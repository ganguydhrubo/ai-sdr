import { describe, it, expect } from 'vitest';
import { mintTalkNonce, consumeTalkNonce, peekTalkNonce, hashToken } from '../lib/voice/talk-links';
import { getDemoStore } from '../lib/store/demo-store';

describe('Single-Use Call Nonces (Phase V3)', () => {
  it('should mint an opaque, cryptographically secure nonce with SHA-256 hash', async () => {
    const store = getDemoStore();
    const session = store.getTalkSessions()[0];

    const result = await mintTalkNonce(session.id, session.organization_id, session.lead_id, 300);

    expect(result.nonce).toBeDefined();
    expect(result.nonce.startsWith('nonce_')).toBe(true);
    expect(result.nonceHash).toBe(hashToken(result.nonce));
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('should allow peeking a valid nonce without consuming it', async () => {
    const store = getDemoStore();
    const session = store.getTalkSessions()[0];

    const { nonce } = await mintTalkNonce(session.id, session.organization_id, session.lead_id, 300);

    const peek1 = await peekTalkNonce(nonce);
    expect(peek1.valid).toBe(true);
    expect(peek1.nonceRecord?.is_used).toBe(false);

    // Second peek must also succeed because nonce wasn't consumed
    const peek2 = await peekTalkNonce(nonce);
    expect(peek2.valid).toBe(true);
    expect(peek2.nonceRecord?.is_used).toBe(false);
  });

  it('should atomically consume a nonce and prevent replay attacks', async () => {
    const store = getDemoStore();
    const session = store.getTalkSessions()[0];

    const { nonce } = await mintTalkNonce(session.id, session.organization_id, session.lead_id, 300);

    // First consumption succeeds
    const consume1 = await consumeTalkNonce(nonce);
    expect(consume1.valid).toBe(true);
    expect(consume1.nonceRecord?.is_used).toBe(true);

    // Second consumption MUST FAIL (replay prevention)
    const consume2 = await consumeTalkNonce(nonce);
    expect(consume2.valid).toBe(false);
    expect(consume2.error).toContain('already been used');
  });

  it('should reject consumption of non-existent or expired nonce', async () => {
    const store = getDemoStore();
    const session = store.getTalkSessions()[0];

    // Non-existent
    const fakeRes = await consumeTalkNonce('nonce_non_existent_123456');
    expect(fakeRes.valid).toBe(false);
    expect(fakeRes.error).toContain('not found');

    // Expired nonce (-10 seconds TTL)
    const { nonce } = await mintTalkNonce(session.id, session.organization_id, session.lead_id, -10);
    const expiredRes = await consumeTalkNonce(nonce);
    expect(expiredRes.valid).toBe(false);
    expect(expiredRes.error).toContain('expired');
  });
});
