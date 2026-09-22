import { describe, it, expect } from 'vitest';
import { getDemoStore } from '../lib/store/demo-store';
import { SDROrchestrator } from '../lib/orchestrator/sdr-orchestrator';

describe('13-Agent SDR Orchestrator Workflow', () => {
  it('should successfully ingest, score, personalize and queue outreach for a valid lead', async () => {
    const store = getDemoStore();
    const lead = store.addLead({
      first_name: 'Tarun',
      last_name: 'Mehta',
      company_name: 'Aether Cloud Systems Pvt Ltd',
      phone: '+919811998877',
      email: 'tarun.mehta@aethercloud.in',
      job_title: 'Chief Revenue Officer',
      city: 'Bengaluru',
      state: 'Karnataka',
    });

    const result = await SDROrchestrator.processLead(lead.id);

    expect(result.success).toBe(true);
    expect(result.lead.score).toBeDefined();
    expect(result.lead.score?.score).toBeGreaterThan(0);
    expect(result.message).toBeDefined();
    expect(result.message?.status).toBe('PENDING_APPROVAL');
    expect(result.stepsTaken).toContain('RESEARCH_AGENT_EXECUTION');
    expect(result.stepsTaken).toContain('ICP_SCORING_AGENT');
    expect(result.stepsTaken).toContain('PERSONALIZATION_AGENT');
    expect(result.stepsTaken).toContain('COMPLIANCE_GUARD_VERIFICATION');
  });

  it('should classify positive buying intent and trigger sales handoff task', async () => {
    const store = getDemoStore();
    const lead = store.leads[0];

    const replyResult = await SDROrchestrator.handleInboundReply({
      leadId: lead.id,
      channel: 'EMAIL',
      messageText: 'Yes, this looks very promising. Please send the pricing tier and let us book a demo this week.',
    });

    expect(['INTERESTED', 'REQUEST_PRICING', 'REQUEST_DEMO']).toContain(replyResult.intent);
    expect(replyResult.handoffTriggered).toBe(true);
    expect(lead.status).toBe('ENGAGED');
    expect(lead.requires_human_attention).toBe(true);

    // Verify task was created for human AE
    const task = store.tasks.find((t) => t.lead_id === lead.id);
    expect(task).toBeDefined();
    expect(task?.priority).toBe('URGENT');
  });

  it('should process unsubscribe intent and permanently suppress prospect', async () => {
    const store = getDemoStore();
    const lead = store.addLead({
      first_name: 'Anupam',
      last_name: 'Mishra',
      company_name: 'Mishra Traders Ltd',
      phone: '+919855443322',
      email: 'anupam@mishratraders.in',
    });

    const replyResult = await SDROrchestrator.handleInboundReply({
      leadId: lead.id,
      channel: 'EMAIL',
      messageText: 'Please unsubscribe me and remove my email from your database.',
    });

    expect(replyResult.intent).toBe('UNSUBSCRIBE');
    expect(lead.status).toBe('DISQUALIFIED');
  });
});
