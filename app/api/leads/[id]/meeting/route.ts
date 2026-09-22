import { NextRequest } from 'next/server';
import { bookMeeting } from '@/lib/meetings/service';
import { errorResponse, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Books a verified meeting for the lead (free Jitsi room, .ics invite, AI brief). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ start_time?: string; duration_minutes?: number; title?: string; description?: string; host_user_id?: string; send_invite?: boolean; with_brief?: boolean }>(req);
    const result = await bookMeeting({
      leadId: params.id,
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
