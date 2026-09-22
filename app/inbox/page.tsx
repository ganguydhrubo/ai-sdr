'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Send, Zap, Sparkles, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppState } from '../../lib/client/use-app-state';
import { api } from '../../lib/client/api';
import { timeAgo } from '../../lib/client/format';
import { PageLoading, PageError, Notice, useNotice, DeliveryReceiptLine, btn, inputCls, Spinner } from '../../components/ui';
import type { DeliveryReceipt } from '../../lib/types';

const PRESETS = [
  { label: '“Pricing & Case Studies”', text: 'Can you share pricing and customer case studies for India?', cls: 'text-slate-700' },
  { label: '“Confirm Demo”', text: 'Yes, lets do a demo this Thursday at 3 PM.', cls: 'text-emerald-700 font-semibold' },
  { label: '“Not now”', text: 'Not right now, please reach out next quarter.', cls: 'text-slate-700' },
  { label: '“Unsubscribe”', text: 'Please stop contacting our team. Unsubscribe.', cls: 'text-rose-700 font-semibold' },
];

export default function InboxPage() {
  const { state, loading, error, refresh } = useAppState({ pollMs: 15_000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [customInbound, setCustomInbound] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();

  const conversations = useMemo(() => {
    const list = [...(state?.conversations || [])].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return attentionOnly ? list.filter((c) => c.needs_human_attention) : list;
  }, [state, attentionOnly]);

  if (error && !state) return <PageError message={error} />;
  if (loading || !state) return <PageLoading />;

  const selectedConv = conversations.find((c) => c.id === selectedId) || conversations[0] || null;
  const lead = selectedConv ? state.leads.find((l) => l.id === selectedConv.lead_id) : undefined;

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

  const handleSendHumanReply = () =>
    run('human', async () => {
      if (!selectedConv || !replyInput.trim()) return;
      const res = await api.post<{ delivery: DeliveryReceipt }>(`/api/conversations/${selectedConv.id}/reply`, { text: replyInput });
      setReplyInput('');
      setNotice(res.delivery.error ? { kind: 'error', text: `Reply saved, delivery failed: ${res.delivery.error}` } : { kind: 'ok', text: `Reply ${res.delivery.simulated ? 'sent (simulated)' : 'delivered'} via ${res.delivery.provider}${res.delivery.redirected_to ? ` → ${res.delivery.redirected_to}` : ''}.` });
    });

  const handleSimulateInbound = (text: string) =>
    run('inbound', async () => {
      if (!selectedConv || !text.trim()) return;
      const res = await api.post<{ intent: string; handoff_triggered: boolean; ai_reply?: string; delivery?: DeliveryReceipt }>(`/api/leads/${selectedConv.lead_id}/reply`, {
        text,
        channel: selectedConv.channel,
      });
      setCustomInbound('');
      setNotice({
        kind: 'ok',
        text: `Inbound classified as ${res.intent}${res.handoff_triggered ? ' · handoff task created' : ''}${res.ai_reply ? res.delivery ? ` · AI reply ${res.delivery.error ? 'failed to send' : 'sent'}` : ' · AI reply drafted below — press Send to deliver' : ''}.`,
      });
    });

  const handleAIReply = () =>
    run('ai', async () => {
      if (!selectedConv) return;
      await api.post(`/api/conversations/${selectedConv.id}/ai-reply`, { send: false });
      setNotice({ kind: 'ok', text: 'AI reply drafted — review and press Send.' });
    });

  const handleSendDraft = (messageId: string) =>
    run(messageId, async () => {
      if (!selectedConv) return;
      const res = await api.post<{ delivery: DeliveryReceipt }>(`/api/conversations/${selectedConv.id}/send`, { message_id: messageId });
      setNotice(res.delivery.error ? { kind: 'error', text: `Delivery failed: ${res.delivery.error}` } : { kind: 'ok', text: `Draft ${res.delivery.simulated ? 'sent (simulated)' : 'delivered'} via ${res.delivery.provider}.` });
    });

  return (
    <div className="space-y-4 max-w-7xl mx-auto h-[calc(100vh-6.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            Unified Multi-Channel Conversation Inbox
          </h1>
          <p className="text-xs text-slate-500">
            Prospect replies across Email & self-hosted WhatsApp · replies leave via {state.org.delivery_mode === 'SIMULATED' ? 'the simulator' : state.org.delivery_mode === 'LIVE_REDIRECT' ? 'live channels, redirected to your test inbox' : 'live channels'}.
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} className="accent-indigo-600" />
          Needs human attention only
        </label>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {/* Main Inbox Workspace */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex min-h-0">
        {/* Left: Conversation List */}
        <div className="w-72 lg:w-80 border-r border-slate-200 flex flex-col h-full bg-slate-50/50 flex-shrink-0">
          <div className="p-3 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">All Inbound Threads ({conversations.length})</div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100" data-testid="conversation-list">
            {conversations.map((conv) => {
              const isSelected = selectedConv?.id === conv.id;
              const lastMsg = conv.messages[conv.messages.length - 1];

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={clsx('p-3.5 cursor-pointer transition-colors text-xs space-y-1', isSelected ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-100/60')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 truncate">{conv.lead_name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-600">{conv.channel}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium truncate">{conv.lead_company}</div>
                  <div className="text-[11px] text-slate-600 line-clamp-1 italic">{lastMsg?.content || 'No messages'}</div>
                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className={clsx('font-semibold px-1.5 py-0.5 rounded', conv.latest_intent === 'UNSUBSCRIBE' || conv.latest_intent === 'NOT_INTERESTED' ? 'bg-rose-100 text-rose-800' : conv.latest_intent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700')}>
                      {conv.latest_intent || 'WAITING'}
                    </span>
                    <span className="text-slate-400">{timeAgo(conv.updated_at)}</span>
                  </div>
                  {conv.needs_human_attention && (
                    <div className="text-[10px] text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> needs a human
                    </div>
                  )}
                </div>
              );
            })}
            {conversations.length === 0 && <div className="p-6 text-xs text-slate-400 text-center">No conversations yet. Simulate a reply from a lead&apos;s 360° page.</div>}
          </div>
        </div>

        {/* Middle: Chat Message Thread */}
        {selectedConv ? (
          <div className="flex-1 flex flex-col h-full min-w-0">
            {/* Thread Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0 gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 truncate">{selectedConv.lead_name}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">{selectedConv.channel}</span>
                  <span className="text-[10px] font-semibold text-slate-500">{selectedConv.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  {selectedConv.lead_company} · {selectedConv.lead_email} · {selectedConv.lead_phone}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={handleAIReply} disabled={busy !== null || lead?.is_suppressed} className={btn.small} data-testid="draft-ai-reply">
                  {busy === 'ai' ? <Spinner /> : <Sparkles className="w-3 h-3 text-indigo-600" />} Draft AI reply
                </button>
                <Link href={`/leads/${selectedConv.lead_id}`} className="text-xs font-semibold text-indigo-600 hover:underline whitespace-nowrap">
                  Lead 360° →
                </Link>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40" data-testid="inbox-thread">
              {selectedConv.messages.map((m) => {
                const isProspect = m.sender_type === 'PROSPECT';
                const isDraft = !isProspect && m.delivery_status === 'DRAFT';
                return (
                  <div
                    key={m.id}
                    className={clsx(
                      'p-3 rounded-lg text-xs max-w-lg shadow-2xs',
                      isProspect ? 'bg-white border border-slate-200 text-slate-800 mr-auto' : isDraft ? 'bg-amber-50 border border-amber-200 text-slate-800 ml-auto' : m.sender_type === 'HUMAN_REP' ? 'bg-emerald-600 text-white ml-auto' : 'bg-indigo-600 text-white ml-auto'
                    )}
                  >
                    <div className={clsx('text-[10px] font-semibold mb-1 flex items-center justify-between gap-3', isProspect ? 'text-slate-400' : isDraft ? 'text-amber-700' : 'text-indigo-100')}>
                      <span>{m.sender_name || (isProspect ? selectedConv.lead_name : 'Apex SDR')}</span>
                      <span className="font-normal">{timeAgo(m.created_at)}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {isDraft && (
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-amber-200 pt-1.5">
                        <span className="text-[10px] font-bold text-amber-700">AI DRAFT · not sent</span>
                        <button onClick={() => handleSendDraft(m.id)} disabled={busy !== null} className={btn.small} data-testid={`send-draft-${m.id}`}>
                          {busy === m.id ? <Spinner /> : <Send className="w-3 h-3" />} Send
                        </button>
                      </div>
                    )}
                    {m.delivery && !isDraft && (
                      <div className={clsx('text-[10px] mt-1', m.delivery.error ? 'text-rose-200' : 'opacity-80')}>
                        {m.delivery.error ? `Delivery failed: ${m.delivery.error}` : `${m.delivery.simulated ? 'Simulated' : 'Delivered'} via ${m.delivery.provider}${m.delivery.redirected_to ? ` → ${m.delivery.redirected_to}` : ''}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inbound Simulator Quick Bar */}
            <div className="p-2.5 bg-slate-100 border-t border-slate-200 text-xs flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  Simulate inbound reply:
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {PRESETS.map((p) => (
                    <button key={p.label} onClick={() => handleSimulateInbound(p.text)} disabled={busy !== null} className={clsx('px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[11px] disabled:opacity-50', p.cls)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="…or type what the prospect replied"
                  value={customInbound}
                  onChange={(e) => setCustomInbound(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSimulateInbound(customInbound)}
                  className={inputCls}
                  data-testid="custom-inbound"
                />
                <button onClick={() => handleSimulateInbound(customInbound)} disabled={busy !== null || !customInbound.trim()} className={btn.secondary}>
                  {busy === 'inbound' ? <Spinner /> : <Zap className="w-3.5 h-3.5" />} Process
                </button>
              </div>
            </div>

            {/* Human Rep Reply Input */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2 flex-shrink-0">
              <input
                type="text"
                placeholder={lead?.is_suppressed ? 'This prospect is suppressed — no replies can be sent' : 'Type a human reply or intervention...'}
                value={replyInput}
                disabled={lead?.is_suppressed}
                onChange={(e) => setReplyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendHumanReply()}
                className={inputCls}
                data-testid="human-reply"
              />
              <button onClick={handleSendHumanReply} disabled={busy !== null || !replyInput.trim() || lead?.is_suppressed} className={btn.primary} data-testid="send-human-reply">
                {busy === 'human' ? <Spinner /> : <Send className="w-3.5 h-3.5" />} Send
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400">Select a conversation thread to view</div>
        )}

        {/* Right: AI Intelligence & Qualification Panel */}
        {selectedConv && (
          <div className="w-72 border-l border-slate-200 p-4 space-y-4 bg-slate-50/50 hidden xl:flex flex-col">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Conversation Intelligence</h3>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Detected Intent</span>
                <div className="font-bold text-indigo-700">{selectedConv.latest_intent || 'WAITING'}</div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Buying Stage</span>
                <div className="font-semibold text-slate-800">{selectedConv.buying_stage}</div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Sentiment</span>
                <div className={clsx('font-semibold', selectedConv.sentiment === 'NEGATIVE' ? 'text-rose-600' : selectedConv.sentiment === 'NEUTRAL' ? 'text-slate-600' : 'text-emerald-600')}>{selectedConv.sentiment}</div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Lead status</span>
                <div className="font-semibold text-slate-800">{lead?.status.replace(/_/g, ' ') || '—'}</div>
                {lead?.requires_human_attention && <div className="text-[10px] text-amber-700">{lead.attention_reason}</div>}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-2">
              <h4 className="text-[11px] font-bold text-slate-700">Qualification Signals:</h4>
              {Object.entries(selectedConv.qualification_notes || {}).length === 0 ? (
                <p className="text-[11px] text-slate-500">No qualification notes captured yet.</p>
              ) : (
                Object.entries(selectedConv.qualification_notes).map(([k, v]) => (
                  <p key={k} className="text-[11px] text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-700 capitalize">{k}:</span> {v}
                  </p>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
