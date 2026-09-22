import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationStatus } from '@/lib/integrations/status';

export const dynamic = 'force-dynamic';

/** Live health of every integration (Groq, Resend, Evolution API, Supabase, voice, persistence). */
export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get('fresh') === 'true';
  return NextResponse.json(await getIntegrationStatus({ fresh }));
}
