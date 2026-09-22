import { NextRequest, NextResponse } from 'next/server';
import { resolveTalkToken, revokeTalkToken } from '@/lib/voice/talk-links';
import { getDemoStore } from '@/lib/store/demo-store';
import { getSupabaseClient } from '@/lib/supabase';
import { ComplianceGuard } from '@/lib/compliance/guard';

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const body = await req.json().catch(() => ({}));
    const { event, details, durationSeconds, reason } = body;

    const tokenRes = await resolveTalkToken(token);
    const store = getDemoStore();
    const session = tokenRes.session;

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const supabase = getSupabaseClient();

    switch (event) {
      case 'call_started': {
        session.call_count = (session.call_count || 0) + 1;
        session.status = 'CALL_STARTED';
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
        session.status = 'COMPLETED';
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
          ComplianceGuard.addSuppression({
            email: lead.email,
            phone: lead.phone,
            reason: 'DO_NOT_CONTACT',
          });
        }
        await revokeTalkToken(token, reason || 'Prospect 1-click opt-out on talk page');
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to process event' },
      { status: 500 }
    );
  }
}
