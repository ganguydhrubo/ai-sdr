import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { deliverConversationReply } from '@/lib/outreach/dispatch';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** A human rep replies in the inbox: appended to the thread and delivered over the channel. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getDemoStore();
    const conv = store.conversations.find((c) => c.id === params.id);
    if (!conv) return jsonError('Conversation not found', 404);
    const body = await readJson<{ text?: string; sender_name?: string }>(req);
    const text = (body.text || '').trim();
    if (!text) return jsonError('text is required', 400);

    const manager = store.users.find((u) => u.role === 'SALES_MANAGER') || store.users[1];
    const message = {
      id: `cm_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      conversation_id: conv.id,
      sender_type: 'HUMAN_REP' as const,
      sender_name: body.sender_name || `${manager?.full_name || 'Sales Rep'} (Sales Rep)`,
      content: text,
      created_at: new Date().toISOString(),
    };
    conv.messages.push(message);
    conv.status = 'WAITING_PROSPECT';
    conv.needs_human_attention = false;
    conv.updated_at = message.created_at;
    const lead = store.findLead(conv.lead_id);
    if (lead) {
      lead.requires_human_attention = false;
      lead.updated_at = message.created_at;
    }
    store.recordAuditLog('USER', 'HUMAN_REPLY_SENT', 'conversation', conv.id, `Human reply to ${conv.lead_name} on ${conv.channel}`);

    const delivery = await deliverConversationReply(conv.id, message.id);
    return jsonOk({ message: { ...message, delivery, delivery_status: delivery.error ? 'FAILED' : 'SENT' }, delivery, conversation: conv });
  } catch (err) {
    return errorResponse(err);
  }
}
