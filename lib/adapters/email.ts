import { ComplianceGuard } from '../compliance/guard';

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  leadId?: string;
  campaignId?: string;
}

export interface SendResult {
  success: boolean;
  messageId: string;
  provider: string;
  status: 'SENT' | 'QUEUED' | 'FAILED' | 'SUPPRESSED';
  error?: string;
}

export interface EmailProvider {
  name: string;
  send(input: SendEmailInput): Promise<SendResult>;
}

export class DemoEmailProvider implements EmailProvider {
  public name = 'DemoEmailProvider (Simulated SMTP/Resend)';

  public async send(input: SendEmailInput): Promise<SendResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      success: true,
      messageId: `demo_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      provider: this.name,
      status: 'SENT',
    };
  }
}

export class ResendEmailProvider implements EmailProvider {
  public name = 'ResendEmailProvider';
  private apiKey: string;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress = 'onboarding@resend.dev') {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  public async send(input: SendEmailInput): Promise<SendResult> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [input.to],
          subject: input.subject,
          text: input.body,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          messageId: '',
          provider: this.name,
          status: 'FAILED',
          error: errorText,
        };
      }

      const json = await response.json();
      return {
        success: true,
        messageId: json.id,
        provider: this.name,
        status: 'SENT',
      };
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        provider: this.name,
        status: 'FAILED',
        error: err?.message || 'Network error',
      };
    }
  }
}

export class EmailAdapter {
  private static provider: EmailProvider;

  public static getProvider(): EmailProvider {
    if (!this.provider) {
      if (process.env.DEMO_MODE === 'true' || !process.env.RESEND_API_KEY) {
        this.provider = new DemoEmailProvider();
      } else {
        this.provider = new ResendEmailProvider(
          process.env.RESEND_API_KEY,
          process.env.EMAIL_FROM || 'sales@apextech.in'
        );
      }
    }
    return this.provider;
  }

  public static async dispatchEmail(input: SendEmailInput): Promise<SendResult> {
    // 1. Compliance Guard Check
    const compliance = ComplianceGuard.checkOutboundMessage({
      channel: 'EMAIL',
      recipientEmail: input.to,
      subject: input.subject,
      body: input.body,
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

    // 2. Dispatch via Provider
    const provider = this.getProvider();
    const result = await provider.send(input);

    if (result.success) {
      ComplianceGuard.recordSend('EMAIL');
    }

    return result;
  }
}
