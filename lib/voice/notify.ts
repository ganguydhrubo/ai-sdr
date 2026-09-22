import { VoiceWebhookProcessResult } from './provider';
import { getDemoStore } from '../store/demo-store';

/**
 * Forwards a processed end-of-call result to the n8n post-call follow-up workflow
 * (n8n/workflows/post-call-followup.json) when N8N_POST_CALL_WEBHOOK_URL is configured.
 * Fire-and-forget: a failure here must never fail the Dograh webhook response.
 */
export async function notifyPostCallWorkflow(result: VoiceWebhookProcessResult): Promise<boolean> {
  const url = process.env.N8N_POST_CALL_WEBHOOK_URL;
  if (!url || !result.success || result.duplicate || !result.callRecord) {
    return false;
  }

  const call = result.callRecord;
  const lead = getDemoStore().getLeads().find((l) => l.id === call.lead_id);
  const body = {
    event: 'voice.call.completed',
    call_id: call.id,
    lead_id: call.lead_id,
    lead_name: call.lead_name,
    lead_first_name: lead?.first_name,
    // Contact details travel only to the company's own n8n (secret-protected) for the follow-up email.
    lead_email: lead?.email,
    lead_company: call.lead_company,
    talk_session_id: call.talk_session_id,
    mode: call.mode,
    provider: call.provider,
    provider_run_id: call.provider_run_id,
    duration_seconds: call.duration_seconds,
    intent: call.intent,
    sentiment: call.sentiment,
    extracted: call.extracted,
    recording_url: call.recording_url,
    carrier_cost_estimate_inr: call.carrier_cost_estimate_inr,
    ended_at: call.ended_at,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_WEBHOOK_SECRET ? { 'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}
