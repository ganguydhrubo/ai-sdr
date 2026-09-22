import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getDemoStore, resetDemoStore } from '../lib/store/demo-store';
import { ComplianceGuard } from '../lib/compliance/guard';
import { GET as getState } from '../app/api/state/route';
import { POST as resetState } from '../app/api/state/reset/route';
import { POST as createLead } from '../app/api/leads/route';
import { PATCH as patchLead } from '../app/api/leads/[id]/route';
import { POST as processLead } from '../app/api/leads/[id]/process/route';
import { POST as replyLead } from '../app/api/leads/[id]/reply/route';
import { POST as bookForLead } from '../app/api/leads/[id]/meeting/route';
import { POST as briefLead } from '../app/api/leads/[id]/brief/route';
import { POST as importLeads } from '../app/api/leads/import/route';
import { POST as approveMessage } from '../app/api/messages/[id]/approve/route';
import { POST as rejectMessage } from '../app/api/messages/[id]/reject/route';
import { POST as killSwitch } from '../app/api/settings/kill-switch/route';
import { PUT as putSettings } from '../app/api/settings/route';
import { POST as addSuppression, DELETE as removeSuppression } from '../app/api/settings/suppression/route';
import { POST as createCampaign } from '../app/api/campaigns/route';
import { PATCH as patchCampaign } from '../app/api/campaigns/[id]/route';
import { POST as enrollCampaign } from '../app/api/campaigns/[id]/enroll/route';
import { POST as createTask } from '../app/api/tasks/route';
import { PATCH as patchTask } from '../app/api/tasks/[id]/route';
import { GET as meetingIcs } from '../app/api/meetings/[id]/ics/route';
import { POST as sendDraft } from '../app/api/conversations/[id]/send/route';
import { POST as dial } from '../app/api/voice/dial/route';
import { POST as mintTalkLink } from '../app/api/voice/talk-links/route';
import { PUT as putWhatsAppSettings } from '../app/api/whatsapp/settings/route';

function req(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}
const p = (id: string) => ({ params: { id } });

describe('Admin API — the UI talks only to these routes', () => {
  beforeEach(() => {
    resetDemoStore();
    getDemoStore().org.delivery_mode = 'SIMULATED';
  });

  it('GET /api/state returns the whole snapshot with computed stats and integration health', async () => {
    const res = await getState();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.leads.length).toBeGreaterThan(10);
    expect(json.stats.totalLeads).toBe(json.leads.length);
    expect(json.stats.pendingApprovals).toBe(1);
    expect(json.voiceAnalytics.calls_completed).toBeGreaterThanOrEqual(5);
    expect(json.integrations.ai.live).toBe(false);
    expect(json.integrations.persistence.enabled).toBe(false);
    expect(json.suppressionList.length).toBe(3);
    expect(json.callingWindow.timeString).toMatch(/IST/);
  });

  it('lead lifecycle: create (+agent) → approve draft → simulate reply → send AI draft → book meeting → brief', async () => {
    const store = getDemoStore();
    const created = await createLead(req('POST', 'http://localhost/api/leads', { name: 'Kiran Desai', company: 'Desai Fasteners Pvt Ltd', phone: '9811001100', email: 'kiran@desaifast.in', run: true }));
    expect(created.status).toBe(200);
    const { lead, run } = await created.json();
    expect(run.success).toBe(true);
    expect(lead.normalized_phone).toBe('+919811001100');

    const dup = await createLead(req('POST', 'http://localhost/api/leads', { name: 'Kiran Again', company: 'Other', email: 'kiran@desaifast.in' }));
    expect(dup.status).toBe(400);

    const draft = store.messages.find((m) => m.lead_id === lead.id && m.status === 'PENDING_APPROVAL')!;
    const approved = await approveMessage(req('POST', `http://localhost/api/messages/${draft.id}/approve`, { approver: 'QA' }), p(draft.id));
    const approvedJson = await approved.json();
    expect(approvedJson.sent).toBe(true);
    expect(approvedJson.delivery.simulated).toBe(true);
    expect(store.findLead(lead.id)?.status).toBe('CONTACTED');

    const reply = await replyLead(req('POST', `http://localhost/api/leads/${lead.id}/reply`, { text: 'Yes, interested — send pricing and lets book a demo.', channel: 'EMAIL' }), p(lead.id));
    const replyJson = await reply.json();
    expect(['INTERESTED', 'REQUEST_PRICING', 'REQUEST_DEMO']).toContain(replyJson.intent);
    expect(replyJson.handoff_triggered).toBe(true);
    expect(replyJson.ai_reply).toBeTruthy();
    expect(replyJson.delivery).toBeUndefined(); // autonomous replies are off → draft only
    const conv = store.conversations.find((c) => c.lead_id === lead.id)!;
    expect(conv.messages.find((m) => m.id === replyJson.ai_reply_message_id)?.delivery_status).toBe('DRAFT');
    expect(store.messages.find((m) => m.id === draft.id)?.status).toBe('REPLIED');

    const sent = await sendDraft(req('POST', `http://localhost/api/conversations/${conv.id}/send`, { message_id: replyJson.ai_reply_message_id }), p(conv.id));
    expect((await sent.json()).delivery.simulated).toBe(true);

    const booked = await bookForLead(req('POST', `http://localhost/api/leads/${lead.id}/meeting`, { send_invite: true }), p(lead.id));
    const bookedJson = await booked.json();
    expect(bookedJson.meeting.meet_url).toMatch(/^https:\/\/meet\.jit\.si\//);
    expect(bookedJson.meeting.sales_brief).toBeDefined();
    expect(bookedJson.invite.simulated).toBe(true);
    expect(store.findLead(lead.id)?.status).toBe('MEETING');

    const ics = await meetingIcs(req('GET', `http://localhost/api/meetings/${bookedJson.meeting.id}/ics`), p(bookedJson.meeting.id));
    expect(ics.headers.get('content-type')).toMatch(/text\/calendar/);
    expect(await ics.text()).toMatch(/BEGIN:VEVENT/);

    const brief = await briefLead(req('POST', `http://localhost/api/leads/${lead.id}/brief`), p(lead.id));
    expect((await brief.json()).brief.recommended_questions.length).toBeGreaterThan(0);
  });

  it('reject, status change and suppression from the lead route', async () => {
    const store = getDemoStore();
    const pending = store.messages.find((m) => m.status === 'PENDING_APPROVAL')!;
    const rejected = await rejectMessage(req('POST', `http://localhost/api/messages/${pending.id}/reject`, { reason: 'Tone' }), p(pending.id));
    expect((await rejected.json()).message.status).toBe('CANCELLED');

    const lead = store.leads[1];
    const moved = await patchLead(req('PATCH', `http://localhost/api/leads/${lead.id}`, { status: 'WON' }), p(lead.id));
    expect((await moved.json()).lead.status).toBe('WON');
    const bad = await patchLead(req('PATCH', `http://localhost/api/leads/${lead.id}`, { status: 'BANANA' }), p(lead.id));
    expect(bad.status).toBe(400);

    await patchLead(req('PATCH', `http://localhost/api/leads/${lead.id}`, { suppress: true }), p(lead.id));
    expect(store.findLead(lead.id)?.is_suppressed).toBe(true);
    expect(ComplianceGuard.isSuppressed(lead.email).suppressed).toBe(true);
    await patchLead(req('PATCH', `http://localhost/api/leads/${lead.id}`, { suppress: false }), p(lead.id));
    expect(ComplianceGuard.isSuppressed(lead.email).suppressed).toBe(false);
  });

  it('kill switch, ICP weights validation and the suppression registry', async () => {
    const store = getDemoStore();
    const on = await killSwitch(req('POST', 'http://localhost/api/settings/kill-switch', { active: true }));
    expect((await on.json()).active).toBe(true);
    expect(ComplianceGuard.isEmergencyKillSwitchActive()).toBe(true);
    const pending = store.messages.find((m) => m.status === 'PENDING_APPROVAL')!;
    const blocked = await approveMessage(req('POST', `http://localhost/api/messages/${pending.id}/approve`), p(pending.id));
    expect((await blocked.json()).sent).toBe(false);
    await killSwitch(req('POST', 'http://localhost/api/settings/kill-switch', { active: false }));

    const badWeights = await putSettings(req('PUT', 'http://localhost/api/settings', { icp: { weight_industry: 10 } }));
    expect(badWeights.status).toBe(400);
    const goodWeights = await putSettings(req('PUT', 'http://localhost/api/settings', { icp: { weight_industry: 25, weight_company_size: 15, weight_role_seniority: 20, weight_geography: 10, weight_tech_fit: 10, weight_business_signals: 10, weight_contact_quality: 10, minimum_qualifying_score: 65 }, delivery_mode: 'LIVE_REDIRECT', outbound_test_email: 'qa@example.in' }));
    expect(goodWeights.status).toBe(200);
    expect(store.icp.weight_industry).toBe(25);
    expect(store.icp.minimum_qualifying_score).toBe(65);
    expect(store.org.delivery_mode).toBe('LIVE_REDIRECT');
    expect(store.org.outbound_test_email).toBe('qa@example.in');

    const added = await addSuppression(req('POST', 'http://localhost/api/settings/suppression', { identifier: store.leads[2].email }));
    expect(added.status).toBe(200);
    expect(store.leads[2].is_suppressed).toBe(true);
    const invalid = await addSuppression(req('POST', 'http://localhost/api/settings/suppression', { identifier: '???' }));
    expect(invalid.status).toBe(400);
    const removed = await removeSuppression(req('DELETE', 'http://localhost/api/settings/suppression', { identifier: store.leads[2].email }));
    expect((await removed.json()).removed).toBe(1);
    expect(store.leads[2].is_suppressed).toBe(false);
  });

  it('campaigns: create with a default sequence, change mode, pause, enrol leads', async () => {
    const store = getDemoStore();
    const created = await createCampaign(req('POST', 'http://localhost/api/campaigns', { name: 'QA Pune Suppliers', primary_channel: 'WHATSAPP', approval_mode: 'SEMI_AUTOMATIC' }));
    expect(created.status).toBe(200);
    const { campaign, steps } = await created.json();
    expect(steps).toHaveLength(4);
    expect(steps.some((s: { step_type: string }) => s.step_type === 'TALK_INVITE')).toBe(true);
    const dupName = await createCampaign(req('POST', 'http://localhost/api/campaigns', { name: 'qa pune suppliers' }));
    expect(dupName.status, JSON.stringify(await dupName.clone().json())).toBe(400);

    const enrolled = await enrollCampaign(req('POST', `http://localhost/api/campaigns/${campaign.id}/enroll`, { lead_ids: [store.leads[0].id, store.leads[1].id] }), p(campaign.id));
    const enrolledJson = await enrolled.json();
    expect(enrolledJson.enrolled).toHaveLength(2);
    expect(enrolledJson.queued + enrolledJson.drafted).toBe(2);
    expect(enrolledJson.sent).toBe(2); // SEMI_AUTOMATIC → sent right away (simulated)
    expect(store.campaigns.find((c) => c.id === campaign.id)?.leads_count).toBe(2);

    const paused = await patchCampaign(req('PATCH', `http://localhost/api/campaigns/${campaign.id}`, { status: 'PAUSED', approval_mode: 'MANUAL' }), p(campaign.id));
    expect((await paused.json()).campaign.status).toBe('PAUSED');
    const refused = await enrollCampaign(req('POST', `http://localhost/api/campaigns/${campaign.id}/enroll`, { lead_ids: [store.leads[2].id] }), p(campaign.id));
    expect(refused.status).toBe(400);
  });

  it('tasks, WhatsApp anti-ban settings, PSTN dial gate, talk-link minting, CSV import and reset', async () => {
    const store = getDemoStore();
    const task = await createTask(req('POST', 'http://localhost/api/tasks', { title: 'Call Kiran', priority: 'HIGH', lead_id: store.leads[0].id }));
    const { task: t } = await task.json();
    expect(t.lead_name).toBe(store.leads[0].full_name);
    const done = await patchTask(req('PATCH', `http://localhost/api/tasks/${t.id}`, { status: 'COMPLETED' }), p(t.id));
    expect((await done.json()).task.completed_at).toBeTruthy();

    const wa = await putWhatsAppSettings(req('PUT', 'http://localhost/api/whatsapp/settings', { minDelaySeconds: 20, maxDelaySeconds: 10, dailyLimit: 30 }));
    const waJson = await wa.json();
    expect(waJson.antiBan.maxDelaySeconds).toBeGreaterThanOrEqual(20);
    expect(store.whatsappAntiBan.dailyLimit).toBe(30);

    const blocked = await dial(req('POST', 'http://localhost/api/voice/dial', { lead_id: store.leads[0].id }));
    expect(blocked.status).toBe(422);
    const blockedJson = await blocked.json();
    expect(blockedJson.violations.join(' ')).toMatch(/PSTN outbound calling is disabled/);
    expect(store.voiceCalls[0].status).toBe('BLOCKED');

    const manual = await mintTalkLink(req('POST', 'http://localhost/api/voice/talk-links', { lead_id: store.leads[3].id, channel: 'MANUAL' }));
    const manualJson = await manual.json();
    expect(manualJson.talk_url).toContain('/talk/');
    expect(store.getTalkSession(manualJson.session.id)?.channel).toBe('manual');
    const suppressed = store.leads[4];
    suppressed.is_suppressed = true;
    const refused = await mintTalkLink(req('POST', 'http://localhost/api/voice/talk-links', { lead_id: suppressed.id, channel: 'EMAIL' }));
    expect(refused.status).toBe(422);

    const imported = await importLeads(req('POST', 'http://localhost/api/leads/import', { sample: true }));
    expect((await imported.json()).summary.created).toBe(5);

    const reset = await resetState();
    expect(reset.status).toBe(200);
    expect(getDemoStore().leads.length).toBe(12);
  });
});
