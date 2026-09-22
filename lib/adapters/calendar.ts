import type { Meeting } from '../types';

export interface TimeSlot {
  start: string; // ISO 8601 string
  end: string;
  isAvailable: boolean;
  /** Human label in IST, e.g. "Thu 24 Sep, 11:30 AM" */
  label: string;
}

export interface BookingRequest {
  leadId: string;
  leadName: string;
  leadEmail: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  hostUserId?: string;
}

export interface BookingResult {
  success: boolean;
  meetingId: string;
  calendarEventId: string;
  meetUrl: string;
  provider: string;
  error?: string;
}

export interface CalendarProvider {
  name: string;
  getAvailableSlots(startDate: Date, daysAhead?: number): Promise<TimeSlot[]>;
  bookSlot(request: BookingRequest): Promise<BookingResult>;
}

const IST_OFFSET_MINUTES = 330;

/** Returns the IST calendar date components for a UTC instant. */
function istParts(date: Date): { y: number; m: number; d: number; weekday: number } {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate(), weekday: shifted.getUTCDay() };
}

/** Builds a UTC instant for a wall-clock time in IST. */
function istInstant(y: number, m: number, d: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(y, m, d, hour, minute) - IST_OFFSET_MINUTES * 60000);
}

export function formatIstLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

/** Slug used for free Jitsi Meet rooms — no account, no cost, works in any browser. */
export function createMeetingRoomUrl(seed: string): string {
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24);
  const suffix = Math.random().toString(36).substring(2, 8);
  return `https://meet.jit.si/ApexSDR-${slug || 'discovery'}-${suffix}`;
}

/**
 * Offers 11:30 and 15:30 IST slots on the next business days (Mon–Sat) — the free calendar
 * provider. The same slots are read aloud by the voice agent.
 */
export class DemoCalendarProvider implements CalendarProvider {
  public name = 'Jitsi Meet';

  public async getAvailableSlots(startDate: Date, daysAhead = 3): Promise<TimeSlot[]> {
    const slots: TimeSlot[] = [];
    const base = istParts(startDate);
    let offset = 1;
    while (slots.length < daysAhead * 2 && offset < daysAhead + 7) {
      const dayInstant = istInstant(base.y, base.m, base.d + offset, 0, 0);
      const parts = istParts(dayInstant);
      offset++;
      if (parts.weekday === 0) continue; // skip Sundays
      for (const [hour, minute] of [
        [11, 30],
        [15, 30],
      ]) {
        const start = istInstant(parts.y, parts.m, parts.d, hour, minute);
        const end = new Date(start.getTime() + 30 * 60000);
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          isAvailable: true,
          label: formatIstLabel(start.toISOString()),
        });
      }
    }
    return slots.slice(0, daysAhead * 2);
  }

  public async bookSlot(request: BookingRequest): Promise<BookingResult> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const id = `meet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return {
      success: true,
      meetingId: id,
      calendarEventId: `cal_evt_${Date.now()}`,
      meetUrl: createMeetingRoomUrl(request.leadName || request.leadId),
      provider: this.name,
    };
  }
}

export class CalendarAdapter {
  private static provider: CalendarProvider;

  public static getProvider(): CalendarProvider {
    if (!this.provider) {
      this.provider = new DemoCalendarProvider();
    }
    return this.provider;
  }

  public static async queryAvailableSlots(startDate: Date, daysAhead = 3): Promise<TimeSlot[]> {
    return this.getProvider().getAvailableSlots(startDate, daysAhead);
  }

  public static async scheduleMeeting(request: BookingRequest): Promise<BookingResult> {
    return this.getProvider().bookSlot(request);
  }
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** RFC 5545 invite for a meeting — attached to invite emails and downloadable from the Meetings page. */
export function buildMeetingIcs(meeting: Meeting, organizer: { name: string; email: string }, attendeeEmail?: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ApexSDR//Meetings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@apexsdr`,
    `DTSTAMP:${icsDate(meeting.created_at || new Date().toISOString())}`,
    `DTSTART:${icsDate(meeting.start_time)}`,
    `DTEND:${icsDate(meeting.end_time)}`,
    `SUMMARY:${icsEscape(meeting.title)}`,
    `DESCRIPTION:${icsEscape(`${meeting.description || 'Discovery call'}\nJoin: ${meeting.meet_url}`)}`,
    `LOCATION:${icsEscape(meeting.meet_url)}`,
    `URL:${meeting.meet_url}`,
    `ORGANIZER;CN=${icsEscape(organizer.name)}:mailto:${organizer.email}`,
  ];
  if (attendeeEmail) {
    lines.push(`ATTENDEE;CN=${icsEscape(meeting.lead_name)};RSVP=TRUE:mailto:${attendeeEmail}`);
  }
  lines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
