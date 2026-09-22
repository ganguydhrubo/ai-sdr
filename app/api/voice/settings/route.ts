import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDemoStore } from '@/lib/store/demo-store';
import { getSupabaseClient } from '@/lib/supabase';
import { evaluatePstnGate } from '@/lib/voice/compliance';
import { getSdrTalkAgentScriptVersion } from '@/lib/voice/prompts';
import { getVoiceProvider } from '@/lib/voice/provider';

export const dynamic = 'force-dynamic';

const VoiceSettingsUpdateSchema = z
  .object({
    voice_enabled: z.boolean(),
    web_voice_enabled: z.boolean(),
    pstn_enabled: z.boolean(),
    dlt_entity_id: z.string().trim().max(64),
    caller_id_series: z.enum(['140', '1600', '1601']),
    advance_notice_given: z.boolean(),
    oap_autodialer_notice_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .or(z.literal('')),
    oap_notice_doc_url: z.string().url().or(z.literal('')),
    calling_window_start: z.string().regex(/^\d{2}:\d{2}$/),
    calling_window_end: z.string().regex(/^\d{2}:\d{2}$/),
    pstn_daily_cap: z.number().int().min(0).max(5000),
    talk_link_ttl_days: z.number().int().min(1).max(30),
    talk_link_max_calls: z.number().int().min(1).max(10),
    recording_enabled: z.boolean(),
    human_booking_url: z.string().url().or(z.literal('')),
  })
  .partial();

function buildPayload() {
  const store = getDemoStore();
  const settings = store.getVoiceSettings();
  let scriptVersion = 'unavailable';
  try {
    scriptVersion = getSdrTalkAgentScriptVersion();
  } catch {
    // script file missing in this deployment
  }
  return {
    settings,
    gate: evaluatePstnGate(settings),
    provider: getVoiceProvider().name,
    script_version: scriptVersion,
    provider_cost_note:
      'Provider cost not included: PSTN minutes (Vobiz), Dograh usage and telephony numbers are billed by those providers. WebRTC talk links carry no carrier cost.',
  };
}

export async function GET() {
  return NextResponse.json(buildPayload());
}

export async function PUT(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = VoiceSettingsUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid voice settings', issues: parsed.error.issues }, { status: 400 });
  }

  const store = getDemoStore();
  const updates = { ...parsed.data } as Record<string, unknown>;
  // Empty strings mean "clear the optional field".
  for (const key of ['oap_autodialer_notice_date', 'oap_notice_doc_url', 'human_booking_url', 'dlt_entity_id']) {
    if (updates[key] === '') updates[key] = undefined;
  }

  const previous = { ...store.getVoiceSettings() };
  const settings = store.updateVoiceSettings(updates);

  // Turning PSTN on is only allowed when the gate passes — the UI shows why otherwise.
  if (settings.pstn_enabled) {
    const gate = evaluatePstnGate(settings);
    if (!gate.ready) {
      store.updateVoiceSettings({ pstn_enabled: false });
      const failing = gate.items.filter((i) => !i.passed).map((i) => i.label);
      store.recordAuditLog(
        'USER',
        'VOICE_PSTN_ENABLE_BLOCKED',
        'setting',
        settings.id,
        `PSTN enable refused — gate items failing: ${failing.join('; ')}`
      );
      return NextResponse.json(
        { error: 'PSTN cannot be enabled until every gate item passes', failing, ...buildPayload() },
        { status: 422 }
      );
    }
  }

  const before = previous as unknown as Record<string, unknown>;
  const after = settings as unknown as Record<string, unknown>;
  const changed = Object.keys(parsed.data).filter((k) => before[k] !== after[k]);
  store.recordAuditLog(
    'USER',
    'VOICE_SETTINGS_UPDATED',
    'setting',
    settings.id,
    changed.length ? `Updated voice settings: ${changed.join(', ')}` : 'Voice settings saved (no changes)'
  );

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('voice_settings').upsert({ ...settings });
    } catch {
      // demo fallback
    }
  }

  return NextResponse.json(buildPayload());
}
