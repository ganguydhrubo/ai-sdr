import { NextResponse } from 'next/server';
import { computeVoiceAnalytics } from '@/lib/voice/analytics';

export const dynamic = 'force-dynamic';

/** Voice-module metrics for the dashboard and external reporting. */
export async function GET() {
  return NextResponse.json(computeVoiceAnalytics());
}
