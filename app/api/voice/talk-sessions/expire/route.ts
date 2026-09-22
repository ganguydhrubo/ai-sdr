import { NextRequest, NextResponse } from 'next/server';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { expireTalkSessions } from '@/lib/voice/sessions';

export const dynamic = 'force-dynamic';

/** Expires overdue talk links. Called hourly by n8n/workflows/talk-link-expiry.json. */
export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }
  const result = await expireTalkSessions();
  return NextResponse.json({ success: true, ...result });
}
