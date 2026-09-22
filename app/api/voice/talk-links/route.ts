import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { dispatchTalkInvite } from '@/lib/orchestrator/talk-invite';
import { mintTalkToken } from '@/lib/voice/talk-links';
import { flushOutbox } from '@/lib/outreach/dispatch';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/**
 * Mints a "Talk to our AI" link from the Voice Hub.
 * channel MANUAL → link only (copy/QR); EMAIL/WHATSAPP → invite message (approval-aware) that
 * is delivered immediately when no approval is required.
 */
export async function POST(req: NextRequest) {
  try {
    const store = getDemoStore();
    const body = await readJson<{ lead_id?: string; channel?: 'EMAIL' | 'WHATSAPP' | 'MANUAL'; language?: string; expires_in_days?: number; max_calls?: number }>(req);
    const lead = body.lead_id ? store.findLead(body.lead_id) : undefined;
    if (!lead) return jsonError('Lead not found', 404);
    if (lead.is_suppressed) return jsonError(`${lead.full_name} is suppressed`, 422);
    const settings = store.getVoiceSettings();
    if (!settings.voice_enabled || !settings.web_voice_enabled) return jsonError('Web voice is disabled in Voice Settings', 422);
    const channel = body.channel || 'MANUAL';

    if (channel === 'MANUAL') {
      const minted = await mintTalkToken({
        organizationId: store.org.id,
        leadId: lead.id,
        leadName: lead.full_name,
        leadCompany: lead.company_name,
        channel: 'email',
        language: body.language || lead.preferred_language || 'en',
        expiresInDays: body.expires_in_days ?? settings.talk_link_ttl_days,
        maxCalls: body.max_calls ?? settings.talk_link_max_calls,
      });
      store.updateTalkSession(minted.session.id, { channel: 'manual' });
      store.recordAuditLog('USER', 'TALK_LINK_MINTED', 'talk_session', minted.session.id, `Manual talk link minted for ${lead.full_name}`);
      store.persist();
      return jsonOk({ talk_url: minted.talkUrl, session: store.getTalkSession(minted.session.id), token: minted.token });
    }

    const result = await dispatchTalkInvite({
      leadId: lead.id,
      channel,
      language: body.language || lead.preferred_language,
      expiresInDays: body.expires_in_days,
      maxCalls: body.max_calls,
    });
    if (!result.success) return jsonError(result.error || 'Could not mint the talk link', 422);
    let delivery;
    if (result.message?.status === 'QUEUED') {
      const flush = await flushOutbox();
      delivery = flush.results.find((r) => r.message.id === result.message?.id)?.receipt;
    }
    store.persist();
    return jsonOk({
      talk_url: result.talkUrl,
      session: result.session,
      token: result.talkUrl?.split('/talk/')[1],
      message: result.message,
      requires_approval: result.requiresApproval,
      delivery,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
