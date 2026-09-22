import { VoiceCall } from '../types';
import { DograhWebhookPayload } from './schemas';

export interface OutboundCallParams {
  leadId: string;
  phone: string;
  greetingOverride?: string;
  language?: string;
  campaignId?: string;
}

export interface OutboundCallResult {
  success: boolean;
  callId: string;
  workflowRunId: string | number;
  status: 'initiated' | 'queued' | 'failed';
  error?: string;
}

export interface VoiceWebhookProcessResult {
  success: boolean;
  callRecord?: VoiceCall;
  extracted?: any;
  error?: string;
  /** True when the same provider run was already recorded as COMPLETED (duplicate delivery). */
  duplicate?: boolean;
}

export interface VoiceProvider {
  name: string;
  initiateOutboundCall(params: OutboundCallParams): Promise<OutboundCallResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader?: string): boolean;
  processWebhook(payload: DograhWebhookPayload): Promise<VoiceWebhookProcessResult>;
}

import { DemoVoiceProvider } from './demo';
import { DograhVoiceProvider } from './dograh';

export function getVoiceProvider(explicitType?: 'demo' | 'dograh' | 'mock'): VoiceProvider {
  const providerType =
    explicitType ||
    (process.env.VOICE_PROVIDER as 'demo' | 'dograh') ||
    (process.env.DEMO_MODE === 'true' || !process.env.DOGRAH_API_KEY ? 'demo' : 'dograh');

  if (providerType === 'dograh' && process.env.DOGRAH_API_KEY) {
    return new DograhVoiceProvider();
  }

  return new DemoVoiceProvider();
}
