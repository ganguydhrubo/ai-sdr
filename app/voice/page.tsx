'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Phone, PhoneCall, Link2, ExternalLink, Copy, Check, QrCode, Clock, ShieldCheck, UserCheck, Plus, CheckCircle2, XCircle, Ban, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppState } from '../../lib/client/use-app-state';
import { api } from '../../lib/client/api';
import { timeAgo, formatDuration } from '../../lib/client/format';
import { PageLoading, PageError, Notice, useNotice, Modal, Field, inputCls, btn, Spinner, DeliveryReceiptLine } from '../../components/ui';
import type { DeliveryReceipt, TalkSession, VoiceCall } from '../../lib/types';

export default function VoiceHubPage() {
  const { state, loading, error, refresh } = useAppState({ pollMs: 15_000 });
  const [activeTab, setActiveTab] = useState<'sessions' | 'calls' | 'dialer'>('sessions');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();

  // New Talk Link Modal State
  const [isMintModalOpen, setIsMintModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'EMAIL' | 'WHATSAPP' | 'MANUAL'>('MANUAL');
  const [minted, setMinted] = useState<{ url: string; requires_approval?: boolean; delivery?: DeliveryReceipt; message?: { status: string } } | null>(null);

  // Dialer
  const [dialerLeadId, setDialerLeadId] = useState('');
  const [dialerResult, setDialerResult] = useState<{ ok: boolean; text: string; violations?: string[] } | null>(null);

  if (error && !state) return <PageError message={error} />;
  if (loading || !state) return <PageLoading />;

  const { voiceAnalytics: voice, callingWindow, voiceSettings } = state;
  const sessions: TalkSession[] = [...state.talkSessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const calls: VoiceCall[] = state.voiceCalls;
  const selectedCall = calls.find((c) => c.id === selectedCallId) || calls[0] || null;
  const leads = state.leads.filter((l) => !l.is_suppressed);
  const origin = typeof window !== 'undefined' ? window.location.origin : state.appUrl;
  const linkFor = (s: TalkSession) => (s.token ? `${origin}/talk/${s.token}` : null);
  const gateFails = state.voiceSettings.pstn_enabled ? [] : ['PSTN outbound calling is disabled in Voice Settings'];

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

  const handleCopy = (s: TalkSession) => {
    const url = linkFor(s);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMintTalkLink = () =>
    run('mint', async () => {
      const leadId = selectedLeadId || leads[0]?.id;
      if (!leadId) return;
      const res = await api.post<{ talk_url: string; token: string; requires_approval?: boolean; delivery?: DeliveryReceipt; message?: { status: string } }>('/api/voice/talk-links', {
        lead_id: leadId,
        channel: selectedChannel,
      });
      const url = `${origin}/talk/${res.token}`;
      setMinted({ url, requires_approval: res.requires_approval, delivery: res.delivery, message: res.message });
      setIsMintModalOpen(false);
      setActiveTab('sessions');
      setNotice({
        kind: res.delivery?.error ? 'error' : 'ok',
        text:
          selectedChannel === 'MANUAL'
            ? 'Talk link minted — copy it, show the QR, or open it to test the AI voice agent.'
            : res.requires_approval
              ? `Talk link minted; the ${selectedChannel} invite is waiting for approval on the dashboard.`
              : res.delivery?.error
                ? `Talk link minted but the invite failed: ${res.delivery.error}`
                : `Talk link minted and the ${selectedChannel} invite was ${res.delivery?.simulated ? 'sent (simulated)' : 'delivered'} via ${res.delivery?.provider}.`,
      });
    });

  const handleRevoke = (s: TalkSession) =>
    run(`revoke-${s.id}`, async () => {
      await api.post(`/api/voice/talk-sessions/${s.id}/revoke`, { reason: 'Revoked from Voice Hub' });
      setNotice({ kind: 'ok', text: 'Talk link revoked.' });
    });

  const handleDial = () =>
    run('dial', async () => {
      setDialerResult({ ok: true, text: 'Running the eight-point TRAI/DLT compliance gate…' });
      try {
        const res = await api.post<{ call: VoiceCall | null; provider: string }>('/api/voice/dial', { lead_id: dialerLeadId || leads[0]?.id });
        setDialerResult({ ok: true, text: `SUCCESS via ${res.provider} provider: call ${res.call?.status.toLowerCase()} (${res.call?.duration_seconds}s). Transcript recorded under Call Logs.` });
        if (res.call) setSelectedCallId(res.call.id);
      } catch (err) {
        const e = err as { message: string; payload?: { violations?: string[] } };
        setDialerResult({ ok: false, text: e.message, violations: e.payload?.violations });
      }
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 border border-violet-500/20 text-xs font-bold uppercase tracking-wider">In-browser voice agent</span>
            <span className={clsx('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', callingWindow.allowed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
              <Clock className="w-3 h-3" />
              <span>
                TRAI Window: {callingWindow.timeString} ({callingWindow.allowed ? 'OPEN' : 'CLOSED'})
              </span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Voice Hub &amp; Autonomous AI Calls</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Zero-cost WebRTC talk links sent via WhatsApp/Email, the browser voice agent ({state.integrations.ai.live ? `GPT-OSS on Groq` : 'offline simulator'} · {state.integrations.voice.stt} · TTS {state.integrations.voice.tts}), and TRAI/DLT-gated outbound dialing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setIsMintModalOpen(true)} className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2" data-testid="open-mint">
            <Plus className="w-4 h-4" />
            <span>Mint Talk Link</span>
          </button>
          <Link href="/settings/voice" className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span>Voice Settings</span>
          </Link>
        </div>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {minted && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs flex flex-col sm:flex-row sm:items-center gap-3" data-testid="minted-link">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-violet-900">Latest talk link</div>
            <div className="font-mono text-[11px] text-violet-800 break-all">{minted.url}</div>
            {minted.delivery && <DeliveryReceiptLine receipt={minted.delivery} />}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { navigator.clipboard.writeText(minted.url); setCopiedId('minted'); setTimeout(() => setCopiedId(null), 2000); }} className={btn.secondary}>
              {copiedId === 'minted' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} Copy
            </button>
            <button onClick={() => setQrUrl(minted.url)} className={btn.secondary}>
              <QrCode className="w-3.5 h-3.5" /> QR
            </button>
            <a href={minted.url} target="_blank" rel="noreferrer" className={btn.primary}>
              <ExternalLink className="w-3.5 h-3.5" /> Open & talk
            </a>
          </div>
        </div>
      )}

      {/* Top 5 Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Talk Links Sent</span>
            <Link2 className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{voice.talk_links_sent}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {voice.talk_links_opened} opened • {voice.open_rate_pct}% open rate
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>AI Voice Calls</span>
            <PhoneCall className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{voice.calls_completed}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {voice.completion_rate_pct}% completed of {voice.calls_started} started
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Avg Call Duration</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatDuration(voice.avg_duration_seconds)}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {voice.webrtc_calls} WebRTC • {voice.pstn_calls} PSTN
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Demos &amp; Handoffs</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{voice.meetings_from_voice + voice.handoffs_from_voice}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {voice.meetings_from_voice} meetings booked • {voice.handoffs_from_voice} handoffs • {voice.opt_outs_from_voice} opt-outs
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Carrier Cost</span>
            <span className="text-xs font-bold text-emerald-600">₹0 WebRTC</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{voice.carrier_cost_inr.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-slate-500 mt-1">PSTN estimate only • provider cost not included</div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(
          [
            ['sessions', Link2, `Talk Sessions & Links (${sessions.length})`],
            ['calls', PhoneCall, `Call Logs & Transcripts (${calls.length})`],
            ['dialer', Phone, 'Outbound PSTN Dialer'],
          ] as const
        ).map(([key, Icon, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={clsx('px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2', activeTab === key ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')} data-testid={`voice-tab-${key}`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: TALK SESSIONS & LINKS */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Active &amp; Historical Talk Sessions</h2>
            <span className="text-xs text-slate-500">Tokens hashed (SHA-256); links valid {voiceSettings.talk_link_ttl_days} days · {voiceSettings.talk_link_max_calls} calls</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600" data-testid="talk-sessions-table">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Prospect &amp; Company</th>
                  <th className="py-3 px-3">Channel</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Calls Left</th>
                  <th className="py-3 px-3">Expires</th>
                  <th className="py-3 px-3">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => {
                  const url = linkFor(s);
                  const live = !['REVOKED', 'EXPIRED'].includes(s.status) && s.call_count < s.max_calls;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`session-${s.id}`}>
                      <td className="py-3.5 px-4">
                        <Link href={`/leads/${s.lead_id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                          {s.lead_name || 'Prospect'}
                        </Link>
                        <div className="text-[11px] text-slate-400">{s.lead_company || 'Enterprise'}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="capitalize font-medium text-slate-700">{s.channel}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                            s.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : s.status === 'CALL_STARTED' || s.status === 'OPENED'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : s.status === 'REVOKED' || s.status === 'EXPIRED'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                          )}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono">
                        {Math.max(0, s.max_calls - s.call_count)} / {s.max_calls}
                      </td>
                      <td className="py-3.5 px-3 text-[11px] text-slate-500">{new Date(s.expires_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</td>
                      <td className="py-3.5 px-3 text-[11px] text-slate-500">{timeAgo(s.created_at)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleCopy(s)} disabled={!url} className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-30" title={url ? 'Copy Talk Link' : 'Token not available (minted elsewhere)'}>
                            {copiedId === s.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => url && setQrUrl(url)} disabled={!url} className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-30" title="Show Mobile QR Code">
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          {live && (
                            <button onClick={() => handleRevoke(s)} disabled={busy !== null} className="p-1.5 text-slate-500 hover:text-rose-700 rounded-md hover:bg-rose-50 transition-colors" title="Revoke link">
                              {busy === `revoke-${s.id}` ? <Spinner /> : <Ban className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {url && live ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg text-xs font-medium border border-violet-200 flex items-center gap-1 transition-colors">
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 px-2">{!url ? 'no token' : 'inactive'}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CALL LOGS & TRANSCRIPTS */}
      {activeTab === 'calls' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Voice Call Records</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto" data-testid="call-list">
              {calls.map((call) => {
                const isSelected = selectedCall?.id === call.id;
                return (
                  <div key={call.id} onClick={() => setSelectedCallId(call.id)} className={clsx('p-3.5 cursor-pointer transition-colors', isSelected ? 'bg-violet-50/60 border-l-4 border-violet-600' : 'hover:bg-slate-50')}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-900">{call.lead_name || 'Prospect'}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {call.mode} · {call.provider}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-2">{call.lead_company}</div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        {call.duration_seconds}s · {timeAgo(call.created_at)}
                      </span>
                      <span className={clsx('font-medium', call.status === 'BLOCKED' ? 'text-rose-600' : 'text-emerald-600')}>{call.status === 'BLOCKED' ? 'BLOCKED' : call.extracted?.intent || call.intent || call.status}</span>
                    </div>
                  </div>
                );
              })}
              {calls.length === 0 && <div className="p-6 text-xs text-slate-400 text-center">No calls yet — open a talk link and speak to the agent.</div>}
            </div>
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
            {selectedCall ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedCall.lead_name} — {selectedCall.lead_company}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Call ID: {selectedCall.id} • Mode: {selectedCall.mode.toUpperCase()} • Provider: {selectedCall.provider} • Cost: ₹{selectedCall.carrier_cost_estimate_inr.toFixed(2)}
                    </div>
                  </div>
                  <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border', selectedCall.sentiment === 'NEGATIVE' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200')}>{selectedCall.sentiment || selectedCall.status}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs space-y-1">
                  <span className="font-bold text-slate-700 block">AI Extracted Summary:</span>
                  <p className="text-slate-600 leading-relaxed">{selectedCall.extracted?.summary || 'No summary'}</p>
                  {selectedCall.extracted?.qualification && (
                    <div className="grid grid-cols-2 gap-1 pt-2 text-[11px]">
                      {Object.entries(selectedCall.extracted.qualification).map(([k, v]) => (
                        <div key={k}>
                          <span className="font-semibold text-slate-700 capitalize">{k.replace('_', ' ')}:</span> {v || '—'}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-2 text-[11px]">
                    {selectedCall.extracted?.meeting_requested && (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Meeting booked
                      </span>
                    )}
                    {selectedCall.extracted?.handoff_requested && <span className="text-indigo-700 font-semibold">Handoff created</span>}
                    {selectedCall.extracted?.opt_out && <span className="text-rose-700 font-semibold">Opted out</span>}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">Turn-by-Turn Transcript</span>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1" data-testid="call-transcript">
                    {selectedCall.transcript && selectedCall.transcript.length > 0 ? (
                      selectedCall.transcript.map((turn, i) => (
                        <div key={i} className={clsx('flex flex-col', turn.role === 'agent' ? 'items-start' : 'items-end')}>
                          <span className="text-[10px] text-slate-400 mb-0.5">{turn.role === 'agent' ? 'Apex AI Voice SDR' : selectedCall.lead_name}</span>
                          <div className={clsx('p-2.5 rounded-xl text-xs max-w-[85%] leading-relaxed', turn.role === 'agent' ? 'bg-violet-50 text-violet-900 border border-violet-100' : 'bg-slate-800 text-white')}>{turn.text}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No transcript for this call.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 text-center py-12">Select a call to view full details.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: OUTBOUND PSTN DIALER */}
      {activeTab === 'dialer' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 max-w-2xl mx-auto space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Gated Outbound PSTN Dialing Console</h2>
            <p className="text-xs text-slate-500 mt-0.5">Every dial runs the eight-point gate (kill switch, voice/PSTN enabled, TRAI window, DLT ID, 140-series caller ID, OAP notice, suppression/NDNC). Blocked calls are logged with the reasons.</p>
          </div>

          <div className="space-y-4">
            <Field label="Lead to call">
              <select value={dialerLeadId} onChange={(e) => setDialerLeadId(e.target.value)} className={inputCls} data-testid="dialer-lead">
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name} — {l.normalized_phone || 'no phone'} ({l.company_name})
                  </option>
                ))}
              </select>
            </Field>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
              <span className="font-bold text-slate-800 block">Pre-Dial Compliance Gate (saved settings):</span>
              <GateRow ok={!state.org.emergency_kill_switch_active} label="Global kill switch off" />
              <GateRow ok={voiceSettings.voice_enabled} label="Voice module enabled" />
              <GateRow ok={voiceSettings.pstn_enabled} label="PSTN outbound route enabled (Voice Settings)" />
              <GateRow ok={callingWindow.allowed} label={`TRAI calling window 09:00–21:00 IST (now ${callingWindow.timeString})`} />
              <GateRow ok={!!voiceSettings.dlt_entity_id} label={`DLT Principal Entity ID ${voiceSettings.dlt_entity_id ? `(${voiceSettings.dlt_entity_id})` : 'missing'}`} />
              <GateRow ok={!!voiceSettings.caller_id_series} label={`Caller ID series ${voiceSettings.caller_id_series || 'unset'}`} />
              <GateRow ok={!!voiceSettings.advance_notice_given} label="Advance autodialer notice filed with the OAP" />
              <GateRow ok label="Suppression & NDNC scrubbing (checked per lead at dial time)" />
              {gateFails.length > 0 && (
                <Link href="/settings/voice" className="text-[11px] text-indigo-600 hover:underline block pt-1">
                  Fix in Voice Settings →
                </Link>
              )}
            </div>

            <button onClick={handleDial} disabled={busy !== null || leads.length === 0} className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50" data-testid="dial">
              {busy === 'dial' ? <Spinner /> : <PhoneCall className="w-4 h-4" />}
              <span>{busy === 'dial' ? 'Running Compliance Checks...' : 'Initiate Compliant Outbound Call'}</span>
            </button>

            {dialerResult && (
              <div className={clsx('p-3 rounded-xl text-xs font-mono space-y-1', dialerResult.ok ? 'bg-slate-900 text-slate-100' : 'bg-rose-950 text-rose-100')} data-testid="dialer-result">
                <div>{dialerResult.text}</div>
                {dialerResult.violations?.map((v, i) => (
                  <div key={i}>✗ {v}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MINT TALK LINK MODAL */}
      <Modal open={isMintModalOpen} title="Mint New WebRTC Talk Link" description="Generates a cryptographically hashed 32-byte talk token with a personalized browser URL. The prospect talks to the AI agent from any browser at ₹0 carrier cost." onClose={() => setIsMintModalOpen(false)}>
        <div className="space-y-3 text-xs">
          <Field label="Target Prospect">
            <select value={selectedLeadId || leads[0]?.id || ''} onChange={(e) => setSelectedLeadId(e.target.value)} className={inputCls} data-testid="mint-lead">
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name} ({l.company_name})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Channel Distribution">
            <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value as typeof selectedChannel)} className={inputCls} data-testid="mint-channel">
              <option value="MANUAL">Manual — just give me the link / QR</option>
              <option value="WHATSAPP">WhatsApp invite (Direct Baileys)</option>
              <option value="EMAIL">Email invite (Resend)</option>
            </select>
          </Field>
          <p className="text-[11px] text-slate-500">
            {selectedChannel === 'MANUAL'
              ? 'The link is minted now; nothing is sent.'
              : `An invite message is drafted for approval (MANUAL campaigns) or sent immediately, honouring delivery mode ${state.org.delivery_mode}.`}
          </p>

          <div className="flex gap-2.5 pt-2">
            <button onClick={() => setIsMintModalOpen(false)} className="flex-1 py-2 px-3 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <button onClick={handleMintTalkLink} disabled={busy !== null} className="flex-1 py-2 px-3 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors shadow-sm flex items-center justify-center gap-1 disabled:opacity-50" data-testid="mint-submit">
              {busy === 'mint' ? <Spinner /> : null} {busy === 'mint' ? 'Minting...' : 'Generate Talk Link'}
            </button>
          </div>
        </div>
      </Modal>

      {/* QR CODE PREVIEW MODAL */}
      <Modal open={!!qrUrl} title="Scan to test on your phone" description="Open your phone camera and point it at the code — the talk page works in the mobile browser." onClose={() => setQrUrl(null)}>
        {qrUrl && (
          <div className="text-center space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr?text=${encodeURIComponent(qrUrl)}`} alt="Talk link QR code" className="mx-auto w-56 h-56 rounded-xl border border-slate-200" />
            <div className="font-mono text-[11px] text-slate-500 break-all">{qrUrl}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function GateRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
      <span>{label}</span>
    </div>
  );
}
