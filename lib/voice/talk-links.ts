import crypto from 'crypto';
import { TalkSession, TalkCallNonce } from '../types';
import { getDemoStore } from '../store/demo-store';
import { getSupabaseClient } from '../supabase';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface MintTalkTokenParams {
  organizationId: string;
  leadId: string;
  leadName?: string;
  leadCompany?: string;
  campaignId?: string;
  channel?: 'email' | 'whatsapp' | 'sms';
  language?: string;
  maxCalls?: number;
  expiresInDays?: number;
}

export interface MintTalkTokenResult {
  token: string;
  tokenHash: string;
  talkUrl: string;
  session: TalkSession;
}

/**
 * Mints a cryptographically secure 32-byte base64url talk token.
 * Only the SHA-256 hash is persisted in the database.
 */
export async function mintTalkToken(params: MintTalkTokenParams): Promise<MintTalkTokenResult> {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);

  const expiresInDays = params.expiresInDays ?? 7;
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const talkUrl = `${baseUrl.replace(/\/$/, '')}/talk/${token}`;

  const sessionData: Partial<TalkSession> = {
    id: `ts_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    organization_id: params.organizationId,
    lead_id: params.leadId,
    lead_name: params.leadName,
    lead_company: params.leadCompany,
    campaign_id: params.campaignId,
    channel: params.channel || 'email',
    token_hash: tokenHash,
    // The raw token stays in the local store so operators can copy/re-send the link (not sent to Supabase).
    token,
    status: 'CREATED',
    expires_at: expiresAt,
    max_calls: params.maxCalls ?? 3,
    call_count: 0,
    language: params.language || 'en',
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabaseClient();
  let createdSession: TalkSession | null = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('talk_sessions')
        .insert({
          id: sessionData.id,
          organization_id: sessionData.organization_id,
          lead_id: sessionData.lead_id,
          campaign_id: sessionData.campaign_id,
          channel: sessionData.channel,
          token_hash: sessionData.token_hash,
          status: sessionData.status,
          expires_at: sessionData.expires_at,
          max_calls: sessionData.max_calls,
          call_count: sessionData.call_count,
          language: sessionData.language,
        })
        .select()
        .single();

      if (!error && data) {
        createdSession = data as TalkSession;
      }
    } catch {
      // Fallback to demo store
    }
  }

  // Always keep demoStore up-to-date
  const demoStore = getDemoStore();
  const demoSession = demoStore.createTalkSession(sessionData);

  return {
    token,
    tokenHash,
    talkUrl,
    session: createdSession || demoSession,
  };
}

/**
 * Resolves and validates a talk session from a raw bearer token.
 */
export async function resolveTalkToken(token: string): Promise<{
  valid: boolean;
  error?: string;
  session?: TalkSession;
}> {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is missing or invalid' };
  }

  const tokenHash = hashToken(token);
  const supabase = getSupabaseClient();
  let session: TalkSession | undefined;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('talk_sessions')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (!error && data) {
        session = data as TalkSession;
      }
    } catch {
      // fallback
    }
  }

  if (!session) {
    const demoStore = getDemoStore();
    session = demoStore.findTalkSessionByTokenHash(tokenHash);
    if (!session) {
      // Check if token matches directly (e.g. demo pre-seeded tokens)
      session = demoStore.getTalkSessions().find((s) => s.token === token);
    }
  }

  if (!session) {
    return { valid: false, error: 'Talk session not found' };
  }

  if (session.status === 'REVOKED') {
    return {
      valid: false,
      error: `Talk session was revoked${session.revoked_reason ? `: ${session.revoked_reason}` : ''}`,
      session,
    };
  }

  if (session.status === 'EXPIRED' || new Date(session.expires_at).getTime() < Date.now()) {
    return { valid: false, error: 'Talk session has expired', session };
  }

  if (session.call_count >= session.max_calls) {
    return { valid: false, error: 'Maximum call limit for this talk link has been reached', session };
  }

  return { valid: true, session };
}

/**
 * Mints an opaque, single-use nonce for a WebRTC or PSTN call session.
 */
export async function mintTalkNonce(
  sessionId: string,
  organizationId: string,
  leadId: string,
  ttlSeconds = 300
): Promise<{ nonce: string; nonceHash: string; expiresAt: string }> {
  const nonce = `nonce_${crypto.randomBytes(16).toString('hex')}`;
  const nonceHash = hashToken(nonce);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const nonceData: TalkCallNonce = {
    id: `tcn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    talk_session_id: sessionId,
    organization_id: organizationId,
    lead_id: leadId,
    nonce_hash: nonceHash,
    is_used: false,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('talk_call_nonces').insert({
        id: nonceData.id,
        talk_session_id: nonceData.talk_session_id,
        organization_id: nonceData.organization_id,
        lead_id: nonceData.lead_id,
        nonce_hash: nonceData.nonce_hash,
        is_used: false,
        expires_at: nonceData.expires_at,
      });
    } catch {
      // fallback
    }
  }

  const demoStore = getDemoStore();
  demoStore.createTalkNonce(nonceData);

  return { nonce, nonceHash, expiresAt };
}

/**
 * Validates and atomically consumes a single-use call nonce.
 */
export async function consumeTalkNonce(nonce: string): Promise<{
  valid: boolean;
  error?: string;
  nonceRecord?: TalkCallNonce;
}> {
  if (!nonce) {
    return { valid: false, error: 'Missing nonce' };
  }

  const nonceHash = hashToken(nonce);
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('talk_call_nonces')
        .select('*')
        .eq('nonce_hash', nonceHash)
        .maybeSingle();

      if (!error && data) {
        if (data.is_used) {
          return { valid: false, error: 'Nonce already consumed' };
        }
        if (new Date(data.expires_at).getTime() < Date.now()) {
          return { valid: false, error: 'Nonce has expired' };
        }

        // Atomically update
        const { data: updated, error: updateErr } = await supabase
          .from('talk_call_nonces')
          .update({ is_used: true, used_at: new Date().toISOString() })
          .eq('id', data.id)
          .eq('is_used', false)
          .select()
          .single();

        if (updateErr || !updated) {
          return { valid: false, error: 'Failed to atomically consume nonce' };
        }

        return { valid: true, nonceRecord: updated as TalkCallNonce };
      }
    } catch {
      // fallback to demo store
    }
  }

  const demoStore = getDemoStore();
  const res = demoStore.consumeTalkNonceByHash(nonceHash);
  if (!res.success) {
    return { valid: false, error: res.error };
  }

  return { valid: true, nonceRecord: res.nonce };
}

/**
 * Peeks a nonce without consuming it (used by pre-call data fetch while call is establishing).
 */
export async function peekTalkNonce(nonce: string): Promise<{
  valid: boolean;
  error?: string;
  nonceRecord?: TalkCallNonce;
}> {
  if (!nonce) {
    return { valid: false, error: 'Missing nonce' };
  }

  const nonceHash = hashToken(nonce);
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('talk_call_nonces')
        .select('*')
        .eq('nonce_hash', nonceHash)
        .maybeSingle();

      if (!error && data) {
        if (new Date(data.expires_at).getTime() < Date.now()) {
          return { valid: false, error: 'Nonce has expired' };
        }
        return { valid: true, nonceRecord: data as TalkCallNonce };
      }
    } catch {
      // fallback
    }
  }

  const demoStore = getDemoStore();
  const record = demoStore.findTalkNonceByHash(nonceHash);
  if (!record) {
    return { valid: false, error: 'Nonce not found' };
  }
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { valid: false, error: 'Nonce has expired' };
  }

  return { valid: true, nonceRecord: record };
}

/**
 * Revokes a talk session and cancels all future inbound calls.
 */
export async function revokeTalkToken(
  tokenOrHash: string,
  reason: string
): Promise<{ success: boolean; session?: TalkSession }> {
  const hash = tokenOrHash.length === 64 ? tokenOrHash : hashToken(tokenOrHash);
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('talk_sessions')
        .update({
          status: 'REVOKED',
          revoked_at: new Date().toISOString(),
          revoked_reason: reason,
        })
        .eq('token_hash', hash)
        .select()
        .single();

      if (!error && data) {
        return { success: true, session: data as TalkSession };
      }
    } catch {
      // fallback
    }
  }

  const demoStore = getDemoStore();
  const session = demoStore.findTalkSessionByTokenHash(hash);
  if (session) {
    session.status = 'REVOKED';
    session.revoked_at = new Date().toISOString();
    session.revoked_reason = reason;
    return { success: true, session };
  }

  return { success: false };
}
