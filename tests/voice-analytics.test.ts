import { describe, it, expect } from 'vitest';
import { computeVoiceAnalytics, formatDuration } from '../lib/voice/analytics';
import { GET as getAnalytics } from '../app/api/voice/analytics/route';
import { getDemoStore } from '../lib/store/demo-store';
import { TalkSession, VoiceCall } from '../lib/types';

describe('Voice analytics (Phase V10)', () => {
  it('computes link, call, meeting and cost metrics from sessions and calls', () => {
    const sessions: TalkSession[] = [
      { id: 's1', organization_id: 'o', lead_id: 'l1', channel: 'email', token_hash: 'h1', status: 'SENT', expires_at: 'x', max_calls: 3, call_count: 0, language: 'en', created_at: 'c', sent_at: 't' },
      { id: 's2', organization_id: 'o', lead_id: 'l2', channel: 'email', token_hash: 'h2', status: 'OPENED', expires_at: 'x', max_calls: 3, call_count: 0, language: 'en', created_at: 'c', sent_at: 't', opened_at: 't' },
      { id: 's3', organization_id: 'o', lead_id: 'l3', channel: 'whatsapp', token_hash: 'h3', status: 'COMPLETED', expires_at: 'x', max_calls: 3, call_count: 1, language: 'hi', created_at: 'c', sent_at: 't', opened_at: 't' },
      { id: 's4', organization_id: 'o', lead_id: 'l4', channel: 'email', token_hash: 'h4', status: 'CREATED', expires_at: 'x', max_calls: 3, call_count: 0, language: 'en', created_at: 'c' },
    ];
    const base: Omit<VoiceCall, 'id' | 'mode' | 'status' | 'duration_seconds' | 'extracted' | 'carrier_cost_estimate_inr'> = {
      organization_id: 'o', lead_id: 'l', provider: 'demo', transcript: [], disclosure_given: true, consent_transcript: true, created_at: 'c',
    };
    const calls: VoiceCall[] = [
      { ...base, id: 'c1', mode: 'webrtc', status: 'COMPLETED', duration_seconds: 120, extracted: { meeting_requested: true, meeting_id: 'm1' }, carrier_cost_estimate_inr: 0 },
      { ...base, id: 'c2', mode: 'webrtc', status: 'COMPLETED', duration_seconds: 60, extracted: { handoff_requested: true }, carrier_cost_estimate_inr: 0 },
      { ...base, id: 'c3', mode: 'pstn', status: 'COMPLETED', duration_seconds: 180, extracted: { opt_out: true }, carrier_cost_estimate_inr: 1.25 },
      { ...base, id: 'c4', mode: 'pstn', status: 'NO_ANSWER', duration_seconds: 0, extracted: {}, carrier_cost_estimate_inr: 0.85 },
      { ...base, id: 'c5', mode: 'pstn', status: 'BLOCKED', duration_seconds: 0, extracted: {}, carrier_cost_estimate_inr: 0 },
    ];

    const a = computeVoiceAnalytics(sessions, calls, new Date('2026-09-22T10:00:00Z'));
    expect(a.talk_links_sent).toBe(3);
    expect(a.talk_links_opened).toBe(2);
    expect(a.open_rate_pct).toBe(66.7);
    expect(a.calls_started).toBe(4); // BLOCKED is not a started call
    expect(a.calls_completed).toBe(3);
    expect(a.completion_rate_pct).toBe(75);
    expect(a.avg_duration_seconds).toBe(120);
    expect(a.meetings_from_voice).toBe(1);
    expect(a.handoffs_from_voice).toBe(1);
    expect(a.opt_outs_from_voice).toBe(1);
    expect(a.webrtc_calls).toBe(2);
    expect(a.pstn_calls).toBe(3);
    expect(a.carrier_cost_inr).toBe(2.1);
    expect(a.computed_at).toBe('2026-09-22T10:00:00.000Z');
  });

  it('handles an empty organisation without dividing by zero', () => {
    const a = computeVoiceAnalytics([], []);
    expect(a.open_rate_pct).toBe(0);
    expect(a.completion_rate_pct).toBe(0);
    expect(a.avg_duration_seconds).toBe(0);
    expect(a.carrier_cost_inr).toBe(0);
  });

  it('formats durations for the dashboard card', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 05s');
  });

  it('serves the seeded demo metrics over the API', async () => {
    const store = getDemoStore();
    const res = await getAnalytics();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.calls_completed).toBe(store.getVoiceCalls().filter((c) => c.status === 'COMPLETED').length);
    expect(json.talk_links_sent).toBeGreaterThan(0);
    expect(json.meetings_from_voice).toBeGreaterThanOrEqual(0);
  });
});
