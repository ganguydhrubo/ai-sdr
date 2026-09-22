import { NextRequest, NextResponse } from 'next/server';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { BookMeetingRequestSchema } from '@/lib/voice/schemas';
import { getDemoStore } from '@/lib/store/demo-store';
import { getSupabaseClient } from '@/lib/supabase';
import { peekTalkNonce } from '@/lib/voice/talk-links';
import { createMeetingRoomUrl } from '@/lib/adapters/calendar';
import { Meeting } from '@/lib/types';

export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = BookMeetingRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { selected_slot, topic } = parsed.data;
    const talkRef = raw.talk_ref || raw.initial_context?.talk_ref;

    const store = getDemoStore();
    let lead = store.getLeads()[0];

    if (talkRef) {
      const nonceCheck = await peekTalkNonce(talkRef);
      if (nonceCheck.valid && nonceCheck.nonceRecord) {
        const foundLead = store.getLeads().find((l) => l.id === nonceCheck.nonceRecord?.lead_id);
        if (foundLead) lead = foundLead;
      }
    }

    const meetingId = `meet_${Date.now()}`;
    const meetLink = createMeetingRoomUrl(lead.full_name || lead.id);

    const newMeeting: Meeting = {
      id: meetingId,
      organization_id: store.getOrg().id,
      lead_id: lead.id,
      lead_name: lead.full_name,
      lead_company: lead.company_name || 'Prospect Enterprise',
      title: topic || 'Apex AI SDR Discovery Demo',
      start_time: selected_slot,
      end_time: new Date(new Date(selected_slot).getTime() + 15 * 60000).toISOString(),
      meet_url: meetLink,
      calendar_provider: 'Jitsi Meet',
      status: 'CONFIRMED',
      sales_brief: {
        account_overview: `Discovery demo booked directly over voice call for ${lead.company_name}.`,
        contact_role: lead.job_title || 'Executive',
        company_context: 'Lead qualified by Dograh WebRTC agent.',
        verified_pain_points: ['Manual follow-up latency'],
        buying_signals: ['Direct slot booking'],
        recommended_questions: ['What is your current monthly SDR touch volume?'],
        anticipated_objections: ['Implementation timeline'],
        recommended_discovery_approach: 'Focus on Indian CRM sync & DLT compliance.',
      },
      created_at: new Date().toISOString(),
    };

    store.meetings.unshift(newMeeting);
    lead.status = 'MEETING';

    store.recordAuditLog(
      'AI_AGENT',
      'VOICE_MEETING_SCHEDULED',
      'meeting',
      meetingId,
      `Voice agent booked meeting for ${lead.full_name} (${lead.company_name}) at ${selected_slot}.`
    );

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('meetings').insert(newMeeting);
        await supabase.from('leads').update({ status: 'MEETING' }).eq('id', lead.id);
      } catch {
        // demo fallback
      }
    }

    return NextResponse.json({
      success: true,
      meeting_id: meetingId,
      meet_link: meetLink,
      scheduled_at: selected_slot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error booking voice meeting' },
      { status: 500 }
    );
  }
}
