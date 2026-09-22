import { NextRequest, NextResponse } from 'next/server';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { getDemoStore } from '@/lib/store/demo-store';
import { VoiceCallStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Lists voice calls for follow-up automation and reporting.
 * Query: status, since (ISO timestamp — calls that ended after it), lead_id, limit.
 * Transcripts are not returned here; the follow-up workflow only needs the extracted outcome.
 */
export async function GET(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams;
  const status = q.get('status')?.toUpperCase() as VoiceCallStatus | undefined;
  const since = q.get('since') ? new Date(q.get('since') as string).getTime() : undefined;
  const leadId = q.get('lead_id') || undefined;
  const limit = Number(q.get('limit') || 100);

  const calls = getDemoStore()
    .getVoiceCalls()
    .filter((c) => (status ? c.status === status : true))
    .filter((c) => (leadId ? c.lead_id === leadId : true))
    .filter((c) => (since !== undefined && !Number.isNaN(since) ? new Date(c.ended_at || c.started_at || 0).getTime() > since : true))
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      lead_id: c.lead_id,
      lead_name: c.lead_name,
      lead_company: c.lead_company,
      talk_session_id: c.talk_session_id,
      mode: c.mode,
      provider: c.provider,
      provider_run_id: c.provider_run_id,
      status: c.status,
      started_at: c.started_at,
      ended_at: c.ended_at,
      duration_seconds: c.duration_seconds,
      intent: c.intent,
      sentiment: c.sentiment,
      extracted: c.extracted,
      recording_url: c.recording_url,
      carrier_cost_estimate_inr: c.carrier_cost_estimate_inr,
    }));

  return NextResponse.json({ count: calls.length, calls });
}
