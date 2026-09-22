import { describe, it, expect } from 'vitest';
import { POST as preCallHandler } from '../app/api/voice/tools/pre-call/route';
import { POST as productKnowledgeHandler } from '../app/api/voice/tools/product-knowledge/route';
import { POST as availabilityHandler } from '../app/api/voice/tools/availability/route';
import { POST as bookMeetingHandler } from '../app/api/voice/tools/book-meeting/route';
import { POST as handoffHandler } from '../app/api/voice/tools/handoff/route';
import { POST as optOutHandler } from '../app/api/voice/tools/opt-out/route';
import { NextRequest } from 'next/server';
import { mintTalkNonce } from '../lib/voice/talk-links';
import { getDemoStore } from '../lib/store/demo-store';
import { ComplianceGuard } from '../lib/compliance/guard';

function createMockRequest(body: any, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/voice/tools', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('In-Call Voice Agent Tools (Phase V5)', () => {
  it('pre-call endpoint should return verified facts and context from talk_ref nonce', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[0];
    const session = store.getTalkSessions()[0];

    const { nonce } = await mintTalkNonce(session.id, session.organization_id, lead.id, 300);

    const req = createMockRequest({
      event: 'call_inbound',
      initial_context: {
        talk_ref: nonce,
      },
    });

    const res = await preCallHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.initial_context).toBeDefined();
    expect(json.initial_context.first_name).toBe(lead.first_name);
    expect(json.initial_context.company).toBe(lead.company_name);
    expect(json.initial_context.verified_research_facts.length).toBeGreaterThan(0);
  });

  it('product-knowledge tool should return grounded answers for B2B pricing and integrations', async () => {
    const req = createMockRequest({
      query: 'What is your commercial pricing for Indian enterprises?',
    });

    const res = await productKnowledgeHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.answer).toContain('INR');
    expect(json.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('availability tool should return valid Indian business hours slots', async () => {
    const req = createMockRequest({ days_ahead: 5 });

    const res = await availabilityHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.available_slots).toBeDefined();
    expect(json.available_slots.length).toBeGreaterThan(0);
    expect(json.timezone).toBe('Asia/Kolkata');
  });

  it('book-meeting tool should create a confirmed meeting and update lead status', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[1];
    const session = store.getTalkSessions()[1];
    const { nonce } = await mintTalkNonce(session.id, session.organization_id, lead.id, 300);

    const targetSlot = '2026-09-24T15:00:00+05:30';
    const req = createMockRequest({
      selected_slot: targetSlot,
      topic: 'Apex AI Platform Discovery Demo',
      talk_ref: nonce,
    });

    const res = await bookMeetingHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.meeting_id).toBeDefined();
    expect(json.meet_link).toMatch(/^https:\/\/meet\.jit\.si\/ApexSDR-/); // free Jitsi room, no account needed
    expect(lead.status).toBe('MEETING');
  });

  it('handoff tool should queue a high-priority SDR task and flag human attention', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[2];
    const session = store.getTalkSessions()[2];
    const { nonce } = await mintTalkNonce(session.id, session.organization_id, lead.id, 300);

    const req = createMockRequest({
      urgency: 'HIGH',
      reason: 'Prospect has multi-locational deployment questions',
      talk_ref: nonce,
    });

    const res = await handoffHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe('QUEUED');
    expect(lead.requires_human_attention).toBe(true);
    expect(lead.status).toBe('SALES_HANDOFF');
  });

  it('opt-out tool should immediately suppress the lead and revoke session', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[3];
    const session = store.getTalkSessions()[3];
    const { nonce } = await mintTalkNonce(session.id, session.organization_id, lead.id, 300);

    const req = createMockRequest({
      reason: 'Prospect requested DO NOT CALL',
      talk_ref: nonce,
    });

    const res = await optOutHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.suppressed).toBe(true);
    expect(lead.is_suppressed).toBe(true);

    const suppressedCheck = ComplianceGuard.isSuppressed(lead.email, lead.phone);
    expect(suppressedCheck.suppressed).toBe(true);
  });
});
