import { NextRequest, NextResponse } from 'next/server';
import { revokeTalkToken, hashToken } from '@/lib/voice/talk-links';
import { getDemoStore } from '@/lib/store/demo-store';
import { getSupabaseClient } from '@/lib/supabase';
import { ComplianceGuard } from '@/lib/compliance/guard';
import { completeLocalCall } from '@/lib/voice/agent';
import type { TalkSession } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Finds the session for a token without the max-calls check (events arrive mid-call). */
function findSession(token: string): TalkSession | undefined {
  const store = getDemoStore();
  const hash = hashToken(token);
  return store.findTalkSessionByTokenHash(hash) || store.getTalkSessions().find((s) => s.token === token);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const body = await req.json().catch(() => ({}));
    const { event, details, durationSeconds, reason, transcript, language, actions } = body;

    const store = getDemoStore();
    const session = findSession(token);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const supabase = getSupabaseClient();

    switch (event) {
      case 'opened': {
        if (['CREATED', 'SENT'].includes(session.status)) {
          session.status = 'OPENED';
          session.opened_at = session.opened_at || new Date().toISOString();
        }
        session.last_opened_at = new Date().toISOString();
        if (supabase) {
          try {
            await supabase.from('talk_sessions').update({ status: session.status, opened_at: session.opened_at, last_opened_at: session.last_opened_at }).eq('id', session.id);
          } catch {
            // fallback
          }
        }
        store.persist();
        break;
      }

      case 'call_started': {
        if (session.status === 'REVOKED' || session.status === 'EXPIRED') {
          return NextResponse.json({ error: `Talk session is ${session.status.toLowerCase()}` }, { status: 403 });
        }
        session.call_count = (session.call_count || 0) + 1;
        session.status = 'CALL_STARTED';
        session.opened_at = session.opened_at || new Date().toISOString();
        store.recordAuditLog(
          'USER',
          'VOICE_CALL_STARTED',
          'talk_session',
          session.id,
          `Prospect initiated WebRTC call via token link. Call count: ${session.call_count}`
        );
        if (supabase) {
          try {
            await supabase
              .from('talk_sessions')
              .update({
                call_count: session.call_count,
                status: 'CALL_STARTED',
                last_opened_at: new Date().toISOString(),
              })
              .eq('id', session.id);
          } catch {
            // fallback
          }
        }
        break;
      }

      case 'call_completed': {
        if (Array.isArray(transcript) && transcript.length > 0) {
          // In-browser agent call: record transcript, extraction and outcomes.
          const call = await completeLocalCall({
            session,
            transcript: transcript
              .filter((t: { role?: string; text?: string }) => (t.role === 'agent' || t.role === 'user') && typeof t.text === 'string')
              .map((t: { role: 'agent' | 'user'; text: string }) => ({ role: t.role, text: t.text })),
            durationSeconds: Number(durationSeconds) || 0,
            language,
            actions,
          });
          if (supabase) {
            try {
              await supabase.from('talk_sessions').update({ status: session.status }).eq('id', session.id);
              await supabase.from('voice_calls').upsert({ ...call });
            } catch {
              // fallback
            }
          }
          return NextResponse.json({ success: true, call_id: call.id, intent: call.intent, summary: call.extracted?.summary });
        }

        if (session.status !== 'REVOKED') session.status = 'COMPLETED';
        store.recordAuditLog(
          'AI_AGENT',
          'VOICE_CALL_COMPLETED',
          'talk_session',
          session.id,
          `WebRTC call completed. Duration: ${durationSeconds || 0}s.`
        );
        if (supabase) {
          try {
            await supabase
              .from('talk_sessions')
              .update({ status: 'COMPLETED' })
              .eq('id', session.id);
          } catch {
            // fallback
          }
        }
        break;
      }

      case 'opt_out': {
        const lead = store.getLeads().find((l) => l.id === session.lead_id);
        if (lead) {
          lead.is_suppressed = true;
          lead.suppression_reason = reason || 'Prospect opted out via talk landing page';
          lead.status = 'DISQUALIFIED';
          lead.updated_at = new Date().toISOString();
          ComplianceGuard.addSuppression({
            email: lead.email,
            phone: lead.phone,
            reason: 'DO_NOT_CONTACT',
          });
        }
        await revokeTalkToken(session.token_hash, reason || 'Prospect 1-click opt-out on talk page');
        store.recordAuditLog(
          'USER',
          'PROSPECT_OPTED_OUT',
          'lead',
          session.lead_id,
          `Prospect exercised TRAI/DPDP opt-out right: ${reason || 'DO NOT CONTACT'}`
        );
        break;
      }

      case 'error': {
        store.recordAuditLog(
          'SYSTEM_WORKER',
          'VOICE_CLIENT_ERROR',
          'talk_session',
          session.id,
          `Client WebRTC error: ${details || 'Unknown audio error'}`
        );
        break;
      }

      default:
        break;
    }

    store.persist();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to process event' },
      { status: 500 }
    );
  }
}
