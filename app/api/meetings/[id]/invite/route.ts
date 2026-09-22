import { NextRequest } from 'next/server';
import { sendMeetingInvite } from '@/lib/meetings/service';
import { errorResponse, jsonOk } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Emails the .ics invite to the prospect (delivery mode aware). */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const receipt = await sendMeetingInvite(params.id);
    if (receipt.error) return jsonOk({ delivery: receipt, sent: false });
    return jsonOk({ delivery: receipt, sent: true });
  } catch (err) {
    return errorResponse(err);
  }
}
