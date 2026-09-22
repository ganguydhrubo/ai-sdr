import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';
import type { Meeting } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: Meeting['status'][] = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];

/** Complete / cancel / reschedule a meeting. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getDemoStore();
    const meeting = store.meetings.find((m) => m.id === params.id);
    if (!meeting) return jsonError('Meeting not found', 404);
    const body = await readJson<{ status?: Meeting['status']; start_time?: string; end_time?: string; title?: string; description?: string }>(req);
    if (body.status && !STATUSES.includes(body.status)) return jsonError(`Invalid status ${body.status}`, 400);

    const patch: Partial<Meeting> = {};
    if (body.start_time) {
      const start = new Date(body.start_time);
      if (Number.isNaN(start.getTime())) return jsonError('Invalid start_time', 400);
      patch.start_time = start.toISOString();
      patch.end_time = body.end_time && !Number.isNaN(Date.parse(body.end_time)) ? new Date(body.end_time).toISOString() : new Date(start.getTime() + 30 * 60000).toISOString();
      patch.status = body.status || 'RESCHEDULED';
      patch.invite_sent_at = undefined;
    }
    if (body.status) patch.status = body.status;
    if (body.title) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    store.updateMeeting(meeting.id, patch);

    const lead = store.findLead(meeting.lead_id);
    if (lead && body.status === 'COMPLETED') {
      lead.status = 'QUALIFIED_OPPORTUNITY';
      lead.updated_at = new Date().toISOString();
    }
    if (lead && body.status === 'CANCELLED' && lead.status === 'MEETING') {
      lead.status = 'ENGAGED';
      lead.updated_at = new Date().toISOString();
    }
    store.recordAuditLog('USER', 'MEETING_UPDATED', 'meeting', meeting.id, `${meeting.title}: ${Object.keys(patch).join(', ') || 'no changes'} → ${meeting.status}`);
    store.persist();
    return jsonOk({ meeting });
  } catch (err) {
    return errorResponse(err);
  }
}
