import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { deliverConversationReply } from '@/lib/outreach/dispatch';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Delivers an existing draft (AI or human) from the thread. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getDemoStore();
    const conv = store.conversations.find((c) => c.id === params.id);
    if (!conv) return jsonError('Conversation not found', 404);
    const body = await readJson<{ message_id?: string }>(req);
    if (!body.message_id) return jsonError('message_id is required', 400);
    const msg = conv.messages.find((m) => m.id === body.message_id);
    if (!msg) return jsonError('Message not found', 404);
    if (msg.sender_type === 'PROSPECT') return jsonError('Prospect messages cannot be sent', 400);
    const delivery = await deliverConversationReply(conv.id, msg.id);
    if (!delivery.error) conv.status = 'WAITING_PROSPECT';
    store.persist();
    return jsonOk({ delivery, message: msg });
  } catch (err) {
    return errorResponse(err);
  }
}
