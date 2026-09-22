import { describe, it, expect } from 'vitest';
import { resolveLeadContextFromNonce, resolvePublicTalkContext } from '../lib/voice/resolver';
import { detectOptOutPhrase, checkCallingWindowIST, isTraiCompliantCallerId } from '../lib/voice/compliance';
import { mintTalkToken, mintTalkNonce } from '../lib/voice/talk-links';
import { getDemoStore } from '../lib/store/demo-store';

describe('Voice Resolver & Compliance (Phase V3)', () => {
  it('should resolve pre-call context from single-use nonce with strict data minimization', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[0];
    const session = store.getTalkSessions()[0];

    const { nonce } = await mintTalkNonce(session.id, session.organization_id, lead.id, 300);

    const result = await resolveLeadContextFromNonce(nonce);
    expect(result.valid).toBe(true);
    expect(result.context).toBeDefined();
    expect(result.context?.first_name).toBe(lead.first_name);
    expect(result.context?.company).toBe(lead.company_name);
    expect(result.context?.verified_research_facts.length).toBeGreaterThan(0);

    // CRITICAL SECURITY RULE: Lead phone number and lead email must NOT be present in pre-call context
    const contextJson = JSON.stringify(result.context);
    expect(contextJson).not.toContain(lead.email);
    expect(contextJson).not.toContain(lead.phone);
  });

  it('should resolve safe public metadata for talk landing page without leaking private data', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[1];

    const { token } = await mintTalkToken({
      organizationId: store.getOrg().id,
      leadId: lead.id,
      leadName: lead.full_name,
      leadCompany: lead.company_name,
    });

    const pubResult = await resolvePublicTalkContext(token);
    expect(pubResult.valid).toBe(true);
    expect(pubResult.publicContext).toBeDefined();
    expect(pubResult.publicContext?.leadFirstName).toBe(lead.first_name);
    expect(pubResult.publicContext?.companyName).toBe(lead.company_name);
    expect(pubResult.publicContext?.callsRemaining).toBe(3);

    // Ensure phone and email are not exposed
    const pubJson = JSON.stringify(pubResult.publicContext);
    expect(pubJson).not.toContain(lead.email);
    expect(pubJson).not.toContain(lead.phone);
  });

  it('should detect opt-out phrases accurately across English, Hindi, and Bengali', () => {
    // English
    const en1 = detectOptOutPhrase('I am not interested, please stop calling this number immediately.');
    expect(en1.isOptOut).toBe(true);
    expect(en1.language).toBe('en');

    const en2 = detectOptOutPhrase('Please take me off your call list.');
    expect(en2.isOptOut).toBe(true);
    expect(en2.language).toBe('en');

    // Hindi
    const hi1 = detectOptOutPhrase('Bhai dobara call mat karna, humein nahi chahiye.');
    expect(hi1.isOptOut).toBe(true);
    expect(hi1.language).toBe('hi');

    const hi2 = detectOptOutPhrase('Mera phone mat karo, list se number hata do.');
    expect(hi2.isOptOut).toBe(true);
    expect(hi2.language).toBe('hi');

    // Bengali
    const bn1 = detectOptOutPhrase('Amader dorkar nei, ar phone korben na.');
    expect(bn1.isOptOut).toBe(true);
    expect(bn1.language).toBe('bn');

    const bn2 = detectOptOutPhrase('Amar number ta delete korun please.');
    expect(bn2.isOptOut).toBe(true);
    expect(bn2.language).toBe('bn');

    // Neutral conversation (No false positive)
    const neutral = detectOptOutPhrase('Could you share your pricing and schedule a product walkthrough for our team?');
    expect(neutral.isOptOut).toBe(false);
  });

  it('should strictly enforce TRAI 09:00–21:00 IST calling window', () => {
    // 03:00 UTC = 08:30 IST (Outside window, 30 min before 9 AM)
    const earlyDate = new Date('2026-09-22T03:00:00.000Z');
    const earlyCheck = checkCallingWindowIST(earlyDate);
    expect(earlyCheck.allowed).toBe(false);
    expect(earlyCheck.reason).toContain('09:00–21:00 IST');

    // 05:00 UTC = 10:30 IST (Inside window)
    const openDate = new Date('2026-09-22T05:00:00.000Z');
    const openCheck = checkCallingWindowIST(openDate);
    expect(openCheck.allowed).toBe(true);

    // 16:00 UTC = 21:30 IST (Outside window, 30 min after 9 PM)
    const lateDate = new Date('2026-09-22T16:00:00.000Z');
    const lateCheck = checkCallingWindowIST(lateDate);
    expect(lateCheck.allowed).toBe(false);
  });

  it('should validate TRAI 140/1600/1601 commercial numbering series', () => {
    expect(isTraiCompliantCallerId('+911409876543')).toBe(true);
    expect(isTraiCompliantCallerId('1409876543')).toBe(true);
    expect(isTraiCompliantCallerId('+911600123456')).toBe(true);
    expect(isTraiCompliantCallerId('1601999888')).toBe(true);

    // Regular consumer mobile or invalid series should be rejected
    expect(isTraiCompliantCallerId('+919876543210')).toBe(false);
    expect(isTraiCompliantCallerId('+918045678900')).toBe(false);
    expect(isTraiCompliantCallerId('')).toBe(false);
  });
});
