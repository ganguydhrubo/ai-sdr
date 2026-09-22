import { NextRequest, NextResponse } from 'next/server';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { HandoffRequestSchema } from '@/lib/voice/schemas';
import { getDemoStore, INITIAL_USERS } from '@/lib/store/demo-store';
import { getSupabaseClient } from '@/lib/supabase';
import { peekTalkNonce } from '@/lib/voice/talk-links';
import { Task } from '@/lib/types';

export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = HandoffRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { urgency, reason } = parsed.data;
    const talkRef = raw.talk_ref || raw.initial_context?.talk_ref;

    const store = getDemoStore();
    let lead = store.getLeads()[0];

    if (talkRef) {
      const nonceCheck = await peekTalkNonce(talkRef);
      if (nonceCheck.valid && nonceCheck.nonceRecord) {
        const found = store.getLeads().find((l) => l.id === nonceCheck.nonceRecord?.lead_id);
        if (found) lead = found;
      }
    }

    const handoffId = `hnd_${Date.now()}`;
    const assignedRep = INITIAL_USERS[0].full_name; // Vikram Malhotra (Sales Director)

    const newTask: Task = {
      id: `task_${Date.now()}`,
      organization_id: store.getOrg().id,
      lead_id: lead.id,
      lead_name: lead.full_name,
      assigned_user_id: INITIAL_USERS[0].id,
      assigned_user_name: assignedRep,
      title: `Urgent Voice Handoff: ${lead.company_name}`,
      description: `Prospect requested live human SDR intervention during AI voice call: ${reason}`,
      priority: urgency === 'CRITICAL' ? 'URGENT' : urgency === 'HIGH' ? 'HIGH' : 'MEDIUM',
      status: 'PENDING',
      created_by_ai: true,
      created_at: new Date().toISOString(),
    };

    store.tasks.unshift(newTask);
    lead.status = 'SALES_HANDOFF';
    lead.requires_human_attention = true;
    lead.attention_reason = `Voice call handoff: ${reason}`;

    store.recordAuditLog(
      'AI_AGENT',
      'VOICE_SDR_HANDOFF_TRIGGERED',
      'lead',
      lead.id,
      `SDR handoff triggered for ${lead.full_name}. Priority: ${urgency}. Reason: ${reason}`
    );

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('tasks').insert(newTask);
        await supabase
          .from('leads')
          .update({
            status: 'SALES_HANDOFF',
            requires_human_attention: true,
            attention_reason: newTask.description,
          })
          .eq('id', lead.id);
      } catch {
        // demo fallback
      }
    }

    return NextResponse.json({
      success: true,
      handoff_id: handoffId,
      assigned_rep: assignedRep,
      status: 'QUEUED',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error executing sales handoff' },
      { status: 500 }
    );
  }
}
