import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { revokeTalkToken } from '@/lib/voice/talk-links';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Revokes a talk link so it can no longer start calls. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getDemoStore();
    const session = store.getTalkSession(params.id);
    if (!session) return jsonError('Talk session not found', 404);
    const body = await readJson<{ reason?: string }>(req);
    const result = await revokeTalkToken(session.token_hash, body.reason || 'Revoked by operator');
    store.recordAuditLog('USER', 'TALK_LINK_REVOKED', 'talk_session', session.id, `Talk link for ${session.lead_name || session.lead_id} revoked: ${body.reason || 'operator action'}`);
    store.persist();
    return jsonOk({ session: result.session || session });
  } catch (err) {
    return errorResponse(err);
  }
}
