'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Target,
  Send,
  MessageSquare,
  ThumbsUp,
  Calendar,
  Briefcase,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { getDemoStore } from '../lib/store/demo-store';
import { OutboundMessage } from '../lib/types';

export default function DashboardPage() {
  const store = getDemoStore();
  const [messages, setMessages] = useState<OutboundMessage[]>([...store.messages]);
  const [stats, setStats] = useState(store.getStats());

  const handleApprove = (msgId: string) => {
    store.approveMessage(msgId);
    setMessages([...store.messages]);
    setStats(store.getStats());
  };

  const handleReject = (msgId: string) => {
    store.rejectMessage(msgId, 'Rejected by Sales Manager on dashboard');
    setMessages([...store.messages]);
    setStats(store.getStats());
  };

  const pendingApprovals = messages.filter((m) => m.status === 'PENDING_APPROVAL');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Emergency Kill Switch Banner if active */}
      {stats.killSwitchActive && (
        <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded-r-lg flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-rose-900">
                GLOBAL EMERGENCY KILL SWITCH ENGAGED
              </div>
              <div className="text-xs text-rose-700">
                All autonomous outbound queues and automated follow-ups are completely suspended.
              </div>
            </div>
          </div>
          <Link
            href="/settings"
            className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700"
          >
            Manage Guardrails
          </Link>
        </div>
      )}

      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Executive Sales Operating Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time pipeline metrics, AI SDR performance attribution, and approval queues for Indian B2B outreach.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/leads"
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Ingest Leads</span>
          </Link>
          <Link
            href="/pipeline"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg shadow-xs transition-colors"
          >
            Pipeline CRM
          </Link>
        </div>
      </div>

      {/* Primary KPI Cards (9 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Leads */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Total Ingested</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalLeads}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">+12 today (+18% wow)</div>
        </div>

        {/* Qualified Leads */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>ICP Qualified</span>
            <Target className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{stats.qualifiedLeads}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {((stats.qualifiedLeads / stats.totalLeads) * 100).toFixed(0)}% Qualification Rate
          </div>
        </div>

        {/* Contacted */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Outreach Sent</span>
            <Send className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.contacted}</div>
          <div className="text-[11px] text-slate-500 mt-1">Multi-Channel: Email & WA</div>
        </div>

        {/* Engaged / Replies */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Replies Received</span>
            <MessageSquare className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.engaged}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">24.6% Response Rate</div>
        </div>

        {/* Meetings Booked */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Meetings Booked</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{stats.meetings}</div>
          <div className="text-[11px] text-slate-500 mt-1">{stats.conversionRate}% Conversion</div>
        </div>
      </div>

      {/* Secondary Row: Funnel Visualizer + Pending SDR Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel Visualizer (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Conversion Funnel Velocity</h2>
              <p className="text-xs text-slate-500">Autonomous SDR throughput across stages</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              Avg Cycle: 4.2 Days
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700">1. Ingested & Normalized ({stats.totalLeads})</span>
                <span className="text-slate-500">100%</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-slate-400 h-full rounded-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700">2. ICP Scored & Qualified ({stats.qualifiedLeads})</span>
                <span className="text-slate-500">83%</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full w-[83%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700">3. Multi-Channel Outreach Contacted ({stats.contacted})</span>
                <span className="text-slate-500">66%</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full w-[66%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700">4. Engaged & Intent Classified ({stats.engaged})</span>
                <span className="text-slate-500">28%</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full w-[28%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700">5. Confirmed Meetings & AE Handoff ({stats.meetings})</span>
                <span className="text-slate-500">12%</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full w-[12%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Human SDR Approval Queue (1 Col) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
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
              Human-in-the-loop: Review AI drafted outreach before sending.
            </p>

            <div className="space-y-3">
              {pendingApprovals.slice(0, 2).map((msg) => (
                <div
                  key={msg.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{msg.lead_name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase">
                      {msg.channel}
                    </span>
                  </div>
                  <div className="text-slate-600 line-clamp-2 italic">
                    &ldquo;{msg.subject || msg.body}&rdquo;
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                    <button
                      onClick={() => handleApprove(msg.id)}
                      className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Approve & Send
                    </button>
                    <button
                      onClick={() => handleReject(msg.id)}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[11px] transition-colors"
                    >
                      Reject
                    </button>
                  </div>
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

          <Link
            href="/leads"
            className="text-xs text-indigo-600 font-semibold flex items-center justify-center gap-1 pt-3 mt-2 border-t border-slate-100 hover:text-indigo-800"
          >
            Review all leads & drafts <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Campaigns Snapshot & Recent AI Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaigns */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Active Outbound Campaigns</h2>
            <Link href="/campaigns" className="text-xs font-semibold text-indigo-600 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {store.campaigns.map((camp) => (
              <div
                key={camp.id}
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-900">{camp.name}</div>
                  <div className="text-[11px] text-slate-500">
                    Target: {camp.target_persona} · Mode: {camp.approval_mode}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-800">{camp.leads_count} Leads</div>
                  <div className="text-[11px] text-emerald-600 font-medium">
                    {camp.reply_rate}% Reply Rate
                  </div>
                </div>
              </div>
            ))}
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
            {store.auditLogs.slice(0, 4).map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-slate-800 flex items-center justify-between">
                    <span>{log.action.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-slate-400">Just now</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{log.details}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
