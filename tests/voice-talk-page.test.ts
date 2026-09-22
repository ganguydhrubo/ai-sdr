import { describe, it, expect } from 'vitest';
import { resolvePublicTalkContext } from '../lib/voice/resolver';
import { mintTalkToken, mintTalkNonce } from '../lib/voice/talk-links';
import { getDemoStore } from '../lib/store/demo-store';

describe('Public Talk Page Resolution & Events (Phase V4)', () => {
  it('should resolve active public talk context without leaking private PII', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[0];

    const { token } = await mintTalkToken({
      organizationId: store.getOrg().id,
      leadId: lead.id,
      leadName: lead.full_name,
      leadCompany: lead.company_name,
      language: 'en',
    });

    const res = await resolvePublicTalkContext(token);
    expect(res.valid).toBe(true);
    expect(res.publicContext).toBeDefined();
    expect(res.publicContext?.leadFirstName).toBe(lead.first_name);
    expect(res.publicContext?.companyName).toBe(lead.company_name);
    expect(res.publicContext?.agentName).toContain('Apex');

    // Verify data minimization: no email or phone in public context
    const json = JSON.stringify(res.publicContext);
    expect(json).not.toContain(lead.email);
    expect(json).not.toContain(lead.phone);
  });

  it('should reject invalid or expired talk tokens with appropriate message', async () => {
    const res = await resolvePublicTalkContext('invalid_token_999999');
    expect(res.valid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('should mint a single-use call nonce for an active talk session', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[0];

    const { session } = await mintTalkToken({
      organizationId: store.getOrg().id,
      leadId: lead.id,
    });

    const { nonce, expiresAt } = await mintTalkNonce(
      session.id,
      session.organization_id,
      session.lead_id,
      300
    );

    expect(nonce.startsWith('nonce_')).toBe(true);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
