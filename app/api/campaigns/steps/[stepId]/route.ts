import { NextRequest } from 'next/server';
import { updateCampaignStep } from '@/lib/orchestrator/campaigns';
import { errorResponse, jsonOk, readJson } from '@/lib/api/respond';
import type { CampaignStep } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Toggle / edit one sequence step (templates, delay, active flag). */
export async function PATCH(req: NextRequest, { params }: { params: { stepId: string } }) {
  try {
    const body = await readJson<Partial<Pick<CampaignStep, 'is_active' | 'name' | 'description' | 'subject_template' | 'body_template' | 'delay_days'>>>(req);
    const step = updateCampaignStep(params.stepId, body);
    return jsonOk({ step });
  } catch (err) {
    return errorResponse(err);
  }
}
