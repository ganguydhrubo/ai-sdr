import { NextRequest } from 'next/server';
import { meetingIcs } from '@/lib/meetings/service';
import { errorResponse } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Downloads the meeting as an .ics calendar file. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { filename, content } = meetingIcs(params.id);
    return new Response(content, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
