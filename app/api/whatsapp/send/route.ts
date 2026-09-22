import { NextResponse } from 'next/server';
import { EvolutionWhatsAppEngine } from '@/lib/adapters/whatsapp-evolution';

export const dynamic = 'force-dynamic';

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

    const result = await EvolutionWhatsAppEngine.dispatchSafeMessage({
      instanceName: instanceName || 'apex_sales_01',
      recipientPhone,
      recipientName: recipientName || 'Prospect',
      recipientCompany: recipientCompany || 'Enterprise Lead',
      baseMessageText,
    });

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch WhatsApp message' },
      { status: 500 }
    );
  }
}
