import { NextRequest } from 'next/server';
import { enrollLeads } from '@/lib/orchestrator/campaigns';
import { getDemoStore } from '@/lib/store/demo-store';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/**
 * Enrols leads and runs step 1 for each. Body: { lead_ids: string[] } or { filter: "QUALIFIED"|"ALL" }.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ lead_ids?: string[]; filter?: 'QUALIFIED' | 'ALL' | 'NEW'; execute_first_step?: boolean }>(req);
    const store = getDemoStore();
    let leadIds = Array.isArray(body.lead_ids) ? body.lead_ids : [];
    if (!leadIds.length && body.filter) {
      leadIds = store.leads
        .filter((l) => !l.is_suppressed)
        .filter((l) =>
          body.filter === 'ALL'
            ? true
            : body.filter === 'NEW'
              ? l.status === 'NEW'
              : ['QUALIFIED', 'NEW', 'OUTREACH'].includes(l.status) && (l.score?.score ?? 0) >= store.icp.minimum_qualifying_score
        )
        .map((l) => l.id);
    }
    if (!leadIds.length) return jsonError('No leads selected', 400);
    const result = await enrollLeads(params.id, leadIds, { executeFirstStep: body.execute_first_step });
    return jsonOk({
      campaign: result.campaign,
      enrolled: result.enrolled,
      already_enrolled: result.alreadyEnrolled,
      drafted: result.drafted,
      queued: result.queued,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
