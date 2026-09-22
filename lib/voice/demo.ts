import { VoiceProvider, OutboundCallParams, OutboundCallResult, VoiceWebhookProcessResult } from './provider';
import { DograhWebhookPayload } from './schemas';
import { getDemoStore } from '../store/demo-store';
import { checkPstnOutboundCompliance } from './compliance';
import { ComplianceGuard } from '../compliance/guard';
import { VoiceCall } from '../types';

export class DemoVoiceProvider implements VoiceProvider {
  public name = 'demo';

  public async initiateOutboundCall(params: OutboundCallParams): Promise<OutboundCallResult> {
    const demoStore = getDemoStore();
    const lead = demoStore.getLeads().find((l) => l.id === params.leadId);

    if (!lead) {
      return {
        success: false,
        callId: '',
        workflowRunId: 0,
        status: 'failed',
        error: `Lead ${params.leadId} not found in store`,
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
        error: `TRAI/Compliance Gate Failed: ${complianceCheck.violations.join('; ')}`,
      };
    }

    const callId = `vc_demo_${Date.now()}`;
    const workflowRunId = Math.floor(10000 + Math.random() * 90000);

    const newCall = demoStore.recordVoiceCall({
      id: callId,
      organization_id: demoStore.getOrg().id,
      lead_id: lead.id,
      lead_name: lead.full_name,
      lead_company: lead.company_name,
      mode: 'pstn',
      provider: 'demo',
      provider_run_id: `wr_${workflowRunId}`,
      status: 'INITIATED',
      started_at: new Date().toISOString(),
      carrier_cost_estimate_inr: 0.85, // Estimated PSTN carrier rate
      disclosure_given: true,
      consent_transcript: true,
    });

    demoStore.recordAuditLog(
      'AI_AGENT',
      'VOICE_OUTBOUND_INITIATED',
      'voice_call',
      newCall.id,
      `Simulated PSTN outbound call to ${lead.full_name} (${lead.company_name}) over Vobiz SIP carrier.`
    );

    return {
      success: true,
      callId,
      workflowRunId,
      status: 'initiated',
    };
  }

  public verifyWebhookSignature(rawBody: string, signatureHeader?: string): boolean {
    // In demo mode, accept any signature or check against configured secret if present
    const secret = process.env.DOGRAH_WEBHOOK_SECRET;
    if (!secret || secret === 'demo_webhook_secret') {
      return true;
    }
    return signatureHeader === secret;
  }

  public async processWebhook(payload: DograhWebhookPayload): Promise<VoiceWebhookProcessResult> {
    const demoStore = getDemoStore();
    const gathered = payload.gathered_context || {};
    const talkRef = payload.initial_context?.talk_ref;

    // Resolve associated call or create a completed record
    let callRecord = demoStore
      .getVoiceCalls()
      .find(
        (c) =>
          c.provider_run_id === String(payload.workflow_run_id) ||
          (talkRef && c.talk_session_id?.includes(talkRef))
      );

    const lead = demoStore.getLeads()[0];

    if (!callRecord) {
      callRecord = demoStore.recordVoiceCall({
        id: `vc_${payload.workflow_run_id}`,
        organization_id: demoStore.getOrg().id,
        lead_id: lead.id,
        lead_name: lead.full_name,
        lead_company: lead.company_name,
        mode: payload.initial_context?.talk_ref ? 'webrtc' : 'pstn',
        provider: 'demo',
        provider_run_id: String(payload.workflow_run_id),
        status: 'COMPLETED',
        started_at: payload.call_time || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: payload.cost_info?.call_duration_seconds || 120,
        transcript: [
          { role: 'agent', text: 'Namaste, Apex AI voice agent here.' },
          { role: 'user', text: gathered.summary || 'Interested in learning more about your sales platform.' },
        ],
        extracted: gathered,
        intent: gathered.intent || 'INTERESTED',
        sentiment: (gathered.sentiment as any) || 'POSITIVE',
        disclosure_given: true,
        consent_transcript: true,
        recording_url: payload.recording_url || 'https://demo-storage.apextech.in/recordings/demo_call.mp3',
        carrier_cost_estimate_inr: 0.0,
      });
    } else {
      callRecord.status = 'COMPLETED';
      callRecord.ended_at = new Date().toISOString();
      callRecord.duration_seconds = payload.cost_info?.call_duration_seconds || callRecord.duration_seconds || 120;
      callRecord.extracted = gathered;
      callRecord.intent = gathered.intent || callRecord.intent;
      callRecord.sentiment = (gathered.sentiment as any) || callRecord.sentiment;
      if (payload.recording_url) callRecord.recording_url = payload.recording_url;
    }

    // Handle SDR post-call actions:
    // 1. Opt-out check
    if (gathered.opt_out) {
      ComplianceGuard.addSuppression({
        email: lead.email,
        phone: lead.phone,
        reason: 'DO_NOT_CONTACT',
      });
      lead.is_suppressed = true;
      lead.suppression_reason = 'Opted out during voice call';
      demoStore.recordAuditLog(
        'SYSTEM_WORKER',
        'LEAD_SUPPRESSED_FROM_VOICE',
        'lead',
        lead.id,
        `Suppressed prospect ${lead.full_name} following voice opt-out request.`
      );
    }

    // 2. Meeting booked check
    if (gathered.meeting_requested && gathered.meeting_id) {
      lead.status = 'MEETING';
      demoStore.recordAuditLog(
        'AI_AGENT',
        'VOICE_MEETING_SCHEDULED',
        'meeting',
        gathered.meeting_id,
        `Voice agent successfully booked demo meeting for ${lead.full_name}.`
      );
    }

    // 3. SDR handoff check
    if (gathered.handoff_requested) {
      lead.requires_human_attention = true;
      lead.status = 'SALES_HANDOFF';
      demoStore.recordAuditLog(
        'AI_AGENT',
        'VOICE_SDR_HANDOFF_TRIGGERED',
        'lead',
        lead.id,
        `SDR human handoff requested during voice call: ${gathered.summary || 'Immediate follow-up needed'}`
      );
    }

    return {
      success: true,
      callRecord,
      extracted: gathered,
    };
  }
}
