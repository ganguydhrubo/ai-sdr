import { flushOutbox } from '@/lib/outreach/dispatch';
import { errorResponse, jsonOk } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Sends every QUEUED message (non-MANUAL campaigns). Also called after enrolments. */
export async function POST() {
  try {
    const result = await flushOutbox();
    return jsonOk({
      sent: result.sent,
      failed: result.failed,
      results: result.results.map((r) => ({ message_id: r.message.id, status: r.message.status, delivery: r.receipt })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
