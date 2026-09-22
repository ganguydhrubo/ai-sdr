'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Video, Building, Sparkles, Download, Send, CheckCircle2, XCircle, Plus, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppState } from '../../lib/client/use-app-state';
import { api } from '../../lib/client/api';
import { formatDateTimeIst, timeAgo } from '../../lib/client/format';
import { PageLoading, PageError, Notice, useNotice, Modal, Field, inputCls, btn, Spinner } from '../../components/ui';
import type { DeliveryReceipt, Meeting } from '../../lib/types';

export default function MeetingsPage() {
  const { state, loading, error, refresh } = useAppState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();
  const [filter, setFilter] = useState<'UPCOMING' | 'ALL'>('UPCOMING');

  // Book modal
  const [showBook, setShowBook] = useState(false);
  const [bookLeadId, setBookLeadId] = useState('');
  const [slots, setSlots] = useState<Array<{ start: string; label: string }>>([]);
  const [slot, setSlot] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  useEffect(() => {
    if (!showBook && !rescheduleId) return;
    api.get<{ slots: Array<{ start: string; label: string }> }>('/api/meetings/slots?days=7').then((r) => {
      setSlots(r.slots);
      setSlot((s) => s || r.slots[0]?.start || '');
    });
  }, [showBook, rescheduleId]);

  if (error && !state) return <PageError message={error} />;
  if (loading || !state) return <PageLoading />;

  const now = Date.now();
  const all = [...state.meetings].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const meetings = filter === 'ALL' ? all : all.filter((m) => m.status === 'CONFIRMED' || m.status === 'RESCHEDULED' || new Date(m.end_time).getTime() > now);
  const selectedMeeting: Meeting | null = meetings.find((m) => m.id === selectedId) || meetings[0] || null;
  const lead = selectedMeeting ? state.leads.find((l) => l.id === selectedMeeting.lead_id) : undefined;
  const brief = selectedMeeting?.sales_brief || lead?.sales_brief;

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

  const setStatus = (m: Meeting, status: Meeting['status']) =>
    run(`${m.id}-${status}`, async () => {
      await api.patch(`/api/meetings/${m.id}`, { status });
      setNotice({ kind: 'ok', text: `Meeting marked ${status.toLowerCase()}.` });
    });

  const sendInviteNow = (m: Meeting) =>
    run(`${m.id}-invite`, async () => {
      const res = await api.post<{ delivery: DeliveryReceipt; sent: boolean }>(`/api/meetings/${m.id}/invite`);
      setNotice(res.sent ? { kind: 'ok', text: `Invite ${res.delivery.simulated ? 'sent (simulated)' : 'emailed'} via ${res.delivery.provider}${res.delivery.redirected_to ? ` → ${res.delivery.redirected_to}` : ''}.` } : { kind: 'error', text: `Invite failed: ${res.delivery.error}` });
    });

  const regenerateBrief = (m: Meeting) =>
    run(`${m.id}-brief`, async () => {
      await api.post(`/api/leads/${m.lead_id}/brief`);
      setNotice({ kind: 'ok', text: 'AI sales brief regenerated.' });
    });

  const book = () =>
    run('book', async () => {
      if (!bookLeadId) return;
      const res = await api.post<{ meeting: Meeting; invite?: DeliveryReceipt }>('/api/meetings', { lead_id: bookLeadId, start_time: slot, send_invite: sendInvite });
      setShowBook(false);
      setSelectedId(res.meeting.id);
      setNotice({ kind: res.invite?.error ? 'error' : 'ok', text: `Booked ${formatDateTimeIst(res.meeting.start_time)} IST${res.invite ? res.invite.error ? ` · invite failed: ${res.invite.error}` : ` · invite ${res.invite.simulated ? 'simulated' : 'emailed'}` : ''}.` });
    });

  const reschedule = () =>
    run('reschedule', async () => {
      if (!rescheduleId) return;
      await api.patch(`/api/meetings/${rescheduleId}`, { start_time: slot, status: 'RESCHEDULED' });
      setRescheduleId(null);
      setNotice({ kind: 'ok', text: `Rescheduled to ${formatDateTimeIst(slot)} IST — resend the invite.` });
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Confirmed Discovery Meetings & AI Briefs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Free Jitsi video rooms (no account), .ics invites, and auto-synthesised AE briefing dossiers.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            {(['UPCOMING', 'ALL'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={clsx('px-2.5 py-1.5 rounded-lg font-medium', filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>
                {f === 'UPCOMING' ? 'Upcoming' : `All (${all.length})`}
              </button>
            ))}
          </div>
          <button onClick={() => setShowBook(true)} className={btn.primary} data-testid="open-book-meeting">
            <Plus className="w-3.5 h-3.5" /> Book meeting
          </button>
        </div>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Meetings List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bookings ({meetings.length})</h2>

          {meetings.map((m) => {
            const isSelected = selectedMeeting?.id === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={clsx('p-4 bg-white rounded-xl border cursor-pointer transition-all shadow-xs space-y-2', isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20' : 'border-slate-200 hover:border-slate-300')}
                data-testid={`meeting-${m.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border', m.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : m.status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200')}>{m.status}</span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatDateTimeIst(m.start_time)} IST
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-900 line-clamp-1">{m.title}</h3>

                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Building className="w-3 h-3 text-slate-400" />
                  <span>
                    {m.lead_company} · {m.lead_name}
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
                  <span className="text-[11px] text-slate-500">Host: {m.host_user_name || 'Sales Rep'}</span>
                  <a href={m.meet_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 text-[11px]">
                    Join <Video className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
          {meetings.length === 0 && <div className="p-6 text-xs text-slate-400 text-center bg-white rounded-xl border border-slate-200">No meetings yet — book one, or let the AI voice agent book it on a talk link.</div>}
        </div>

        {/* Right: AI Sales Brief Dossier (2 Cols) */}
        {selectedMeeting ? (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> AI Sales Brief
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedMeeting.title}</h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  Prospect:{' '}
                  <Link href={`/leads/${selectedMeeting.lead_id}`} className="text-indigo-600 hover:underline">
                    {selectedMeeting.lead_name}
                  </Link>{' '}
                  ({selectedMeeting.lead_company}) · {formatDateTimeIst(selectedMeeting.start_time)} IST · {selectedMeeting.calendar_provider}
                  {selectedMeeting.invite_sent_at ? ` · invite sent ${timeAgo(selectedMeeting.invite_sent_at)}` : ' · invite not sent'}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <a href={selectedMeeting.meet_url} target="_blank" rel="noreferrer" className={btn.success}>
                  <Video className="w-4 h-4" /> Open Video Room
                </a>
                <a href={`/api/meetings/${selectedMeeting.id}/ics`} className={btn.secondary} download>
                  <Download className="w-3.5 h-3.5" /> .ics
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button onClick={() => sendInviteNow(selectedMeeting)} disabled={busy !== null} className={btn.secondary} data-testid="send-invite">
                {busy === `${selectedMeeting.id}-invite` ? <Spinner /> : <Send className="w-3.5 h-3.5" />} {selectedMeeting.invite_sent_at ? 'Resend invite' : 'Email invite'}
              </button>
              <button onClick={() => { setRescheduleId(selectedMeeting.id); setSlot(''); }} disabled={busy !== null} className={btn.secondary}>
                <RefreshCw className="w-3.5 h-3.5" /> Reschedule
              </button>
              {selectedMeeting.status !== 'COMPLETED' && (
                <button onClick={() => setStatus(selectedMeeting, 'COMPLETED')} disabled={busy !== null} className={btn.secondary}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Mark completed
                </button>
              )}
              {selectedMeeting.status !== 'CANCELLED' && (
                <button onClick={() => setStatus(selectedMeeting, 'CANCELLED')} disabled={busy !== null} className={`${btn.secondary} text-rose-700`}>
                  <XCircle className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
              <button onClick={() => regenerateBrief(selectedMeeting)} disabled={busy !== null} className={btn.ghost}>
                {busy === `${selectedMeeting.id}-brief` ? <Spinner /> : <Sparkles className="w-3.5 h-3.5 text-indigo-600" />} {brief ? 'Regenerate brief' : 'Generate brief'}
              </button>
            </div>

            {brief ? (
              <div className="space-y-5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Account Overview</span>
                    <p className="text-slate-700 leading-relaxed">{brief.account_overview}</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Contact Role</span>
                    <p className="text-slate-700 leading-relaxed">{brief.contact_role}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-rose-50/50 rounded-lg border border-rose-200 space-y-2">
                    <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Verified Pain Points</span>
                    <ul className="list-disc list-inside text-rose-900 space-y-1">
                      {brief.verified_pain_points.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3.5 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-2">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Buying Signals</span>
                    <ul className="list-disc list-inside text-emerald-900 space-y-1">
                      {brief.buying_signals.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Recommended Discovery Questions (India B2B Context)</span>
                  <ol className="list-decimal list-inside text-slate-700 space-y-1">
                    {brief.recommended_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Anticipated Objections & Suggested Rebuttals</span>
                  <ul className="list-disc list-inside text-slate-700 space-y-1">
                    {brief.anticipated_objections.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Recommended approach</span>
                  <p className="text-indigo-900 mt-1">{brief.recommended_discovery_approach}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">No AI Sales Brief yet — generate one above.</div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">Select a meeting to view details.</div>
        )}
      </div>

      {/* Book modal */}
      <Modal open={showBook} title="Book a discovery meeting" description="Creates a free Jitsi room, generates the AI brief and (optionally) emails the .ics invite." onClose={() => setShowBook(false)}>
        <div className="space-y-3">
          <Field label="Prospect">
            <select value={bookLeadId} onChange={(e) => setBookLeadId(e.target.value)} className={inputCls} data-testid="book-lead">
              <option value="">Select a lead…</option>
              {state.leads
                .filter((l) => !l.is_suppressed)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name} — {l.company_name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Slot (IST)">
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className={inputCls}>
              {slots.map((s) => (
                <option key={s.start} value={s.start}>
                  {s.label} IST
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="accent-indigo-600" />
            Email the invite now ({state.org.delivery_mode})
          </label>
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button onClick={() => setShowBook(false)} className={btn.ghost}>
              Cancel
            </button>
            <button onClick={book} disabled={busy !== null || !bookLeadId || !slot} className={btn.success} data-testid="confirm-book">
              {busy === 'book' ? <Spinner /> : <Calendar className="w-3.5 h-3.5" />} Book
            </button>
          </div>
        </div>
      </Modal>

      {/* Reschedule modal */}
      <Modal open={!!rescheduleId} title="Reschedule meeting" onClose={() => setRescheduleId(null)}>
        <div className="space-y-3">
          <Field label="New slot (IST)">
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className={inputCls}>
              {slots.map((s) => (
                <option key={s.start} value={s.start}>
                  {s.label} IST
                </option>
              ))}
            </select>
          </Field>
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button onClick={() => setRescheduleId(null)} className={btn.ghost}>
              Cancel
            </button>
            <button onClick={reschedule} disabled={busy !== null || !slot} className={btn.primary}>
              {busy === 'reschedule' ? <Spinner /> : <RefreshCw className="w-3.5 h-3.5" />} Reschedule
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
