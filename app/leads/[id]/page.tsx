'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  CheckCircle2,
  XCircle,
  Zap,
  Send,
  Ban,
  Link2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  PhoneCall,
  Save,
  Video,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAppState } from '../../../lib/client/use-app-state';
import { api } from '../../../lib/client/api';
import { formatDateTimeIst, timeAgo } from '../../../lib/client/format';
import {
  PageLoading,
  PageError,
  Notice,
  useNotice,
  Modal,
  Field,
  inputCls,
  btn,
  LeadStatusBadge,
  MessageStatusBadge,
  DeliveryReceiptLine,
  Spinner,
} from '../../../components/ui';
import type { AISalesBrief, DeliveryReceipt, LeadStatus, OutboundMessage } from '../../../lib/types';

type Tab = 'OVERVIEW' | 'OUTREACH' | 'CONVERSATION' | 'BRIEF' | 'VOICE';

const STATUSES: LeadStatus[] = ['NEW', 'QUALIFIED', 'OUTREACH', 'CONTACTED', 'ENGAGED', 'QUALIFIED_OPPORTUNITY', 'MEETING', 'SALES_HANDOFF', 'WON', 'LOST', 'NURTURE', 'DISQUALIFIED'];

const REPLY_PRESETS = [
  { label: 'Interested & Demo', text: 'Yes, interested. Please send pricing details and let us schedule a demo.', tone: 'ok' },
  { label: 'Pricing question', text: 'Can you share pricing and customer case studies for India?', tone: 'ok' },
  { label: 'Not Now', text: 'Not right now, please reach out next financial year in April.', tone: 'neutral' },
  { label: 'Unsubscribe', text: 'Please unsubscribe me. Do not contact me again.', tone: 'danger' },
];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const { state, loading, error, refresh } = useAppState();

  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();
  const [simulatedReply, setSimulatedReply] = useState(REPLY_PRESETS[0].text);
  const [replyChannel, setReplyChannel] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');
  const [humanReply, setHumanReply] = useState('');
  const [notes, setNotes] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, DeliveryReceipt>>({});
  const [talkLink, setTalkLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Book meeting modal
  const [showBook, setShowBook] = useState(false);
  const [slots, setSlots] = useState<Array<{ start: string; label: string }>>([]);
  const [slot, setSlot] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [sendInvite, setSendInvite] = useState(true);

  useEffect(() => {
    if (!showBook) return;
    api.get<{ slots: Array<{ start: string; label: string }> }>('/api/meetings/slots?days=5').then((r) => {
      setSlots(r.slots);
      setSlot((s) => s || r.slots[0]?.start || '');
    });
  }, [showBook]);

  if (error && !state) return <PageError message={error} />;
  if (loading || !state) return <PageLoading />;

  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Lead not found.{' '}
        <Link href="/leads" className="text-indigo-600 underline">
          Back to Leads
        </Link>
      </div>
    );
  }

  const messages = state.messages.filter((m) => m.lead_id === lead.id);
  const conversation = state.conversations.find((c) => c.lead_id === lead.id && c.channel === replyChannel) || state.conversations.find((c) => c.lead_id === lead.id);
  const meetings = state.meetings.filter((m) => m.lead_id === lead.id);
  const tasks = state.tasks.filter((t) => t.lead_id === lead.id);
  const talkSessions = state.talkSessions.filter((s) => s.lead_id === lead.id);
  const voiceCalls = state.voiceCalls.filter((c) => c.lead_id === lead.id);
  const company = state.companies.find((c) => c.id === lead.company_id);
  const brief: AISalesBrief | undefined = lead.sales_brief;

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

  const handleRunOrchestrator = () =>
    run('process', async () => {
      const res = await api.post<{ run: { success: boolean; steps: string[]; error?: string }; message?: OutboundMessage }>(`/api/leads/${lead.id}/process`);
      setNotice(
        res.run.success
          ? { kind: 'ok', text: `SDR agent finished ${res.run.steps.length} steps${res.message ? ` — ${res.message.channel} draft is ${res.message.status.replace('_', ' ').toLowerCase()}` : ''}.` }
          : { kind: 'error', text: `SDR agent stopped: ${res.run.error}` }
      );
      if (res.message) setActiveTab('OUTREACH');
    });

  const handleApprove = (msg: OutboundMessage) =>
    run(msg.id, async () => {
      const res = await api.post<{ sent: boolean; delivery: DeliveryReceipt }>(`/api/messages/${msg.id}/approve`);
      setReceipts((r) => ({ ...r, [msg.id]: res.delivery }));
      setNotice(res.sent ? { kind: 'ok', text: `Sent via ${res.delivery.provider}${res.delivery.redirected_to ? ` → ${res.delivery.redirected_to}` : ''}.` } : { kind: 'error', text: `Delivery failed: ${res.delivery.error}` });
    });

  const handleReject = (msg: OutboundMessage) => run(msg.id, async () => void (await api.post(`/api/messages/${msg.id}/reject`, { reason: 'Rejected from Lead 360' })));

  const handleRetry = (msg: OutboundMessage) =>
    run(msg.id, async () => {
      const res = await api.post<{ sent: boolean; delivery: DeliveryReceipt }>(`/api/messages/${msg.id}/send`);
      setReceipts((r) => ({ ...r, [msg.id]: res.delivery }));
      setNotice(res.sent ? { kind: 'ok', text: `Resent via ${res.delivery.provider}.` } : { kind: 'error', text: `Still failing: ${res.delivery.error}` });
    });

  const handleSimulateReply = () =>
    run('reply', async () => {
      const res = await api.post<{ intent: string; next_action: string; handoff_triggered: boolean; ai_reply?: string; delivery?: DeliveryReceipt }>(`/api/leads/${lead.id}/reply`, {
        text: simulatedReply,
        channel: replyChannel,
      });
      setNotice({
        kind: 'ok',
        text: `Classified intent: ${res.intent} · next action: ${res.next_action}${res.handoff_triggered ? ' · sales handoff task created' : ''}${res.ai_reply ? res.delivery ? ` · AI reply ${res.delivery.error ? 'failed' : 'sent'}` : ' · AI reply drafted (send it from the thread)' : ''}.`,
      });
    });

  const handleHumanReply = () =>
    run('human', async () => {
      if (!conversation || !humanReply.trim()) return;
      const res = await api.post<{ delivery: DeliveryReceipt }>(`/api/conversations/${conversation.id}/reply`, { text: humanReply });
      setHumanReply('');
      setNotice(res.delivery.error ? { kind: 'error', text: `Reply recorded but delivery failed: ${res.delivery.error}` } : { kind: 'ok', text: `Reply ${res.delivery.simulated ? 'sent (simulated)' : 'delivered'} via ${res.delivery.provider}.` });
    });

  const handleSendDraft = (messageId: string) =>
    run(messageId, async () => {
      if (!conversation) return;
      const res = await api.post<{ delivery: DeliveryReceipt }>(`/api/conversations/${conversation.id}/send`, { message_id: messageId });
      setNotice(res.delivery.error ? { kind: 'error', text: `Delivery failed: ${res.delivery.error}` } : { kind: 'ok', text: `Draft ${res.delivery.simulated ? 'sent (simulated)' : 'delivered'} via ${res.delivery.provider}.` });
    });

  const handleAIReply = () =>
    run('ai-reply', async () => {
      if (!conversation) return;
      await api.post(`/api/conversations/${conversation.id}/ai-reply`, { send: false });
      setNotice({ kind: 'ok', text: 'AI reply drafted — review it in the thread and press Send.' });
    });

  const handleBookMeeting = () =>
    run('book', async () => {
      const res = await api.post<{ meeting: { meet_url: string; start_time: string }; invite?: DeliveryReceipt }>(`/api/leads/${lead.id}/meeting`, {
        start_time: slot || undefined,
        title: meetingTitle || undefined,
        send_invite: sendInvite,
      });
      setShowBook(false);
      setNotice({
        kind: res.invite?.error ? 'error' : 'ok',
        text: `Meeting booked for ${formatDateTimeIst(res.meeting.start_time)} IST · room ${res.meeting.meet_url}${res.invite ? res.invite.error ? ` · invite failed: ${res.invite.error}` : ` · invite ${res.invite.simulated ? 'simulated' : 'emailed'}${res.invite.redirected_to ? ` to ${res.invite.redirected_to}` : ''}` : ''}.`,
      });
    });

  const handleBrief = () =>
    run('brief', async () => {
      await api.post(`/api/leads/${lead.id}/brief`);
      setNotice({ kind: 'ok', text: 'AI sales brief generated.' });
      setActiveTab('BRIEF');
    });

  const handleMintLink = () =>
    run('mint', async () => {
      const res = await api.post<{ talk_url: string }>('/api/voice/talk-links', { lead_id: lead.id, channel: 'MANUAL', language: lead.preferred_language });
      const url = `${window.location.origin}/talk/${res.talk_url.split('/talk/')[1]}`;
      setTalkLink(url);
      setActiveTab('VOICE');
      setNotice({ kind: 'ok', text: 'Talk link minted — copy it or open it to test the AI voice agent.' });
    });

  const handleStatus = (status: LeadStatus) => run('status', async () => void (await api.patch(`/api/leads/${lead.id}`, { status })));

  const handleSuppress = () =>
    run('suppress', async () => {
      await api.patch(`/api/leads/${lead.id}`, { suppress: !lead.is_suppressed, reason: lead.is_suppressed ? undefined : 'Suppressed from Lead 360' });
      setNotice({ kind: 'ok', text: lead.is_suppressed ? 'Suppression removed.' : 'Lead suppressed — no further outreach will be sent.' });
    });

  const handleSaveNotes = () =>
    run('notes', async () => {
      await api.patch(`/api/leads/${lead.id}`, { notes: notes ?? '' });
      setNotice({ kind: 'ok', text: 'Notes saved.' });
    });

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/leads')} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors" aria-label="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{lead.full_name}</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                ICP Fit: {lead.score ? `${lead.score.score}/100 (${lead.score.classification})` : 'not scored'}
              </span>
              <LeadStatusBadge status={lead.status} />
              {lead.is_suppressed && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 inline-flex items-center gap-1">
                  <Ban className="w-3 h-3" /> SUPPRESSED
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
              <span>{lead.job_title}</span>
              <span>·</span>
              <span className="font-medium text-slate-700">{lead.company_name}</span>
              <span>·</span>
              <span>
                {lead.city}, {lead.state}
              </span>
              {lead.campaign_name && (
                <>
                  <span>·</span>
                  <span>Campaign: {lead.campaign_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleRunOrchestrator} disabled={busy !== null || lead.is_suppressed} className={btn.primary} data-testid="trigger-sdr">
            {busy === 'process' ? <Spinner /> : <Zap className="w-3.5 h-3.5" />}
            <span>{busy === 'process' ? 'Agent Thinking...' : 'Trigger AI SDR Sequence'}</span>
          </button>
          <button onClick={() => setShowBook(true)} disabled={busy !== null || lead.is_suppressed} className={btn.success} data-testid="open-book-meeting">
            <Calendar className="w-3.5 h-3.5" />
            <span>Book Verified Meeting</span>
          </button>
          <button onClick={handleMintLink} disabled={busy !== null || lead.is_suppressed} className={`${btn.secondary} text-violet-700 border-violet-200`}>
            {busy === 'mint' ? <Spinner /> : <Link2 className="w-3.5 h-3.5" />}
            <span>Mint Talk Link</span>
          </button>
          <button onClick={handleSuppress} disabled={busy !== null} className={clsx(btn.secondary, !lead.is_suppressed && 'text-rose-700 border-rose-200')}>
            <Ban className="w-3.5 h-3.5" />
            <span>{lead.is_suppressed ? 'Remove suppression' : 'Suppress'}</span>
          </button>
        </div>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold text-slate-500 overflow-x-auto">
        {(
          [
            ['OVERVIEW', 'Lead 360° Profile'],
            ['OUTREACH', `Outbound Messages (${messages.length})`],
            ['CONVERSATION', `Inbound Reply & Intent Lab${conversation ? ` (${conversation.messages.length})` : ''}`],
            ['BRIEF', 'AI Sales Brief'],
            ['VOICE', `Voice (${talkSessions.length} links · ${voiceCalls.length} calls)`],
          ] as Array<[Tab, string]>
        ).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx('pb-2.5 transition-colors whitespace-nowrap flex items-center gap-1', activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'hover:text-slate-800')}
            data-testid={`tab-${tab.toLowerCase()}`}
          >
            <span>{label}</span>
            {tab === 'OUTREACH' && messages.some((m) => m.status === 'PENDING_APPROVAL') && <span className="w-2 h-2 rounded-full bg-amber-500" />}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Verified Contact Credentials</h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone
                </span>
                <span className="font-semibold text-slate-800">{lead.normalized_phone || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
                </span>
                <span className="font-semibold text-slate-800 break-all">{lead.normalized_email || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" /> Entity Type
                </span>
                <span className="font-semibold text-slate-800">{company ? company.entity_type.replace('_', ' ') : 'Not on registry'}</span>
              </div>
              {company?.gstin && (
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">GSTIN</span>
                  <span className="font-mono text-slate-800">{company.gstin}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Preferred Language</span>
                <span className="font-semibold text-slate-800 uppercase">{lead.preferred_language}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Source</span>
                <span className="font-semibold text-slate-800">{lead.lead_source}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Do Not Call (DNC)</span>
                <span className={clsx('font-semibold', lead.is_dnc_registered || lead.is_suppressed ? 'text-rose-600' : 'text-emerald-600')}>
                  {lead.is_suppressed ? `Suppressed — ${lead.suppression_reason}` : lead.is_dnc_registered ? 'Registered' : 'Clean / Not Registered'}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <Field label="Lifecycle status">
                <select value={lead.status} onChange={(e) => handleStatus(e.target.value as LeadStatus)} disabled={busy !== null} className={inputCls} data-testid="status-select">
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">ICP Scoring Breakdown</h3>
            {lead.score ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-indigo-600">{lead.score.score}/100</div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{lead.score.classification}</div>
                    <div className="text-[11px] text-slate-500">Confidence: {Math.round(lead.score.confidence * 100)}%</div>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center text-[10px] text-slate-500">
                  {[
                    ['Ind', lead.score.industry_score],
                    ['Size', lead.score.size_score],
                    ['Role', lead.score.role_score],
                    ['Geo', lead.score.geo_score],
                    ['Sig', lead.score.signals_score],
                  ].map(([k, v]) => (
                    <div key={k as string} className="bg-slate-50 rounded p-1 border border-slate-100">
                      <div className="font-bold text-slate-800">{v}</div>
                      {k}
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-700">Business Rationale:</div>
                  {lead.score.reasoning.map((r, i) => (
                    <div key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="text-indigo-600 font-bold">•</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">Not scored yet — trigger the AI SDR sequence.</div>
            )}
            {lead.research && lead.research.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <div className="text-[11px] font-semibold text-slate-700">Verified research signals:</div>
                {lead.research.map((r) => (
                  <div key={r.fact_key} className="text-[11px] text-slate-600">
                    <span className="font-mono text-slate-400">{r.source}</span> · {r.fact_value}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sales Enablement Tasks & Meetings</h3>
              {meetings.map((m) => (
                <div key={m.id} className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                  <div className="font-semibold text-slate-800 flex items-center gap-1">
                    <Video className="w-3 h-3 text-emerald-600" /> {m.title}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {formatDateTimeIst(m.start_time)} IST · {m.status}
                  </div>
                  <a href={m.meet_url} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1 mt-1">
                    Join room <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
              {tasks.map((t) => (
                <div key={t.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div className="font-semibold text-slate-800">{t.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{t.description}</div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-indigo-600 font-semibold">
                    <span>Priority: {t.priority}</span>
                    <span>{t.status}</span>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && meetings.length === 0 && <div className="text-xs text-slate-400 py-4 text-center">No outstanding tasks or meetings.</div>}
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Notes</h3>
              <textarea rows={4} value={notes ?? lead.notes ?? ''} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Context for the account executive…" />
              <button onClick={handleSaveNotes} disabled={busy !== null || notes === null} className={btn.secondary}>
                {busy === 'notes' ? <Spinner /> : <Save className="w-3.5 h-3.5" />} Save notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OUTREACH & DRAFTS */}
      {activeTab === 'OUTREACH' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Personalized Multi-Channel Outbound Sequence</h3>
            <span className="text-xs text-slate-500">Delivery mode: {state.org.delivery_mode}</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {messages.map((msg) => (
              <div key={msg.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3" data-testid={`message-${msg.id}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded uppercase">{msg.channel}</span>
                    <span className="text-xs font-semibold text-slate-800">{msg.subject || 'Outbound Direct Message'}</span>
                    {msg.campaign_name && <span className="text-[10px] text-slate-400">· {msg.campaign_name}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{timeAgo(msg.created_at)}</span>
                    <MessageStatusBadge status={msg.status} />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap font-sans">{msg.body}</div>
                {msg.error_message && msg.status !== 'FAILED' && <div className="text-[11px] text-amber-700">Guard note: {msg.error_message}</div>}
                <DeliveryReceiptLine receipt={receipts[msg.id] || msg.delivery} />

                {(msg.status === 'PENDING_APPROVAL' || msg.status === 'FAILED' || msg.status === 'QUEUED') && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {msg.status === 'PENDING_APPROVAL' && (
                      <button onClick={() => handleReject(msg)} disabled={busy !== null} className={btn.secondary}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}
                    {msg.status === 'PENDING_APPROVAL' ? (
                      <button onClick={() => handleApprove(msg)} disabled={busy !== null} className={btn.success} data-testid={`approve-${msg.id}`}>
                        {busy === msg.id ? <Spinner /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve & Dispatch Message
                      </button>
                    ) : (
                      <button onClick={() => handleRetry(msg)} disabled={busy !== null} className={btn.primary}>
                        {busy === msg.id ? <Spinner /> : <RefreshCw className="w-3.5 h-3.5" />} {msg.status === 'FAILED' ? 'Retry delivery' : 'Send now'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {messages.length === 0 && (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                No outbound drafts generated yet. Click &ldquo;Trigger AI SDR Sequence&rdquo; above to run personalization.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: INBOUND REPLY & INTENT LAB */}
      {activeTab === 'CONVERSATION' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col h-[32rem]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Conversation Thread {conversation ? `· ${conversation.channel}` : ''}</h3>
              {conversation && (
                <button onClick={handleAIReply} disabled={busy !== null} className={btn.small}>
                  {busy === 'ai-reply' ? <Spinner /> : <Sparkles className="w-3 h-3 text-indigo-600" />} Draft AI reply
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2" data-testid="conversation-thread">
              {conversation?.messages.map((m) => (
                <div
                  key={m.id}
                  className={clsx(
                    'p-3 rounded-lg text-xs max-w-[85%]',
                    m.sender_type === 'PROSPECT' ? 'bg-slate-100 text-slate-800 ml-auto' : m.sender_type === 'HUMAN_REP' ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' : 'bg-indigo-50 text-indigo-900 border border-indigo-100'
                  )}
                >
                  <div className="font-semibold text-[10px] text-slate-500 mb-0.5 flex items-center justify-between gap-2">
                    <span>{m.sender_name || (m.sender_type === 'PROSPECT' ? lead.full_name : 'Apex AI SDR')}</span>
                    <span className="font-normal">{timeAgo(m.created_at)}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.sender_type !== 'PROSPECT' && m.delivery_status === 'DRAFT' && (
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-indigo-100 pt-1.5">
                      <span className="text-[10px] font-bold text-amber-700">DRAFT · not sent</span>
                      <button onClick={() => handleSendDraft(m.id)} disabled={busy !== null} className={btn.small} data-testid={`send-draft-${m.id}`}>
                        {busy === m.id ? <Spinner /> : <Send className="w-3 h-3" />} Send
                      </button>
                    </div>
                  )}
                  {m.delivery && m.delivery_status !== 'DRAFT' && <DeliveryReceiptLine receipt={m.delivery} />}
                </div>
              ))}
              {!conversation && <div className="text-center text-xs text-slate-400 py-12">No inbound messages yet. Use the simulator on the right to test intent detection.</div>}
            </div>
            {conversation && (
              <div className="pt-3 mt-3 border-t border-slate-200 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a human reply…"
                  value={humanReply}
                  onChange={(e) => setHumanReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleHumanReply()}
                  className={inputCls}
                />
                <button onClick={handleHumanReply} disabled={busy !== null || !humanReply.trim()} className={btn.primary}>
                  {busy === 'human' ? <Spinner /> : <Send className="w-3.5 h-3.5" />} Send
                </button>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Simulate Inbound Prospect Reply</h3>
              <p className="text-xs text-slate-500">
                Test the AI Conversation Agent: classifies intent, sentiment and buying stage, triggers handoff / suppression, and drafts the AI reply.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Channel:</span>
              {(['EMAIL', 'WHATSAPP'] as const).map((c) => (
                <button key={c} onClick={() => setReplyChannel(c)} className={clsx('px-2.5 py-1 rounded-lg font-semibold', replyChannel === c ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700')}>
                  {c}
                </button>
              ))}
            </div>

            <textarea rows={3} value={simulatedReply} onChange={(e) => setSimulatedReply(e.target.value)} className={inputCls} data-testid="simulated-reply" />

            <div className="flex flex-wrap gap-2 text-[11px]">
              {REPLY_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setSimulatedReply(p.text)}
                  className={clsx('px-2 py-1 rounded', p.tone === 'danger' ? 'bg-rose-50 hover:bg-rose-100 text-rose-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')}
                >
                  Preset: {p.label}
                </button>
              ))}
            </div>

            <button onClick={handleSimulateReply} disabled={busy !== null} className={`${btn.primary} w-full justify-center`} data-testid="submit-reply">
              {busy === 'reply' ? <Spinner /> : <Zap className="w-3.5 h-3.5" />} {busy === 'reply' ? 'Classifying Intent...' : 'Submit & Process Inbound Reply'}
            </button>

            {conversation && (
              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Intent</div>
                  <div className="font-bold text-indigo-700">{conversation.latest_intent || '—'}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Stage</div>
                  <div className="font-semibold text-slate-800">{conversation.buying_stage}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Sentiment</div>
                  <div className={clsx('font-semibold', conversation.sentiment === 'NEGATIVE' ? 'text-rose-600' : 'text-emerald-600')}>{conversation.sentiment}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AI SALES BRIEF */}
      {activeTab === 'BRIEF' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5" data-testid="brief-tab">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Sales Brief: Executive Discovery Deck</h2>
              <p className="text-xs text-slate-500">
                Synthesised for Account Executives from verified lead, company, conversation and call data.
                {lead.sales_brief_generated_at ? ` Generated ${timeAgo(lead.sales_brief_generated_at)}.` : ''}
              </p>
            </div>
            <button onClick={handleBrief} disabled={busy !== null} className={btn.primary} data-testid="generate-brief">
              {busy === 'brief' ? <Spinner /> : <Sparkles className="w-3.5 h-3.5" />} {brief ? 'Regenerate brief' : 'Generate brief'}
              <span className="text-[10px] font-normal opacity-80">· {state.integrations.ai.live ? state.integrations.ai.model.split('/').pop() : 'offline simulator'}</span>
            </button>
          </div>

          {brief ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <BriefBlock title="Account Overview" text={brief.account_overview} />
                <BriefBlock title="Contact Role" text={brief.contact_role} />
                <BriefBlock title="Company Context" text={brief.company_context} />
                <BriefList title="Verified Pain Points" items={brief.verified_pain_points} />
              </div>
              <div className="space-y-3">
                <BriefList title="Buying Signals" items={brief.buying_signals} />
                <BriefList title="Recommended Discovery Questions" items={brief.recommended_questions} ordered />
                <BriefList title="Anticipated Objections & Rebuttals" items={brief.anticipated_objections} />
                <BriefBlock title="Recommended Discovery Approach" text={brief.recommended_discovery_approach} />
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-slate-400">No brief yet — generate one before the discovery call.</div>
          )}
        </div>
      )}

      {/* TAB 5: VOICE */}
      {activeTab === 'VOICE' && (
        <div className="space-y-4">
          {talkLink && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs flex flex-col sm:flex-row sm:items-center gap-3" data-testid="talk-link-panel">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-violet-900">Personal talk link minted</div>
                <div className="font-mono text-[11px] text-violet-800 break-all">{talkLink}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => copyLink(talkLink)} className={btn.secondary}>
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} Copy
                </button>
                <a href={talkLink} target="_blank" rel="noreferrer" className={btn.primary}>
                  <ExternalLink className="w-3.5 h-3.5" /> Open & talk
                </a>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Talk links</h3>
              {talkSessions.map((s) => (
                <div key={s.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-800">
                      {s.status} · {s.channel}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {s.max_calls - s.call_count} of {s.max_calls} calls left · expires {new Date(s.expires_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  {s.token && !['REVOKED', 'EXPIRED', 'COMPLETED'].includes(s.status) && (
                    <a href={`/talk/${s.token}`} target="_blank" rel="noreferrer" className={btn.small}>
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
              {talkSessions.length === 0 && <div className="text-xs text-slate-400 py-4 text-center">No talk links yet — mint one above.</div>}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">AI voice calls</h3>
              {voiceCalls.map((c) => (
                <div key={c.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <PhoneCall className="w-3 h-3 text-violet-600" /> {c.mode.toUpperCase()} · {c.provider} · {c.duration_seconds}s
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700">{c.intent || c.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">{c.extracted?.summary || 'No summary'}</div>
                </div>
              ))}
              {voiceCalls.length === 0 && <div className="text-xs text-slate-400 py-4 text-center">No calls recorded for this lead.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Book meeting modal */}
      <Modal open={showBook} title={`Book a discovery meeting with ${lead.first_name}`} description="Free Jitsi room, .ics invite, and an AI sales brief for the AE." onClose={() => setShowBook(false)}>
        <div className="space-y-3">
          <Field label="Slot (IST business hours)">
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className={inputCls} data-testid="meeting-slot">
              {slots.map((s) => (
                <option key={s.start} value={s.start}>
                  {s.label} IST
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder={`Discovery Session: Apex SDR x ${lead.company_name}`} className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="accent-indigo-600" />
            Email the invite (.ics) to {lead.email || 'the prospect'} now ({state.org.delivery_mode})
          </label>
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button onClick={() => setShowBook(false)} className={btn.ghost}>
              Cancel
            </button>
            <button onClick={handleBookMeeting} disabled={busy !== null || !slot} className={btn.success} data-testid="confirm-book-meeting">
              {busy === 'book' ? <Spinner /> : <Calendar className="w-3.5 h-3.5" />} Book meeting
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BriefBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">{title}</h4>
      <p className="text-slate-600 mt-1">{text}</p>
    </div>
  );
}

function BriefList({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <div>
      <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">{title}</h4>
      <Tag className={clsx('list-inside text-slate-600 mt-1 space-y-1', ordered ? 'list-decimal' : 'list-disc')}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </Tag>
    </div>
  );
}
