import { NextResponse } from 'next/server';
import { EvolutionWhatsAppEngine } from '@/lib/adapters/whatsapp-evolution';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const instanceName = body.instanceName || 'apex_sales_01';

    const result = await EvolutionWhatsAppEngine.disconnect(instanceName);

    return NextResponse.json({
      success: true,
      instance: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
