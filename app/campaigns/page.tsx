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
import { TEMPLATE_VARIABLES } from '../../lib/outreach/templates';
import { clsx } from 'clsx';

export default function CampaignsPage() {
  const store = getDemoStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([...store.campaigns]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign>(campaigns[0]);
  const steps = store.getCampaignSteps(selectedCampaign.id);

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
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Outreach Cadence Steps
              </h3>
              <span className="text-[11px] text-slate-400">
                {steps.length} steps · {steps.filter((s) => s.step_type === 'TALK_INVITE').length} talk link
              </span>
            </div>

            <div className="space-y-3">
              {steps.map((step) => {
                const isTalkInvite = step.step_type === 'TALK_INVITE';
                const Icon =
                  isTalkInvite ? Phone : step.channel === 'WHATSAPP' ? MessageSquare : step.channel === 'LINKEDIN' ? Linkedin : Mail;
                const iconColour =
                  isTalkInvite
                    ? 'text-violet-600'
                    : step.channel === 'WHATSAPP'
                      ? 'text-emerald-600'
                      : step.channel === 'LINKEDIN'
                        ? 'text-sky-600'
                        : 'text-indigo-600';
                return (
                  <div
                    key={step.id}
                    data-testid={`campaign-step-${step.step_number}`}
                    className={clsx(
                      'flex items-start gap-4 p-4 rounded-lg border',
                      isTalkInvite ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0',
                        isTalkInvite ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'
                      )}
                    >
                      {step.step_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Icon className={clsx('w-3.5 h-3.5', iconColour)} /> Day {step.delay_days} · {step.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-2">
                          {isTalkInvite ? (
                            <>
                              <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-mono text-[10px]">
                                TALK_INVITE · {'{{talk_link}}'}
                              </span>
                              <span>
                                {step.talk_link_expires_in_days ?? 7}-day link · {step.talk_link_max_calls ?? 3} calls · ₹0 carrier cost
                              </span>
                            </>
                          ) : (
                            <span>{step.channel} · {step.whatsapp_template_name ? `template ${step.whatsapp_template_name}` : 'AI-personalised'}</span>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{step.description}</p>
                      {step.subject_template && (
                        <p className="text-[11px] text-slate-500 mt-1.5 font-mono truncate">
                          Subject: {step.subject_template}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Template variables:</span>{' '}
              {TEMPLATE_VARIABLES.map((v) => (
                <span key={v.key} className="inline-block mr-2 mb-1 font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5" title={v.description}>
                  {'{{'}{v.key}{'}}'}
                </span>
              ))}
              <span className="block mt-1">
                A TALK_INVITE step mints a personal WebRTC link per lead, sends it on the step&apos;s channel and revokes it on opt-out. It must contain {'{{talk_link}}'}.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
