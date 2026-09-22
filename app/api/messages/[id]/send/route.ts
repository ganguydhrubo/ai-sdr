import { NextRequest } from 'next/server';
import { dispatchOutboundMessage } from '@/lib/outreach/dispatch';
import { errorResponse, jsonOk } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** (Re)sends a queued or failed message. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await dispatchOutboundMessage(params.id);
    return jsonOk({ sent: result.success, message: result.message, delivery: result.receipt });
  } catch (err) {
    return errorResponse(err);
  }
}
