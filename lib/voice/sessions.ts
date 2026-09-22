import { getDemoStore } from '../store/demo-store';
import { getSupabaseClient } from '../supabase';
import { TalkSession, TalkSessionStatus } from '../types';

export interface ListTalkSessionsFilter {
  status?: TalkSessionStatus | TalkSessionStatus[];
  /** Only sessions whose sent_at is at least this many hours old. */
  sentOlderThanHours?: number;
  /** When true, only sessions that were never opened. */
  unopened?: boolean;
  campaignId?: string;
  limit?: number;
}

export function listTalkSessions(filter: ListTalkSessionsFilter = {}): TalkSession[] {
  const store = getDemoStore();
  const statuses = filter.status ? (Array.isArray(filter.status) ? filter.status : [filter.status]) : undefined;
  const cutoff =
    filter.sentOlderThanHours !== undefined ? Date.now() - filter.sentOlderThanHours * 3600000 : undefined;

  return store
    .getTalkSessions()
    .filter((s) => (statuses ? statuses.includes(s.status) : true))
    .filter((s) => (filter.campaignId ? s.campaign_id === filter.campaignId : true))
    .filter((s) => (filter.unopened ? !s.opened_at : true))
    .filter((s) => (cutoff !== undefined ? !!s.sent_at && new Date(s.sent_at).getTime() <= cutoff : true))
    .slice(0, filter.limit ?? 200);
}

export interface ExpireResult {
  expired: number;
  sessionIds: string[];
  checkedAt: string;
}

/**
 * Marks every live talk session whose expires_at has passed as EXPIRED.
 * Idempotent: already-expired, revoked or completed sessions are left alone.
 * Called hourly by the n8n talk-link-expiry workflow.
 */
export async function expireTalkSessions(now: Date = new Date()): Promise<ExpireResult> {
  const store = getDemoStore();
  const live: TalkSessionStatus[] = ['CREATED', 'SENT', 'OPENED'];
  const due = store
    .getTalkSessions()
    .filter((s) => live.includes(s.status) && new Date(s.expires_at).getTime() <= now.getTime());

  for (const session of due) {
    session.status = 'EXPIRED';
    store.recordAuditLog(
      'SYSTEM_WORKER',
      'TALK_LINK_EXPIRED',
      'talk_session',
      session.id,
      `Talk link for ${session.lead_name || session.lead_id} expired at ${session.expires_at}`
    );
  }

  const supabase = getSupabaseClient();
  if (supabase && due.length > 0) {
    try {
      await supabase
        .from('talk_sessions')
        .update({ status: 'EXPIRED' })
        .in('id', due.map((s) => s.id));
    } catch {
      // demo fallback
    }
  }

  return { expired: due.length, sessionIds: due.map((s) => s.id), checkedAt: now.toISOString() };
}
