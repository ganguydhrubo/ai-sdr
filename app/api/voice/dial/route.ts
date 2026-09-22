import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { getVoiceProvider } from '@/lib/voice/provider';
import { checkPstnOutboundCompliance } from '@/lib/voice/compliance';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/**
 * Gated outbound PSTN dial. The eight-point TRAI gate runs first; a blocked call is recorded
 * as BLOCKED with the reasons. With the demo provider the call completes with a synthetic
 * transcript so the log/analytics reflect it (₹ estimate only — no carrier is billed).
 */
export async function POST(req: NextRequest) {
  try {
    const store = getDemoStore();
    const body = await readJson<{ lead_id?: string; phone?: string; language?: string }>(req);
    const lead = body.lead_id ? store.findLead(body.lead_id) : store.leads.find((l) => l.normalized_phone === body.phone) || store.leads[0];
    if (!lead) return jsonError('Lead not found', 404);

    const settings = store.getVoiceSettings();
    const gate = checkPstnOutboundCompliance(lead, settings);
    if (!gate.allowed) {
      const blocked = store.recordVoiceCall({
        lead_id: lead.id,
        lead_name: lead.full_name,
        lead_company: lead.company_name,
        mode: 'pstn',
        provider: 'demo',
        provider_run_id: `blocked_${Date.now()}`,
        status: 'BLOCKED',
        duration_seconds: 0,
        transcript: [],
        extracted: { summary: `Blocked by the TRAI/DLT gate: ${gate.violations.join('; ')}` },
        carrier_cost_estimate_inr: 0,
      });
      store.recordAuditLog('SYSTEM_WORKER', 'VOICE_OUTBOUND_BLOCKED', 'voice_call', blocked.id, `PSTN dial to ${lead.full_name} blocked: ${gate.violations.join('; ')}`);
      store.persist();
      return jsonError('Outbound call blocked by the compliance gate', 422, { violations: gate.violations, call: blocked });
    }

    const provider = getVoiceProvider();
    const result = await provider.initiateOutboundCall({ leadId: lead.id, phone: body.phone || lead.phone, language: body.language || lead.preferred_language });
    if (!result.success) return jsonError(result.error || 'Provider refused the call', 422);

    let call = store.voiceCalls.find((c) => c.id === result.callId);
    if (provider.name === 'demo' && call) {
      // Simulated carrier leg: complete the call with a short transcript so the pipeline closes.
      const first = lead.first_name;
      call.status = 'COMPLETED';
      call.ended_at = new Date(Date.now() + 95_000).toISOString();
      call.duration_seconds = 95;
      call.transcript = [
        { role: 'agent', text: `Namaste ${first}, this is Apex, an AI assistant calling on behalf of ${store.org.name} — I'm not a person. This call is recorded and transcribed. Do you have three minutes?` },
        { role: 'user', text: 'Haan, boliye. We are looking at automating our sales follow-ups.' },
        { role: 'agent', text: 'Perfect. Would a 15-minute walkthrough with our solutions director help? I can hold Thursday 3 PM IST.' },
        { role: 'user', text: 'Send the details on email and we will confirm.' },
      ];
      call.extracted = {
        intent: 'INTERESTED',
        buying_stage: 'EVALUATING',
        sentiment: 'POSITIVE',
        language: 'Hinglish',
        meeting_requested: false,
        handoff_requested: false,
        opt_out: false,
        summary: `Simulated PSTN call to ${lead.full_name}: interested in automating follow-ups, asked for details by email.`,
      };
      call.intent = 'INTERESTED';
      call.sentiment = 'POSITIVE';
      if (!['MEETING', 'SALES_HANDOFF'].includes(lead.status)) {
        lead.status = 'ENGAGED';
        lead.requires_human_attention = true;
        lead.attention_reason = 'Interested on the PSTN call; wants details by email';
        lead.updated_at = new Date().toISOString();
      }
      store.recordAuditLog('AI_AGENT', 'VOICE_OUTBOUND_COMPLETED', 'voice_call', call.id, `Simulated PSTN call with ${lead.full_name} completed (95s).`);
    }
    store.persist();
    return jsonOk({ call: call || null, provider: provider.name, workflow_run_id: result.workflowRunId });
  } catch (err) {
    return errorResponse(err);
  }
}
