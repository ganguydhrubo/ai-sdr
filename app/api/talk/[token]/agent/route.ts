import { NextRequest, NextResponse } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { hashToken, peekTalkNonce } from '@/lib/voice/talk-links';
import { runTalkAgentTurn } from '@/lib/voice/agent';

export const dynamic = 'force-dynamic';

/**
 * One turn of the in-browser voice agent. Body: { nonce, history, user_text|null, language }.
 * The nonce minted for this call proves the caller is on a valid talk link; the session's
 * max-calls limit was already enforced when the nonce was issued.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { nonce, history, user_text: userText, language } = body as {
      nonce?: string;
      history?: Array<{ role: 'agent' | 'user'; text: string }>;
      user_text?: string | null;
      language?: string;
    };

    const store = getDemoStore();
    const hash = hashToken(params.token);
    const session = store.findTalkSessionByTokenHash(hash) || store.getTalkSessions().find((s) => s.token === params.token);
    if (!session) return NextResponse.json({ error: 'Talk session not found' }, { status: 404 });
    if (session.status === 'REVOKED' || session.status === 'EXPIRED') {
      return NextResponse.json({ error: `Talk session is ${session.status.toLowerCase()}` }, { status: 403 });
    }
    if (!nonce) return NextResponse.json({ error: 'nonce is required' }, { status: 400 });
    const nonceCheck = await peekTalkNonce(nonce);
    if (!nonceCheck.valid || nonceCheck.nonceRecord?.talk_session_id !== session.id) {
      return NextResponse.json({ error: nonceCheck.error || 'Invalid call nonce' }, { status: 403 });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((t) => (t.role === 'agent' || t.role === 'user') && typeof t.text === 'string')
          .slice(-16)
          .map((t) => ({ role: t.role, text: t.text.slice(0, 1000) }))
      : [];
    const text = typeof userText === 'string' && userText.trim() ? userText.trim().slice(0, 1000) : null;

    const turn = await runTalkAgentTurn({ session, history: safeHistory, userText: text, language });
    return NextResponse.json({
      success: true,
      reply: turn.reply,
      intent: turn.intent,
      actions: turn.actions,
      applied: turn.applied,
      end_call: turn.end_call,
      simulated: turn.simulated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Agent turn failed' }, { status: 500 });
  }
}
