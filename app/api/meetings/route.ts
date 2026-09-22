import { NextRequest } from 'next/server';
import { bookMeeting } from '@/lib/meetings/service';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await readJson<{ lead_id?: string; start_time?: string; duration_minutes?: number; title?: string; description?: string; host_user_id?: string; send_invite?: boolean; with_brief?: boolean }>(req);
    if (!body.lead_id) return jsonError('lead_id is required', 400);
    const result = await bookMeeting({
      leadId: body.lead_id,
      startTime: body.start_time,
      durationMinutes: body.duration_minutes,
      title: body.title,
      description: body.description,
      hostUserId: body.host_user_id,
      sendInvite: body.send_invite,
      withBrief: body.with_brief,
    });
    return jsonOk({ meeting: result.meeting, invite: result.invite });
  } catch (err) {
    return errorResponse(err);
  }
}
