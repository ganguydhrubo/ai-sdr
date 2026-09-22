import QRCode from 'qrcode';
import { normalizeIndianPhone } from '../normalization/india';
import { getTrackedAI } from '../ai/tracked';
import { ComplianceGuard } from '../compliance/guard';
import { getDemoStore } from '../store/demo-store';
import type { WhatsAppAntiBanSettings } from '../types';

export type AntiBanSettings = WhatsAppAntiBanSettings;

export interface WhatsAppInstance {
  id: string;
  name: string;
  status: 'DISCONNECTED' | 'QR_READY' | 'CONNECTING' | 'CONNECTED';
  qrCodeUrl?: string;
  pairingCode?: string;
  connectedPhone?: string;
  profileName?: string;
  antiBan: AntiBanSettings;
  createdAt: string;
  lastActiveAt?: string;
  isLiveEvolutionApi?: boolean;
}

export interface SendWhatsAppMessageParams {
  instanceName: string;
  recipientPhone: string;
  recipientName: string;
  recipientCompany?: string;
  baseMessageText: string;
  leadContext?: string;
  leadId?: string;
}

export interface DispatchOptions {
  /** Never contact Evolution; mark as sent by the simulator. */
  simulate?: boolean;
  /** Send to this number instead of the recipient (LIVE_REDIRECT delivery mode). */
  redirectTo?: string;
  /** Send the text verbatim (approved campaign copy) instead of the anti-ban AI variation. */
  variation?: boolean;
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId: string;
  dispatchedMessage: string;
  dispatchedTo?: string;
  delayAppliedSeconds: number;
  status: 'SENT' | 'FAILED' | 'SUPPRESSED' | 'LIMIT_EXCEEDED';
  error?: string;
  isRealEvolutionApi?: boolean;
  simulated: boolean;
}

export interface EvolutionRuntimeInfo {
  configured: boolean;
  url: string;
  reachable: boolean;
  version?: string;
  instanceName: string;
  instanceState: 'open' | 'connecting' | 'close' | 'unknown';
  connectedPhone?: string;
  profileName?: string;
  checked_at: string;
}

const DEFAULT_ANTI_BAN: AntiBanSettings = {
  minDelaySeconds: 15,
  maxDelaySeconds: 42,
  enableDynamicAiVariation: true,
  dailyLimit: 50,
  sentToday: 0,
};

/**
 * Evolution API / Baileys WhatsApp Engine with Enterprise Anti-Ban Shields
 * Connects directly to the real Evolution API v2 multi-device Baileys daemon (self-hosted, ₹0 Meta fees).
 */
export class EvolutionWhatsAppEngine {
  private static instance: WhatsAppInstance = {
    id: 'inst_apex_001',
    name: 'apex_sales_01',
    status: 'DISCONNECTED',
    antiBan: { ...DEFAULT_ANTI_BAN },
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    isLiveEvolutionApi: true,
  };

  private static runtimeCache: { info: EvolutionRuntimeInfo; at: number } | null = null;

  private static getEvolutionConfig() {
    const url = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, '');
    const key = process.env.EVOLUTION_API_KEY || 'apex_evolution_secret_2026';
    return { url, key };
  }

  private static headers(extra: Record<string, string> = {}): Record<string, string> {
    const { key } = this.getEvolutionConfig();
    return { apikey: key, 'Bypass-Tunnel-Reminder': 'true', ...extra };
  }

  /** Anti-ban settings live in the persistent store so they survive restarts. */
  private static antiBan(): AntiBanSettings {
    const store = getDemoStore();
    if (!store.whatsappAntiBan) {
      store.whatsappAntiBan = { ...DEFAULT_ANTI_BAN };
    }
    this.instance.antiBan = store.whatsappAntiBan;
    return store.whatsappAntiBan;
  }

  /**
   * Returns current WhatsApp instance status cached in memory
   */
  public static getInstance(): WhatsAppInstance {
    this.antiBan();
    return this.instance;
  }

  /**
   * Queries real Evolution API to fetch live connection status
   */
  public static async checkLiveStatus(instanceName = 'apex_sales_01'): Promise<WhatsAppInstance> {
    const { url } = this.getEvolutionConfig();
    this.antiBan();

    try {
      const res = await fetch(`${url}/instance/connectionState/${instanceName}`, {
        headers: this.headers(),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        const state = data?.instance?.state;

        if (state === 'open') {
          this.instance.status = 'CONNECTED';
          this.instance.isLiveEvolutionApi = true;
          this.instance.lastActiveAt = new Date().toISOString();

          // Fetch owner details
          try {
            const infoRes = await fetch(`${url}/instance/fetchInstances?instanceName=${instanceName}`, {
              headers: this.headers(),
              cache: 'no-store',
              signal: AbortSignal.timeout(5000),
            });
            if (infoRes.ok) {
              const info = await infoRes.json();
              const instData = Array.isArray(info) ? info[0] : info?.value ? info.value[0] : null;
              if (instData) {
                this.instance.connectedPhone =
                  instData.number || instData.ownerJid?.replace('@s.whatsapp.net', '') || this.instance.connectedPhone;
                this.instance.profileName = instData.profileName || this.instance.profileName || 'Linked Sales SDR';
              }
            }
          } catch (e) {
            console.error('Failed to fetch detailed profile:', e);
          }
        } else if (state === 'connecting') {
          this.instance.status = this.instance.qrCodeUrl ? 'QR_READY' : 'CONNECTING';
        } else {
          this.instance.status = 'DISCONNECTED';
          this.instance.connectedPhone = undefined;
          this.instance.profileName = undefined;
        }
      }
    } catch (err: any) {
      console.warn('Evolution API unreachable, staying with existing status:', err?.message);
    }

    return this.instance;
  }

  /** Reachability + instance state for the integrations panel (cached for 20 s). */
  public static async getRuntimeInfo(opts?: { fresh?: boolean }): Promise<EvolutionRuntimeInfo> {
    if (!opts?.fresh && this.runtimeCache && Date.now() - this.runtimeCache.at < 20_000) {
      return this.runtimeCache.info;
    }
    const { url } = this.getEvolutionConfig();
    const info: EvolutionRuntimeInfo = {
      configured: !!process.env.EVOLUTION_API_URL,
      url,
      reachable: false,
      instanceName: this.instance.name,
      instanceState: 'unknown',
      checked_at: new Date().toISOString(),
    };
    try {
      const root = await fetch(`${url}/`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      if (root.ok) {
        info.reachable = true;
        const json = await root.json().catch(() => ({}));
        info.version = json?.version;
        const live = await this.checkLiveStatus(this.instance.name);
        info.instanceState = live.status === 'CONNECTED' ? 'open' : live.status === 'DISCONNECTED' ? 'close' : 'connecting';
        info.connectedPhone = live.connectedPhone;
        info.profileName = live.profileName;
      }
    } catch {
      info.reachable = false;
    }
    this.runtimeCache = { info, at: Date.now() };
    return info;
  }

  /**
   * Generates or fetches the GENUINE live Baileys pairing QR Code from Evolution API
   */
  public static async generatePairingQR(instanceName = 'apex_sales_01'): Promise<{ qrCodeUrl: string; pairingCode?: string }> {
    const { url } = this.getEvolutionConfig();
    this.instance.name = instanceName;

    try {
      // 1. Ensure instance exists
      const checkRes = await fetch(`${url}/instance/connectionState/${instanceName}`, {
        headers: this.headers(),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });

      if (!checkRes.ok) {
        // Create instance if not found
        await fetch(`${url}/instance/create`, {
          method: 'POST',
          headers: this.headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
          signal: AbortSignal.timeout(10_000),
        });
      }

      // 2. Fetch live QR Code from Evolution API
      const connectRes = await fetch(`${url}/instance/connect/${instanceName}`, {
        headers: this.headers(),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });

      if (connectRes.ok) {
        const data = await connectRes.json();
        const base64Qr = data?.base64 || '';
        const pairingCode = data?.pairingCode;

        if (base64Qr) {
          const formattedUrl = base64Qr.startsWith('data:image') ? base64Qr : `data:image/png;base64,${base64Qr}`;

          this.instance.status = 'QR_READY';
          this.instance.qrCodeUrl = formattedUrl;
          this.instance.pairingCode = pairingCode;
          this.instance.isLiveEvolutionApi = true;

          return {
            qrCodeUrl: formattedUrl,
            pairingCode,
          };
        }
      }
    } catch (err: any) {
      console.error('Error contacting live Evolution API for QR:', err?.message);
    }

    // Fallback: placeholder QR so the page still renders when the Docker stack is down.
    const rawQrString = `2@${Date.now()},ApexSDR_Baileys_${Math.random().toString(36).substring(2, 12)},${Date.now() + 60000}`;
    const qrDataUrl = await QRCode.toDataURL(rawQrString, {
      margin: 2,
      scale: 8,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    });

    this.instance.status = 'QR_READY';
    this.instance.qrCodeUrl = qrDataUrl;
    this.instance.isLiveEvolutionApi = false;

    return { qrCodeUrl: qrDataUrl };
  }

  /**
   * Confirms device link (used manually or via webhook callback)
   */
  public static confirmDeviceLink(phoneNumber: string, profileName: string): WhatsAppInstance {
    const norm = normalizeIndianPhone(phoneNumber);
    this.instance.status = 'CONNECTED';
    this.instance.connectedPhone = norm.normalized;
    this.instance.profileName = profileName || 'Verified Sales SDR';
    this.instance.qrCodeUrl = undefined;
    this.instance.pairingCode = undefined;
    this.instance.lastActiveAt = new Date().toISOString();
    return this.instance;
  }

  /**
   * Disconnects linked WhatsApp device from Evolution API
   */
  public static async disconnect(instanceName = 'apex_sales_01'): Promise<WhatsAppInstance> {
    const { url } = this.getEvolutionConfig();

    try {
      await fetch(`${url}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: this.headers(),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      console.warn('Could not logout on remote Evolution API:', err);
    }

    this.instance.status = 'DISCONNECTED';
    this.instance.connectedPhone = undefined;
    this.instance.profileName = undefined;
    this.instance.qrCodeUrl = undefined;
    this.instance.pairingCode = undefined;
    this.runtimeCache = null;
    return this.instance;
  }

  /**
   * Updates Anti-Ban Shields (persisted)
   */
  public static updateAntiBanSettings(settings: Partial<AntiBanSettings>): AntiBanSettings {
    const store = getDemoStore();
    const current = this.antiBan();
    const next: AntiBanSettings = { ...current, ...settings };
    next.minDelaySeconds = Math.max(1, Math.min(120, Math.round(next.minDelaySeconds)));
    next.maxDelaySeconds = Math.max(next.minDelaySeconds, Math.min(300, Math.round(next.maxDelaySeconds)));
    next.dailyLimit = Math.max(1, Math.min(1000, Math.round(next.dailyLimit)));
    store.whatsappAntiBan = next;
    this.instance.antiBan = next;
    store.recordAuditLog(
      'USER',
      'WHATSAPP_ANTI_BAN_UPDATED',
      'setting',
      this.instance.id,
      `Jitter ${next.minDelaySeconds}–${next.maxDelaySeconds}s, AI variation ${next.enableDynamicAiVariation ? 'on' : 'off'}, daily cap ${next.dailyLimit}`
    );
    return next;
  }

  public static getAntiBanSettings(): AntiBanSettings {
    return { ...this.antiBan() };
  }

  /**
   * Computes a randomized jitter delay between min and max seconds
   * to mimic human typing and intervals, defeating automated spam heuristics.
   */
  public static calculateRandomJitter(min = 15, max = 45): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * AI-Powered Dynamic Message Variation (Anti-Signature Shield)
   * Rephrases each outbound message so WhatsApp never sees identical message hashes across prospects.
   */
  public static async generateUniqueAIMessage(
    recipientName: string,
    recipientCompany: string,
    baseMessage: string,
    leadId?: string
  ): Promise<string> {
    const ai = getTrackedAI('WhatsAppAntiBanAgent', leadId);
    const prompt = `You are an AI SDR sending a personalized WhatsApp message to ${recipientName} at ${recipientCompany}.
The core message value is:
"${baseMessage}"

CRITICAL ANTI-BAN INSTRUCTIONS:
1. Re-phrase this message with fresh sentence structure and warm Indian business etiquette (e.g. "Namaste ${recipientName} ji" or "Hi ${recipientName}").
2. Keep it under 55 words.
3. Sound conversational, helpful, and professional—like a human sales rep typing on WhatsApp.
4. Do NOT use spam triggers like "100% free", "guaranteed", or ALL CAPS.
5. Keep any URL from the original message exactly as it is.
6. Return ONLY the message text without quotes or meta commentary.`;

    try {
      const completion = await ai.generateCompletion(prompt, { temperature: 0.7, maxTokens: 160, task: 'whatsapp_variation' });
      const text = completion.text.trim().replace(/^"|"$/g, '');
      return text || baseMessage;
    } catch {
      // Fallback with clean variation
      const greetings = [`Namaste ${recipientName} ji`, `Hi ${recipientName}`, `Hello ${recipientName}`];
      const selectedGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      return `${selectedGreeting}, saw ${recipientCompany}'s recent growth in the region. Wanted to share a quick 2-page brief on how B2B sales teams are streamlining outbound pipeline. Would Thursday be good for a quick chat?`;
    }
  }

  /**
   * Dispatches WhatsApp message with full Anti-Ban Protection:
   * 1. ComplianceGuard suppression check
   * 2. Daily volume warm-up check
   * 3. Randomized human typing delay
   * 4. AI-generated unique message variation (optional)
   * 5. Real Evolution API HTTP call to the live Baileys instance (unless simulated)
   */
  public static async dispatchSafeMessage(
    params: SendWhatsAppMessageParams,
    options: DispatchOptions = {}
  ): Promise<SendWhatsAppResult> {
    const antiBan = this.antiBan();

    // 1. Compliance Guard Check
    const compliance = ComplianceGuard.checkOutboundMessage({
      channel: 'WHATSAPP',
      recipientPhone: params.recipientPhone,
      body: params.baseMessageText,
    });

    if (!compliance.allowed) {
      return {
        success: false,
        messageId: '',
        dispatchedMessage: params.baseMessageText,
        delayAppliedSeconds: 0,
        status: 'SUPPRESSED',
        error: compliance.reason,
        simulated: true,
      };
    }

    // 2. Warm-Up Rate Limit Check
    if (antiBan.sentToday >= antiBan.dailyLimit) {
      return {
        success: false,
        messageId: '',
        dispatchedMessage: params.baseMessageText,
        delayAppliedSeconds: 0,
        status: 'LIMIT_EXCEEDED',
        error: `Anti-Ban Daily Threshold Reached (${antiBan.sentToday}/${antiBan.dailyLimit}). Ramping paused to protect number reputation.`,
        simulated: true,
      };
    }

    // 3. Random Jitter Delay (Anti-Bot Timing)
    const delaySeconds = this.calculateRandomJitter(antiBan.minDelaySeconds, antiBan.maxDelaySeconds);

    // 4. Generate Unique AI Variation (Anti-Signature Hash)
    let finalMessage = params.baseMessageText;
    const useVariation = options.variation ?? antiBan.enableDynamicAiVariation;
    if (useVariation) {
      finalMessage = await this.generateUniqueAIMessage(
        params.recipientName,
        params.recipientCompany || 'Enterprise Partner',
        params.baseMessageText,
        params.leadId
      );
    }

    const target = options.redirectTo || params.recipientPhone;
    const cleanPhone = target.replace(/[^\d]/g, '');

    // 5a. Simulated delivery (DEMO_MODE / SIMULATED delivery mode)
    if (options.simulate) {
      antiBan.sentToday += 1;
      ComplianceGuard.recordSend('WHATSAPP');
      getDemoStore().persist();
      return {
        success: true,
        messageId: `sim_wa_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        dispatchedMessage: finalMessage,
        dispatchedTo: target,
        delayAppliedSeconds: delaySeconds,
        status: 'SENT',
        isRealEvolutionApi: false,
        simulated: true,
      };
    }

    // 5b. Send via Real Evolution API
    const { url } = this.getEvolutionConfig();
    try {
      const response = await fetch(`${url}/message/sendText/${params.instanceName || 'apex_sales_01'}`, {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          number: cleanPhone,
          text: finalMessage,
          // Evolution shows "typing…" for this long before sending; keep the request short.
          delay: Math.min(delaySeconds, 5) * 1000,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (response.ok) {
        const json = await response.json();
        antiBan.sentToday += 1;
        ComplianceGuard.recordSend('WHATSAPP');
        getDemoStore().persist();
        return {
          success: true,
          messageId: json?.key?.id || `ev_msg_${Date.now()}`,
          dispatchedMessage: finalMessage,
          dispatchedTo: target,
          delayAppliedSeconds: delaySeconds,
          status: 'SENT',
          isRealEvolutionApi: true,
          simulated: false,
        };
      }

      const errJson = await response.json().catch(() => ({}));
      const detail =
        errJson?.response?.message?.[0] || errJson?.message || errJson?.error || `HTTP ${response.status}`;
      const hint =
        response.status === 400 && /not.*connected|instance/i.test(String(detail))
          ? ' — link a WhatsApp number first (WhatsApp Hub → scan the QR).'
          : '';
      return {
        success: false,
        messageId: '',
        dispatchedMessage: finalMessage,
        dispatchedTo: target,
        delayAppliedSeconds: delaySeconds,
        status: 'FAILED',
        error: `Evolution API: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}${hint}`,
        isRealEvolutionApi: true,
        simulated: false,
      };
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        dispatchedMessage: finalMessage,
        dispatchedTo: target,
        delayAppliedSeconds: delaySeconds,
        status: 'FAILED',
        error: `Evolution API unreachable at ${url} (${err?.message || 'network error'}) — start it with "docker compose up -d" or switch delivery mode to SIMULATED in Settings.`,
        isRealEvolutionApi: false,
        simulated: false,
      };
    }
  }
}
