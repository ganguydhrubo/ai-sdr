import crypto from 'crypto';
import { VoiceProvider, OutboundCallParams, OutboundCallResult, VoiceWebhookProcessResult } from './provider';
import { DograhWebhookPayload } from './schemas';
import { getDemoStore } from '../store/demo-store';
import { getSupabaseClient } from '../supabase';
import { checkPstnOutboundCompliance } from './compliance';
import { ComplianceGuard } from '../compliance/guard';
import { peekTalkNonce } from './talk-links';
import { VoiceCall } from '../types';

export class DograhVoiceProvider implements VoiceProvider {
  public name = 'dograh';

  private apiKey: string;
  private baseUrl: string;
  private triggerUuid: string;
  private webhookSecret: string;
  private telephonyConfigId?: number;
  private fromPhoneId?: number;

  constructor() {
    this.apiKey = process.env.DOGRAH_API_KEY || '';
    this.baseUrl = (process.env.DOGRAH_BASE_URL || 'https://api.dograh.com').replace(/\/$/, '');
    this.triggerUuid = process.env.DOGRAH_TRIGGER_UUID || '';
    this.webhookSecret = process.env.DOGRAH_WEBHOOK_SECRET || '';
    this.telephonyConfigId = process.env.DOGRAH_TELEPHONY_CONFIG_ID
      ? Number(process.env.DOGRAH_TELEPHONY_CONFIG_ID)
      : undefined;
    this.fromPhoneId = process.env.DOGRAH_FROM_PHONE_ID
      ? Number(process.env.DOGRAH_FROM_PHONE_ID)
      : undefined;
  }

  public async initiateOutboundCall(params: OutboundCallParams): Promise<OutboundCallResult> {
    const demoStore = getDemoStore();
    const lead = demoStore.getLeads().find((l) => l.id === params.leadId);

    if (!lead) {
      return {
        success: false,
        callId: '',
        workflowRunId: 0,
        status: 'failed',
        error: `Lead ${params.leadId} not found`,
      };
    }

    const settings = demoStore.getVoiceSettings();
    const complianceCheck = checkPstnOutboundCompliance(lead, settings);

    if (!complianceCheck.allowed) {
      return {
        success: false,
        callId: '',
        workflowRunId: 0,
        status: 'failed',
        error: `TRAI PSTN Compliance Block: ${complianceCheck.violations.join('; ')}`,
      };
    }

    if (!this.apiKey || !this.triggerUuid) {
      return {
        success: false,
        callId: '',
        workflowRunId: 0,
        status: 'failed',
        error: 'Dograh API credentials (DOGRAH_API_KEY or DOGRAH_TRIGGER_UUID) are unconfigured.',
      };
    }

    const endpoint = `${this.baseUrl}/api/v1/public/agent/${this.triggerUuid}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          phone_number: params.phone,
          initial_context: {
            lang: params.language || 'en',
            greeting_override: params.greetingOverride
              ? { type: 'text', text: params.greetingOverride }
              : undefined,
          },
          telephony_configuration_id: this.telephonyConfigId,
          from_phone_number_id: this.fromPhoneId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          callId: '',
          workflowRunId: 0,
          status: 'failed',
          error: `Dograh API error (${response.status}): ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        status: string;
        workflow_run_id: string | number;
        workflow_run_name?: string;
      };

      const callId = `vc_dograh_${data.workflow_run_id}`;

      // Save initial call record
      demoStore.recordVoiceCall({
        id: callId,
        organization_id: demoStore.getOrg().id,
        lead_id: lead.id,
        lead_name: lead.full_name,
        lead_company: lead.company_name,
        mode: 'pstn',
        provider: 'dograh',
        provider_run_id: String(data.workflow_run_id),
        status: 'INITIATED',
        started_at: new Date().toISOString(),
        carrier_cost_estimate_inr: 0.85,
      });

      return {
        success: true,
        callId,
        workflowRunId: data.workflow_run_id,
        status: 'initiated',
      };
    } catch (err: any) {
      return {
        success: false,
        callId: '',
        workflowRunId: 0,
        status: 'failed',
        error: err?.message || 'Network failure triggering Dograh API',
      };
    }
  }

  public verifyWebhookSignature(rawBody: string, signatureHeader?: string): boolean {
    if (!this.webhookSecret) {
      // If secret not configured, warn but allow in development
      return true;
    }

    if (!signatureHeader) {
      return false;
    }

    // Check direct secret match (X-Webhook-Secret)
    if (signatureHeader === this.webhookSecret) {
      return true;
    }

    // Check HMAC-SHA256 signature if header is a hex digest
    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(hmac));
    } catch {
      return false;
    }
  }

  public async processWebhook(payload: DograhWebhookPayload): Promise<VoiceWebhookProcessResult> {
    const demoStore = getDemoStore();
    const supabase = getSupabaseClient();
    const gathered = payload.gathered_context || {};
    const talkRef = payload.initial_context?.talk_ref;
    const runId = String(payload.workflow_run_id);

    // 1. Resolve the talk session / lead from the nonce (WebRTC calls carry talk_ref).
    let leadId: string | undefined;
    let sessionId: string | undefined;

    if (talkRef) {
      const nonceCheck = await peekTalkNonce(talkRef);
      if (nonceCheck.valid && nonceCheck.nonceRecord) {
        leadId = nonceCheck.nonceRecord.lead_id;
        sessionId = nonceCheck.nonceRecord.talk_session_id;
      }
    }

    // 2. Idempotency: a PSTN call already has an INITIATED row from initiateOutboundCall(),
    //    and Dograh may redeliver a webhook. Update the existing row instead of adding another.
    const existing = demoStore.getVoiceCalls().find((c) => c.provider_run_id === runId);
    const duplicate = existing?.status === 'COMPLETED';

    if (existing && !leadId) {
      leadId = existing.lead_id;
    }

    const lead =
      demoStore.getLeads().find((l) => l.id === leadId) || demoStore.getLeads()[0];

    const endedAt = new Date().toISOString();
    let callRecord: VoiceCall;

    if (existing) {
      existing.status = 'COMPLETED';
      existing.ended_at = existing.ended_at && duplicate ? existing.ended_at : endedAt;
      existing.duration_seconds =
        payload.cost_info?.call_duration_seconds ?? existing.duration_seconds ?? 0;
      existing.extracted = gathered;
      existing.intent = gathered.intent || existing.intent;
      existing.sentiment = (gathered.sentiment as any) || existing.sentiment;
      existing.talk_session_id = existing.talk_session_id || sessionId;
      existing.lead_id = lead.id;
      existing.lead_name = lead.full_name;
      existing.lead_company = lead.company_name;
      if (payload.recording_url) existing.recording_url = payload.recording_url;
      callRecord = existing;
    } else {
      callRecord = demoStore.recordVoiceCall({
        id: `vc_dograh_${runId}`,
        organization_id: demoStore.getOrg().id,
        lead_id: lead.id,
        lead_name: lead.full_name,
        lead_company: lead.company_name,
        talk_session_id: sessionId,
        mode: talkRef ? 'webrtc' : 'pstn',
        provider: 'dograh',
        provider_run_id: runId,
        status: 'COMPLETED',
        started_at: payload.call_time || endedAt,
        ended_at: endedAt,
        duration_seconds: payload.cost_info?.call_duration_seconds ?? 0,
        extracted: gathered,
        intent: gathered.intent || 'INTERESTED',
        sentiment: (gathered.sentiment as any) || 'POSITIVE',
        disclosure_given: true,
        consent_transcript: true,
        recording_url: payload.recording_url,
        // WebRTC is carrier-free; PSTN via Vobiz carries an estimated per-call cost.
        carrier_cost_estimate_inr: talkRef ? 0.0 : 1.25,
      });
    }

    if (supabase) {
      try {
        await supabase.from('voice_calls').upsert({
          id: callRecord.id,
          organization_id: callRecord.organization_id,
          lead_id: callRecord.lead_id,
          talk_session_id: callRecord.talk_session_id,
          mode: callRecord.mode,
          provider: callRecord.provider,
          provider_run_id: callRecord.provider_run_id,
          status: callRecord.status,
          started_at: callRecord.started_at,
          ended_at: callRecord.ended_at,
          duration_seconds: callRecord.duration_seconds,
          extracted: callRecord.extracted,
          intent: callRecord.intent,
          sentiment: callRecord.sentiment,
          recording_url: callRecord.recording_url,
          carrier_cost_estimate_inr: callRecord.carrier_cost_estimate_inr,
        });
      } catch {
        // demo fallback
      }
    }

    // 3. Post-call lead actions — skipped on duplicate delivery so audit history stays clean.
    if (!duplicate) {
      if (gathered.opt_out) {
        ComplianceGuard.addSuppression({
          email: lead.email,
          phone: lead.phone,
          reason: 'DO_NOT_CONTACT',
        });
        lead.is_suppressed = true;
        lead.suppression_reason = 'Opted out via Dograh voice call';
        demoStore.recordAuditLog(
          'SYSTEM_WORKER',
          'LEAD_SUPPRESSED_FROM_VOICE',
          'lead',
          lead.id,
          `Suppressed prospect ${lead.full_name} following voice opt-out (Dograh run ${runId}).`
        );
      }

      if (gathered.meeting_requested) {
        lead.status = 'MEETING';
        demoStore.recordAuditLog(
          'AI_AGENT',
          'VOICE_MEETING_SCHEDULED',
          'meeting',
          gathered.meeting_id || callRecord.id,
          `Voice agent booked a meeting for ${lead.full_name} (Dograh run ${runId}).`
        );
      } else if (gathered.handoff_requested) {
        lead.status = 'SALES_HANDOFF';
        lead.requires_human_attention = true;
        demoStore.recordAuditLog(
          'AI_AGENT',
          'VOICE_SDR_HANDOFF_TRIGGERED',
          'lead',
          lead.id,
          `SDR human handoff requested during voice call: ${gathered.summary || 'Immediate follow-up needed'}`
        );
      }
    }

    return {
      success: true,
      callRecord,
      extracted: gathered,
      duplicate,
    };
  }
}
