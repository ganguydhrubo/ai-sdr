import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { ComplianceGuard } from '@/lib/compliance/guard';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';
import type { Lead, LeadStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: LeadStatus[] = [
  'NEW', 'RESEARCHING', 'QUALIFIED', 'OUTREACH', 'CONTACTED', 'ENGAGED', 'QUALIFIED_OPPORTUNITY',
  'MEETING', 'SALES_HANDOFF', 'WON', 'LOST', 'NURTURE', 'DISQUALIFIED',
];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const store = getDemoStore();
  const lead = store.findLead(params.id);
  if (!lead) return jsonError('Lead not found', 404);
  return jsonOk({
    lead,
    messages: store.messages.filter((m) => m.lead_id === lead.id),
    conversations: store.conversations.filter((c) => c.lead_id === lead.id),
    meetings: store.meetings.filter((m) => m.lead_id === lead.id),
    tasks: store.tasks.filter((t) => t.lead_id === lead.id),
    talkSessions: store.talkSessions.filter((s) => s.lead_id === lead.id),
    voiceCalls: store.voiceCalls.filter((c) => c.lead_id === lead.id),
  });
}

/** Updates lead fields; a status change goes through the audited transition. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getDemoStore();
    const lead = store.findLead(params.id);
    if (!lead) return jsonError('Lead not found', 404);
    const body = await readJson<Partial<Lead> & { reason?: string; suppress?: boolean }>(req);

    if (body.status) {
      if (!STATUSES.includes(body.status)) return jsonError(`Invalid status ${body.status}`, 400);
      store.updateLeadStatus(lead.id, body.status, body.reason);
    }
    if (body.suppress !== undefined) {
      if (body.suppress) {
        ComplianceGuard.addSuppression({ email: lead.email, phone: lead.phone, reason: 'MANUAL_BLOCK' });
        lead.is_suppressed = true;
        lead.suppression_reason = body.reason || 'Suppressed manually';
        store.recordAuditLog('USER', 'LEAD_SUPPRESSED', 'lead', lead.id, lead.suppression_reason);
      } else {
        if (lead.email) ComplianceGuard.removeSuppression(lead.email);
        if (lead.phone) ComplianceGuard.removeSuppression(lead.phone);
        lead.is_suppressed = false;
        lead.suppression_reason = undefined;
        store.recordAuditLog('USER', 'LEAD_UNSUPPRESSED', 'lead', lead.id, 'Suppression removed manually');
      }
    }
    const patch: Partial<Lead> = {};
    for (const key of ['notes', 'job_title', 'preferred_language', 'assigned_user_id', 'requires_human_attention', 'attention_reason', 'is_dnc_registered', 'city', 'state', 'industry'] as const) {
      if (body[key] !== undefined) (patch as Record<string, unknown>)[key] = body[key];
    }
    if (Object.keys(patch).length) store.updateLead(lead.id, patch);
    store.persist();
    return jsonOk({ lead });
  } catch (err) {
    return errorResponse(err);
  }
}
