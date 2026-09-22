import { NextRequest, NextResponse } from 'next/server';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { AvailabilityRequestSchema } from '@/lib/voice/schemas';

export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = AvailabilityRequestSchema.safeParse(raw);
    const daysAhead = parsed.success ? parsed.data.days_ahead : 5;

    const slots: string[] = [];
    const now = new Date();

    // Generate upcoming weekday slots between 10:00 and 17:00 IST
    for (let d = 1; d <= daysAhead + 2 && slots.length < 6; d++) {
      const targetDate = new Date(now.getTime() + d * 86400000);
      const dayOfWeek = targetDate.getDay();

      // Skip Sunday (0) and Saturday (6)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dateStr = targetDate.toISOString().split('T')[0];
      slots.push(`${dateStr}T10:30:00+05:30`);
      slots.push(`${dateStr}T15:00:00+05:30`);
    }

    return NextResponse.json({
      available_slots: slots.slice(0, 6),
      timezone: 'Asia/Kolkata',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error generating calendar availability' },
      { status: 500 }
    );
  }
}
