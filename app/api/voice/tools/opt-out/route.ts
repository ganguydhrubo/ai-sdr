import { NextRequest, NextResponse } from 'next/server';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { OptOutRequestSchema } from '@/lib/voice/schemas';
import { getDemoStore } from '@/lib/store/demo-store';
import { getSupabaseClient } from '@/lib/supabase';
import { ComplianceGuard } from '@/lib/compliance/guard';
import { peekTalkNonce, revokeTalkToken } from '@/lib/voice/talk-links';

export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = OptOutRequestSchema.safeParse(raw);
    const reason = parsed.success ? parsed.data.reason : 'Prospect opt-out during voice call';
    const talkRef = raw.talk_ref || raw.initial_context?.talk_ref;

    const store = getDemoStore();
    let lead = store.getLeads()[0];
    let sessionId: string | undefined;

    if (talkRef) {
      const nonceCheck = await peekTalkNonce(talkRef);
      if (nonceCheck.valid && nonceCheck.nonceRecord) {
        sessionId = nonceCheck.nonceRecord.talk_session_id;
        const found = store.getLeads().find((l) => l.id === nonceCheck.nonceRecord?.lead_id);
        if (found) lead = found;
      }
    }

    // Add to global suppression list
    ComplianceGuard.addSuppression({
      email: lead.email,
      phone: lead.phone,
      reason: 'DO_NOT_CONTACT',
    });

    lead.is_suppressed = true;
    lead.suppression_reason = reason;

    if (sessionId) {
      const session = store.getTalkSessions().find((s) => s.id === sessionId);
      if (session) {
        await revokeTalkToken(session.token_hash, reason);
      }
    }

    store.recordAuditLog(
      'USER',
      'PROSPECT_SUPPRESSED_FROM_VOICE_TOOL',
      'lead',
      lead.id,
      `Prospect ${lead.full_name} opted out in-call: ${reason}`
    );

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('leads')
          .update({
            is_suppressed: true,
            suppression_reason: reason,
          })
          .eq('id', lead.id);
      } catch {
        // demo fallback
      }
    }

    return NextResponse.json({
      success: true,
      suppressed: true,
      status: 'REVOKED',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error processing opt-out tool' },
      { status: 500 }
    );
  }
}
