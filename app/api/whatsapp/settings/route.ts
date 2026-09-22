import { NextRequest } from 'next/server';
import { EvolutionWhatsAppEngine } from '@/lib/adapters/whatsapp-evolution';
import { getDemoStore } from '@/lib/store/demo-store';
import { errorResponse, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

export async function GET() {
  return jsonOk({ antiBan: EvolutionWhatsAppEngine.getAntiBanSettings(), deliveryMode: getDemoStore().org.delivery_mode });
}

/** Persists the anti-ban shield settings (jitter window, AI variation, daily cap). */
export async function PUT(req: NextRequest) {
  try {
    const body = await readJson<{ minDelaySeconds?: number; maxDelaySeconds?: number; enableDynamicAiVariation?: boolean; dailyLimit?: number; resetSentToday?: boolean }>(req);
    const patch: Record<string, unknown> = {};
    if (body.minDelaySeconds !== undefined) patch.minDelaySeconds = Number(body.minDelaySeconds);
    if (body.maxDelaySeconds !== undefined) patch.maxDelaySeconds = Number(body.maxDelaySeconds);
    if (body.enableDynamicAiVariation !== undefined) patch.enableDynamicAiVariation = !!body.enableDynamicAiVariation;
    if (body.dailyLimit !== undefined) patch.dailyLimit = Number(body.dailyLimit);
    if (body.resetSentToday) patch.sentToday = 0;
    const antiBan = EvolutionWhatsAppEngine.updateAntiBanSettings(patch);
    getDemoStore().persist();
    return jsonOk({ antiBan });
  } catch (err) {
    return errorResponse(err);
  }
}
