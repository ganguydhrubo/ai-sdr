import { describe, it, expect, beforeEach } from 'vitest';
import { ComplianceGuard } from '../lib/compliance/guard';

describe('ComplianceGuard & Security Circuit Breakers', () => {
  beforeEach(() => {
    ComplianceGuard.setEmergencyKillSwitch(false);
  });

  it('should block all outbound messages when emergency kill switch is engaged', () => {
    ComplianceGuard.setEmergencyKillSwitch(true);

    const check = ComplianceGuard.checkOutboundMessage({
      channel: 'EMAIL',
      recipientEmail: 'prospect@valid-domain.in',
      body: 'Hi, let us connect. Reply unsubscribe to opt out.',
    });

    expect(check.allowed).toBe(false);
    expect(check.violations).toContain('KILL_SWITCH_ACTIVE');
  });

  it('should block messages to suppressed emails', () => {
    ComplianceGuard.addSuppression({
      email: 'optout@target.com',
      reason: 'UNSUBSCRIBED',
    });

    const check = ComplianceGuard.checkOutboundMessage({
      channel: 'EMAIL',
      recipientEmail: 'optout@target.com',
      body: 'Hello there. Reply unsubscribe to opt out.',
    });

    expect(check.allowed).toBe(false);
    expect(check.violations.some((v) => v.includes('SUPPRESSION_VIOLATION'))).toBe(true);
  });

  it('should flag prohibited marketing claims', () => {
    const check = ComplianceGuard.checkOutboundMessage({
      channel: 'EMAIL',
      recipientEmail: 'valid@prospect.com',
      body: 'We provide guaranteed 100% return in 30 days! Reply unsubscribe to opt out.',
    });

    expect(check.allowed).toBe(false);
    expect(check.violations.some((v) => v.includes('PROHIBITED_CLAIM'))).toBe(true);
  });

  it('should flag emails missing opt-out notice', () => {
    const check = ComplianceGuard.checkOutboundMessage({
      channel: 'EMAIL',
      recipientEmail: 'valid@prospect.com',
      body: 'Hello, check our B2B software solutions today.',
    });

    expect(check.allowed).toBe(false);
    expect(check.violations).toContain('MISSING_OPT_OUT: Outbound emails must include clear opt-out / unsubscribe instructions.');
  });

  it('should pass compliant outbound emails', () => {
    const check = ComplianceGuard.checkOutboundMessage({
      channel: 'EMAIL',
      recipientEmail: 'legitimate.lead@enterprise.in',
      subject: 'Consultative introduction regarding sales automation',
      body: 'Hi Rajesh, would love to share a short case study on sales productivity. If you prefer not to receive updates, reply unsubscribe.',
    });

    expect(check.allowed).toBe(true);
    expect(check.violations.length).toBe(0);
  });
});
