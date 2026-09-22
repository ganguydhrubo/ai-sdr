'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Sliders, AlertOctagon, Ban, Plus, Save, Key, Phone, RefreshCw, Trash2, Database, Mail, Smartphone, Cpu, Mic } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppState } from '../../lib/client/use-app-state';
import { api } from '../../lib/client/api';
import { PageLoading, PageError, Notice, useNotice, Modal, Field, inputCls, btn, Spinner } from '../../components/ui';
import type { DeliveryMode } from '../../lib/types';
import type { IntegrationStatus } from '../../lib/integrations/status';

const WEIGHT_FIELDS = [
  ['weight_industry', 'Industry Fit Weight', 40],
  ['weight_role_seniority', 'Role & Seniority Weight', 40],
  ['weight_company_size', 'Company Size / Revenue Weight', 30],
  ['weight_geography', 'Geography (Tier 1/2 Hubs) Weight', 30],
  ['weight_tech_fit', 'Tech Stack Fit Weight', 30],
  ['weight_business_signals', 'Verified Public Signals', 30],
  ['weight_contact_quality', 'Contact Reachability & Phone Quality', 30],
] as const;

type WeightKey = (typeof WEIGHT_FIELDS)[number][0];

export default function SettingsPage() {
  const { state, loading, error, refresh } = useAppState();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();

  const [weights, setWeights] = useState<Record<WeightKey, number> | null>(null);
  const [minScore, setMinScore] = useState<number | null>(null);
  const [delivery, setDelivery] = useState<{ delivery_mode: DeliveryMode; outbound_test_email: string; outbound_test_phone: string; is_autonomous_outreach_enabled: boolean; monthly_ai_budget: number } | null>(null);
  const [newSuppression, setNewSuppression] = useState('');
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!state) return;
    setWeights((w) => w || (Object.fromEntries(WEIGHT_FIELDS.map(([k]) => [k, state.icp[k]])) as Record<WeightKey, number>));
    setMinScore((m) => (m === null ? state.icp.minimum_qualifying_score : m));
    setDelivery(
      (d) =>
        d || {
          delivery_mode: state.org.delivery_mode,
          outbound_test_email: state.org.outbound_test_email || '',
          outbound_test_phone: state.org.outbound_test_phone || '',
          is_autonomous_outreach_enabled: state.org.is_autonomous_outreach_enabled,
          monthly_ai_budget: state.org.monthly_ai_budget,
        }
    );
    setIntegrations((i) => i || state.integrations);
  }, [state]);

  if (error && !state) return <PageError message={error} />;
  if (loading || !state || !weights || !delivery || minScore === null) return <PageLoading />;

  const killSwitch = state.org.emergency_kill_switch_active;
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const integ = integrations || state.integrations;

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

  const handleToggleKillSwitch = () =>
    run('kill', async () => {
      const res = await api.post<{ active: boolean }>('/api/settings/kill-switch');
      setNotice({ kind: res.active ? 'error' : 'ok', text: res.active ? 'EMERGENCY STOP engaged — every outbound channel is frozen.' : 'Outreach resumed.' });
    });

  const handleSaveWeights = () =>
    run('weights', async () => {
      await api.put('/api/settings', { icp: { ...weights, minimum_qualifying_score: minScore } });
      setNotice({ kind: 'ok', text: 'ICP scoring matrix saved — the scoring agent uses these weights on the next run.' });
    });

  const handleSaveDelivery = () =>
    run('delivery', async () => {
      const res = await api.put<{ integrations: IntegrationStatus }>('/api/settings', delivery);
      setIntegrations(res.integrations);
      setNotice({ kind: 'ok', text: `Delivery settings saved (${delivery.delivery_mode}).` });
    });

  const handleAddSuppression = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppression.trim()) return;
    run('suppress', async () => {
      await api.post('/api/settings/suppression', { identifier: newSuppression, reason: 'MANUAL_BLOCK' });
      setNewSuppression('');
      setNotice({ kind: 'ok', text: 'Added to the suppression registry; matching leads are now blocked.' });
    });
  };

  const handleRemoveSuppression = (identifier: string) => run(`rm-${identifier}`, async () => void (await api.delete('/api/settings/suppression', { identifier })));

  const handleRefreshIntegrations = () =>
    run('integrations', async () => {
      setIntegrations(await api.get<IntegrationStatus>('/api/integrations?fresh=true'));
    });

  const handleReset = () =>
    run('reset', async () => {
      await api.post('/api/state/reset');
      setConfirmReset(false);
      setWeights(null);
      setDelivery(null);
      setMinScore(null);
      setNotice({ kind: 'ok', text: 'Demo data reset to the seed state.' });
    });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          Enterprise Admin & Compliance Control Center
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Delivery mode, dynamic ICP scoring weights, global suppression lists, emergency guardrails and live integration health.</p>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {/* Emergency Kill Switch Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={clsx('p-2.5 rounded-lg', killSwitch ? 'bg-rose-100' : 'bg-slate-100')}>
              <AlertOctagon className={clsx('w-6 h-6', killSwitch ? 'text-rose-600 animate-pulse' : 'text-slate-600')} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Global Emergency Kill Switch</h2>
              <p className="text-xs text-slate-500">Instantly freeze all outbound email, WhatsApp, and voice sequences across every campaign. Persists across restarts.</p>
            </div>
          </div>

          <button
            onClick={handleToggleKillSwitch}
            disabled={busy !== null}
            data-testid="settings-kill-switch"
            className={clsx('px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-60 whitespace-nowrap', killSwitch ? 'bg-rose-600 text-white hover:bg-rose-700 animate-pulse' : 'bg-slate-900 text-white hover:bg-rose-600')}
          >
            {busy === 'kill' ? <Spinner /> : killSwitch ? 'RESUME ALL OUTREACH' : 'ENGAGE EMERGENCY STOP'}
          </button>
        </div>
      </div>

      {/* Delivery mode */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4" data-testid="delivery-settings">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600" /> Delivery mode & test recipients
            </h2>
            <p className="text-xs text-slate-500">How approved messages leave the platform. Free tiers: Resend delivers only to your own inbox until a domain is verified; WhatsApp needs a linked number.</p>
          </div>
          <button onClick={handleSaveDelivery} disabled={busy !== null} className={btn.primary} data-testid="save-delivery">
            {busy === 'delivery' ? <Spinner /> : <Save className="w-3.5 h-3.5" />} Save
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {(
            [
              ['SIMULATED', 'Simulated', 'Nothing leaves the machine. Messages are marked sent by the simulator. Safe for demos.'],
              ['LIVE_REDIRECT', 'Live → test inbox', 'Real Resend / WhatsApp delivery, but every message goes to the test email/phone below with the original recipient noted.'],
              ['LIVE', 'Live', 'Real delivery to the prospect. Requires a verified Resend domain and a linked WhatsApp number.'],
            ] as Array<[DeliveryMode, string, string]>
          ).map(([mode, label, desc]) => (
            <label key={mode} className={clsx('p-3 rounded-lg border cursor-pointer space-y-1', delivery.delivery_mode === mode ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300')}>
              <div className="flex items-center gap-2">
                <input type="radio" name="delivery_mode" checked={delivery.delivery_mode === mode} onChange={() => setDelivery({ ...delivery, delivery_mode: mode })} className="accent-indigo-600" data-testid={`delivery-${mode}`} />
                <span className="font-bold text-slate-800">{label}</span>
              </div>
              <p className="text-[11px] text-slate-500">{desc}</p>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Test email (LIVE_REDIRECT)" hint="Your own Resend account email works on the free tier">
            <input value={delivery.outbound_test_email} onChange={(e) => setDelivery({ ...delivery, outbound_test_email: e.target.value })} placeholder="you@example.com" className={inputCls} />
          </Field>
          <Field label="Test WhatsApp number (LIVE_REDIRECT)" hint="Indian mobile, e.g. 9876543210">
            <input value={delivery.outbound_test_phone} onChange={(e) => setDelivery({ ...delivery, outbound_test_phone: e.target.value })} placeholder="+91…" className={inputCls} />
          </Field>
          <Field label="Monthly AI budget (USD list price)" hint="Circuit breaker falls back to the offline simulator when reached">
            <input type="number" min={0} value={delivery.monthly_ai_budget} onChange={(e) => setDelivery({ ...delivery, monthly_ai_budget: Number(e.target.value) })} className={inputCls} />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={delivery.is_autonomous_outreach_enabled} onChange={(e) => setDelivery({ ...delivery, is_autonomous_outreach_enabled: e.target.checked })} className="accent-indigo-600 mt-0.5" />
          <span>
            <span className="font-semibold">Autonomous replies</span> — send the AI SDR&apos;s reply to inbound messages automatically instead of leaving it as a draft for a human to send.
          </span>
        </label>
      </div>

      {/* Voice settings entry */}
      <Link href="/settings/voice" data-testid="voice-settings-link" className="block bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-indigo-400 transition-colors">
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
            <p className="text-xs text-slate-500">Customize how the AI Scoring Agent evaluates Indian B2B leads. (Must sum to 100%.)</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', totalWeight === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>Total: {totalWeight}%</span>
            <button onClick={handleSaveWeights} disabled={totalWeight !== 100 || busy !== null} className={btn.primary} data-testid="save-weights">
              {busy === 'weights' ? <Spinner /> : <Save className="w-3.5 h-3.5" />} Save Weights
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {WEIGHT_FIELDS.map(([key, label, max]) => (
            <div key={key}>
              <label className="block text-slate-700 font-semibold mb-1">
                {label}: {weights[key]}%
              </label>
              <input type="range" min="0" max={max} value={weights[key]} onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })} className="w-full accent-indigo-600" />
            </div>
          ))}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Minimum qualifying score: {minScore}/100</label>
            <input type="range" min="0" max="100" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-full accent-indigo-600" />
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
          <p className="text-xs text-slate-500">Suppressed emails, phones, and domains are permanently blocked from every outbound channel, including talk links.</p>
        </div>

        <form onSubmit={handleAddSuppression} className="flex gap-2">
          <input type="text" placeholder="Email, +91 phone or domain (e.g. competitor.com)…" value={newSuppression} onChange={(e) => setNewSuppression(e.target.value)} className={inputCls} data-testid="suppression-input" />
          <button type="submit" disabled={busy !== null || !newSuppression.trim()} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 whitespace-nowrap" data-testid="suppression-add">
            {busy === 'suppress' ? <Spinner /> : <Plus className="w-3.5 h-3.5" />} Suppress
          </button>
        </form>

        <div className="divide-y divide-slate-100 text-xs" data-testid="suppression-list">
          {state.suppressionList.map((item, idx) => {
            const id = item.email || item.domain || item.phone || '';
            return (
              <div key={`${id}-${idx}`} className="py-2.5 flex items-center justify-between gap-3">
                <span className="font-mono text-slate-800 break-all">
                  {[item.email, item.phone, item.domain].filter(Boolean).join(' · ')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">{item.reason}</span>
                  <button onClick={() => handleRemoveSuppression(id)} disabled={busy !== null} className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {state.suppressionList.length === 0 && <div className="py-4 text-slate-400 text-center">Registry is empty.</div>}
        </div>
      </div>

      {/* Integrations */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3" data-testid="integrations">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600" />
            Free-stack integrations — live health
          </h2>
          <button onClick={handleRefreshIntegrations} disabled={busy !== null} className={btn.secondary}>
            {busy === 'integrations' ? <Spinner /> : <RefreshCw className="w-3.5 h-3.5" />} Re-check
          </button>
        </div>
        <p className="text-[11px] text-slate-500">Checked {new Date(integ.checked_at).toLocaleTimeString('en-IN')} · {integ.demo_mode ? 'DEMO_MODE=true (everything simulated)' : 'production mode'} · delivery {integ.delivery_mode}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <IntegrationCard icon={Cpu} title="AI brain" ok={integ.ai.live} status={integ.ai.live ? `Groq · ${integ.ai.model}` : 'Offline simulator'} note={integ.ai.reason} />
          <IntegrationCard icon={Mail} title="Outbound email" ok={integ.email.live && integ.email.domain_verified !== false} warn={integ.email.live && integ.email.domain_verified === false} status={integ.email.live ? `Resend · from ${integ.email.from}` : 'Simulated'} note={integ.email.domain_note || integ.email.reason} />
          <IntegrationCard
            icon={Smartphone}
            title="WhatsApp (Evolution API / Baileys)"
            ok={integ.whatsapp.instanceState === 'open'}
            warn={integ.whatsapp.reachable && integ.whatsapp.instanceState !== 'open'}
            status={integ.whatsapp.reachable ? `${integ.whatsapp.url} · v${integ.whatsapp.version || '?'} · instance ${integ.whatsapp.instanceState}${integ.whatsapp.connectedPhone ? ` · ${integ.whatsapp.connectedPhone}` : ''}` : `Unreachable at ${integ.whatsapp.url}`}
            note={integ.whatsapp.instanceState === 'open' ? 'Linked and ready.' : integ.whatsapp.reachable ? 'Scan the QR on the WhatsApp Hub to link a number (₹0 Meta fees).' : 'Start the stack: docker compose -f docker/docker-compose.yml up -d'}
          />
          <IntegrationCard icon={Mic} title="Voice agent" ok status={`In-browser · STT ${integ.voice.stt} · TTS ${integ.voice.tts}`} note={integ.voice.note} />
          <IntegrationCard icon={Database} title="Persistence" ok={integ.persistence.enabled} status={integ.persistence.enabled ? `JSON snapshot · ${integ.persistence.path}` : 'In-memory only'} note={integ.persistence.saved_at ? `Last saved ${new Date(integ.persistence.saved_at).toLocaleString('en-IN')} · ${Math.round((integ.persistence.bytes || 0) / 1024)} KB` : 'Not written yet'} />
          <IntegrationCard icon={Database} title="Supabase (optional mirror)" ok={integ.supabase.configured && integ.supabase.tables_ready === true} warn={integ.supabase.configured && integ.supabase.tables_ready === false} status={integ.supabase.configured ? integ.supabase.url || 'configured' : 'Not configured'} note={integ.supabase.note} />
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-rose-800">Reset demo data</h2>
          <p className="text-xs text-slate-500">Deletes the persisted snapshot and reseeds the Indian B2B sample data. Leads, campaigns, messages and calls you added are lost.</p>
        </div>
        <button onClick={() => setConfirmReset(true)} disabled={busy !== null} className={btn.danger} data-testid="reset-data">
          <Trash2 className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <Modal open={confirmReset} title="Reset all data to the seed state?" description="This cannot be undone." onClose={() => setConfirmReset(false)}>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConfirmReset(false)} className={btn.ghost}>
            Cancel
          </button>
          <button onClick={handleReset} disabled={busy !== null} className={btn.danger} data-testid="confirm-reset">
            {busy === 'reset' ? <Spinner /> : <Trash2 className="w-3.5 h-3.5" />} Yes, reset
          </button>
        </div>
      </Modal>
    </div>
  );
}

function IntegrationCard({ icon: Icon, title, ok, warn, status, note }: { icon: typeof Cpu; title: string; ok?: boolean; warn?: boolean; status: string; note?: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-slate-500" /> {title}
        </div>
        <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', ok ? 'bg-emerald-50 text-emerald-700' : warn ? 'bg-amber-50 text-amber-700' : 'bg-slate-200 text-slate-600')}>{ok ? 'LIVE' : warn ? 'ATTENTION' : 'SIMULATED / OFF'}</span>
      </div>
      <div className="text-slate-600 break-all">{status}</div>
      {note && <div className="text-[11px] text-slate-500">{note}</div>}
    </div>
  );
}
