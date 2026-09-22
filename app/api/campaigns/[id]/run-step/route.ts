import { NextRequest } from 'next/server';
import { runStepForLead } from '@/lib/orchestrator/campaigns';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Runs one sequence step for one lead from the Campaigns page. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ step_id?: string; lead_id?: string }>(req);
    if (!body.step_id || !body.lead_id) return jsonError('step_id and lead_id are required', 400);
    const result = await runStepForLead(params.id, body.step_id, body.lead_id);
    if (!result.success) return jsonError(result.error || 'Step failed', 422, { step_type: result.stepType });
    return jsonOk({ step_type: result.stepType, message: result.message, delivery: result.delivery });
  } catch (err) {
    return errorResponse(err);
  }
}
