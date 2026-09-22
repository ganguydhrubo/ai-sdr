'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  PhoneOff,
  Globe,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Save,
  ArrowLeft,
  IndianRupee,
  FileText,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { VoiceSettings } from '../../../lib/types';
import type { PstnGateEvaluation } from '../../../lib/voice/compliance';

interface VoiceSettingsPayload {
  settings: VoiceSettings;
  gate: PstnGateEvaluation;
  provider: string;
  script_version: string;
  provider_cost_note: string;
}

type Draft = Pick<
  VoiceSettings,
  | 'voice_enabled'
  | 'web_voice_enabled'
  | 'pstn_enabled'
  | 'caller_id_series'
  | 'advance_notice_given'
  | 'calling_window_start'
  | 'calling_window_end'
  | 'pstn_daily_cap'
  | 'talk_link_ttl_days'
  | 'talk_link_max_calls'
  | 'recording_enabled'
> & {
  dlt_entity_id: string;
  oap_autodialer_notice_date: string;
  oap_notice_doc_url: string;
  human_booking_url: string;
};

function toDraft(s: VoiceSettings): Draft {
  return {
    voice_enabled: s.voice_enabled,
    web_voice_enabled: s.web_voice_enabled,
    pstn_enabled: s.pstn_enabled,
    dlt_entity_id: s.dlt_entity_id || '',
    caller_id_series: s.caller_id_series || '140',
    advance_notice_given: !!s.advance_notice_given,
    oap_autodialer_notice_date: s.oap_autodialer_notice_date || '',
    oap_notice_doc_url: s.oap_notice_doc_url || '',
    calling_window_start: s.calling_window_start,
    calling_window_end: s.calling_window_end,
    pstn_daily_cap: s.pstn_daily_cap,
    talk_link_ttl_days: s.talk_link_ttl_days,
    talk_link_max_calls: s.talk_link_max_calls,
    recording_enabled: s.recording_enabled,
    human_booking_url: s.human_booking_url || '',
  };
}

const inputCls =
  'w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

export default function VoiceSettingsPage() {
  const [payload, setPayload] = useState<VoiceSettingsPayload | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/voice/settings', { cache: 'no-store' });
    const data = (await res.json()) as VoiceSettingsPayload;
    setPayload(data);
    setDraft(toDraft(data.settings));
  }, []);

  useEffect(() => {
    load().catch(() => setNotice({ kind: 'error', text: 'Could not load voice settings.' }));
  }, [load]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/voice/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (res.ok) {
        setPayload(data);
        setDraft(toDraft(data.settings));
        setNotice({ kind: 'ok', text: 'Voice settings saved.' });
      } else if (res.status === 422) {
        setPayload(data);
        setDraft(toDraft(data.settings));
        setNotice({ kind: 'error', text: `${data.error}: ${(data.failing || []).join('; ')}.` });
      } else {
        setNotice({ kind: 'error', text: data.error || 'Could not save voice settings.' });
      }
    } catch {
      setNotice({ kind: 'error', text: 'Could not save voice settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (!payload || !draft) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 p-6" data-testid="voice-settings-loading">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading voice settings…
      </div>
    );
  }

  const gate = payload.gate;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link href="/settings" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Admin & Guardrails
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Phone className="w-6 h-6 text-indigo-600" />
            Voice Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Zero-cost WebRTC talk links, the optional TRAI-compliant PSTN route, and the eight-point gate that must pass before any phone call is placed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono px-2 py-1 rounded bg-slate-100 border border-slate-200">
            provider: {payload.provider} · script {payload.script_version}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="voice-settings-save"
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Voice Settings
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={clsx(
            'rounded-lg border px-4 py-3 text-xs font-medium',
            notice.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.text}
        </div>
      )}

      {/* Provider cost banner */}
      <div
        data-testid="provider-cost-banner"
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3"
      >
        <IndianRupee className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-amber-900">Provider cost not included</div>
          <p className="text-xs text-amber-800 mt-0.5">{payload.provider_cost_note}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: settings */}
        <div className="lg:col-span-3 space-y-6">
          {/* Channels */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" /> Channels
            </h2>
            <ToggleRow
              label="Voice module"
              description="Master switch for every voice feature."
              checked={draft.voice_enabled}
              onChange={(v) => update('voice_enabled', v)}
              testId="toggle-voice-enabled"
            />
            <ToggleRow
              label='Web voice — "Talk to our AI" links'
              description="WebRTC in the prospect's browser. ₹0 carrier cost. Sent by TALK_INVITE campaign steps."
              checked={draft.web_voice_enabled}
              onChange={(v) => update('web_voice_enabled', v)}
              testId="toggle-web-voice"
            />
            <ToggleRow
              label="PSTN outbound calls (Dograh + Vobiz)"
              description="Real phone calls. Only enable when every gate item on the right passes."
              checked={draft.pstn_enabled}
              onChange={(v) => update('pstn_enabled', v)}
              testId="toggle-pstn"
              danger={!gate.ready}
            />
          </section>

          {/* TRAI / DLT */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" /> TRAI, DLT & OAP compliance
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="DLT Principal Entity ID*">
                <input
                  value={draft.dlt_entity_id}
                  onChange={(e) => update('dlt_entity_id', e.target.value)}
                  placeholder="Enter DLT Principal Entity ID"
                  maxLength={64}
                  data-testid="input-dlt"
                  className={inputCls}
                />
              </Field>
              <Field label="Caller ID series*">
                <select
                  value={draft.caller_id_series}
                  onChange={(e) => update('caller_id_series', e.target.value as Draft['caller_id_series'])}
                  data-testid="select-caller-id"
                  className={inputCls}
                >
                  <option value="140">140 — promotional</option>
                  <option value="1600">1600 — transactional / service</option>
                  <option value="1601">1601 — transactional / service</option>
                </select>
              </Field>
              <Field label="Calling window (IST)">
                <div className="flex items-center gap-2">
                  <input value={draft.calling_window_start} onChange={(e) => update('calling_window_start', e.target.value)} className={inputCls} placeholder="09:00" />
                  <span className="text-xs text-slate-400">to</span>
                  <input value={draft.calling_window_end} onChange={(e) => update('calling_window_end', e.target.value)} className={inputCls} placeholder="21:00" />
                </div>
              </Field>
              <Field label="PSTN daily cap (calls)">
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={draft.pstn_daily_cap}
                  onChange={(e) => update('pstn_daily_cap', Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.advance_notice_given}
                  onChange={(e) => update('advance_notice_given', e.target.checked)}
                  data-testid="checkbox-oap-notice"
                  className="mt-0.5"
                />
                <span>
                  <span className="text-xs font-semibold text-slate-900 block">Advance autodialer notice filed with the Originating Access Provider (OAP)</span>
                  <span className="text-[11px] text-slate-500">Required before any automated outbound calling under TRAI TCCCPR.</span>
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Notice date">
                  <input
                    type="date"
                    value={draft.oap_autodialer_notice_date}
                    onChange={(e) => update('oap_autodialer_notice_date', e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Notice document URL">
                  <input
                    value={draft.oap_notice_doc_url}
                    onChange={(e) => update('oap_notice_doc_url', e.target.value)}
                    placeholder="https://…"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* Talk links & recording */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" /> Talk links, recording & booking
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Talk link validity (days)">
                <input type="number" min={1} max={30} value={draft.talk_link_ttl_days} onChange={(e) => update('talk_link_ttl_days', Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Max calls per link">
                <input type="number" min={1} max={10} value={draft.talk_link_max_calls} onChange={(e) => update('talk_link_max_calls', Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Human booking URL">
                <input value={draft.human_booking_url} onChange={(e) => update('human_booking_url', e.target.value)} placeholder="https://cal.com/…" className={inputCls} />
              </Field>
            </div>
            <ToggleRow
              label="Record and transcribe calls"
              description="The agent discloses recording in its first sentence and stops if the prospect objects (DPDP consent)."
              checked={draft.recording_enabled}
              onChange={(v) => update('recording_enabled', v)}
              testId="toggle-recording"
            />
          </section>
        </div>

        {/* Right: the gate */}
        <aside className="lg:col-span-2">
          <section
            data-testid="pstn-gate"
            className={clsx(
              'rounded-xl border p-6 shadow-xs space-y-4 sticky top-4',
              gate.ready ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {gate.ready ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
                PSTN readiness gate
              </h2>
              <span
                data-testid="pstn-gate-status"
                className={clsx(
                  'text-[11px] font-bold px-2 py-0.5 rounded-full border',
                  gate.ready ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'
                )}
              >
                {gate.ready ? 'READY' : `BLOCKED · ${gate.passed}/${gate.total}`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Eight checks evaluated by <span className="font-mono">checkPstnOutboundCompliance()</span> before every outbound call. Saved settings are evaluated; unsaved edits are not.
            </p>
            <ol className="space-y-2">
              {gate.items.map((item, idx) => (
                <li
                  key={item.id}
                  data-testid={`gate-item-${item.id}`}
                  data-passed={item.passed}
                  className={clsx(
                    'flex items-start gap-2.5 rounded-lg border p-3',
                    item.passed ? 'bg-white border-slate-200' : 'bg-rose-50 border-rose-200'
                  )}
                >
                  {item.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">
                      {idx + 1}. {item.label}
                      {item.runtime && <span className="ml-1 text-[10px] font-mono text-slate-400">per lead</span>}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{item.detail}</div>
                    {!item.passed && item.action && (
                      <div className="text-[11px] text-rose-700 mt-1">→ {item.action}</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-200">
              {draft.pstn_enabled ? <Phone className="w-3.5 h-3.5 text-emerald-600" /> : <PhoneOff className="w-3.5 h-3.5 text-slate-400" />}
              PSTN is {draft.pstn_enabled ? 'enabled' : 'off'} · WebRTC talk links are {draft.web_voice_enabled ? 'enabled (₹0)' : 'off'}
            </div>
          </section>
        </aside>
      </div>

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-600 block mb-1">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  testId,
  danger,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-b-0">
      <div>
        <div className="text-xs font-semibold text-slate-900">{label}</div>
        <div className="text-[11px] text-slate-500">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition-colors',
          checked ? (danger ? 'bg-rose-500 border-rose-500' : 'bg-indigo-600 border-indigo-600') : 'bg-slate-200 border-slate-300'
        )}
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}
