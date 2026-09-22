import { NextRequest } from 'next/server';
import { SDROrchestrator } from '@/lib/orchestrator/sdr-orchestrator';
import { deliverConversationReply } from '@/lib/outreach/dispatch';
import { getDemoStore } from '@/lib/store/demo-store';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';
import type { Channel } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Records an inbound prospect message (simulator, webhook or manual entry), classifies it,
 * updates the lead/conversation, drafts the AI reply and — when autonomous outreach is on or
 * `send` is true — delivers that reply over the channel.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getDemoStore();
    const lead = store.findLead(params.id);
    if (!lead) return jsonError('Lead not found', 404);
    const body = await readJson<{ text?: string; channel?: Channel; sender_name?: string; send?: boolean }>(req);
    const text = (body.text || '').trim();
    if (!text) return jsonError('text is required', 400);
    const channel: Channel = body.channel && ['EMAIL', 'WHATSAPP', 'LINKEDIN', 'VOICE'].includes(body.channel) ? body.channel : 'EMAIL';

    const result = await SDROrchestrator.handleInboundReply({ leadId: lead.id, channel, messageText: text, senderName: body.sender_name });

    const conv = result.conversation;
    const draft = [...conv.messages].reverse().find((m) => m.sender_type === 'AI_SDR' && m.content === result.aiReply);
    let delivery;
    if (draft) {
      draft.delivery_status = 'DRAFT';
      const shouldSend = body.send ?? store.org.is_autonomous_outreach_enabled;
      if (shouldSend) {
        delivery = await deliverConversationReply(conv.id, draft.id);
      }
    }
    store.persist();
    return jsonOk({
      intent: result.intent,
      next_action: result.nextAction,
      handoff_triggered: result.handoffTriggered,
      ai_reply: result.aiReply,
      ai_reply_message_id: draft?.id,
      delivery,
      conversation: conv,
      lead,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
