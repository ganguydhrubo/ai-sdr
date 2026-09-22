import { NextResponse } from 'next/server';
import { EvolutionWhatsAppEngine } from '@/lib/adapters/whatsapp-evolution';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const instanceName = searchParams.get('instance') || 'apex_sales_01';

    // First check if already connected
    const currentStatus = await EvolutionWhatsAppEngine.checkLiveStatus(instanceName);
    if (currentStatus.status === 'CONNECTED') {
      return NextResponse.json({
        success: true,
        status: 'CONNECTED',
        instance: currentStatus,
      });
    }

    // Otherwise generate or fetch fresh live QR code from Baileys / Evolution API
    const qrResult = await EvolutionWhatsAppEngine.generatePairingQR(instanceName);

    return NextResponse.json({
      success: true,
      status: 'QR_READY',
      qrCodeUrl: qrResult.qrCodeUrl,
      pairingCode: qrResult.pairingCode,
      isLiveEvolutionApi: EvolutionWhatsAppEngine.getInstance().isLiveEvolutionApi,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch WhatsApp pairing QR' },
      { status: 500 }
    );
  }
}
