import { NextRequest, NextResponse } from 'next/server';
import { getVoiceProvider } from '@/lib/voice/provider';
import { DograhWebhookPayloadSchema } from '@/lib/voice/schemas';
import { getDemoStore } from '@/lib/store/demo-store';

export const dynamic = 'force-dynamic';

/**
 * Dograh end-of-call webhook (docs/voice/DOGRAH_CONTRACTS.md, Section 4).
 *
 * Order of operations matters:
 *   1. read the RAW body (HMAC verification must see the exact bytes Dograh signed),
 *   2. verify X-Webhook-Secret against the active provider,
 *   3. parse + validate the JSON against DograhWebhookPayloadSchema,
 *   4. hand the payload to provider.processWebhook(), which records the call and
 *      applies the post-call lead actions (opt-out suppression, meeting, handoff).
 */
export async function POST(req: NextRequest) {
  const provider = getVoiceProvider();

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request body' }, { status: 400 });
  }

  const signatureHeader = req.headers.get('x-webhook-secret') ?? undefined;
  if (!provider.verifyWebhookSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Webhook-Secret' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = DograhWebhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid Dograh webhook payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await provider.processWebhook(parsed.data);

    getDemoStore().recordAuditLog(
      'SYSTEM_WORKER',
      result.duplicate ? 'VOICE_WEBHOOK_DUPLICATE_IGNORED' : 'VOICE_WEBHOOK_PROCESSED',
      'voice_call',
      result.callRecord?.id || String(parsed.data.workflow_run_id),
      `Dograh end-of-call webhook for run ${parsed.data.workflow_run_id} handled by the ${provider.name} provider` +
        (result.duplicate ? ' (duplicate delivery, no side effects re-applied).' : '.')
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Webhook processing failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: provider.name,
      duplicate: result.duplicate ?? false,
      call_id: result.callRecord?.id,
      status: result.callRecord?.status,
      lead_id: result.callRecord?.lead_id,
      extracted: result.extracted,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error processing Dograh webhook' },
      { status: 500 }
    );
  }
}
