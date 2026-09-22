import { NextRequest } from 'next/server';
import { SDROrchestrator } from '@/lib/orchestrator/sdr-orchestrator';
import { getDemoStore } from '@/lib/store/demo-store';
import { errorResponse, jsonError, jsonOk } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Generates (or regenerates) the AI sales brief for a lead. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getDemoStore();
    const lead = store.findLead(params.id);
    if (!lead) return jsonError('Lead not found', 404);
    const brief = await SDROrchestrator.generateSalesBrief(lead.id);
    return jsonOk({ brief, generated_at: lead.sales_brief_generated_at });
  } catch (err) {
    return errorResponse(err);
  }
}
