'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Send, Plus, Play, Pause, Mail, MessageSquare, Linkedin, Phone, Users, Zap, ToggleLeft, ToggleRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppState } from '../../lib/client/use-app-state';
import { api } from '../../lib/client/api';
import { TEMPLATE_VARIABLES } from '../../lib/outreach/templates';
import { PageLoading, PageError, Notice, useNotice, Modal, Field, inputCls, btn, LeadStatusBadge, Spinner } from '../../components/ui';
import type { ApprovalMode, Campaign } from '../../lib/types';

export default function CampaignsPage() {
  const { state, loading, error, refresh } = useAppState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', target_persona: 'VP Sales / Head of BD', target_industry: 'Industrial Manufacturing', approval_mode: 'MANUAL' as ApprovalMode, primary_channel: 'EMAIL' as 'EMAIL' | 'WHATSAPP', include_talk_invite: true });

  // Enroll modal
  const [showEnroll, setShowEnroll] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Run step
  const [runLeadId, setRunLeadId] = useState('');

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('campaign');
    if (fromQuery) setSelectedId(fromQuery);
  }, []);

  const campaigns = useMemo(() => state?.campaigns || [], [state]);
  const selectedCampaign: Campaign | undefined = useMemo(() => campaigns.find((c) => c.id === selectedId) || campaigns[0], [campaigns, selectedId]);

  if (error && !state) return <PageError message={error} />;
  if (loading || !state) return <PageLoading />;

  const steps = selectedCampaign ? state.campaignSteps.filter((s) => s.campaign_id === selectedCampaign.id).sort((a, b) => a.step_number - b.step_number) : [];
  const enrolledIds = selectedCampaign?.enrolled_lead_ids || [];
  const enrolledLeads = state.leads.filter((l) => enrolledIds.includes(l.id));
  const candidateLeads = state.leads.filter((l) => !enrolledIds.includes(l.id) && !l.is_suppressed);
  const campaignMessages = selectedCampaign ? state.messages.filter((m) => m.campaign_id === selectedCampaign.id) : [];

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handleToggleMode = (campId: string, newMode: ApprovalMode) => run(`mode-${newMode}`, async () => void (await api.patch(`/api/campaigns/${campId}`, { approval_mode: newMode })));

  const handleToggleStatus = (camp: Campaign) =>
    run('status', async () => {
      const status = camp.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      await api.patch(`/api/campaigns/${camp.id}`, { status });
      setNotice({ kind: 'ok', text: `Campaign ${status === 'ACTIVE' ? 'resumed' : 'paused'}.` });
    });

  const handleCreate = () =>
    run('create', async () => {
      const res = await api.post<{ campaign: Campaign }>('/api/campaigns', form);
      setShowCreate(false);
      setSelectedId(res.campaign.id);
      setForm({ ...form, name: '', description: '' });
      setNotice({ kind: 'ok', text: `Campaign "${res.campaign.name}" created with ${res.campaign.steps_count} steps. Enrol leads to start the sequence.` });
    });

  const handleEnroll = (filter?: 'QUALIFIED' | 'ALL') =>
    run('enroll', async () => {
      if (!selectedCampaign) return;
      const res = await api.post<{ enrolled: string[]; already_enrolled: string[]; drafted: number; queued: number; sent: number; failed: number; errors: Array<{ error: string }> }>(`/api/campaigns/${selectedCampaign.id}/enroll`, filter ? { filter } : { lead_ids: selectedLeads });
      setShowEnroll(false);
      setSelectedLeads([]);
      setNotice({
        kind: res.errors.length && !res.enrolled.length ? 'error' : 'ok',
        text: `Enrolled ${res.enrolled.length} lead(s): ${res.drafted} drafts waiting for approval, ${res.queued} queued${res.sent ? `, ${res.sent} sent` : ''}${res.failed ? `, ${res.failed} failed` : ''}${res.errors.length ? ` · ${res.errors.map((e) => e.error).join('; ')}` : ''}.`,
      });
    });

  const handleRunStep = (stepId: string) =>
    run(`step-${stepId}`, async () => {
      if (!selectedCampaign || !runLeadId) {
        setNotice({ kind: 'info', text: 'Pick a lead first (dropdown below the steps).' });
        return;
      }
      const res = await api.post<{ step_type: string; message?: { status: string; channel: string }; delivery?: { sent: number; failed: number } }>(`/api/campaigns/${selectedCampaign.id}/run-step`, { step_id: stepId, lead_id: runLeadId });
      setNotice({
        kind: 'ok',
        text: `${res.step_type} step executed — ${res.message?.channel} message is ${res.message?.status?.replace('_', ' ').toLowerCase()}${res.delivery ? ` (${res.delivery.sent} sent, ${res.delivery.failed} failed)` : ''}.`,
      });
    });

  const handleToggleStep = (stepId: string, active: boolean) => run(`toggle-${stepId}`, async () => void (await api.patch(`/api/campaigns/steps/${stepId}`, { is_active: active })));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Send className="w-6 h-6 text-indigo-600" />
            Outbound Campaigns & Sequences
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Configure multi-channel cadence rules, business hours (IST), approval modes, and enrol leads.</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className={btn.primary} data-testid="open-create-campaign">
            <Plus className="w-3.5 h-3.5" /> Create New Campaign
          </button>
        </div>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {campaigns.map((camp) => {
          const sent = state.messages.filter((m) => m.campaign_id === camp.id && ['SENT', 'DELIVERED', 'REPLIED'].includes(m.status)).length;
          const replied = state.messages.filter((m) => m.campaign_id === camp.id && m.status === 'REPLIED').length;
          return (
            <div
              key={camp.id}
              onClick={() => setSelectedId(camp.id)}
              className={clsx(
                'p-5 rounded-xl border cursor-pointer transition-all',
                selectedCampaign?.id === camp.id ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              )}
              data-testid={`campaign-card-${camp.id}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border', camp.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>{camp.status}</span>
                <span className="text-xs font-semibold text-slate-500">Mode: {camp.approval_mode}</span>
              </div>

              <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{camp.name}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{camp.description}</p>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                <div>
                  <div className="text-xs font-bold text-slate-900">{camp.leads_count}</div>
                  <div className="text-[10px] text-slate-400">Enrolled</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{sent}</div>
                  <div className="text-[10px] text-slate-400">Sent</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-600">{replied}</div>
                  <div className="text-[10px] text-slate-400">Replied</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Sequence View for Selected Campaign */}
      {selectedCampaign && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Sequence Architecture</div>
              <h2 className="text-lg font-bold text-slate-900">{selectedCampaign.name}</h2>
              <div className="text-xs text-slate-500 mt-0.5">
                Target: {selectedCampaign.target_persona} · {selectedCampaign.target_industry} · {selectedCampaign.business_hours_start}–{selectedCampaign.business_hours_end} IST
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-600">Approval Policy:</span>
              {(['MANUAL', 'SEMI_AUTOMATIC', 'AUTONOMOUS'] as ApprovalMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleToggleMode(selectedCampaign.id, mode)}
                  disabled={busy !== null}
                  className={clsx('px-3 py-1 rounded-lg text-xs font-semibold transition-colors', selectedCampaign.approval_mode === mode ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')}
                  data-testid={`mode-${mode}`}
                >
                  {mode.replace('_', ' ')}
                </button>
              ))}
              <button onClick={() => handleToggleStatus(selectedCampaign)} disabled={busy !== null} className={selectedCampaign.status === 'ACTIVE' ? btn.secondary : btn.success} data-testid="toggle-campaign-status">
                {busy === 'status' ? <Spinner /> : selectedCampaign.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {selectedCampaign.status === 'ACTIVE' ? 'Pause' : 'Resume'}
              </button>
              <button onClick={() => setShowEnroll(true)} disabled={busy !== null || selectedCampaign.status !== 'ACTIVE'} className={btn.primary} data-testid="open-enroll">
                <Users className="w-3.5 h-3.5" /> Enrol leads
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            {selectedCampaign.approval_mode === 'MANUAL'
              ? 'MANUAL: every step lands in the SDR approval queue on the dashboard before anything is sent.'
              : selectedCampaign.approval_mode === 'SEMI_AUTOMATIC'
                ? 'SEMI-AUTOMATIC: compliant steps are sent immediately; anything the guard flags waits for approval.'
                : 'AUTONOMOUS: compliant steps are sent immediately without human review (the kill switch still applies).'}
          </p>

          {/* Sequence Steps Timeline */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Outreach Cadence Steps</h3>
              <span className="text-[11px] text-slate-400">
                {steps.length} steps · {steps.filter((s) => s.step_type === 'TALK_INVITE').length} talk link
              </span>
            </div>

            <div className="space-y-3">
              {steps.map((step) => {
                const isTalkInvite = step.step_type === 'TALK_INVITE';
                const Icon = isTalkInvite ? Phone : step.channel === 'WHATSAPP' ? MessageSquare : step.channel === 'LINKEDIN' ? Linkedin : Mail;
                const iconColour = isTalkInvite ? 'text-violet-600' : step.channel === 'WHATSAPP' ? 'text-emerald-600' : step.channel === 'LINKEDIN' ? 'text-sky-600' : 'text-indigo-600';
                const stepMessages = campaignMessages.filter((m) => m.campaign_step_id === step.id);
                return (
                  <div
                    key={step.id}
                    data-testid={`campaign-step-${step.step_number}`}
                    className={clsx('flex items-start gap-4 p-4 rounded-lg border', isTalkInvite ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200', !step.is_active && 'opacity-60')}
                  >
                    <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0', isTalkInvite ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700')}>{step.step_number}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Icon className={clsx('w-3.5 h-3.5', iconColour)} /> Day {step.delay_days} · {step.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-2 flex-wrap">
                          {isTalkInvite ? (
                            <>
                              <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-mono text-[10px]">TALK_INVITE · {'{{talk_link}}'}</span>
                              <span>
                                {step.talk_link_expires_in_days ?? 7}-day link · {step.talk_link_max_calls ?? 3} calls · ₹0 carrier cost
                              </span>
                            </>
                          ) : (
                            <span>
                              {step.channel} · {step.whatsapp_template_name ? `template ${step.whatsapp_template_name}` : 'AI-personalised'}
                            </span>
                          )}
                          <span className="text-slate-500">· {stepMessages.length} sent/drafted</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{step.description}</p>
                      {step.subject_template && <p className="text-[11px] text-slate-500 mt-1.5 font-mono truncate">Subject: {step.subject_template}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => handleRunStep(step.id)} disabled={busy !== null || !step.is_active} className={btn.small} data-testid={`run-step-${step.step_number}`}>
                          {busy === `step-${step.id}` ? <Spinner /> : <Zap className="w-3 h-3 text-indigo-600" />} Run for selected lead
                        </button>
                        <button onClick={() => handleToggleStep(step.id, !step.is_active)} disabled={busy !== null} className={btn.ghost}>
                          {step.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />} {step.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
              <span className="text-slate-600 font-semibold">Lead for &ldquo;Run for selected lead&rdquo;:</span>
              <select value={runLeadId} onChange={(e) => setRunLeadId(e.target.value)} className={`${inputCls} sm:max-w-xs`} data-testid="run-step-lead">
                <option value="">Select a lead…</option>
                {(enrolledLeads.length ? enrolledLeads : state.leads.filter((l) => !l.is_suppressed)).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name} — {l.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Template variables:</span>{' '}
              {TEMPLATE_VARIABLES.map((v) => (
                <span key={v.key} className="inline-block mr-2 mb-1 font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5" title={v.description}>
                  {'{{'}
                  {v.key}
                  {'}}'}
                </span>
              ))}
              <span className="block mt-1">A TALK_INVITE step mints a personal WebRTC link per lead, sends it on the step&apos;s channel and revokes it on opt-out. It must contain {'{{talk_link}}'}.</span>
            </div>
          </div>

          {/* Enrolled leads */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Enrolled leads ({enrolledLeads.length})</h3>
            {enrolledLeads.length === 0 ? (
              <div className="text-xs text-slate-400">No leads enrolled yet — click &ldquo;Enrol leads&rdquo; to start the sequence for real prospects.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {enrolledLeads.map((l) => {
                  const last = campaignMessages.find((m) => m.lead_id === l.id);
                  return (
                    <Link key={l.id} href={`/leads/${l.id}`} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs hover:border-indigo-300">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 truncate">{l.full_name}</span>
                        <LeadStatusBadge status={l.status} />
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{l.company_name}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{last ? `Last touch: ${last.channel} · ${last.status.replace('_', ' ')}` : 'No touches yet'}</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create campaign modal */}
      <Modal open={showCreate} title="Create a campaign" description="A 4-touch sequence is generated: opener → follow-up → Talk-to-our-AI link → polite close. Templates are editable per step." onClose={() => setShowCreate(false)}>
        <div className="space-y-3">
          <Field label="Name *">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. Q4 Pune Auto-Component Suppliers" data-testid="campaign-name" />
          </Field>
          <Field label="Description">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="Who this targets and why" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target persona">
              <input value={form.target_persona} onChange={(e) => setForm({ ...form, target_persona: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Target industry">
              <input value={form.target_industry} onChange={(e) => setForm({ ...form, target_industry: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary channel">
              <select value={form.primary_channel} onChange={(e) => setForm({ ...form, primary_channel: e.target.value as 'EMAIL' | 'WHATSAPP' })} className={inputCls}>
                <option value="EMAIL">Email-led (Resend)</option>
                <option value="WHATSAPP">WhatsApp-first (Baileys)</option>
              </select>
            </Field>
            <Field label="Approval mode">
              <select value={form.approval_mode} onChange={(e) => setForm({ ...form, approval_mode: e.target.value as ApprovalMode })} className={inputCls}>
                <option value="MANUAL">MANUAL — approve every message</option>
                <option value="SEMI_AUTOMATIC">SEMI-AUTOMATIC — send compliant, hold flagged</option>
                <option value="AUTONOMOUS">AUTONOMOUS — send everything compliant</option>
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.include_talk_invite} onChange={(e) => setForm({ ...form, include_talk_invite: e.target.checked })} className="accent-indigo-600" />
            Include a &ldquo;Talk to our AI&rdquo; voice-link step (₹0 carrier cost)
          </label>
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className={btn.ghost}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={busy !== null || !form.name.trim()} className={btn.primary} data-testid="submit-create-campaign">
              {busy === 'create' ? <Spinner /> : <Plus className="w-3.5 h-3.5" />} Create campaign
            </button>
          </div>
        </div>
      </Modal>

      {/* Enrol modal */}
      <Modal open={showEnroll} title={`Enrol leads in ${selectedCampaign?.name || 'campaign'}`} description="Step 1 runs immediately for every enrolled lead (draft for approval on MANUAL campaigns, sent otherwise)." onClose={() => setShowEnroll(false)} wide>
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => handleEnroll('QUALIFIED')} disabled={busy !== null} className={btn.secondary}>
              Enrol all ICP-qualified ({candidateLeads.filter((l) => (l.score?.score ?? 0) >= state.icp.minimum_qualifying_score && ['QUALIFIED', 'NEW', 'OUTREACH'].includes(l.status)).length})
            </button>
            <button onClick={() => setSelectedLeads(candidateLeads.map((l) => l.id))} className={btn.ghost}>
              Select all
            </button>
            <button onClick={() => setSelectedLeads([])} className={btn.ghost}>
              Clear
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {candidateLeads.map((l) => (
              <label key={l.id} className="flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedLeads.includes(l.id)}
                  onChange={(e) => setSelectedLeads((s) => (e.target.checked ? [...s, l.id] : s.filter((id) => id !== l.id)))}
                  className="accent-indigo-600"
                  data-testid={`enroll-${l.id}`}
                />
                <span className="font-semibold text-slate-800">{l.full_name}</span>
                <span className="text-slate-500 truncate">{l.company_name}</span>
                <span className="ml-auto text-[10px] font-bold text-slate-500">{l.score?.score ?? '—'}</span>
                <LeadStatusBadge status={l.status} />
              </label>
            ))}
            {candidateLeads.length === 0 && <div className="p-4 text-xs text-slate-400 text-center">Every lead is already enrolled.</div>}
          </div>
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button onClick={() => setShowEnroll(false)} className={btn.ghost}>
              Cancel
            </button>
            <button onClick={() => handleEnroll()} disabled={busy !== null || selectedLeads.length === 0} className={btn.primary} data-testid="submit-enroll">
              {busy === 'enroll' ? <Spinner /> : <Users className="w-3.5 h-3.5" />} Enrol {selectedLeads.length} lead{selectedLeads.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
