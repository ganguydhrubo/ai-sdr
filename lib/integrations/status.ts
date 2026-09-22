import { getAIRuntimeInfo } from '../ai/groq';
import { getEmailRuntimeInfo } from '../adapters/email';
import { EvolutionWhatsAppEngine, EvolutionRuntimeInfo } from '../adapters/whatsapp-evolution';
import { getVoiceProvider } from '../voice/provider';
import { snapshotFileInfo } from '../store/persistence';
import { effectiveDeliveryMode } from '../outreach/dispatch';
import type { DeliveryMode } from '../types';

export interface IntegrationStatus {
  ai: { live: boolean; provider: string; model: string; reason: string };
  email: { live: boolean; provider: string; from: string; reason: string; domain_verified?: boolean; domain_note?: string };
  whatsapp: EvolutionRuntimeInfo;
  supabase: { configured: boolean; url?: string; tables_ready?: boolean; note: string };
  voice: {
    provider: string;
    browser_agent: boolean;
    stt: 'browser+groq-whisper' | 'browser-only';
    tts: 'browser' | 'groq-orpheus+browser';
    note: string;
  };
  persistence: { enabled: boolean; path: string; exists: boolean; saved_at?: string; bytes?: number };
  delivery_mode: DeliveryMode;
  demo_mode: boolean;
  checked_at: string;
}

let cache: { status: IntegrationStatus; at: number } | null = null;

async function checkResendDomain(): Promise<{ domain_verified?: boolean; domain_note?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return {};
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { domain_note: `Resend API HTTP ${res.status}` };
    const json = await res.json();
    const domains: Array<{ name: string; status: string }> = json?.data || [];
    const from = process.env.EMAIL_FROM || '';
    const fromDomain = from.match(/@([^>\s]+)/)?.[1]?.toLowerCase();
    const verified = domains.filter((d) => d.status === 'verified').map((d) => d.name);
    if (fromDomain && fromDomain !== 'resend.dev') {
      const ok = verified.includes(fromDomain);
      return {
        domain_verified: ok,
        domain_note: ok
          ? `${fromDomain} is verified`
          : `${fromDomain} is not verified on Resend (${domains.find((d) => d.name === fromDomain)?.status || 'not added'}) — sends will fail until verified or EMAIL_FROM uses onboarding@resend.dev`,
      };
    }
    return {
      domain_verified: false,
      domain_note:
        'Sending from onboarding@resend.dev: the free tier delivers only to your own Resend account email — use LIVE_REDIRECT with that address, or verify a domain',
    };
  } catch (err) {
    return { domain_note: `Resend check failed: ${(err as Error).message}` };
  }
}

async function checkSupabase(): Promise<IntegrationStatus['supabase']> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { configured: false, note: 'Not configured — the app runs on the local JSON store (free).' };
  }
  try {
    const res = await fetch(`${url}/rest/v1/leads?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return { configured: true, url, tables_ready: true, note: 'Connected; voice tables are mirrored best-effort.' };
    }
    if (res.status === 404) {
      return {
        configured: true,
        url,
        tables_ready: false,
        note: 'Project reachable but migrations not applied — run supabase/migrations/001 and 002 in the SQL editor. The local JSON store remains the source of truth.',
      };
    }
    return { configured: true, url, tables_ready: false, note: `Supabase responded HTTP ${res.status}` };
  } catch (err) {
    return { configured: true, url, tables_ready: false, note: `Supabase unreachable: ${(err as Error).message}` };
  }
}

export async function getIntegrationStatus(opts?: { fresh?: boolean }): Promise<IntegrationStatus> {
  if (!opts?.fresh && cache && Date.now() - cache.at < 20_000) {
    return cache.status;
  }
  const demoMode = process.env.DEMO_MODE === 'true';
  const ai = getAIRuntimeInfo();
  const email = getEmailRuntimeInfo();

  const [domain, whatsapp, supabase] = await Promise.all([
    email.live ? checkResendDomain() : Promise.resolve({}),
    demoMode
      ? Promise.resolve<EvolutionRuntimeInfo>({
          configured: false,
          url: 'simulated',
          reachable: false,
          instanceName: 'apex_sales_01',
          instanceState: 'unknown',
          checked_at: new Date().toISOString(),
        })
      : EvolutionWhatsAppEngine.getRuntimeInfo({ fresh: opts?.fresh }),
    checkSupabase(),
  ]);

  const groqKey = !demoMode && !!process.env.GROQ_API_KEY;
  const ttsProvider = process.env.VOICE_TTS_PROVIDER === 'groq' && groqKey ? 'groq-orpheus+browser' : 'browser';
  const status: IntegrationStatus = {
    ai,
    email: { ...email, ...domain },
    whatsapp,
    supabase,
    voice: {
      provider: getVoiceProvider().name,
      browser_agent: true,
      stt: groqKey ? 'browser+groq-whisper' : 'browser-only',
      tts: ttsProvider,
      note: groqKey
        ? 'Free in-browser agent: Web Speech or Groq Whisper for listening, GPT-OSS for the conversation, browser TTS for speaking. ₹0 carrier cost.'
        : 'Free in-browser agent with the offline simulator (set GROQ_API_KEY for a live conversation).',
    },
    persistence: snapshotFileInfo(),
    delivery_mode: effectiveDeliveryMode(),
    demo_mode: demoMode,
    checked_at: new Date().toISOString(),
  };
  cache = { status, at: Date.now() };
  return status;
}

export function invalidateIntegrationCache(): void {
  cache = null;
}
