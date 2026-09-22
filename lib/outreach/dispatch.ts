import { getDemoStore } from '../store/demo-store';
import { ComplianceGuard } from '../compliance/guard';
import { EmailAdapter, getEmailRuntimeInfo } from '../adapters/email';
import { EvolutionWhatsAppEngine } from '../adapters/whatsapp-evolution';
import { DeliveryMode, DeliveryReceipt, Lead, OutboundMessage } from '../types';

export interface DispatchResult {
  success: boolean;
  message: OutboundMessage;
  receipt: DeliveryReceipt;
}

/** Effective delivery mode: the organisation setting, forced to SIMULATED when DEMO_MODE=true. */
export function effectiveDeliveryMode(): DeliveryMode {
  if (process.env.DEMO_MODE === 'true') return 'SIMULATED';
  return getDemoStore().org.delivery_mode || 'LIVE';
}

function resolveRecipient(
  channel: OutboundMessage['channel'],
  lead: Lead,
  mode: DeliveryMode
): { to: string; redirected: boolean; simulateBecause?: string } {
  const org = getDemoStore().org;
  if (mode === 'LIVE_REDIRECT') {
    const target = channel === 'EMAIL' ? org.outbound_test_email : channel === 'WHATSAPP' ? org.outbound_test_phone : undefined;
    if (target) return { to: target, redirected: true };
    return {
      to: channel === 'EMAIL' ? lead.email : lead.phone,
      redirected: false,
      simulateBecause: `LIVE_REDIRECT has no test ${channel === 'EMAIL' ? 'email' : 'phone'} configured in Settings — delivery was simulated`,
    };
  }
  return { to: channel === 'EMAIL' ? lead.email : lead.phone, redirected: false };
}

function applySuccess(message: OutboundMessage, lead: Lead, receipt: DeliveryReceipt) {
  const store = getDemoStore();
  message.status = 'SENT';
  message.sent_at = receipt.attempted_at;
  message.delivered_at = receipt.simulated ? receipt.attempted_at : undefined;
  message.error_message = undefined;
  message.delivery = receipt;
  message.attempts = (message.attempts || 0) + 1;

  if (['NEW', 'QUALIFIED', 'OUTREACH', 'RESEARCHING'].includes(lead.status)) {
    lead.status = 'CONTACTED';
  }
  lead.updated_at = receipt.attempted_at;

  if (message.talk_session_id) {
    const session = store.talkSessions.find((s) => s.id === message.talk_session_id);
    if (session && session.status === 'CREATED') {
      session.status = 'SENT';
      session.sent_at = receipt.attempted_at;
    }
  }

  store.recordAuditLog(
    'SYSTEM_WORKER',
    receipt.simulated ? 'OUTREACH_SENT_SIMULATED' : 'OUTREACH_SENT',
    'message',
    message.id,
    `${message.channel} to ${lead.full_name}${receipt.redirected_to ? ` (redirected to ${receipt.redirected_to})` : ''} via ${receipt.provider}${receipt.provider_message_id ? ` [${receipt.provider_message_id}]` : ''}`
  );
}

function applyFailure(message: OutboundMessage, lead: Lead, receipt: DeliveryReceipt) {
  const store = getDemoStore();
  message.status = receipt.error?.startsWith('SUPPRESSED') ? 'SUPPRESSED' : 'FAILED';
  message.error_message = receipt.error;
  message.delivery = receipt;
  message.attempts = (message.attempts || 0) + 1;
  store.recordAuditLog(
    'SYSTEM_WORKER',
    'OUTREACH_DELIVERY_FAILED',
    'message',
    message.id,
    `${message.channel} to ${lead.full_name} failed: ${receipt.error}`
  );
}

/**
 * Hands an approved / queued / failed message to its channel provider and records the outcome.
 * Honest by design: a real provider error leaves the message FAILED with the provider's reason.
 */
export async function dispatchOutboundMessage(messageId: string): Promise<DispatchResult> {
  const store = getDemoStore();
  const message = store.messages.find((m) => m.id === messageId);
  if (!message) throw new Error(`Message not found: ${messageId}`);
  if (!['QUEUED', 'FAILED', 'PENDING_APPROVAL'].includes(message.status)) {
    throw new Error(`Message ${messageId} is ${message.status} and cannot be dispatched`);
  }
  const lead = store.leads.find((l) => l.id === message.lead_id);
  if (!lead) throw new Error(`Lead not found for message ${messageId}`);

  const attemptedAt = new Date().toISOString();
  const mode = effectiveDeliveryMode();

  // Re-run the guard at send time: the kill switch or a fresh opt-out beats an old approval.
  const guard = ComplianceGuard.checkOutboundMessage({
    channel: message.channel,
    recipientEmail: lead.email,
    recipientPhone: lead.phone,
    subject: message.subject,
    body: message.body,
  });
  if (!guard.allowed && guard.violations.some((v) => v.startsWith('SUPPRESSION') || v === 'KILL_SWITCH_ACTIVE')) {
    const receipt: DeliveryReceipt = {
      provider: 'ComplianceGuard',
      simulated: true,
      error: `SUPPRESSED: ${guard.reason}`,
      attempted_at: attemptedAt,
    };
    applyFailure(message, lead, receipt);
    store.persist();
    return { success: false, message, receipt };
  }

  let receipt: DeliveryReceipt;

  if (message.channel === 'EMAIL') {
    const target = resolveRecipient('EMAIL', lead, mode);
    const simulate = mode === 'SIMULATED' || !!target.simulateBecause;
    const subject = target.redirected ? `[TEST → ${lead.email}] ${message.subject || 'Message from ApexSDR'}` : message.subject || 'Message from ApexSDR';
    const body = target.redirected
      ? `(Redirected test delivery — original recipient: ${lead.full_name} <${lead.email}>)\n\n${message.body}`
      : message.body;
    const result = await EmailAdapter.dispatchEmail(
      { to: target.to, subject, body, leadId: lead.id, campaignId: message.campaign_id },
      { simulate }
    );
    receipt = {
      provider: result.provider + (target.simulateBecause ? ` (${target.simulateBecause})` : ''),
      simulated: result.simulated,
      redirected_to: target.redirected ? target.to : undefined,
      provider_message_id: result.messageId || undefined,
      error: result.success ? undefined : result.status === 'SUPPRESSED' ? `SUPPRESSED: ${result.error}` : result.error,
      attempted_at: attemptedAt,
    };
  } else if (message.channel === 'WHATSAPP') {
    const target = resolveRecipient('WHATSAPP', lead, mode);
    const simulate = mode === 'SIMULATED' || !!target.simulateBecause;
    const body = target.redirected ? `[TEST → ${lead.full_name} ${lead.phone}] ${message.body}` : message.body;
    const result = await EvolutionWhatsAppEngine.dispatchSafeMessage(
      {
        instanceName: 'apex_sales_01',
        recipientPhone: lead.phone,
        recipientName: lead.first_name,
        recipientCompany: lead.company_name,
        baseMessageText: body,
        leadId: lead.id,
      },
      { simulate, redirectTo: target.redirected ? target.to : undefined, variation: false }
    );
    receipt = {
      provider: (result.isRealEvolutionApi ? 'Evolution API (Baileys)' : 'WhatsApp simulator') + (target.simulateBecause ? ` (${target.simulateBecause})` : ''),
      simulated: result.simulated,
      redirected_to: target.redirected ? target.to : undefined,
      provider_message_id: result.messageId || undefined,
      error: result.success ? undefined : result.status === 'SUPPRESSED' ? `SUPPRESSED: ${result.error}` : result.error,
      attempted_at: attemptedAt,
    };
  } else {
    // LINKEDIN / VOICE touches have no free API — recorded as simulated sends.
    await new Promise((r) => setTimeout(r, 60));
    receipt = {
      provider: `${message.channel} simulator (no free API for this channel)`,
      simulated: true,
      provider_message_id: `sim_${message.channel.toLowerCase()}_${Date.now()}`,
      attempted_at: attemptedAt,
    };
  }

  if (receipt.error) {
    applyFailure(message, lead, receipt);
    store.persist();
    return { success: false, message, receipt };
  }

  applySuccess(message, lead, receipt);
  store.persist();
  return { success: true, message, receipt };
}

/** Human approval → immediate dispatch through the channel provider. */
export async function approveAndDispatch(messageId: string, approver = 'Ananya Sen (Sales Manager)'): Promise<DispatchResult> {
  const store = getDemoStore();
  const message = store.messages.find((m) => m.id === messageId);
  if (!message) throw new Error(`Message not found: ${messageId}`);
  if (message.status !== 'PENDING_APPROVAL' && message.status !== 'FAILED' && message.status !== 'QUEUED') {
    throw new Error(`Message ${messageId} is ${message.status}; only pending, queued or failed messages can be approved`);
  }
  message.approved_by = approver;
  message.approved_at = new Date().toISOString();
  message.status = 'QUEUED';
  store.recordAuditLog('USER', 'OUTREACH_APPROVED', 'message', message.id, `${approver} approved ${message.channel} outbound to ${message.lead_name}`);
  return dispatchOutboundMessage(messageId);
}

export function rejectMessage(messageId: string, reason: string): OutboundMessage {
  const store = getDemoStore();
  const message = store.rejectMessage(messageId, reason);
  if (!message) throw new Error(`Message not found: ${messageId}`);
  store.persist();
  return message;
}

/** Sends every QUEUED message (non-MANUAL campaigns). Returns a per-message summary. */
export async function flushOutbox(limit = 50): Promise<{ sent: number; failed: number; results: DispatchResult[] }> {
  const store = getDemoStore();
  const queued = store.messages.filter((m) => m.status === 'QUEUED').slice(0, limit);
  const results: DispatchResult[] = [];
  for (const msg of queued) {
    try {
      results.push(await dispatchOutboundMessage(msg.id));
    } catch (err) {
      msg.status = 'FAILED';
      msg.error_message = (err as Error).message;
    }
  }
  return {
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length + (queued.length - results.length),
    results,
  };
}

/** Sends a conversation reply (human or AI) to the prospect over the conversation's channel. */
export async function deliverConversationReply(conversationId: string, messageId: string): Promise<DeliveryReceipt> {
  const store = getDemoStore();
  const conv = store.conversations.find((c) => c.id === conversationId);
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`);
  const msg = conv.messages.find((m) => m.id === messageId);
  if (!msg) throw new Error(`Conversation message not found: ${messageId}`);
  const lead = store.leads.find((l) => l.id === conv.lead_id);
  if (!lead) throw new Error(`Lead not found for conversation ${conversationId}`);

  const attemptedAt = new Date().toISOString();
  const mode = effectiveDeliveryMode();
  let receipt: DeliveryReceipt;

  if (conv.channel === 'EMAIL') {
    const target = resolveRecipient('EMAIL', lead, mode);
    const simulate = mode === 'SIMULATED' || !!target.simulateBecause;
    const body = `${msg.content}\n\nTo opt out of future emails, reply with unsubscribe.`;
    const result = await EmailAdapter.dispatchEmail(
      {
        to: target.to,
        subject: `${target.redirected ? `[TEST → ${lead.email}] ` : ''}Re: ${store.org.name} — ${conv.lead_company}`,
        body: target.redirected ? `(Redirected test delivery — original recipient: ${lead.full_name} <${lead.email}>)\n\n${body}` : body,
        leadId: lead.id,
      },
      { simulate }
    );
    receipt = {
      provider: result.provider,
      simulated: result.simulated,
      redirected_to: target.redirected ? target.to : undefined,
      provider_message_id: result.messageId || undefined,
      error: result.success ? undefined : result.error,
      attempted_at: attemptedAt,
    };
  } else if (conv.channel === 'WHATSAPP') {
    const target = resolveRecipient('WHATSAPP', lead, mode);
    const simulate = mode === 'SIMULATED' || !!target.simulateBecause;
    const result = await EvolutionWhatsAppEngine.dispatchSafeMessage(
      {
        instanceName: 'apex_sales_01',
        recipientPhone: lead.phone,
        recipientName: lead.first_name,
        recipientCompany: lead.company_name,
        baseMessageText: target.redirected ? `[TEST → ${lead.full_name}] ${msg.content}` : msg.content,
        leadId: lead.id,
      },
      { simulate, redirectTo: target.redirected ? target.to : undefined, variation: false }
    );
    receipt = {
      provider: result.isRealEvolutionApi ? 'Evolution API (Baileys)' : 'WhatsApp simulator',
      simulated: result.simulated,
      redirected_to: target.redirected ? target.to : undefined,
      provider_message_id: result.messageId || undefined,
      error: result.success ? undefined : result.error,
      attempted_at: attemptedAt,
    };
  } else {
    receipt = {
      provider: `${conv.channel} simulator`,
      simulated: true,
      provider_message_id: `sim_${Date.now()}`,
      attempted_at: attemptedAt,
    };
  }

  msg.delivery = receipt;
  msg.delivery_status = receipt.error ? 'FAILED' : 'SENT';
  conv.updated_at = attemptedAt;
  store.recordAuditLog(
    'SYSTEM_WORKER',
    receipt.error ? 'REPLY_DELIVERY_FAILED' : receipt.simulated ? 'REPLY_SENT_SIMULATED' : 'REPLY_SENT',
    'conversation',
    conv.id,
    receipt.error ? `Reply to ${conv.lead_name} failed: ${receipt.error}` : `Reply delivered to ${conv.lead_name} via ${receipt.provider}`
  );
  store.persist();
  return receipt;
}

/** One-off transactional email to a lead (meeting invites), honouring the delivery mode. */
export async function sendLeadEmail(
  lead: Lead,
  input: { subject: string; body: string; icsAttachment?: { filename: string; content: string } }
): Promise<DeliveryReceipt> {
  const attemptedAt = new Date().toISOString();
  const mode = effectiveDeliveryMode();
  const target = resolveRecipient('EMAIL', lead, mode);
  const simulate = mode === 'SIMULATED' || !!target.simulateBecause;
  const body = `${target.redirected ? `(Redirected test delivery — original recipient: ${lead.full_name} <${lead.email}>)\n\n` : ''}${input.body}\n\nTo opt out of future emails, reply with unsubscribe.`;
  const result = await EmailAdapter.dispatchEmail(
    {
      to: target.to,
      subject: `${target.redirected ? `[TEST → ${lead.email}] ` : ''}${input.subject}`,
      body,
      leadId: lead.id,
      icsAttachment: input.icsAttachment,
    },
    { simulate }
  );
  return {
    provider: result.provider + (target.simulateBecause ? ` (${target.simulateBecause})` : ''),
    simulated: result.simulated,
    redirected_to: target.redirected ? target.to : undefined,
    provider_message_id: result.messageId || undefined,
    error: result.success ? undefined : result.error,
    attempted_at: attemptedAt,
  };
}

export function describeDeliverySetup() {
  const email = getEmailRuntimeInfo();
  return { mode: effectiveDeliveryMode(), email };
}
