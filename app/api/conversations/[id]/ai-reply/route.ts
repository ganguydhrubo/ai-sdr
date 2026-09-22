import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { SDROrchestrator } from '@/lib/orchestrator/sdr-orchestrator';
import { deliverConversationReply } from '@/lib/outreach/dispatch';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Drafts the AI SDR's next reply; `send: true` (default) delivers it over the channel. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getDemoStore();
    const conv = store.conversations.find((c) => c.id === params.id);
    if (!conv) return jsonError('Conversation not found', 404);
    const body = await readJson<{ send?: boolean }>(req);

    const reply = await SDROrchestrator.draftAIReply(conv.id);
    const draft = [...conv.messages].reverse().find((m) => m.sender_type === 'AI_SDR' && m.content === reply);
    if (!draft) return jsonError('Draft was not recorded', 500);
    draft.delivery_status = 'DRAFT';

    let delivery;
    if (body.send ?? true) {
      delivery = await deliverConversationReply(conv.id, draft.id);
      conv.status = 'WAITING_PROSPECT';
    }
    store.persist();
    return jsonOk({ reply, message_id: draft.id, delivery, conversation: conv });
  } catch (err) {
    return errorResponse(err);
  }
}
