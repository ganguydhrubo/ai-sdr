import { NextRequest, NextResponse } from 'next/server';
import { CalendarAdapter } from '@/lib/adapters/calendar';

export const dynamic = 'force-dynamic';

/** Available 30-minute slots (IST business hours) for the booking dialog and the voice agent. */
export async function GET(req: NextRequest) {
  const days = Math.min(14, Math.max(1, Number(req.nextUrl.searchParams.get('days') || 5)));
  const slots = await CalendarAdapter.queryAvailableSlots(new Date(), days);
  return NextResponse.json({ timezone: 'Asia/Kolkata', slots });
}
