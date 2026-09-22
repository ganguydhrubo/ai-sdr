import { NextRequest, NextResponse } from 'next/server';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { listTalkSessions } from '@/lib/voice/sessions';
import { TalkSessionStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: TalkSessionStatus[] = ['CREATED', 'SENT', 'OPENED', 'CALL_STARTED', 'COMPLETED', 'EXPIRED', 'REVOKED'];

/**
 * Lists talk sessions for the n8n workflows (reminders, expiry, reporting).
 * Query: status (comma-separated), sent_older_than_hours, unopened=true, campaign_id, limit.
 * Tokens are never returned — only hashes exist after minting.
 */
export async function GET(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams;
  const statusParam = q.get('status');
  const statuses = statusParam
    ? (statusParam.split(',').map((s) => s.trim().toUpperCase()) as TalkSessionStatus[])
    : undefined;
  if (statuses && statuses.some((s) => !STATUSES.includes(s))) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }
  const hours = q.get('sent_older_than_hours');
  const limit = q.get('limit');

  const sessions = listTalkSessions({
    status: statuses,
    sentOlderThanHours: hours ? Number(hours) : undefined,
    unopened: q.get('unopened') === 'true',
    campaignId: q.get('campaign_id') || undefined,
    limit: limit ? Number(limit) : undefined,
  }).map((s) => ({
    id: s.id,
    lead_id: s.lead_id,
    lead_name: s.lead_name,
    lead_company: s.lead_company,
    campaign_id: s.campaign_id,
    campaign_step_id: s.campaign_step_id,
    channel: s.channel,
    status: s.status,
    language: s.language,
    expires_at: s.expires_at,
    sent_at: s.sent_at,
    opened_at: s.opened_at,
    call_count: s.call_count,
    max_calls: s.max_calls,
  }));

  return NextResponse.json({ count: sessions.length, sessions });
}
