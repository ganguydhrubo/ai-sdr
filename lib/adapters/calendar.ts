export interface TimeSlot {
  start: string; // ISO 8601 string
  end: string;
  isAvailable: boolean;
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
  error?: string;
}

export interface CalendarProvider {
  name: string;
  getAvailableSlots(startDate: Date, daysAhead?: number): Promise<TimeSlot[]>;
  bookSlot(request: BookingRequest): Promise<BookingResult>;
}

export class DemoCalendarProvider implements CalendarProvider {
  public name = 'DemoCalendarProvider (Google Meet Simulator)';

  public async getAvailableSlots(startDate: Date, daysAhead = 3): Promise<TimeSlot[]> {
    const slots: TimeSlot[] = [];
    const baseDate = new Date(startDate);

    for (let day = 1; day <= daysAhead; day++) {
      const slotDate = new Date(baseDate);
      slotDate.setDate(slotDate.getDate() + day);

      // Offer slots at 11:30 AM IST and 3:30 PM IST (working business hours)
      const morningSlot = new Date(slotDate);
      morningSlot.setHours(11, 30, 0, 0);
      const morningEnd = new Date(morningSlot);
      morningEnd.setMinutes(morningEnd.getMinutes() + 30);

      const afternoonSlot = new Date(slotDate);
      afternoonSlot.setHours(15, 30, 0, 0);
      const afternoonEnd = new Date(afternoonSlot);
      afternoonEnd.setMinutes(afternoonEnd.getMinutes() + 30);

      slots.push({
        start: morningSlot.toISOString(),
        end: morningEnd.toISOString(),
        isAvailable: true,
      });

      slots.push({
        start: afternoonSlot.toISOString(),
        end: afternoonEnd.toISOString(),
        isAvailable: true,
      });
    }

    return slots;
  }

  public async bookSlot(request: BookingRequest): Promise<BookingResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const randomHash = Math.random().toString(36).substring(2, 6);
    return {
      success: true,
      meetingId: `meet_${Date.now()}`,
      calendarEventId: `cal_evt_${Date.now()}`,
      meetUrl: `https://meet.google.com/apx-${randomHash}-sdr`,
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

  public static async queryAvailableSlots(startDate: Date): Promise<TimeSlot[]> {
    return this.getProvider().getAvailableSlots(startDate);
  }

  public static async scheduleMeeting(request: BookingRequest): Promise<BookingResult> {
    return this.getProvider().bookSlot(request);
  }
}
