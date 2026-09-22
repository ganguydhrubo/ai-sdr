import { NextRequest } from 'next/server';
import { createCampaign, CreateCampaignInput } from '@/lib/orchestrator/campaigns';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Creates a campaign with a default 4-touch sequence (opener → follow-up → talk link → close). */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson<CreateCampaignInput>(req);
    if (!body.name?.trim()) return jsonError('name is required', 400);
    const { campaign, steps } = createCampaign(body);
    return jsonOk({ campaign, steps });
  } catch (err) {
    return errorResponse(err);
  }
}
