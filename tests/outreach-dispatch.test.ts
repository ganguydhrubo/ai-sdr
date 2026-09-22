import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { getDemoStore, resetDemoStore } from '../lib/store/demo-store';
import { approveAndDispatch, dispatchOutboundMessage, effectiveDeliveryMode, flushOutbox, deliverConversationReply } from '../lib/outreach/dispatch';
import { SDROrchestrator } from '../lib/orchestrator/sdr-orchestrator';
import { ComplianceGuard } from '../lib/compliance/guard';

describe('Outbound dispatch (approve → channel provider → receipt)', () => {
  beforeEach(() => resetDemoStore());
  afterEach(() => {
    delete process.env.DEMO_MODE;
    resetDemoStore();
  });

  it('DEMO_MODE forces simulated delivery regardless of the organisation setting', () => {
    process.env.DEMO_MODE = 'true';
    getDemoStore().org.delivery_mode = 'LIVE';
    expect(effectiveDeliveryMode()).toBe('SIMULATED');
    delete process.env.DEMO_MODE;
    expect(effectiveDeliveryMode()).toBe('LIVE');
  });

  it('approving a pending draft sends it (simulated without provider keys), marks the lead CONTACTED and audits it', async () => {
    const store = getDemoStore();
    store.org.delivery_mode = 'SIMULATED';
    const pending = store.messages.find((m) => m.status === 'PENDING_APPROVAL')!;
    const lead = store.findLead(pending.lead_id)!;
    lead.status = 'OUTREACH';

    const result = await approveAndDispatch(pending.id, 'Test Manager');
    expect(result.success).toBe(true);
    expect(result.message.status).toBe('SENT');
    expect(result.message.approved_by).toBe('Test Manager');
    expect(result.receipt.simulated).toBe(true);
    expect(result.receipt.provider).toMatch(/Demo/);
    expect(result.message.attempts).toBe(1);
    expect(lead.status).toBe('CONTACTED');
    expect(store.auditLogs.some((l) => l.action === 'OUTREACH_APPROVED')).toBe(true);
    expect(store.auditLogs.some((l) => l.action === 'OUTREACH_SENT_SIMULATED')).toBe(true);
  });

  it('LIVE_REDIRECT sends to the test inbox and notes the original recipient; without a test inbox it simulates', async () => {
    const store = getDemoStore();
    const lead = store.leads[3];
    store.org.delivery_mode = 'LIVE_REDIRECT';
    store.org.outbound_test_email = 'me@example.in';
    const run = await SDROrchestrator.processLead(lead.id);
    const result = await dispatchOutboundMessage(run.message!.id);
    expect(result.success).toBe(true);
    expect(result.receipt.redirected_to).toBe('me@example.in');

    store.org.outbound_test_email = undefined;
    const run2 = await SDROrchestrator.processLead(store.leads[4].id);
    const result2 = await dispatchOutboundMessage(run2.message!.id);
    expect(result2.success).toBe(true);
    expect(result2.receipt.simulated).toBe(true);
    expect(result2.receipt.provider).toMatch(/no test email/);
  });

  it('refuses to send while the kill switch is engaged and marks the message SUPPRESSED', async () => {
    const store = getDemoStore();
    const pending = store.messages.find((m) => m.status === 'PENDING_APPROVAL')!;
    store.setKillSwitch(true);
    const result = await approveAndDispatch(pending.id);
    expect(result.success).toBe(false);
    expect(result.message.status).toBe('SUPPRESSED');
    expect(result.receipt.error).toMatch(/KILL SWITCH/i);
    store.setKillSwitch(false);
    expect(ComplianceGuard.isEmergencyKillSwitchActive()).toBe(false);
  });

  it('flushOutbox sends every QUEUED message and marks talk links SENT', async () => {
    const store = getDemoStore();
    store.org.delivery_mode = 'SIMULATED';
    const camp = store.campaigns.find((c) => c.id === 'camp_02')!; // SEMI_AUTOMATIC
    const step = store.getCampaignSteps(camp.id).find((s) => s.step_type === 'TALK_INVITE')!;
    const exec = await SDROrchestrator.executeCampaignStep(store.leads[5].id, step.id);
    expect(exec.message?.status).toBe('QUEUED');

    const flush = await flushOutbox();
    expect(flush.sent).toBeGreaterThanOrEqual(1);
    expect(store.messages.find((m) => m.id === exec.message!.id)?.status).toBe('SENT');
    expect(store.talkSessions.find((s) => s.id === exec.message!.talk_session_id)?.status).toBe('SENT');
  });

  it('delivers conversation replies over the thread channel with a receipt on the message', async () => {
    const store = getDemoStore();
    store.org.delivery_mode = 'SIMULATED';
    const conv = store.conversations[0];
    const msg = { id: 'cm_test_reply', conversation_id: conv.id, sender_type: 'HUMAN_REP' as const, content: 'Sure — Thursday works.', created_at: new Date().toISOString() };
    conv.messages.push(msg);
    const receipt = await deliverConversationReply(conv.id, msg.id);
    expect(receipt.error).toBeUndefined();
    expect(receipt.simulated).toBe(true);
    expect(conv.messages.find((m) => m.id === msg.id)?.delivery_status).toBe('SENT');
  });
});
