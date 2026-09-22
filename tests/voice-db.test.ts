import { describe, it, expect } from 'vitest';
import { getDemoStore } from '../lib/store/demo-store';

describe('Phase 8 Database & Voice Models Test Suite', () => {
  const store = getDemoStore();

  it('should initialize demo voice settings with default compliance parameters', () => {
    expect(store.voiceSettings).toBeDefined();
    expect(store.voiceSettings.voice_enabled).toBe(true);
    expect(store.voiceSettings.web_voice_enabled).toBe(true);
    expect(store.voiceSettings.pstn_enabled).toBe(false); // Hard-disabled by default
    expect(store.voiceSettings.calling_window_start).toBe('09:00');
    expect(store.voiceSettings.calling_window_end).toBe('21:00');
    expect(store.voiceSettings.timezone).toBe('Asia/Kolkata');
    expect(store.voiceSettings.caller_id_series).toBe('140');
  });

  it('should seed 10 talk sessions covering all required lifecycle statuses', () => {
    expect(store.talkSessions.length).toBeGreaterThanOrEqual(10);
    const statuses = store.talkSessions.map((ts) => ts.status);
    expect(statuses).toContain('CREATED');
    expect(statuses).toContain('SENT');
    expect(statuses).toContain('OPENED');
    expect(statuses).toContain('CALL_STARTED');
    expect(statuses).toContain('COMPLETED');
    expect(statuses).toContain('EXPIRED');
    expect(statuses).toContain('REVOKED');
  });

  it('should seed 5 completed voice calls with realistic transcripts and extractions', () => {
    expect(store.voiceCalls.length).toBeGreaterThanOrEqual(5);
    const call1 = store.voiceCalls.find((vc) => vc.id === 'vc_01');
    expect(call1).toBeDefined();
    expect(call1?.mode).toBe('webrtc');
    expect(call1?.status).toBe('COMPLETED');
    expect(call1?.carrier_cost_estimate_inr).toBe(0.0); // Zero carrier cost for WebRTC
    expect(call1?.transcript.length).toBeGreaterThan(0);
    expect(call1?.extracted.intent).toBe('REQUEST_DEMO');
    expect(call1?.extracted.meeting_requested).toBe(true);

    const call4 = store.voiceCalls.find((vc) => vc.id === 'vc_04');
    expect(call4).toBeDefined();
    expect(call4?.mode).toBe('pstn');
    expect(call4?.carrier_cost_estimate_inr).toBeGreaterThan(0); // PSTN incurs carrier charges
  });

  it('should uphold tenant isolation across talk sessions and voice calls', () => {
    const orgId = store.org.id;
    store.talkSessions.forEach((ts) => {
      expect(ts.organization_id).toBe(orgId);
    });
    store.voiceCalls.forEach((vc) => {
      expect(vc.organization_id).toBe(orgId);
    });
  });

  it('should allow updating talk sessions and recording new voice calls', () => {
    const newSession = store.addTalkSession({
      lead_id: store.leads[0].id,
      channel: 'email',
      token_hash: 'test_token_hash_999',
      status: 'SENT',
    });
    expect(newSession.id).toBeDefined();
    expect(newSession.token_hash).toBe('test_token_hash_999');

    const updated = store.updateTalkSession(newSession.id, { status: 'OPENED' });
    expect(updated?.status).toBe('OPENED');

    const newCall = store.recordVoiceCall({
      lead_id: store.leads[0].id,
      mode: 'webrtc',
      duration_seconds: 120,
      status: 'COMPLETED',
      intent: 'INTERESTED',
    });
    expect(newCall.id).toBeDefined();
    expect(newCall.duration_seconds).toBe(120);
    expect(newCall.intent).toBe('INTERESTED');
  });
});
