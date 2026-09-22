import { getDemoStore } from '../store/demo-store';
import { TalkSession, VoiceCall } from '../types';

export interface VoiceAnalytics {
  talk_links_sent: number;
  talk_links_opened: number;
  open_rate_pct: number;
  calls_started: number;
  calls_completed: number;
  completion_rate_pct: number;
  avg_duration_seconds: number;
  meetings_from_voice: number;
  handoffs_from_voice: number;
  opt_outs_from_voice: number;
  webrtc_calls: number;
  pstn_calls: number;
  carrier_cost_inr: number;
  computed_at: string;
}

const SENT_STATUSES: TalkSession['status'][] = ['SENT', 'OPENED', 'CALL_STARTED', 'COMPLETED'];
const OPENED_STATUSES: TalkSession['status'][] = ['OPENED', 'CALL_STARTED', 'COMPLETED'];

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/** Talk-link and voice-call metrics for the dashboard cards and /api/voice/analytics. */
export function computeVoiceAnalytics(
  sessions: TalkSession[] = getDemoStore().getTalkSessions(),
  calls: VoiceCall[] = getDemoStore().getVoiceCalls(),
  now: Date = new Date()
): VoiceAnalytics {
  const sent = sessions.filter((s) => !!s.sent_at || SENT_STATUSES.includes(s.status));
  const opened = sessions.filter((s) => !!s.opened_at || OPENED_STATUSES.includes(s.status));

  const started = calls.filter((c) => c.status !== 'BLOCKED');
  const completed = calls.filter((c) => c.status === 'COMPLETED');
  const totalDuration = completed.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

  const meetings = completed.filter((c) => c.extracted?.meeting_requested || !!c.extracted?.meeting_id).length;
  const handoffs = completed.filter((c) => c.extracted?.handoff_requested).length;
  const optOuts = completed.filter((c) => c.extracted?.opt_out).length;

  const carrierCost = calls.reduce((sum, c) => sum + (c.carrier_cost_estimate_inr || 0), 0);

  return {
    talk_links_sent: sent.length,
    talk_links_opened: opened.length,
    open_rate_pct: pct(opened.length, sent.length),
    calls_started: started.length,
    calls_completed: completed.length,
    completion_rate_pct: pct(completed.length, started.length),
    avg_duration_seconds: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
    meetings_from_voice: meetings,
    handoffs_from_voice: handoffs,
    opt_outs_from_voice: optOuts,
    webrtc_calls: calls.filter((c) => c.mode === 'webrtc').length,
    pstn_calls: calls.filter((c) => c.mode === 'pstn').length,
    carrier_cost_inr: Math.round(carrierCost * 100) / 100,
    computed_at: now.toISOString(),
  };
}

// Kept for existing imports; the implementation lives in the client-safe format module.
export { formatDuration } from '../client/format';
