import { describe, it, expect, beforeEach } from 'vitest';
import { mintTalkToken, resolveTalkToken, revokeTalkToken, hashToken } from '../lib/voice/talk-links';
import { getDemoStore } from '../lib/store/demo-store';

describe('Cryptographic Talk Tokens (Phase V3)', () => {
  beforeEach(() => {
    // Reset or prepare store
    const store = getDemoStore();
    expect(store).toBeDefined();
  });

  it('should mint a secure 32-byte base64url talk token with correct SHA-256 hash', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[0];

    const result = await mintTalkToken({
      organizationId: store.getOrg().id,
      leadId: lead.id,
      leadName: lead.full_name,
      channel: 'email',
      maxCalls: 3,
      expiresInDays: 7,
    });

    expect(result.token).toBeDefined();
    expect(result.token.length).toBeGreaterThanOrEqual(40); // 32 bytes base64url is 43 chars
    expect(result.tokenHash).toBe(hashToken(result.token));
    expect(result.talkUrl).toContain(`/talk/${result.token}`);
    expect(result.session.status).toBe('CREATED');
    expect(result.session.token_hash).toBe(result.tokenHash);
  });

  it('should successfully resolve an active minted talk token', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[1];

    const { token } = await mintTalkToken({
      organizationId: store.getOrg().id,
      leadId: lead.id,
      leadName: lead.full_name,
      channel: 'whatsapp',
    });

    const resolution = await resolveTalkToken(token);
    expect(resolution.valid).toBe(true);
    expect(resolution.session).toBeDefined();
    expect(resolution.session?.lead_id).toBe(lead.id);
  });

  it('should reject resolution of invalid or non-existent token', async () => {
    const resolution = await resolveTalkToken('completely_fake_invalid_token_99999');
    expect(resolution.valid).toBe(false);
    expect(resolution.error).toContain('not found');
  });

  it('should reject resolution of expired token', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[2];

    const { token, session } = await mintTalkToken({
      organizationId: store.getOrg().id,
      leadId: lead.id,
      expiresInDays: -1, // Expired yesterday
    });

    // Update expiry in store
    store.updateTalkSession(session.id, {
      expires_at: new Date(Date.now() - 3600000).toISOString(),
    });

    const resolution = await resolveTalkToken(token);
    expect(resolution.valid).toBe(false);
    expect(resolution.error).toContain('expired');
  });

  it('should revoke a token and prevent further resolution', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[3];

    const { token } = await mintTalkToken({
      organizationId: store.getOrg().id,
      leadId: lead.id,
    });

    const revokeRes = await revokeTalkToken(token, 'Prospect requested DND');
    expect(revokeRes.success).toBe(true);

    const resolution = await resolveTalkToken(token);
    expect(resolution.valid).toBe(false);
    expect(resolution.error).toContain('revoked');
  });
});
