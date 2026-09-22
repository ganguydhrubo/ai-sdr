'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Target,
  Send,
  MessageSquare,
  Calendar,
  ArrowRight,
  ShieldAlert,
  Zap,
  Phone,
  Link2,
  IndianRupee,
  Clock,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useAppState } from '../lib/client/use-app-state';
import { api } from '../lib/client/api';
import { timeAgo, pct, formatDuration } from '../lib/client/format';
import { PageLoading, PageError, Notice, useNotice, DeliveryReceiptLine, btn, Spinner } from '../components/ui';
import type { DeliveryReceipt, OutboundMessage } from '../lib/types';

export default function DashboardPage() {
  const { state, loading, error, refresh } = useAppState({ pollMs: 20_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();
  const [receipts, setReceipts] = useState<Record<string, DeliveryReceipt>>({});

  if (error && !state) return <PageError message={error} />;
  if (loading || !state) return <PageLoading />;

  const { stats, voiceAnalytics: voice, messages, campaigns, auditLogs, org, integrations } = state;
  const pendingApprovals = messages.filter((m) => m.status === 'PENDING_APPROVAL');
  const failed = messages.filter((m) => m.status === 'FAILED');

  const handleApprove = async (msg: OutboundMessage) => {
    setBusy(msg.id);
    try {
      const res = await api.post<{ sent: boolean; delivery: DeliveryReceipt }>(`/api/messages/${msg.id}/approve`);
      setReceipts((r) => ({ ...r, [msg.id]: res.delivery }));
      setNotice(
        res.sent
          ? { kind: 'ok', text: `${msg.channel} to ${msg.lead_name} ${res.delivery.simulated ? 'sent (simulated)' : 'delivered'} via ${res.delivery.provider}${res.delivery.redirected_to ? ` → ${res.delivery.redirected_to}` : ''}.` }
          : { kind: 'error', text: `Delivery to ${msg.lead_name} failed: ${res.delivery.error}` }
      );
      await refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (msg: OutboundMessage) => {
    setBusy(msg.id);
    try {
      await api.post(`/api/messages/${msg.id}/reject`, { reason: 'Rejected by Sales Manager on dashboard' });
      await refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handleRetry = async (msg: OutboundMessage) => {
    setBusy(msg.id);
    try {
      const res = await api.post<{ sent: boolean; delivery: DeliveryReceipt }>(`/api/messages/${msg.id}/send`);
      setNotice(res.sent ? { kind: 'ok', text: `Resent to ${msg.lead_name} via ${res.delivery.provider}.` } : { kind: 'error', text: `Still failing: ${res.delivery.error}` });
      await refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handleFlush = async () => {
    setBusy('flush');
    try {
      const res = await api.post<{ sent: number; failed: number }>('/api/outbox/flush');
      setNotice({ kind: res.failed ? 'error' : 'ok', text: `Queue processed: ${res.sent} sent, ${res.failed} failed.` });
      await refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const funnel = [
    { label: 'Ingested & Normalized', value: stats.totalLeads, color: 'bg-slate-400' },
    { label: 'ICP Scored & Qualified', value: stats.qualifiedLeads, color: 'bg-indigo-500' },
    { label: 'Multi-Channel Outreach Contacted', value: stats.contacted, color: 'bg-blue-500' },
    { label: 'Engaged & Intent Classified', value: stats.engaged, color: 'bg-amber-500' },
    { label: 'Confirmed Meetings & AE Handoff', value: stats.meetings, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Emergency Kill Switch Banner if active */}
      {stats.killSwitchActive && (
        <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded-r-lg flex items-center justify-between shadow-sm animate-pulse" data-testid="kill-switch-banner">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-rose-900">GLOBAL EMERGENCY KILL SWITCH ENGAGED</div>
              <div className="text-xs text-rose-700">All autonomous outbound queues and automated follow-ups are completely suspended.</div>
            </div>
          </div>
          <Link href="/settings" className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700">
            Manage Guardrails
          </Link>
        </div>
      )}

      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Sales Operating Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live from the server store · {stats.leadsToday} lead{stats.leadsToday === 1 ? '' : 's'} added today · data persisted {integrations.persistence.enabled ? 'to disk' : 'in memory'}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/leads" className={btn.primary}>
            <Users className="w-3.5 h-3.5" />
            <span>Ingest Leads</span>
          </Link>
          <Link href="/pipeline" className={btn.secondary}>
            Pipeline CRM
          </Link>
        </div>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Total Ingested</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900" data-testid="stat-total-leads">{stats.totalLeads}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">+{stats.leadsToday} today · {stats.suppressedLeads} suppressed</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>ICP Qualified</span>
            <Target className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{stats.qualifiedLeads}</div>
          <div className="text-[11px] text-slate-500 mt-1">{pct(stats.qualifiedLeads, stats.totalLeads)}% Qualification Rate</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Outreach Sent</span>
            <Send className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.sentMessages}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {stats.queuedMessages} queued · {stats.failedMessages} failed
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Replies Received</span>
            <MessageSquare className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.engaged}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">{stats.replyRate}% reply rate on sent</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Meetings Booked</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{stats.meetings}</div>
          <div className="text-[11px] text-slate-500 mt-1">{stats.conversionRate}% Conversion</div>
        </div>
      </div>

      {/* Voice module row */}
      <div className="space-y-2" data-testid="voice-analytics">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-violet-500" /> Voice &amp; AI Calls (WebRTC)
          </h2>
          <div className="flex items-center gap-3">
            <Link href="/voice" className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1">
              <span>Open Voice Hub</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="/settings/voice" className="text-xs font-medium text-slate-500 hover:text-slate-700">
              Settings
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs" data-testid="voice-card-links">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>Talk Links Sent</span>
              <Link2 className="w-4 h-4 text-violet-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{voice.talk_links_sent}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {voice.talk_links_opened} opened · {voice.open_rate_pct}% open rate
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs" data-testid="voice-card-calls">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>AI Calls</span>
              <Phone className="w-4 h-4 text-violet-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{voice.calls_completed}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              of {voice.calls_started} started · {voice.completion_rate_pct}% completed
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs" data-testid="voice-card-duration">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>Avg Call Duration</span>
              <Clock className="w-4 h-4 text-violet-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatDuration(voice.avg_duration_seconds)}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {voice.webrtc_calls} WebRTC · {voice.pstn_calls} PSTN
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs" data-testid="voice-card-meetings">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>Meetings from Voice</span>
              <Calendar className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">{voice.meetings_from_voice}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {voice.handoffs_from_voice} handoffs · {voice.opt_outs_from_voice} opt-outs
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs" data-testid="voice-card-cost">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>Carrier Cost</span>
              <IndianRupee className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">₹{voice.carrier_cost_inr.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-1">WebRTC calls cost ₹0 · PSTN est. only</div>
          </div>
        </div>
      </div>

      {/* Secondary Row: Funnel Visualizer + Pending SDR Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel Visualizer (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Conversion Funnel Velocity</h2>
              <p className="text-xs text-slate-500">Autonomous SDR throughput across stages (computed from live lead statuses)</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              {stats.activeCampaigns} active campaigns
            </span>
          </div>

          <div className="space-y-3">
            {funnel.map((stage, i) => {
              const p = pct(stage.value, stats.totalLeads);
              return (
                <div key={stage.label}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-700">
                      {i + 1}. {stage.label} ({stage.value})
                    </span>
                    <span className="text-slate-500">{p}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div className={`${stage.color} h-full rounded-full transition-all`} style={{ width: `${Math.max(p, stage.value > 0 ? 3 : 0)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Human SDR Approval Queue (1 Col) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between" data-testid="approval-queue">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-900">SDR Approval Queue</h2>
              </div>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200">
                {pendingApprovals.length} Pending
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Human-in-the-loop: approving sends the message through {org.delivery_mode === 'SIMULATED' ? 'the simulator' : org.delivery_mode === 'LIVE_REDIRECT' ? 'the live channel to your test inbox' : 'the live channel'}.
            </p>

            <div className="space-y-3">
              {pendingApprovals.slice(0, 3).map((msg) => (
                <div key={msg.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2" data-testid={`approval-${msg.id}`}>
                  <div className="flex items-center justify-between">
                    <Link href={`/leads/${msg.lead_id}`} className="font-semibold text-slate-800 hover:text-indigo-700">
                      {msg.lead_name}
                    </Link>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase">{msg.channel}</span>
                  </div>
                  <div className="text-slate-600 line-clamp-2 italic">&ldquo;{msg.subject || msg.body}&rdquo;</div>
                  {msg.error_message && (
                    <div className="text-[10px] text-amber-700 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> Guard: {msg.error_message}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                    <button
                      onClick={() => handleApprove(msg)}
                      disabled={busy === msg.id}
                      className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {busy === msg.id ? <Spinner /> : <CheckCircle2 className="w-3 h-3" />} Approve & Send
                    </button>
                    <button
                      onClick={() => handleReject(msg)}
                      disabled={busy === msg.id}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[11px] transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                  <DeliveryReceiptLine receipt={receipts[msg.id]} />
                </div>
              ))}

              {pendingApprovals.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  No pending approvals. Outbound queue is clear.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 space-y-2">
            {stats.queuedMessages > 0 && (
              <button onClick={handleFlush} disabled={busy === 'flush'} className={`${btn.secondary} w-full justify-center`} data-testid="flush-queue">
                {busy === 'flush' ? <Spinner /> : <RefreshCw className="w-3.5 h-3.5" />} Send {stats.queuedMessages} queued now
              </button>
            )}
            <Link href="/leads" className="text-xs text-indigo-600 font-semibold flex items-center justify-center gap-1 hover:text-indigo-800">
              Review all leads & drafts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Failed deliveries */}
      {failed.length > 0 && (
        <div className="bg-white rounded-xl border border-rose-200 p-5 shadow-xs" data-testid="failed-deliveries">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Delivery failures ({failed.length})
            </h2>
            <Link href="/settings" className="text-xs font-semibold text-indigo-600 hover:underline">
              Delivery settings
            </Link>
          </div>
          <div className="space-y-2">
            {failed.slice(0, 4).map((msg) => (
              <div key={msg.id} className="p-3 bg-rose-50/60 rounded-lg border border-rose-100 text-xs flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">
                    {msg.lead_name} · {msg.channel}
                  </div>
                  <div className="text-[11px] text-rose-700 break-words">{msg.error_message}</div>
                </div>
                <button onClick={() => handleRetry(msg)} disabled={busy === msg.id} className={btn.small}>
                  {busy === msg.id ? <Spinner /> : <RefreshCw className="w-3 h-3" />} Retry
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaigns Snapshot & Recent AI Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaigns */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Outbound Campaigns</h2>
            <Link href="/campaigns" className="text-xs font-semibold text-indigo-600 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {campaigns.map((camp) => {
              const sent = messages.filter((m) => m.campaign_id === camp.id && ['SENT', 'DELIVERED', 'REPLIED'].includes(m.status)).length;
              const replied = messages.filter((m) => m.campaign_id === camp.id && m.status === 'REPLIED').length;
              return (
                <div key={camp.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{camp.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Target: {camp.target_persona} · Mode: {camp.approval_mode} · {camp.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-800">{camp.leads_count} Leads</div>
                    <div className="text-[11px] text-emerald-600 font-medium">
                      {sent} sent · {replied} replied
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live AI Activity Stream */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">Live AI SDR Activity Feed</h2>
            </div>
            <Link href="/activity" className="text-xs font-semibold text-indigo-600 hover:underline">
              Activity Center
            </Link>
          </div>
          <div className="space-y-2.5">
            {auditLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 flex items-center justify-between gap-2">
                    <span className="truncate">{log.action.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{timeAgo(log.created_at)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 break-words">{log.details}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
