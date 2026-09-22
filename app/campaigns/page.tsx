'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Plus,
  Play,
  Pause,
  Clock,
  Settings2,
  Mail,
  MessageSquare,
  Linkedin,
  Phone,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { getDemoStore } from '../../lib/store/demo-store';
import { Campaign, ApprovalMode } from '../../lib/types';
import { clsx } from 'clsx';

export default function CampaignsPage() {
  const store = getDemoStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([...store.campaigns]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign>(campaigns[0]);

  const handleToggleMode = (campId: string, newMode: ApprovalMode) => {
    const camp = store.campaigns.find((c) => c.id === campId);
    if (camp) {
      camp.approval_mode = newMode;
      setCampaigns([...store.campaigns]);
      setSelectedCampaign({ ...camp });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Send className="w-6 h-6 text-indigo-600" />
            Outbound Campaigns & Sequences
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure multi-channel cadence rules, business hours (IST), and human approval modes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Create New Campaign
          </button>
        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {campaigns.map((camp) => (
          <div
            key={camp.id}
            onClick={() => setSelectedCampaign(camp)}
            className={clsx(
              'p-5 rounded-xl border cursor-pointer transition-all',
              selectedCampaign.id === camp.id
                ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {camp.status}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Mode: {camp.approval_mode}
              </span>
            </div>

            <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{camp.name}</h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{camp.description}</p>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
              <div>
                <div className="text-xs font-bold text-slate-900">{camp.leads_count}</div>
                <div className="text-[10px] text-slate-400">Enrolled</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{camp.open_rate}%</div>
                <div className="text-[10px] text-slate-400">Open Rate</div>
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-600">{camp.reply_rate}%</div>
                <div className="text-[10px] text-slate-400">Reply Rate</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Sequence View for Selected Campaign */}
      {selectedCampaign && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Sequence Architecture
              </div>
              <h2 className="text-lg font-bold text-slate-900">{selectedCampaign.name}</h2>
              <div className="text-xs text-slate-500 mt-0.5">
                Target: {selectedCampaign.target_persona} · {selectedCampaign.target_industry}
              </div>
            </div>

            {/* Approval Mode Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Approval Policy:</span>
              {(['MANUAL', 'SEMI_AUTOMATIC', 'AUTONOMOUS'] as ApprovalMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleToggleMode(selectedCampaign.id, mode)}
                  className={clsx(
                    'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                    selectedCampaign.approval_mode === mode
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  )}
                >
                  {mode.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Sequence Steps Timeline */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Outreach Cadence Steps
            </h3>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" /> Day 0 · Initial Personalized Email
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Auto-personalized by AI</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Value-driven consultative intro highlighting pipeline efficiency for VP Sales. Checked against ComplianceGuard.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Day 2 · WhatsApp Touchpoint (Meta API)
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">+91 Verified</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Short message referencing the email with Hindi/Hinglish language options for tier-2 industrial decision makers.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" /> Day 5 · Value & Peer Benchmark
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Delay: 3 Days</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Shares real Indian enterprise case study on reducing SDR ramp time.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  4
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" /> Day 14 · Polite Breakup & Resource
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Final Cadence Step</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Polite breakup note ensuring zero spam escalation. Leaves door open for future outreach.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
