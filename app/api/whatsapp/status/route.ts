import { NextResponse } from 'next/server';
import { EvolutionWhatsAppEngine } from '@/lib/adapters/whatsapp-evolution';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const instanceName = searchParams.get('instance') || 'apex_sales_01';

    const liveInstance = await EvolutionWhatsAppEngine.checkLiveStatus(instanceName);

    return NextResponse.json({
      success: true,
      instance: liveInstance,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}
