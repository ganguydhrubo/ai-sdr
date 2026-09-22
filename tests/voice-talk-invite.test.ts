import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { renderTemplate, templateUsesVariable, formatIndianDate } from '../lib/outreach/templates';
import { dispatchTalkInvite } from '../lib/orchestrator/talk-invite';
import { SDROrchestrator } from '../lib/orchestrator/sdr-orchestrator';
import { POST as talkInviteHandler } from '../app/api/voice/talk-invite/route';
import { POST as executeStepHandler } from '../app/api/campaigns/steps/execute/route';
import { getDemoStore } from '../lib/store/demo-store';
import { ComplianceGuard } from '../lib/compliance/guard';
import { resolveTalkToken } from '../lib/voice/talk-links';

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Outreach templates', () => {
  it('renders known variables and reports unresolved ones', () => {
    const r = renderTemplate('Hi {{first_name}} from {{company}} — {{talk_link}} / {{ missing }}', {
      first_name: 'Asha',
      company: 'Pune Gears',
      talk_link: 'https://app.example.test/talk/abc',
    });
    expect(r.text).toBe('Hi Asha from Pune Gears — https://app.example.test/talk/abc / {{ missing }}');
    expect(r.unresolved).toEqual(['missing']);
    expect(templateUsesVariable('x {{ talk_link }} y', 'talk_link')).toBe(true);
    expect(templateUsesVariable('no link here', 'talk_link')).toBe(false);
    expect(formatIndianDate('2026-09-29T10:00:00.000Z')).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });
});

describe('TALK_INVITE campaign step (Phase V6)', () => {
  it('seeds every campaign with exactly one TALK_INVITE step whose template carries {{talk_link}}', () => {
    const store = getDemoStore();
    for (const campaign of store.campaigns) {
      const steps = store.getCampaignSteps(campaign.id);
      expect(steps.length).toBe(campaign.steps_count);
      const talkSteps = steps.filter((s) => s.step_type === 'TALK_INVITE');
      expect(talkSteps, campaign.name).toHaveLength(1);
      expect(templateUsesVariable(talkSteps[0].body_template, 'talk_link')).toBe(true);
    }
  });

  it('mints a personal talk link, renders it into the message and holds it for approval on a MANUAL campaign', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[8];
    const step = store.getCampaignSteps('camp_01').find((s) => s.step_type === 'TALK_INVITE')!;

    const result = await dispatchTalkInvite({ leadId: lead.id, stepId: step.id });
    expect(result.success).toBe(true);
    expect(result.requiresApproval).toBe(true); // camp_01 is MANUAL

    const message = result.message!;
    expect(message.status).toBe('PENDING_APPROVAL');
    expect(message.channel).toBe('EMAIL');
    expect(message.campaign_step_id).toBe(step.id);
    expect(message.talk_session_id).toBe(result.session!.id);
    expect(message.body).toContain(result.talkUrl!);
    expect(message.body).not.toContain('{{');
    expect(message.subject).toContain(lead.first_name);

    // The link resolves to the lead and carries the step's overrides.
    const token = result.talkUrl!.split('/talk/')[1];
    const resolved = await resolveTalkToken(token);
    expect(resolved.session?.lead_id).toBe(lead.id);
    expect(resolved.session?.campaign_step_id).toBe(step.id);
    expect(resolved.session?.max_calls).toBe(step.talk_link_max_calls);
    expect(resolved.session?.status).toBe('CREATED');

    // Approving the message marks the talk link as SENT.
    store.approveMessage(message.id);
    expect(store.getTalkSessions().find((s) => s.id === message.talk_session_id)?.status).toBe('SENT');
  });

  it('queues immediately on a SEMI_AUTOMATIC WhatsApp campaign and marks the link SENT', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[9];
    const step = store.getCampaignSteps('camp_02').find((s) => s.step_type === 'TALK_INVITE')!;

    const result = await SDROrchestrator.executeCampaignStep(lead.id, step.id);
    expect(result.success).toBe(true);
    expect(result.stepType).toBe('TALK_INVITE');
    expect(result.message?.status).toBe('QUEUED');
    expect(result.message?.channel).toBe('WHATSAPP');
    expect(result.message?.body).toContain('/talk/');
    expect(result.message?.body).toContain('Reply STOP to opt out');

    const session = store.getTalkSessions().find((s) => s.id === result.message?.talk_session_id);
    expect(session?.status).toBe('SENT');
    expect(session?.language).toBe('hi');
  });

  it('refuses to mint a link for a suppressed lead', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[10];
    ComplianceGuard.addSuppression({ email: lead.email, phone: lead.phone, reason: 'DO_NOT_CONTACT' });

    const sessionsBefore = store.getTalkSessions().length;
    const result = await dispatchTalkInvite({ leadId: lead.id, channel: 'EMAIL' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/SUPPRESSION/i);
    expect(store.getTalkSessions().length).toBe(sessionsBefore);
  });

  it('rejects a MESSAGE step passed as a talk invite and a template without {{talk_link}}', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[11];
    const messageStep = store.getCampaignSteps('camp_01').find((s) => s.step_type === 'MESSAGE')!;

    const wrongType = await dispatchTalkInvite({ leadId: lead.id, stepId: messageStep.id });
    expect(wrongType.success).toBe(false);
    expect(wrongType.error).toMatch(/not a TALK_INVITE/);

    const talkStep = store.getCampaignSteps('camp_03').find((s) => s.step_type === 'TALK_INVITE')!;
    const original = talkStep.body_template;
    talkStep.body_template = 'Hi {{first_name}}, no link here.';
    const noLink = await dispatchTalkInvite({ leadId: lead.id, stepId: talkStep.id });
    talkStep.body_template = original;
    expect(noLink.success).toBe(false);
    expect(noLink.error).toMatch(/must contain \{\{talk_link\}\}/);
  });

  it('executes a MESSAGE step through the orchestrator with rendered templates', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[1];
    const step = store.getCampaignSteps('camp_02').find((s) => s.step_number === 1)!;

    const result = await SDROrchestrator.executeCampaignStep(lead.id, step.id);
    expect(result.success).toBe(true);
    expect(result.stepType).toBe('MESSAGE');
    expect(result.message?.body).toContain(lead.first_name);
    expect(result.message?.body).not.toContain('{{');
    expect(result.message?.talk_session_id).toBeUndefined();
  });

  it('exposes both entry points over HTTP for n8n', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[2];

    const invite = await talkInviteHandler(
      jsonRequest('http://localhost:3000/api/voice/talk-invite', { lead_id: lead.id, channel: 'WHATSAPP', language: 'en' })
    );
    expect(invite.status).toBe(200);
    const inviteJson = await invite.json();
    expect(inviteJson.talk_url).toContain('/talk/');
    expect(inviteJson.talk_session_id).toBeDefined();

    const step = store.getCampaignSteps('camp_03').find((s) => s.step_type === 'TALK_INVITE')!;
    const exec = await executeStepHandler(
      jsonRequest('http://localhost:3000/api/campaigns/steps/execute', { lead_id: lead.id, step_id: step.id })
    );
    expect(exec.status).toBe(200);
    expect((await exec.json()).step_type).toBe('TALK_INVITE');

    const missing = await executeStepHandler(
      jsonRequest('http://localhost:3000/api/campaigns/steps/execute', { lead_id: lead.id, step_id: 'nope' })
    );
    expect(missing.status).toBe(404);
  });
});
