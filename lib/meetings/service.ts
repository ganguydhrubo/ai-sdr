import { getDemoStore } from '../store/demo-store';
import { CalendarAdapter, buildMeetingIcs, formatIstLabel } from '../adapters/calendar';
import { SDROrchestrator } from '../orchestrator/sdr-orchestrator';
import { sendLeadEmail } from '../outreach/dispatch';
import type { DeliveryReceipt, Meeting } from '../types';

export interface BookMeetingInput {
  leadId: string;
  startTime?: string;
  durationMinutes?: number;
  title?: string;
  description?: string;
  hostUserId?: string;
  /** Generate the AI sales brief for the AE (default true). */
  withBrief?: boolean;
  /** Email the invite (.ics) to the lead right away (honours the delivery mode). */
  sendInvite?: boolean;
}

export async function bookMeeting(input: BookMeetingInput): Promise<{ meeting: Meeting; invite?: DeliveryReceipt }> {
  const store = getDemoStore();
  const lead = store.findLead(input.leadId);
  if (!lead) throw new Error(`Lead not found: ${input.leadId}`);
  if (lead.is_suppressed) throw new Error(`${lead.full_name} is suppressed; meetings cannot be booked`);

  let start: Date;
  if (input.startTime) {
    start = new Date(input.startTime);
    if (Number.isNaN(start.getTime())) throw new Error('Invalid start time');
  } else {
    const slots = await CalendarAdapter.queryAvailableSlots(new Date(), 2);
    start = new Date(slots[0].start);
  }
  const end = new Date(start.getTime() + (input.durationMinutes || 30) * 60000);
  const title = input.title?.trim() || `Discovery Session: ${store.org.name.split(' ')[0]} SDR x ${lead.company_name}`;

  const booking = await CalendarAdapter.scheduleMeeting({
    leadId: lead.id,
    leadName: lead.full_name,
    leadEmail: lead.email,
    title,
    description: input.description,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    hostUserId: input.hostUserId,
  });
  if (!booking.success) throw new Error(booking.error || 'Calendar booking failed');

  const host = store.users.find((u) => u.id === input.hostUserId) || store.users.find((u) => u.role === 'SALES_REP') || store.users[0];
  const meeting = store.addMeeting({
    id: booking.meetingId,
    lead_id: lead.id,
    lead_name: lead.full_name,
    lead_company: lead.company_name || '',
    host_user_id: host?.id,
    host_user_name: host?.full_name,
    title,
    description: input.description || `Discovery call with ${lead.full_name} (${lead.job_title || 'decision maker'}) at ${lead.company_name}.`,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    meet_url: booking.meetUrl,
    calendar_provider: booking.provider,
    status: 'CONFIRMED',
    sales_brief: lead.sales_brief,
  });

  lead.status = 'MEETING';
  lead.updated_at = new Date().toISOString();
  store.recordAuditLog('AI_AGENT', 'MEETING_BOOKED', 'meeting', meeting.id, `Booked ${formatIstLabel(meeting.start_time)} IST with ${lead.full_name} — ${booking.meetUrl}`);

  if (input.withBrief ?? true) {
    try {
      meeting.sales_brief = await SDROrchestrator.generateSalesBrief(lead.id);
    } catch (err) {
      store.recordAuditLog('SYSTEM_WORKER', 'SALES_BRIEF_FAILED', 'meeting', meeting.id, (err as Error).message);
    }
  }

  let invite: DeliveryReceipt | undefined;
  if (input.sendInvite) {
    invite = await sendMeetingInvite(meeting.id);
  }
  store.persist();
  return { meeting, invite };
}

export async function sendMeetingInvite(meetingId: string): Promise<DeliveryReceipt> {
  const store = getDemoStore();
  const meeting = store.meetings.find((m) => m.id === meetingId);
  if (!meeting) throw new Error(`Meeting not found: ${meetingId}`);
  const lead = store.findLead(meeting.lead_id);
  if (!lead) throw new Error(`Lead not found for meeting ${meetingId}`);
  if (!lead.email) throw new Error(`${lead.full_name} has no email address on file`);
  const host = store.users.find((u) => u.id === meeting.host_user_id) || store.users[0];
  const ics = buildMeetingIcs(meeting, { name: host?.full_name || store.org.name, email: host?.email || `sales@${store.org.domain || 'apextech.in'}` }, lead.email);
  const when = formatIstLabel(meeting.start_time);
  const receipt = await sendLeadEmail(lead, {
    subject: `Invitation: ${meeting.title} — ${when} IST`,
    body: `Hi ${lead.first_name},\n\nConfirming our ${Math.round((new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime()) / 60000)}-minute call on ${when} IST.\n\nJoin from any browser (no account needed): ${meeting.meet_url}\n\nThe calendar invite is attached.\n\nBest regards,\n${host?.full_name || store.org.name}\n${store.org.name}`,
    icsAttachment: { filename: 'apexsdr-meeting.ics', content: ics },
  });
  if (!receipt.error) meeting.invite_sent_at = receipt.attempted_at;
  store.recordAuditLog(
    'SYSTEM_WORKER',
    receipt.error ? 'MEETING_INVITE_FAILED' : receipt.simulated ? 'MEETING_INVITE_SENT_SIMULATED' : 'MEETING_INVITE_SENT',
    'meeting',
    meeting.id,
    receipt.error ? `Invite to ${lead.full_name} failed: ${receipt.error}` : `Invite delivered to ${receipt.redirected_to || lead.email} via ${receipt.provider}`
  );
  store.persist();
  return receipt;
}

export function meetingIcs(meetingId: string): { filename: string; content: string } {
  const store = getDemoStore();
  const meeting = store.meetings.find((m) => m.id === meetingId);
  if (!meeting) throw new Error(`Meeting not found: ${meetingId}`);
  const lead = store.findLead(meeting.lead_id);
  const host = store.users.find((u) => u.id === meeting.host_user_id) || store.users[0];
  return {
    filename: `${meeting.id}.ics`,
    content: buildMeetingIcs(meeting, { name: host?.full_name || store.org.name, email: host?.email || `sales@${store.org.domain || 'apextech.in'}` }, lead?.email),
  };
}
