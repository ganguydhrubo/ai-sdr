import { NextRequest } from 'next/server';
import { SDROrchestrator } from '@/lib/orchestrator/sdr-orchestrator';
import { flushOutbox } from '@/lib/outreach/dispatch';
import { getDemoStore } from '@/lib/store/demo-store';
import { errorResponse, jsonError, jsonOk } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Runs the 13-agent SDR workflow (research → score → personalise → guard → queue) for one lead. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getDemoStore();
    if (!store.findLead(params.id)) return jsonError('Lead not found', 404);
    const result = await SDROrchestrator.processLead(params.id);
    let delivery: { sent: number; failed: number } | undefined;
    if (result.message?.status === 'QUEUED') {
      const flush = await flushOutbox();
      delivery = { sent: flush.sent, failed: flush.failed };
    }
    store.persist();
    return jsonOk({
      run: { success: result.success, steps: result.stepsTaken, error: result.error },
      lead: result.lead,
      message: result.message,
      delivery,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
