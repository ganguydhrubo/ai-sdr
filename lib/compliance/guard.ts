import { Channel } from '../types';

export interface ComplianceCheckResult {
  allowed: boolean;
  reason?: string;
  violations: string[];
  requiresHumanReview: boolean;
}

export interface SuppressionEntry {
  email?: string;
  phone?: string;
  domain?: string;
  reason: 'UNSUBSCRIBED' | 'DO_NOT_CONTACT' | 'BOUNCE' | 'COMPLAINT' | 'MANUAL_BLOCK';
  added_at?: string;
}

// Banned or high-risk claims under enterprise SDR policy
const PROHIBITED_PHRASES = [
  'guaranteed 100% return',
  'free trial with no credit card forever',
  'immediate ₹1 crore revenue',
  'act right now or lose your spot',
  'we are an official government partner',
  'calling from ministry of',
  'confidential leak',
  'zero cost whatsapp bulk software',
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /system prompt override/i,
  /reveal your secret instructions/i,
  /dan mode activated/i,
  /you are no longer an ai sdr/i,
  /<script>/i,
];

export const DEFAULT_SUPPRESSION_LIST: SuppressionEntry[] = [
  { email: 'optout@competitor.com', reason: 'UNSUBSCRIBED' },
  { phone: '+919800000000', reason: 'DO_NOT_CONTACT' },
  { domain: 'blacklisted-domain.com', reason: 'BOUNCE' },
];

function cleanPhone(phone?: string): string | undefined {
  return phone?.replace(/[^\d+]/g, '') || undefined;
}

export class ComplianceGuard {
  private static emergencyKillSwitchActive = false;
  private static suppressionList: SuppressionEntry[] = DEFAULT_SUPPRESSION_LIST.map((e) => ({ ...e }));

  // Daily send counter for rate limiting
  private static dailySendsByDomain: Record<string, number> = {};
  private static dailySendsByChannel: Record<Channel, number> = {
    EMAIL: 0,
    WHATSAPP: 0,
    VOICE: 0,
    LINKEDIN: 0,
  };

  /**
   * Activates or deactivates the global emergency kill switch
   */
  public static setEmergencyKillSwitch(active: boolean): void {
    this.emergencyKillSwitchActive = active;
  }

  public static isEmergencyKillSwitchActive(): boolean {
    return this.emergencyKillSwitchActive;
  }

  /**
   * Adds an identifier to the global suppression list (idempotent per identifier).
   */
  public static addSuppression(entry: SuppressionEntry): SuppressionEntry {
    const normalized: SuppressionEntry = {
      email: entry.email?.trim().toLowerCase() || undefined,
      phone: cleanPhone(entry.phone),
      domain: entry.domain?.trim().toLowerCase() || undefined,
      reason: entry.reason,
      added_at: entry.added_at || new Date().toISOString(),
    };
    const existing = this.suppressionList.find(
      (s) =>
        (!!normalized.email && s.email === normalized.email) ||
        (!!normalized.phone && !!s.phone && cleanPhone(s.phone) === normalized.phone) ||
        (!!normalized.domain && s.domain === normalized.domain)
    );
    if (existing) {
      // Merge so one entry can cover email + phone for the same prospect.
      existing.email = existing.email || normalized.email;
      existing.phone = existing.phone || normalized.phone;
      existing.domain = existing.domain || normalized.domain;
      existing.reason = normalized.reason;
      return existing;
    }
    this.suppressionList.push(normalized);
    return normalized;
  }

  /** Removes every entry matching the identifier (email, phone or domain). Returns how many were removed. */
  public static removeSuppression(identifier: string): number {
    const value = identifier.trim().toLowerCase();
    const phone = cleanPhone(identifier);
    const before = this.suppressionList.length;
    this.suppressionList = this.suppressionList.filter(
      (s) => !(s.email === value || s.domain === value || (!!phone && !!s.phone && cleanPhone(s.phone) === phone))
    );
    return before - this.suppressionList.length;
  }

  public static getSuppressionList(): SuppressionEntry[] {
    return this.suppressionList.map((e) => ({ ...e }));
  }

  /** Replaces the whole list (used when the persisted store is loaded). */
  public static setSuppressionList(entries: SuppressionEntry[]): void {
    this.suppressionList = entries.map((e) => ({ ...e }));
  }

  /** Back to the seed state (used by "Reset demo data"). */
  public static resetToDefaults(): void {
    this.emergencyKillSwitchActive = false;
    this.suppressionList = DEFAULT_SUPPRESSION_LIST.map((e) => ({ ...e }));
    this.dailySendsByDomain = {};
    this.dailySendsByChannel = { EMAIL: 0, WHATSAPP: 0, VOICE: 0, LINKEDIN: 0 };
  }

  public static getDailySends(): Record<Channel, number> {
    return { ...this.dailySendsByChannel };
  }

  /**
   * Checks if an email, phone, or domain is suppressed
   */
  public static isSuppressed(email?: string, phone?: string, domain?: string): { suppressed: boolean; reason?: string } {
    const cleanEmail = email?.trim().toLowerCase();
    const cleanedPhone = cleanPhone(phone);
    const cleanDomain = domain?.trim().toLowerCase();

    for (const item of this.suppressionList) {
      if (cleanEmail && item.email && cleanEmail === item.email.toLowerCase()) {
        return { suppressed: true, reason: `Email is on suppression list: ${item.reason}` };
      }
      if (cleanedPhone && item.phone && cleanedPhone === cleanPhone(item.phone)) {
        return { suppressed: true, reason: `Phone is on suppression list: ${item.reason}` };
      }
      if (cleanDomain && item.domain && cleanDomain === item.domain.toLowerCase()) {
        return { suppressed: true, reason: `Domain is on suppression list: ${item.reason}` };
      }
    }

    return { suppressed: false };
  }

  /**
   * Validates an outbound message against all compliance policies
   */
  public static checkOutboundMessage(params: {
    channel: Channel;
    recipientEmail?: string;
    recipientPhone?: string;
    recipientDomain?: string;
    body: string;
    subject?: string;
  }): ComplianceCheckResult {
    const violations: string[] = [];

    // 1. Check Global Emergency Kill Switch
    if (this.emergencyKillSwitchActive) {
      return {
        allowed: false,
        reason: 'EMERGENCY KILL SWITCH ENGAGED: All outbound communications are halted.',
        violations: ['KILL_SWITCH_ACTIVE'],
        requiresHumanReview: true,
      };
    }

    // 2. Check Suppression List
    const suppression = this.isSuppressed(
      params.recipientEmail,
      params.recipientPhone,
      params.recipientDomain
    );
    if (suppression.suppressed) {
      violations.push(`SUPPRESSION_VIOLATION: ${suppression.reason}`);
    }

    // 3. Prompt Injection / Malicious content check
    const contentToScan = `${params.subject || ''} ${params.body}`;
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(contentToScan)) {
        violations.push('MALICIOUS_CONTENT_OR_INJECTION_DETECTED');
      }
    }

    // 4. Prohibited claims check
    const lowerContent = contentToScan.toLowerCase();
    for (const phrase of PROHIBITED_PHRASES) {
      if (lowerContent.includes(phrase)) {
        violations.push(`PROHIBITED_CLAIM: Message contains forbidden terminology "${phrase}"`);
      }
    }

    // 5. Channel-specific constraints
    if (params.channel === 'EMAIL' && !params.body.toLowerCase().includes('unsubscribe')) {
      // Must include unsubscribe notice or opt-out mechanism
      violations.push('MISSING_OPT_OUT: Outbound emails must include clear opt-out / unsubscribe instructions.');
    }

    // 6. Rate limits check
    const channelSends = this.dailySendsByChannel[params.channel] || 0;
    if (params.channel === 'WHATSAPP' && channelSends >= 500) {
      violations.push('WHATSAPP_RATE_LIMIT: Daily WhatsApp threshold reached (500/day limit).');
    }

    const isAllowed = violations.length === 0;

    return {
      allowed: isAllowed,
      reason: violations.length > 0 ? violations.join(' | ') : undefined,
      violations,
      requiresHumanReview: !isAllowed || violations.length > 0,
    };
  }

  /**
   * Records a successful send for rate limit accounting
   */
  public static recordSend(channel: Channel, domain?: string): void {
    this.dailySendsByChannel[channel] = (this.dailySendsByChannel[channel] || 0) + 1;
    if (domain) {
      this.dailySendsByDomain[domain] = (this.dailySendsByDomain[domain] || 0) + 1;
    }
  }
}
