import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getDemoStore, resetDemoStore } from '../lib/store/demo-store';
import { mintTalkToken, mintTalkNonce } from '../lib/voice/talk-links';
import { completeLocalCall, runTalkAgentTurn } from '../lib/voice/agent';
import { ComplianceGuard } from '../lib/compliance/guard';
import { POST as agentRoute } from '../app/api/talk/[token]/agent/route';
import { POST as eventsRoute } from '../app/api/talk/[token]/events/route';

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

describe('Free in-browser voice agent (offline simulator)', () => {
  beforeEach(() => resetDemoStore());

  it('opens with the AI disclosure and recording notice in the chosen language', async () => {
    const store = getDemoStore();
    const lead = store.leads[0];
    const { session } = await mintTalkToken({ organizationId: store.org.id, leadId: lead.id, leadName: lead.full_name, language: 'en' });
    const en = await runTalkAgentTurn({ session, history: [], userText: null, language: 'en' });
    expect(en.reply).toMatch(/Namaste .*Apex AI SDR/);
    expect(en.reply).toMatch(/not a human/);
    expect(en.reply).toMatch(/recorded and transcribed/);
    expect(en.end_call).toBe(false);

    const hi = await runTalkAgentTurn({ session, history: [], userText: null, language: 'hi' });
    expect(hi.reply).toMatch(/insaan nahi/);
  });

  it('books a meeting when the prospect accepts a slot and records the finished call', async () => {
    const store = getDemoStore();
    const lead = store.leads[2];
    const { session } = await mintTalkToken({ organizationId: store.org.id, leadId: lead.id, leadName: lead.full_name, language: 'en' });
    const greeting = await runTalkAgentTurn({ session, history: [], userText: null });
    const history: Array<{ role: 'agent' | 'user'; text: string }> = [{ role: 'agent', text: greeting.reply }];

    const t1 = await runTalkAgentTurn({ session, history, userText: 'Our reps spend hours on manual follow-ups on WhatsApp.' });
    expect(t1.reply.length).toBeGreaterThan(10);
    history.push({ role: 'user' as const, text: 'Our reps spend hours on manual follow-ups on WhatsApp.' }, { role: 'agent' as const, text: t1.reply });

    const t2 = await runTalkAgentTurn({ session, history, userText: 'Yes, that works — book it.' });
    expect(t2.actions.book_meeting).toBe(true);
    expect(t2.applied.meeting?.meet_url).toMatch(/^https:\/\/meet\.jit\.si\//);
    expect(t2.end_call).toBe(true);
    expect(store.findLead(lead.id)?.status).toBe('MEETING');
    expect(store.meetings.find((m) => m.talk_session_id === session.id)).toBeDefined();

    history.push({ role: 'user' as const, text: 'Yes, that works — book it.' }, { role: 'agent' as const, text: t2.reply });
    const call = await completeLocalCall({ session, transcript: history, durationSeconds: 61, language: 'en' });
    expect(call.provider).toBe('local');
    expect(call.mode).toBe('webrtc');
    expect(call.carrier_cost_estimate_inr).toBe(0);
    expect(call.extracted.meeting_requested).toBe(true);
    expect(call.extracted.meeting_id).toBe(t2.applied.meeting?.id);
    expect(call.transcript).toHaveLength(5); // greeting, user, agent, user, closing
    expect(session.status).toBe('COMPLETED');
  });

  it('honours an opt-out phrase in Hindi instantly: suppressed, link revoked, call ends', async () => {
    const store = getDemoStore();
    const lead = store.leads[6];
    const { session } = await mintTalkToken({ organizationId: store.org.id, leadId: lead.id, leadName: lead.full_name, language: 'hi' });
    const turn = await runTalkAgentTurn({ session, history: [], userText: 'Mujhe call mat karna, nahi chahiye.', language: 'hi' });
    expect(turn.actions.opt_out).toBe(true);
    expect(turn.end_call).toBe(true);
    expect(turn.reply).toMatch(/hata diya/);
    expect(turn.applied.opted_out).toBe(true);
    expect(session.status).toBe('REVOKED');
    expect(store.findLead(lead.id)?.is_suppressed).toBe(true);
    expect(ComplianceGuard.isSuppressed(lead.email, lead.phone).suppressed).toBe(true);
  });

  it('hands off to a human when asked', async () => {
    const store = getDemoStore();
    const lead = store.leads[7];
    const { session } = await mintTalkToken({ organizationId: store.org.id, leadId: lead.id, leadName: lead.full_name });
    const turn = await runTalkAgentTurn({ session, history: [{ role: 'agent', text: 'hello' }], userText: 'Can I speak to a real person please?' });
    expect(turn.actions.handoff).toBe(true);
    expect(turn.applied.task?.title).toMatch(/Voice handoff/);
    expect(store.findLead(lead.id)?.status).toBe('SALES_HANDOFF');
  });

  it('exposes the agent over HTTP with nonce validation and records completed calls via the events route', async () => {
    const store = getDemoStore();
    const lead = store.leads[8];
    const { token, session } = await mintTalkToken({ organizationId: store.org.id, leadId: lead.id, leadName: lead.full_name });
    const { nonce } = await mintTalkNonce(session.id, session.organization_id, lead.id, 300);

    const bad = await agentRoute(jsonRequest(`http://localhost:3000/api/talk/${token}/agent`, { nonce: 'nonce_bogus', history: [], user_text: null }), { params: { token } });
    expect(bad.status).toBe(403);

    const ok = await agentRoute(jsonRequest(`http://localhost:3000/api/talk/${token}/agent`, { nonce, history: [], user_text: null, language: 'en' }), { params: { token } });
    expect(ok.status).toBe(200);
    const json = await ok.json();
    expect(json.reply).toMatch(/Apex AI SDR/);

    const started = await eventsRoute(jsonRequest(`http://localhost:3000/api/talk/${token}/events`, { event: 'call_started' }), { params: { token } });
    expect(started.status).toBe(200);
    expect(session.call_count).toBe(1);

    const completed = await eventsRoute(
      jsonRequest(`http://localhost:3000/api/talk/${token}/events`, {
        event: 'call_completed',
        durationSeconds: 42,
        language: 'en',
        transcript: [
          { role: 'agent', text: json.reply },
          { role: 'user', text: 'Not now, email me a summary.' },
        ],
      }),
      { params: { token } }
    );
    expect(completed.status).toBe(200);
    const body = await completed.json();
    expect(body.call_id).toMatch(/^vc_local_/);
    expect(session.status).toBe('COMPLETED');
    expect(store.voiceCalls.find((c) => c.id === body.call_id)?.duration_seconds).toBe(42);
  });
});
