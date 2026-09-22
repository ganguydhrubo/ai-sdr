import { NextRequest } from 'next/server';
import { rejectMessage } from '@/lib/outreach/dispatch';
import { errorResponse, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ reason?: string }>(req);
    const message = rejectMessage(params.id, body.reason || 'Rejected by Sales Manager');
    return jsonOk({ message });
  } catch (err) {
    return errorResponse(err);
  }
}
