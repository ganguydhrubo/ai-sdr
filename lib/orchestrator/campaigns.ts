import { getDemoStore } from '../store/demo-store';
import { SDROrchestrator } from './sdr-orchestrator';
import { flushOutbox } from '../outreach/dispatch';
import type { ApprovalMode, Campaign, CampaignStatus, CampaignStep, Channel } from '../types';

export interface CreateCampaignInput {
  name: string;
  description?: string;
  target_persona?: string;
  target_industry?: string;
  approval_mode?: ApprovalMode;
  primary_channel?: 'EMAIL' | 'WHATSAPP';
  daily_lead_limit?: number;
  include_talk_invite?: boolean;
}

/** Default 4-touch sequence for a new campaign: opener → follow-up → talk link → polite close. */
export function buildDefaultSteps(campaignId: string, primary: 'EMAIL' | 'WHATSAPP', includeTalkInvite: boolean): CampaignStep[] {
  const secondary: Channel = primary === 'EMAIL' ? 'WHATSAPP' : 'EMAIL';
  const steps: CampaignStep[] = [
    primary === 'EMAIL'
      ? {
          id: `${campaignId}_s1`,
          campaign_id: campaignId,
          step_number: 1,
          step_type: 'MESSAGE',
          channel: 'EMAIL',
          delay_days: 0,
          is_active: true,
          name: 'Personalised opener',
          description: 'Consultative introduction referencing verified account signals.',
          subject_template: 'Accelerating sales pipeline velocity at {{company}}',
          body_template:
            'Hi {{first_name}},\n\nGiven your role at {{company}}, I wanted to share how teams in {{city}} are automating prospecting without adding headcount.\n\nWould you be open to a 15-minute call this week?\n\nBest regards,\n{{sender_name}}\n{{org_name}}\n\nTo opt out of future emails, reply with unsubscribe.',
        }
      : {
          id: `${campaignId}_s1`,
          campaign_id: campaignId,
          step_number: 1,
          step_type: 'MESSAGE',
          channel: 'WHATSAPP',
          delay_days: 0,
          is_active: true,
          name: 'WhatsApp opener',
          description: 'Consent-aware WhatsApp opener sent through the self-hosted Baileys channel.',
          whatsapp_template_name: 'apex_opener_v1',
          body_template:
            'Namaste {{first_name}} ji, {{sender_name}} from {{org_name}}. We help teams like {{company}} keep their sales pipeline moving with an AI SDR. Open to a short chat this week? Reply STOP to opt out.',
        },
    secondary === 'WHATSAPP'
      ? {
          id: `${campaignId}_s2`,
          campaign_id: campaignId,
          step_number: 2,
          step_type: 'MESSAGE',
          channel: 'WHATSAPP',
          delay_days: 2,
          is_active: true,
          name: 'WhatsApp follow-up',
          description: 'Short nudge referencing the email, Hinglish-friendly.',
          whatsapp_template_name: 'apex_followup_v1',
          body_template:
            'Namaste {{first_name}} ji, {{sender_name}} from {{org_name}} here. Sent you a short note on automating outbound for {{company}}. Would a 2-page brief help? Reply STOP to opt out.',
        }
      : {
          id: `${campaignId}_s2`,
          campaign_id: campaignId,
          step_number: 2,
          step_type: 'MESSAGE',
          channel: 'EMAIL',
          delay_days: 2,
          is_active: true,
          name: 'Email follow-up',
          description: 'Email with a short brief, following the WhatsApp opener.',
          subject_template: 'A 2-page brief for {{company}}',
          body_template:
            'Hi {{first_name}},\n\nAs mentioned on WhatsApp, here is a short brief on how sales teams run outbound with an AI SDR.\n\n{{sender_name}}\n{{org_name}}\n\nTo opt out, reply with unsubscribe.',
        },
  ];

  if (includeTalkInvite) {
    steps.push(
      primary === 'EMAIL'
        ? {
            id: `${campaignId}_s3`,
            campaign_id: campaignId,
            step_number: 3,
            step_type: 'TALK_INVITE',
            channel: 'EMAIL',
            delay_days: 4,
            is_active: true,
            name: 'Talk to our AI link',
            description: 'Personal WebRTC talk link — the prospect speaks to the AI SDR from the browser, ₹0 carrier cost.',
            talk_link_language: 'en',
            talk_link_expires_in_days: 7,
            talk_link_max_calls: 3,
            subject_template: "{{first_name}}, talk to {{org_name}}'s AI for 2 minutes",
            body_template:
              'Hi {{first_name}},\n\nHere is a personal link where you can ask our AI sales assistant anything about {{org_name}} by voice, straight from your browser:\n\n{{talk_link}}\n\nIt is private to you and works until {{talk_link_expires}}.\n\nBest regards,\n{{sender_name}}\n\nTo opt out of future emails, reply with unsubscribe.',
          }
        : {
            id: `${campaignId}_s3`,
            campaign_id: campaignId,
            step_number: 3,
            step_type: 'TALK_INVITE',
            channel: 'WHATSAPP',
            delay_days: 4,
            is_active: true,
            name: 'Talk to our AI (WhatsApp)',
            description: 'Personal talk link sent on WhatsApp — Hindi/Hinglish capable voice agent, ₹0 carrier cost.',
            talk_link_language: 'hi',
            talk_link_expires_in_days: 5,
            talk_link_max_calls: 3,
            body_template:
              '{{first_name}} ji, 2 minute baat kar lijiye hamare AI assistant se, seedha browser se: {{talk_link}} (link {{talk_link_expires}} tak valid hai, sirf aapke liye). Reply STOP to opt out.',
          }
    );
  }

  steps.push({
    id: `${campaignId}_s${steps.length + 1}`,
    campaign_id: campaignId,
    step_number: steps.length + 1,
    step_type: 'MESSAGE',
    channel: 'EMAIL',
    delay_days: 10,
    is_active: true,
    name: 'Polite breakup',
    description: 'Closes the sequence politely and leaves the door open.',
    subject_template: 'Closing the loop, {{first_name}}',
    body_template:
      'Hi {{first_name}},\n\nI will stop here so as not to crowd your inbox. If outbound automation becomes a priority at {{company}}, this thread is the fastest way back to us.\n\n{{sender_name}}\n{{org_name}}\n\nTo opt out, reply with unsubscribe.',
  });

  return steps;
}

export function createCampaign(input: CreateCampaignInput): { campaign: Campaign; steps: CampaignStep[] } {
  const store = getDemoStore();
  const name = input.name.trim();
  if (!name) throw new Error('Campaign name is required');
  if (store.campaigns.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`A campaign named "${name}" already exists`);
  }
  const id = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const primary = input.primary_channel || 'EMAIL';
  const steps = buildDefaultSteps(id, primary, input.include_talk_invite ?? true);
  const campaign: Campaign = {
    id,
    organization_id: store.org.id,
    name,
    description: input.description?.trim() || `Multi-channel ${primary === 'EMAIL' ? 'email-led' : 'WhatsApp-first'} sequence.`,
    status: 'ACTIVE',
    approval_mode: input.approval_mode || 'MANUAL',
    target_persona: input.target_persona?.trim() || 'VP Sales / Head of BD',
    target_industry: input.target_industry?.trim() || 'Indian B2B enterprises',
    daily_lead_limit: input.daily_lead_limit || 30,
    business_hours_start: '09:30',
    business_hours_end: '18:30',
    timezone: 'Asia/Kolkata',
    working_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    steps_count: steps.length,
    leads_count: 0,
    open_rate: 0,
    reply_rate: 0,
    positive_reply_rate: 0,
    enrolled_lead_ids: [],
    created_at: new Date().toISOString(),
  };
  store.addCampaign(campaign, steps);
  store.recordAuditLog('USER', 'CAMPAIGN_CREATED', 'campaign', campaign.id, `Created campaign "${campaign.name}" (${steps.length} steps, ${campaign.approval_mode})`);
  store.persist();
  return { campaign, steps };
}

export function updateCampaign(
  campaignId: string,
  patch: Partial<Pick<Campaign, 'name' | 'description' | 'status' | 'approval_mode' | 'target_persona' | 'target_industry' | 'daily_lead_limit'>>
): Campaign {
  const store = getDemoStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  const before = { status: campaign.status, approval_mode: campaign.approval_mode };
  const allowedStatus: CampaignStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'];
  if (patch.status && !allowedStatus.includes(patch.status)) throw new Error(`Invalid status ${patch.status}`);
  if (patch.approval_mode && !['MANUAL', 'SEMI_AUTOMATIC', 'AUTONOMOUS'].includes(patch.approval_mode)) {
    throw new Error(`Invalid approval mode ${patch.approval_mode}`);
  }
  Object.assign(campaign, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
  const changes: string[] = [];
  if (before.status !== campaign.status) changes.push(`status ${before.status} → ${campaign.status}`);
  if (before.approval_mode !== campaign.approval_mode) changes.push(`approval ${before.approval_mode} → ${campaign.approval_mode}`);
  store.recordAuditLog('USER', 'CAMPAIGN_UPDATED', 'campaign', campaign.id, changes.length ? changes.join(', ') : `Updated campaign "${campaign.name}"`);
  store.persist();
  return campaign;
}

export interface EnrollResult {
  campaign: Campaign;
  enrolled: string[];
  alreadyEnrolled: string[];
  drafted: number;
  queued: number;
  sent: number;
  failed: number;
  errors: Array<{ lead_id: string; error: string }>;
}

/**
 * Enrols leads in a campaign and executes step 1 for each of them right away.
 * MANUAL campaigns leave drafts in the approval queue; other modes queue and send immediately.
 */
export async function enrollLeads(campaignId: string, leadIds: string[], opts?: { executeFirstStep?: boolean }): Promise<EnrollResult> {
  const store = getDemoStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  if (campaign.status === 'PAUSED' || campaign.status === 'ARCHIVED') {
    throw new Error(`Campaign is ${campaign.status}; resume it before enrolling leads`);
  }
  campaign.enrolled_lead_ids = campaign.enrolled_lead_ids || [];
  const firstStep = store.getCampaignSteps(campaign.id).find((s) => s.is_active);
  const result: EnrollResult = { campaign, enrolled: [], alreadyEnrolled: [], drafted: 0, queued: 0, sent: 0, failed: 0, errors: [] };

  for (const leadId of leadIds) {
    const lead = store.leads.find((l) => l.id === leadId);
    if (!lead) {
      result.errors.push({ lead_id: leadId, error: 'Lead not found' });
      continue;
    }
    if (campaign.enrolled_lead_ids.includes(leadId)) {
      result.alreadyEnrolled.push(leadId);
      continue;
    }
    if (lead.is_suppressed) {
      result.errors.push({ lead_id: leadId, error: `${lead.full_name} is suppressed` });
      continue;
    }
    campaign.enrolled_lead_ids.push(leadId);
    campaign.leads_count = campaign.enrolled_lead_ids.length;
    lead.campaign_name = campaign.name;
    lead.updated_at = new Date().toISOString();
    result.enrolled.push(leadId);

    if ((opts?.executeFirstStep ?? true) && firstStep) {
      const exec = await SDROrchestrator.executeCampaignStep(leadId, firstStep.id);
      if (exec.success && exec.message) {
        if (exec.message.status === 'PENDING_APPROVAL') result.drafted++;
        else result.queued++;
      } else {
        result.errors.push({ lead_id: leadId, error: exec.error || 'Step execution failed' });
      }
    }
  }

  store.recordAuditLog(
    'USER',
    'CAMPAIGN_ENROLLMENT',
    'campaign',
    campaign.id,
    `Enrolled ${result.enrolled.length} lead(s) in "${campaign.name}"; ${result.drafted} drafted for approval, ${result.queued} queued`
  );

  if (result.queued > 0 && campaign.approval_mode !== 'MANUAL') {
    const flush = await flushOutbox();
    result.sent = flush.sent;
    result.failed = flush.failed;
  }
  store.persist();
  return result;
}

/** Runs one step of a campaign for one lead from the UI (n8n uses /api/campaigns/steps/execute). */
export async function runStepForLead(campaignId: string, stepId: string, leadId: string) {
  const store = getDemoStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  const step = store.getCampaignStep(stepId);
  if (!step || step.campaign_id !== campaignId) throw new Error(`Step not found in campaign: ${stepId}`);
  const exec = await SDROrchestrator.executeCampaignStep(leadId, stepId);
  let delivery: { sent: number; failed: number } | undefined;
  if (exec.success && exec.message?.status === 'QUEUED') {
    const flush = await flushOutbox();
    delivery = { sent: flush.sent, failed: flush.failed };
  }
  store.persist();
  return { ...exec, delivery };
}

export function updateCampaignStep(stepId: string, patch: Partial<Pick<CampaignStep, 'is_active' | 'name' | 'description' | 'subject_template' | 'body_template' | 'delay_days'>>): CampaignStep {
  const store = getDemoStore();
  const step = store.getCampaignStep(stepId);
  if (!step) throw new Error(`Step not found: ${stepId}`);
  if (patch.body_template !== undefined && (step.step_type || 'MESSAGE') === 'TALK_INVITE' && !/\{\{\s*talk_link\s*\}\}/.test(patch.body_template)) {
    throw new Error('A TALK_INVITE step template must contain {{talk_link}}');
  }
  Object.assign(step, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
  store.recordAuditLog('USER', 'CAMPAIGN_STEP_UPDATED', 'campaign_step', step.id, `Updated step ${step.step_number} of ${step.campaign_id}`);
  store.persist();
  return step;
}
