import { ComplianceGuard } from '../compliance/guard';
import { normalizeIndianPhone } from '../normalization/india';

export interface SendWhatsAppInput {
  phone: string;
  templateName?: string;
  parameters?: Record<string, string>;
  messageText?: string;
  leadId?: string;
}

export interface WhatsAppResult {
  success: boolean;
  messageId: string;
  provider: string;
  status: 'SENT' | 'FAILED' | 'SUPPRESSED';
  error?: string;
}

export interface WhatsAppProvider {
  name: string;
  send(input: SendWhatsAppInput): Promise<WhatsAppResult>;
}

export class DemoWhatsAppProvider implements WhatsAppProvider {
  public name = 'DemoWhatsAppProvider (Meta Cloud API Simulator)';

  public async send(input: SendWhatsAppInput): Promise<WhatsAppResult> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return {
      success: true,
      messageId: `wamid.HBgM${Date.now()}_DEMO`,
      provider: this.name,
      status: 'SENT',
    };
  }
}

export class MetaCloudApiWhatsAppProvider implements WhatsAppProvider {
  public name = 'MetaCloudApiWhatsAppProvider';
  private accessToken: string;
  private phoneNumberId: string;

  constructor(accessToken: string, phoneNumberId: string) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
  }

  public async send(input: SendWhatsAppInput): Promise<WhatsAppResult> {
    try {
      const normalized = normalizeIndianPhone(input.phone);
      if (!normalized.isValid) {
        return {
          success: false,
          messageId: '',
          provider: this.name,
          status: 'FAILED',
          error: `Invalid Indian phone number: ${normalized.error}`,
        };
      }

      // Meta Cloud API sends to digits without '+' (e.g. 919876543210)
      const recipientNumber = normalized.normalized.replace('+', '');

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipientNumber,
            type: 'text',
            text: { body: input.messageText || 'Hello from ApexSDR' },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        return {
          success: false,
          messageId: '',
          provider: this.name,
          status: 'FAILED',
          error: err,
        };
      }

      const json = await response.json();
      return {
        success: true,
        messageId: json.messages?.[0]?.id || 'wamid.success',
        provider: this.name,
        status: 'SENT',
      };
    } catch (error: any) {
      return {
        success: false,
        messageId: '',
        provider: this.name,
        status: 'FAILED',
        error: error?.message || 'Network error',
      };
    }
  }
}

export class WhatsAppAdapter {
  private static provider: WhatsAppProvider;

  public static getProvider(): WhatsAppProvider {
    if (!this.provider) {
      if (
        process.env.DEMO_MODE === 'true' ||
        !process.env.WHATSAPP_ACCESS_TOKEN ||
        !process.env.WHATSAPP_PHONE_NUMBER_ID
      ) {
        this.provider = new DemoWhatsAppProvider();
      } else {
        this.provider = new MetaCloudApiWhatsAppProvider(
          process.env.WHATSAPP_ACCESS_TOKEN,
          process.env.WHATSAPP_PHONE_NUMBER_ID
        );
      }
    }
    return this.provider;
  }

  public static async dispatchWhatsApp(input: SendWhatsAppInput): Promise<WhatsAppResult> {
    const compliance = ComplianceGuard.checkOutboundMessage({
      channel: 'WHATSAPP',
      recipientPhone: input.phone,
      body: input.messageText || '',
    });

    if (!compliance.allowed) {
      return {
        success: false,
        messageId: '',
        provider: 'ComplianceGuard',
        status: 'SUPPRESSED',
        error: compliance.reason,
      };
    }

    const provider = this.getProvider();
    const result = await provider.send(input);

    if (result.success) {
      ComplianceGuard.recordSend('WHATSAPP');
    }

    return result;
  }
}
