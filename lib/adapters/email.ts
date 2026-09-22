import { ComplianceGuard } from '../compliance/guard';

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  leadId?: string;
  campaignId?: string;
  /** Optional calendar invite attached as text/calendar. */
  icsAttachment?: { filename: string; content: string };
}

export interface SendResult {
  success: boolean;
  messageId: string;
  provider: string;
  status: 'SENT' | 'QUEUED' | 'FAILED' | 'SUPPRESSED';
  error?: string;
  simulated: boolean;
}

export interface EmailProvider {
  name: string;
  send(input: SendEmailInput): Promise<SendResult>;
}

export class DemoEmailProvider implements EmailProvider {
  public name = 'DemoEmailProvider (Simulated SMTP/Resend)';

  public async send(input: SendEmailInput): Promise<SendResult> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return {
      success: true,
      messageId: `demo_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      provider: this.name,
      status: 'SENT',
      simulated: true,
    };
  }
}

/** Resend's free tier only sends from onboarding@resend.dev until a domain is verified. */
export const RESEND_ONBOARDING_FROM = 'ApexSDR <onboarding@resend.dev>';

function friendlyResendError(raw: string): string {
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as { message?: string; name?: string };
    message = parsed.message || raw;
  } catch {
    // raw text
  }
  const lower = message.toLowerCase();
  if (lower.includes('testing emails') || lower.includes('your own email address')) {
    return `${message} — On Resend's free tier without a verified domain you can only send to your own account email. Use delivery mode LIVE_REDIRECT with that address in Settings, or verify a domain at resend.com/domains.`;
  }
  if (lower.includes('domain is not verified') || lower.includes('not verified')) {
    return `${message} — Verify the sending domain at resend.com/domains or set EMAIL_FROM to onboarding@resend.dev.`;
  }
  return message;
}

export class ResendEmailProvider implements EmailProvider {
  public name = 'ResendEmailProvider';
  private apiKey: string;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress = RESEND_ONBOARDING_FROM) {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  public async send(input: SendEmailInput): Promise<SendResult> {
    try {
      const payload: Record<string, unknown> = {
        from: this.fromAddress,
        to: [input.to],
        subject: input.subject,
        text: input.body,
      };
      if (input.icsAttachment) {
        payload.attachments = [
          {
            filename: input.icsAttachment.filename,
            content: Buffer.from(input.icsAttachment.content, 'utf-8').toString('base64'),
          },
        ];
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          messageId: '',
          provider: this.name,
          status: 'FAILED',
          error: `Resend HTTP ${response.status}: ${friendlyResendError(errorText)}`,
          simulated: false,
        };
      }

      const json = await response.json();
      return {
        success: true,
        messageId: json.id,
        provider: this.name,
        status: 'SENT',
        simulated: false,
      };
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        provider: this.name,
        status: 'FAILED',
        error: err?.message || 'Network error',
        simulated: false,
      };
    }
  }
}

export function isResendConfigured(): boolean {
  return process.env.DEMO_MODE !== 'true' && !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_');
}

export function getEmailRuntimeInfo(): { live: boolean; provider: string; from: string; reason: string } {
  if (process.env.DEMO_MODE === 'true') {
    return { live: false, provider: 'simulated', from: 'simulated', reason: 'DEMO_MODE=true' };
  }
  if (!isResendConfigured()) {
    return { live: false, provider: 'simulated', from: 'simulated', reason: 'RESEND_API_KEY not set' };
  }
  return {
    live: true,
    provider: 'resend',
    from: process.env.EMAIL_FROM || RESEND_ONBOARDING_FROM,
    reason: 'Resend free tier (3,000 emails/month)',
  };
}

export class EmailAdapter {
  public static getProvider(opts?: { simulate?: boolean }): EmailProvider {
    if (opts?.simulate || !isResendConfigured()) {
      return new DemoEmailProvider();
    }
    return new ResendEmailProvider(process.env.RESEND_API_KEY as string, process.env.EMAIL_FROM || RESEND_ONBOARDING_FROM);
  }

  public static async dispatchEmail(input: SendEmailInput, opts?: { simulate?: boolean }): Promise<SendResult> {
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
        simulated: true,
      };
    }

    // 2. Dispatch via Provider
    const provider = this.getProvider(opts);
    const result = await provider.send(input);

    if (result.success) {
      ComplianceGuard.recordSend('EMAIL');
    }

    return result;
  }
}
