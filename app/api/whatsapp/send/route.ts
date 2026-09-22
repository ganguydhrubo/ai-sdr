import { NextResponse } from 'next/server';
import { EvolutionWhatsAppEngine } from '@/lib/adapters/whatsapp-evolution';
import { effectiveDeliveryMode } from '@/lib/outreach/dispatch';
import { getDemoStore } from '@/lib/store/demo-store';

export const dynamic = 'force-dynamic';

/** WhatsApp Hub sandbox send — honours the organisation's delivery mode (simulated / live / redirect). */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { instanceName, recipientPhone, recipientName, recipientCompany, baseMessageText } = body;

    if (!recipientPhone || !baseMessageText) {
      return NextResponse.json(
        { success: false, error: 'recipientPhone and baseMessageText are required' },
        { status: 400 }
      );
    }

    const store = getDemoStore();
    const mode = effectiveDeliveryMode();
    const redirectTo = mode === 'LIVE_REDIRECT' ? store.org.outbound_test_phone : undefined;
    const simulate = mode === 'SIMULATED' || (mode === 'LIVE_REDIRECT' && !redirectTo);

    const result = await EvolutionWhatsAppEngine.dispatchSafeMessage(
      {
        instanceName: instanceName || 'apex_sales_01',
        recipientPhone,
        recipientName: recipientName || 'Prospect',
        recipientCompany: recipientCompany || 'Enterprise Lead',
        baseMessageText,
      },
      { simulate, redirectTo }
    );

    store.recordAuditLog(
      'USER',
      result.success ? (result.simulated ? 'WHATSAPP_SANDBOX_SENT_SIMULATED' : 'WHATSAPP_SANDBOX_SENT') : 'WHATSAPP_SANDBOX_FAILED',
      'whatsapp',
      result.messageId || 'sandbox',
      result.success
        ? `Sandbox message to ${result.dispatchedTo || recipientPhone}${result.simulated ? ' (simulated)' : ''}`
        : `Sandbox send failed: ${result.error}`
    );
    store.persist();

    return NextResponse.json({
      success: result.success,
      result,
      deliveryMode: mode,
      note:
        mode === 'SIMULATED'
          ? 'Delivery mode is SIMULATED — nothing was sent. Switch to LIVE in Settings to use the linked WhatsApp number.'
          : mode === 'LIVE_REDIRECT' && !redirectTo
            ? 'LIVE_REDIRECT has no test phone configured — simulated. Add one in Settings.'
            : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch WhatsApp message' },
      { status: 500 }
    );
  }
}
