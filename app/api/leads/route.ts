import { NextRequest } from 'next/server';
import { createLeadRecord, CreateLeadInput } from '@/lib/leads/service';
import { SDROrchestrator } from '@/lib/orchestrator/sdr-orchestrator';
import { getDemoStore } from '@/lib/store/demo-store';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Creates a lead (validated + normalised); `run: true` also runs the 13-agent SDR workflow on it. */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson<CreateLeadInput & { run?: boolean }>(req);
    const outcome = createLeadRecord(body);
    if (!outcome.lead) {
      return jsonError(outcome.error || 'Could not create lead', 400, { duplicate_of: outcome.duplicateOf });
    }
    let run: Awaited<ReturnType<typeof SDROrchestrator.processLead>> | undefined;
    if (body.run) {
      run = await SDROrchestrator.processLead(outcome.lead.id);
      getDemoStore().persist();
    }
    return jsonOk({ lead: outcome.lead, run: run ? { success: run.success, steps: run.stepsTaken, message_id: run.message?.id, error: run.error } : undefined });
  } catch (err) {
    return errorResponse(err);
  }
}
