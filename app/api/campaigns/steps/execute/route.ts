import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { SDROrchestrator } from '@/lib/orchestrator/sdr-orchestrator';

export const dynamic = 'force-dynamic';

const ExecuteStepSchema = z.object({
  lead_id: z.string().min(1),
  step_id: z.string().min(1),
});

/** Executes one campaign sequence step (MESSAGE or TALK_INVITE) for a lead — used by n8n cadence workflows. */
export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = ExecuteStepSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 });
  }

  const result = await SDROrchestrator.executeCampaignStep(parsed.data.lead_id, parsed.data.step_id);
  if (!result.success) {
    const status = /not found/i.test(result.error || '') ? 404 : 422;
    return NextResponse.json({ success: false, step_type: result.stepType, error: result.error }, { status });
  }

  return NextResponse.json({
    success: true,
    step_type: result.stepType,
    message_id: result.message?.id,
    message_status: result.message?.status,
    talk_session_id: result.message?.talk_session_id,
  });
}
