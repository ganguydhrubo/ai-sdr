import { NextRequest } from 'next/server';
import { updateCampaign } from '@/lib/orchestrator/campaigns';
import { getDemoStore } from '@/lib/store/demo-store';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';
import type { Campaign } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const store = getDemoStore();
  const campaign = store.campaigns.find((c) => c.id === params.id);
  if (!campaign) return jsonError('Campaign not found', 404);
  return jsonOk({ campaign, steps: store.getCampaignSteps(campaign.id) });
}

/** Approval mode, status (pause/resume), name/persona/industry/daily limit. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<Partial<Pick<Campaign, 'name' | 'description' | 'status' | 'approval_mode' | 'target_persona' | 'target_industry' | 'daily_lead_limit'>>>(req);
    const campaign = updateCampaign(params.id, body);
    return jsonOk({ campaign });
  } catch (err) {
    return errorResponse(err);
  }
}
