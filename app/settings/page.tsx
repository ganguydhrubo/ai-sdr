'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Settings,
  Building,
  Sliders,
  ShieldAlert,
  AlertOctagon,
  Ban,
  Plus,
  Save,
  CheckCircle2,
  Key,
  Phone,
} from 'lucide-react';
import { getDemoStore } from '../../lib/store/demo-store';
import { ComplianceGuard } from '../../lib/compliance/guard';
import { clsx } from 'clsx';

export default function SettingsPage() {
  const store = getDemoStore();
  const [killSwitch, setKillSwitch] = useState(store.org.emergency_kill_switch_active);
  const [suppressionList, setSuppressionList] = useState(ComplianceGuard.getSuppressionList());
  const [newSuppressionEmail, setNewSuppressionEmail] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ICP Weights State
  const [weights, setWeights] = useState({
    industry: store.icp.weight_industry,
    size: store.icp.weight_company_size,
    role: store.icp.weight_role_seniority,
    geo: store.icp.weight_geography,
    tech: store.icp.weight_tech_fit,
    signals: store.icp.weight_business_signals,
    contact: store.icp.weight_contact_quality,
  });

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleToggleKillSwitch = () => {
    const newState = store.toggleKillSwitch();
    setKillSwitch(newState);
  };

  const handleAddSuppression = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppressionEmail) return;
    ComplianceGuard.addSuppression({
      email: newSuppressionEmail,
      reason: 'MANUAL_BLOCK',
    });
    setSuppressionList(ComplianceGuard.getSuppressionList());
    setNewSuppressionEmail('');
  };

  const handleSaveWeights = () => {
    store.icp.weight_industry = weights.industry;
    store.icp.weight_company_size = weights.size;
    store.icp.weight_role_seniority = weights.role;
    store.icp.weight_geography = weights.geo;
    store.icp.weight_tech_fit = weights.tech;
    store.icp.weight_business_signals = weights.signals;
    store.icp.weight_contact_quality = weights.contact;

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          Enterprise Admin & Compliance Control Center
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure organization settings, dynamic ICP scoring weights, global suppression lists, and emergency guardrails.
        </p>
      </div>

      {/* Emergency Kill Switch Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={clsx('p-2.5 rounded-lg', killSwitch ? 'bg-rose-100' : 'bg-slate-100')}>
              <AlertOctagon className={clsx('w-6 h-6', killSwitch ? 'text-rose-600 animate-pulse' : 'text-slate-600')} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Global Emergency Kill Switch</h2>
              <p className="text-xs text-slate-500">
                Instantly freeze all outbound email, WhatsApp, and voice sequences across every campaign.
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleKillSwitch}
            className={clsx(
              'px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm',
              killSwitch
                ? 'bg-rose-600 text-white hover:bg-rose-700 animate-pulse'
                : 'bg-slate-900 text-white hover:bg-rose-600'
            )}
          >
            {killSwitch ? 'RESUME ALL OUTREACH' : 'ENGAGE EMERGENCY STOP'}
          </button>
        </div>
      </div>

      {/* Voice settings entry */}
      <Link
        href="/settings/voice"
        data-testid="voice-settings-link"
        className="block bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-indigo-400 transition-colors"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50">
              <Phone className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Voice Settings — talk links & TRAI PSTN gate</h2>
              <p className="text-xs text-slate-500">
                Zero-cost WebRTC &ldquo;Talk to our AI&rdquo; links, DLT / caller-ID / OAP compliance, and the eight-point checklist that must pass before PSTN calling is enabled.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-indigo-600 whitespace-nowrap">Open →</span>
        </div>
      </Link>

      {/* Dynamic ICP Scoring Engine Weights */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Dynamic ICP Fit Scoring Weight Matrix
            </h2>
            <p className="text-xs text-slate-500">
              Customize how the AI Scoring Agent evaluates Indian B2B leads. (Must sum to 100%).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'text-xs font-bold px-2 py-0.5 rounded',
                totalWeight === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              )}
            >
              Total: {totalWeight}%
            </span>
            <button
              onClick={handleSaveWeights}
              disabled={totalWeight !== 100}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> Save Weights
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ICP scoring matrix updated successfully!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Industry Fit Weight: {weights.industry}%
            </label>
            <input
              type="range"
              min="0"
              max="40"
              value={weights.industry}
              onChange={(e) => setWeights({ ...weights, industry: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Role & Seniority Weight: {weights.role}%
            </label>
            <input
              type="range"
              min="0"
              max="40"
              value={weights.role}
              onChange={(e) => setWeights({ ...weights, role: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Company Size / Revenue Weight: {weights.size}%
            </label>
            <input
              type="range"
              min="0"
              max="30"
              value={weights.size}
              onChange={(e) => setWeights({ ...weights, size: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Geography (Tier 1/2 Hubs) Weight: {weights.geo}%
            </label>
            <input
              type="range"
              min="0"
              max="30"
              value={weights.geo}
              onChange={(e) => setWeights({ ...weights, geo: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Verified Public Signals: {weights.signals}%
            </label>
            <input
              type="range"
              min="0"
              max="30"
              value={weights.signals}
              onChange={(e) => setWeights({ ...weights, signals: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Contact Reachability & Phone Quality: {weights.contact}%
            </label>
            <input
              type="range"
              min="0"
              max="30"
              value={weights.contact}
              onChange={(e) => setWeights({ ...weights, contact: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>
      </div>

      {/* Global Suppression List */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-600" />
            Global Suppression & Opt-Out Registry
          </h2>
          <p className="text-xs text-slate-500">
            Suppressed emails, phones, and competitor domains are permanently blocked from outbound queues.
          </p>
        </div>

        <form onSubmit={handleAddSuppression} className="flex gap-2">
          <input
            type="text"
            placeholder="Add email or domain to suppress (e.g. competitor.com)..."
            value={newSuppressionEmail}
            onChange={(e) => setNewSuppressionEmail(e.target.value)}
            className="flex-1 text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Suppress
          </button>
        </form>

        <div className="divide-y divide-slate-100 text-xs">
          {suppressionList.map((item, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between">
              <span className="font-mono text-slate-800">{item.email || item.domain || item.phone}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                {item.reason}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Integrations & API Credentials */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-600" />
          AI & Channel Integrations Status
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-800">Primary LLM Provider</div>
            <div className="text-slate-500 text-[11px]">Groq (Llama-3.3-70B)</div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
              Active (Demo/Groq Adapter)
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-800">Outbound Email</div>
            <div className="text-slate-500 text-[11px]">Resend / SMTP Adapter</div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
              Active (Simulated + Resend)
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-800">WhatsApp Messaging</div>
            <div className="text-slate-500 text-[11px]">Official Meta Cloud API</div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
              Active (Meta Adapter)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
