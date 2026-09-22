import { NextRequest } from 'next/server';
import { importLeadsFromCsv } from '@/lib/leads/service';
import { SAMPLE_LEADS_CSV } from '@/lib/leads/csv';
import { errorResponse, jsonError, jsonOk } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/**
 * Imports leads from CSV. Accepts JSON {csv, run, sample} or a raw text/csv body (?run=true).
 * `sample: true` imports the bundled Indian B2B sample file.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let csv = '';
    let run = req.nextUrl.searchParams.get('run') === 'true';
    if (contentType.includes('application/json')) {
      const body = (await req.json().catch(() => ({}))) as { csv?: string; run?: boolean; sample?: boolean };
      csv = body.sample ? SAMPLE_LEADS_CSV : body.csv || '';
      run = !!body.run;
    } else {
      csv = await req.text();
    }
    if (!csv.trim()) return jsonError('No CSV content received', 400);
    if (csv.length > 2_000_000) return jsonError('CSV too large (max 2 MB)', 413);
    const summary = await importLeadsFromCsv(csv, { runAgent: run });
    return jsonOk({ summary });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET() {
  return new Response(SAMPLE_LEADS_CSV, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="apexsdr-sample-leads.csv"' },
  });
}
