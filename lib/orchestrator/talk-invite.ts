import { getDemoStore } from '../store/demo-store';
import { ComplianceGuard } from '../compliance/guard';
import { mintTalkToken } from '../voice/talk-links';
import {
  renderTemplate,
  templateUsesVariable,
  leadTemplateVariables,
  formatIndianDate,
} from '../outreach/templates';
import { CampaignStep, Channel, OutboundMessage, TalkSession } from '../types';

export interface DispatchTalkInviteParams {
  leadId: string;
  campaignId?: string;
  /** A TALK_INVITE campaign step; when omitted, the default invite template for `channel` is used. */
  stepId?: string;
  channel?: 'EMAIL' | 'WHATSAPP';
  language?: string;
  expiresInDays?: number;
  maxCalls?: number;
}

export interface DispatchTalkInviteResult {
  success: boolean;
  message?: OutboundMessage;
  session?: TalkSession;
  talkUrl?: string;
  requiresApproval?: boolean;
  error?: string;
}

const DEFAULT_TEMPLATES: Record<'EMAIL' | 'WHATSAPP', { subject?: string; body: string }> = {
  EMAIL: {
    subject: "{{first_name}}, talk to {{org_name}}'s AI for 2 minutes",
    body:
      'Hi {{first_name}},\n\nHere is a personal link where you can ask our AI sales assistant anything about {{org_name}} by voice, straight from your browser:\n\n{{talk_link}}\n\nIt is private to you and works until {{talk_link_expires}}.\n\nBest regards,\n{{sender_name}}\n\nTo opt out of future emails, reply with unsubscribe.',
  },
  WHATSAPP: {
    body:
      'Namaste {{first_name}} ji, {{sender_name}} from {{org_name}}. Talk to our AI assistant for 2 minutes from your browser: {{talk_link}} (valid until {{talk_link_expires}}, private to you). Reply STOP to opt out.',
  },
};

function toSessionChannel(channel: Channel): 'email' | 'whatsapp' {
  return channel === 'WHATSAPP' ? 'whatsapp' : 'email';
}

/**
 * Mints a personal "Talk to our AI" link for a lead and queues the invite message on the
 * step's channel. This is the single entry point for the TALK_INVITE campaign step, the
 * `/api/voice/talk-invite` route and the n8n talk-invite-dispatch workflow.
 */
export async function dispatchTalkInvite(params: DispatchTalkInviteParams): Promise<DispatchTalkInviteResult> {
  const store = getDemoStore();
  const lead = store.leads.find((l) => l.id === params.leadId);
  if (!lead) {
    return { success: false, error: `Lead not found: ${params.leadId}` };
  }

  const step: CampaignStep | undefined = params.stepId ? store.getCampaignStep(params.stepId) : undefined;
  if (params.stepId && !step) {
    return { success: false, error: `Campaign step not found: ${params.stepId}` };
  }
  if (step && (step.step_type || 'MESSAGE') !== 'TALK_INVITE') {
    return { success: false, error: `Campaign step ${step.id} is not a TALK_INVITE step` };
  }
  if (step && !step.is_active) {
    return { success: false, error: `Campaign step ${step.id} is inactive` };
  }

  const channel: Channel = step?.channel || params.channel || 'EMAIL';
  if (channel !== 'EMAIL' && channel !== 'WHATSAPP') {
    return { success: false, error: `Talk invites can only be sent by EMAIL or WHATSAPP (got ${channel})` };
  }

  const settings = store.getVoiceSettings();
  if (!settings.voice_enabled || !settings.web_voice_enabled) {
    return { success: false, error: 'Web voice ("Talk to our AI") is disabled in Voice Settings' };
  }

  // Suppression / kill switch / content checks happen BEFORE a token is minted so that
  // opted-out prospects never get a live link.
  const campaignId = step?.campaign_id || params.campaignId;
  const campaign = campaignId ? store.campaigns.find((c) => c.id === campaignId) : undefined;
  const company = store.companies.find((c) => c.id === lead.company_id);
  const sender = store.users.find((u) => u.id === lead.assigned_user_id) || store.users[2];

  const subjectTemplate = step?.subject_template ?? DEFAULT_TEMPLATES[channel].subject;
  const bodyTemplate = step?.body_template ?? DEFAULT_TEMPLATES[channel].body;

  if (!templateUsesVariable(bodyTemplate, 'talk_link')) {
    return { success: false, error: 'TALK_INVITE template must contain {{talk_link}}' };
  }

  const preCheck = ComplianceGuard.checkOutboundMessage({
    channel,
    recipientEmail: lead.email,
    recipientPhone: lead.phone,
    body: bodyTemplate,
    subject: subjectTemplate,
  });
  if (!preCheck.allowed && preCheck.violations.some((v) => v.startsWith('SUPPRESSION') || v === 'KILL_SWITCH_ACTIVE')) {
    return { success: false, error: preCheck.reason || 'Blocked by ComplianceGuard' };
  }

  const minted = await mintTalkToken({
    organizationId: store.org.id,
    leadId: lead.id,
    leadName: lead.full_name,
    leadCompany: lead.company_name,
    campaignId,
    channel: toSessionChannel(channel),
    language: step?.talk_link_language || params.language || 'en',
    expiresInDays: step?.talk_link_expires_in_days ?? params.expiresInDays ?? settings.talk_link_ttl_days,
    maxCalls: step?.talk_link_max_calls ?? params.maxCalls ?? settings.talk_link_max_calls,
  });

  const session = store.updateTalkSession(minted.session.id, { campaign_step_id: step?.id }) || minted.session;

  const vars = {
    ...leadTemplateVariables(lead, { city: company?.city, orgName: store.org.name, senderName: sender?.full_name }),
    talk_link: minted.talkUrl,
    talk_link_expires: formatIndianDate(session.expires_at),
  };

  const renderedBody = renderTemplate(bodyTemplate, vars);
  const renderedSubject = subjectTemplate ? renderTemplate(subjectTemplate, vars) : undefined;
  const unresolved = [...renderedBody.unresolved, ...(renderedSubject?.unresolved || [])];
  if (unresolved.length > 0) {
    // Never send a message with raw {{placeholders}}; revoke the link we just minted.
    session.status = 'REVOKED';
    session.revoked_at = new Date().toISOString();
    session.revoked_reason = `Unresolved template variables: ${unresolved.join(', ')}`;
    return { success: false, error: `Unresolved template variables: ${unresolved.join(', ')}` };
  }

  const guardCheck = ComplianceGuard.checkOutboundMessage({
    channel,
    recipientEmail: lead.email,
    recipientPhone: lead.phone,
    body: renderedBody.text,
    subject: renderedSubject?.text,
  });

  const approvalMode = campaign?.approval_mode || 'MANUAL';
  const requiresApproval = approvalMode === 'MANUAL' || !guardCheck.allowed;

  const message: OutboundMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    organization_id: store.org.id,
    lead_id: lead.id,
    lead_name: lead.full_name,
    lead_company: lead.company_name || company?.name || '',
    campaign_id: campaignId,
    campaign_name: campaign?.name,
    campaign_step_id: step?.id,
    talk_session_id: session.id,
    channel,
    direction: 'OUTBOUND',
    subject: renderedSubject?.text,
    body: renderedBody.text,
    status: requiresApproval ? 'PENDING_APPROVAL' : 'QUEUED',
    requires_approval: requiresApproval,
    error_message: guardCheck.allowed ? undefined : guardCheck.reason,
    created_at: new Date().toISOString(),
  };

  store.messages.unshift(message);

  if (!requiresApproval) {
    // In demo mode "queued" is as far as the pipeline goes; mark the link as sent so
    // reminders and expiry workflows can key off sent_at.
    session.status = 'SENT';
    session.sent_at = new Date().toISOString();
  }

  if (lead.status === 'NEW' || lead.status === 'QUALIFIED') {
    lead.status = 'OUTREACH';
  }

  store.recordAuditLog(
    'AI_AGENT',
    'TALK_INVITE_DRAFTED',
    'message',
    message.id,
    `Talk link ${session.id} minted for ${lead.full_name} (${channel}${step ? `, step ${step.step_number}` : ''}; expires ${vars.talk_link_expires}; approval required: ${requiresApproval})`
  );

  return {
    success: true,
    message,
    session,
    talkUrl: minted.talkUrl,
    requiresApproval,
  };
}
