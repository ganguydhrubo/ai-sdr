'use client';

import { useMemo, useState } from 'react';
import { Activity, Zap, DollarSign, Clock, ShieldCheck, Cpu, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppState } from '../../lib/client/use-app-state';
import { formatInr, timeAgo, usdToInr } from '../../lib/client/format';
import { PageLoading, PageError } from '../../components/ui';

export default function ActivityCenterPage() {
  const { state, loading, error } = useAppState({ pollMs: 15_000 });
  const [actorFilter, setActorFilter] = useState<'ALL' | 'AI_AGENT' | 'USER' | 'SYSTEM_WORKER'>('ALL');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'AUDIT' | 'AI_RUNS'>('AUDIT');

  const logs = useMemo(() => {
    if (!state) return [];
    const q = query.toLowerCase();
    return state.auditLogs.filter((l) => (actorFilter === 'ALL' || l.actor_type === actorFilter) && (!q || l.action.toLowerCase().includes(q) || l.details.toLowerCase().includes(q)));
  }, [state, actorFilter, query]);

  if (error && !state) return <PageError message={error} />;
  if (loading || !state) return <PageLoading />;

  const { stats, aiRuns, org, integrations } = state;
  const liveRuns = aiRuns.filter((r) => r.provider === 'GROQ').length;
  const spentInr = usdToInr(org.ai_budget_spent_current_month);
  const budgetInr = usdToInr(org.monthly_ai_budget);
  const percentSpent = org.monthly_ai_budget > 0 ? ((org.ai_budget_spent_current_month / org.monthly_ai_budget) * 100).toFixed(1) : '0.0';
  const breakerTripped = org.monthly_ai_budget > 0 && org.ai_budget_spent_current_month >= org.monthly_ai_budget;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            AI Activity Center & Observability Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Every AI call is metered (tokens, latency, list-price cost) and every state change is audited. Persisted on disk.</p>
        </div>
      </div>

      {/* Observability KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Tokens Processed</span>
            <Cpu className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.aiTokensTotal.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats.aiRunsCount} runs · {liveRuns} on {integrations.ai.live ? integrations.ai.model.split('/').pop() : 'Groq'} · {stats.aiRunsCount - liveRuns} simulated
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Average Latency</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.aiAvgLatencyMs} ms</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">{integrations.ai.live ? 'Groq LPU free tier' : 'Offline simulator'}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Monthly AI Spend (list price)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatInr(spentInr, { decimals: 2 })}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            ${org.ai_budget_spent_current_month.toFixed(4)} of ${org.monthly_ai_budget} ({percentSpent}%) · billed ₹0 on the free tier
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Safety Circuit Breaker</span>
            <ShieldCheck className={clsx('w-4 h-4', breakerTripped ? 'text-rose-500' : 'text-emerald-500')} />
          </div>
          <div className={clsx('text-xs font-bold px-2 py-1 rounded inline-block', breakerTripped ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50')}>{breakerTripped ? 'BUDGET EXHAUSTED · simulator' : 'BUDGET NORMAL'}</div>
          <div className="text-[11px] text-slate-400 mt-2">Auto-cutoff at {formatInr(budgetInr)}/mo (${org.monthly_ai_budget}) — change in Settings</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(
          [
            ['AUDIT', `Audit log (${state.auditLogs.length})`],
            ['AI_RUNS', `AI runs (${aiRuns.length})`],
          ] as const
        ).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={clsx('px-4 py-2 rounded-lg text-xs font-semibold transition-colors', tab === key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'AUDIT' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Deterministic Agent Execution Log</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…" className="text-xs bg-transparent focus:outline-none w-40" />
              </div>
              <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value as typeof actorFilter)} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <option value="ALL">All actors</option>
                <option value="AI_AGENT">AI agents</option>
                <option value="USER">Users</option>
                <option value="SYSTEM_WORKER">System workers</option>
              </select>
            </div>
          </div>

          <div className="space-y-3" data-testid="audit-log">
            {logs.slice(0, 150).map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', log.actor_type === 'AI_AGENT' ? 'bg-indigo-100 text-indigo-800' : log.actor_type === 'SYSTEM_WORKER' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800')}>{log.actor_type.replace('_', ' ')}</span>
                    <span className="font-bold text-slate-900">{log.action.replace(/_/g, ' ')}</span>
                    <span className="text-slate-400 text-[11px]">({log.actor_name})</span>
                  </div>
                  <div className="text-slate-600 break-words">{log.details}</div>
                </div>

                <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap text-right">
                  {new Date(log.created_at).toLocaleTimeString('en-IN')}
                  <br />
                  {timeAgo(log.created_at)}
                </span>
              </div>
            ))}
            {logs.length === 0 && <div className="text-xs text-slate-400 text-center py-6">No entries match.</div>}
          </div>
        </div>
      )}

      {tab === 'AI_RUNS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs text-slate-600" data-testid="ai-runs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Provider / model</th>
                <th className="px-4 py-3 text-right">Tokens</th>
                <th className="px-4 py-3 text-right">Latency</th>
                <th className="px-4 py-3 text-right">List cost</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aiRuns.slice(0, 150).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{r.agent_name}</td>
                  <td className="px-4 py-2.5">
                    <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded mr-1', r.provider === 'GROQ' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')}>{r.provider}</span>
                    <span className="font-mono text-[11px]">{r.model}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{r.total_tokens.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{r.latency_ms} ms</td>
                  <td className="px-4 py-2.5 text-right font-mono">${r.estimated_cost_usd.toFixed(5)}</td>
                  <td className="px-4 py-2.5">{r.success ? <span className="text-emerald-700 font-semibold">ok</span> : <span className="text-rose-700" title={r.error_message}>failed</span>}</td>
                  <td className="px-4 py-2.5 text-right text-slate-400">{timeAgo(r.created_at)}</td>
                </tr>
              ))}
              {aiRuns.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No AI runs yet — run the SDR agent on a lead.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
