import { NextRequest } from 'next/server';
import { approveAndDispatch } from '@/lib/outreach/dispatch';
import { errorResponse, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Human approval: the message is dispatched through its channel provider immediately. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ approver?: string }>(req);
    const result = await approveAndDispatch(params.id, body.approver);
    return jsonOk({ sent: result.success, message: result.message, delivery: result.receipt });
  } catch (err) {
    return errorResponse(err);
  }
}
