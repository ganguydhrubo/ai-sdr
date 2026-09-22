'use client';

import { useState } from 'react';
import {
  Activity,
  Zap,
  DollarSign,
  Clock,
  ShieldCheck,
  Server,
  Filter,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import { getDemoStore } from '../../lib/store/demo-store';
import { AuditLog, AIRun } from '../../lib/types';
import { clsx } from 'clsx';

export default function ActivityCenterPage() {
  const store = getDemoStore();
  const [auditLogs] = useState<AuditLog[]>([...store.auditLogs]);
  const [aiRuns] = useState<AIRun[]>([...store.aiRuns]);

  // Aggregate Metrics
  const totalTokens = aiRuns.reduce((acc, r) => acc + r.total_tokens, 0) || 1430;
  const totalCostUsd = aiRuns.reduce((acc, r) => acc + r.estimated_cost_usd, 0) || 0.000119;
  const avgLatency =
    aiRuns.length > 0
      ? Math.round(aiRuns.reduce((acc, r) => acc + r.latency_ms, 0) / aiRuns.length)
      : 461;

  const monthlyBudgetUsd = store.org.monthly_ai_budget;
  const spentUsd = store.org.ai_budget_spent_current_month;
  const percentSpent = ((spentUsd / monthlyBudgetUsd) * 100).toFixed(1);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            AI Activity Center & Observability Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time inference logs, token accounting, Groq cost circuit-breakers, and audit trails.
          </p>
        </div>
      </div>

      {/* Observability KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Token Consumption */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Tokens Processed</span>
            <Cpu className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalTokens.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Llama-3.3-70B Context</div>
        </div>

        {/* Inference Latency */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Average Latency</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{avgLatency} ms</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Ultra-fast Groq LPU</div>
        </div>

        {/* Estimated AI Spend */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Monthly AI Spend</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">₹2,380.00</div>
          <div className="text-[11px] text-slate-500 mt-1">${spentUsd.toFixed(2)} USD ({percentSpent}% of budget)</div>
        </div>

        {/* Cost Budget Circuit Breaker */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Safety Circuit Breaker</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-block">
            BUDGET NORMAL
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Auto-cutoff at $500/mo</div>
        </div>
      </div>

      {/* Live AI Audit Stream */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Deterministic Agent Execution Log</h2>
          </div>
          <span className="text-xs text-slate-400">Live streaming</span>
        </div>

        <div className="space-y-3">
          {auditLogs.map((log) => (
            <div
              key={log.id}
              className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-start justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase',
                      log.actor_type === 'AI_AGENT'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-200 text-slate-800'
                    )}
                  >
                    {log.actor_type}
                  </span>
                  <span className="font-bold text-slate-900">{log.action.replace(/_/g, ' ')}</span>
                  <span className="text-slate-400 text-[11px]">({log.actor_name})</span>
                </div>
                <div className="text-slate-600">{log.details}</div>
              </div>

              <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                {new Date(log.created_at).toLocaleTimeString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
