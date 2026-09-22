import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { dispatchTalkInvite } from '@/lib/orchestrator/talk-invite';

export const dynamic = 'force-dynamic';

const TalkInviteRequestSchema = z.object({
  lead_id: z.string().min(1),
  campaign_id: z.string().optional(),
  step_id: z.string().optional(),
  channel: z.enum(['EMAIL', 'WHATSAPP']).optional(),
  language: z.string().optional(),
  expires_in_days: z.number().int().positive().max(30).optional(),
  max_calls: z.number().int().positive().max(10).optional(),
});

/**
 * Mints a personal "Talk to our AI" link and queues the invite message.
 * Called by the n8n talk-invite-dispatch workflow and by the campaign step executor.
 * Protected with the same X-Tool-Secret as the in-call tools.
 */
export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = TalkInviteRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 });
  }

  const result = await dispatchTalkInvite({
    leadId: parsed.data.lead_id,
    campaignId: parsed.data.campaign_id,
    stepId: parsed.data.step_id,
    channel: parsed.data.channel,
    language: parsed.data.language,
    expiresInDays: parsed.data.expires_in_days,
    maxCalls: parsed.data.max_calls,
  });

  if (!result.success) {
    const status = /not found/i.test(result.error || '') ? 404 : 422;
    return NextResponse.json({ success: false, error: result.error }, { status });
  }

  return NextResponse.json({
    success: true,
    message_id: result.message?.id,
    message_status: result.message?.status,
    requires_approval: result.requiresApproval,
    talk_session_id: result.session?.id,
    talk_url: result.talkUrl,
    expires_at: result.session?.expires_at,
    channel: result.message?.channel,
  });
}
