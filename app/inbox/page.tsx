'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Mail,
  Send,
  Calendar,
  AlertTriangle,
  UserCheck,
  CheckCircle,
  Building,
  Phone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { getDemoStore } from '../../lib/store/demo-store';
import { Conversation, ConversationIntent } from '../../lib/types';
import { SDROrchestrator } from '../../lib/orchestrator/sdr-orchestrator';
import { clsx } from 'clsx';

export default function InboxPage() {
  const store = getDemoStore();
  const [conversations, setConversations] = useState<Conversation[]>([...store.conversations]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(conversations[0] || null);
  const [replyInput, setReplyInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSendHumanReply = () => {
    if (!selectedConv || !replyInput.trim()) return;

    selectedConv.messages.push({
      id: `cm_${Date.now()}`,
      conversation_id: selectedConv.id,
      sender_type: 'HUMAN_REP',
      sender_name: 'Ananya Sen (Sales Rep)',
      content: replyInput,
      created_at: new Date().toISOString(),
    });

    selectedConv.status = 'WAITING_PROSPECT';
    selectedConv.updated_at = new Date().toISOString();
    store.recordAuditLog('USER', 'HUMAN_REPLY_SENT', 'conversation', selectedConv.id, `Sent reply to ${selectedConv.lead_name}`);
    setReplyInput('');
    setConversations([...store.conversations]);
  };

  const handleSimulateInbound = async (text: string) => {
    if (!selectedConv) return;
    setIsProcessing(true);
    await SDROrchestrator.handleInboundReply({
      leadId: selectedConv.lead_id,
      channel: selectedConv.channel,
      messageText: text,
    });
    setIsProcessing(false);
    setConversations([...store.conversations]);
    setSelectedConv({ ...store.conversations.find((c) => c.id === selectedConv.id)! });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto h-[calc(100vh-6.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            Unified Multi-Channel Conversation Inbox
          </h1>
          <p className="text-xs text-slate-500">
            Real-time Indian B2B prospect interactions across Email & Official WhatsApp Business API.
          </p>
        </div>
      </div>

      {/* Main Inbox Workspace */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex min-h-0">
        {/* Left: Conversation List */}
        <div className="w-80 border-r border-slate-200 flex flex-col h-full bg-slate-50/50">
          <div className="p-3 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
            All Inbound Threads ({conversations.length})
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.map((conv) => {
              const isSelected = selectedConv?.id === conv.id;
              const lastMsg = conv.messages[conv.messages.length - 1];

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={clsx(
                    'p-3.5 cursor-pointer transition-colors text-xs space-y-1',
                    isSelected ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-100/60'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{conv.lead_name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded uppercase bg-slate-100 text-slate-600">
                      {conv.channel}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium truncate">
                    {conv.lead_company}
                  </div>

                  <div className="text-[11px] text-slate-600 line-clamp-1 italic">
                    {lastMsg?.content || 'No messages'}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span
                      className={clsx(
                        'font-semibold px-1.5 py-0.5 rounded',
                        conv.latest_intent === 'INTERESTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      {conv.latest_intent || 'WAITING'}
                    </span>
                    <span className="text-slate-400">Just now</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle: Chat Message Thread */}
        {selectedConv ? (
          <div className="flex-1 flex flex-col h-full">
            {/* Thread Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">{selectedConv.lead_name}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedConv.channel}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {selectedConv.lead_company} · {selectedConv.lead_email} · {selectedConv.lead_phone}
                </div>
              </div>

              <Link
                href={`/leads/${selectedConv.lead_id}`}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Lead 360° Profile →
              </Link>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40">
              {selectedConv.messages.map((m) => {
                const isProspect = m.sender_type === 'PROSPECT';
                return (
                  <div
                    key={m.id}
                    className={clsx(
                      'p-3 rounded-lg text-xs max-w-lg shadow-2xs',
                      isProspect
                        ? 'bg-white border border-slate-200 text-slate-800 mr-auto'
                        : 'bg-indigo-600 text-white ml-auto'
                    )}
                  >
                    <div
                      className={clsx(
                        'text-[10px] font-semibold mb-1',
                        isProspect ? 'text-slate-400' : 'text-indigo-200'
                      )}
                    >
                      {m.sender_name || (isProspect ? selectedConv.lead_name : 'Apex SDR')}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                );
              })}
            </div>

            {/* Inbound Simulator Quick Bar */}
            <div className="p-2.5 bg-slate-100 border-t border-slate-200 text-xs flex items-center justify-between gap-2 flex-shrink-0">
              <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                Simulate Inbound:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => handleSimulateInbound('Can you share pricing and customer case studies for India?')}
                  className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700"
                >
                  &ldquo;Pricing & Case Studies&rdquo;
                </button>
                <button
                  onClick={() => handleSimulateInbound('Yes, lets do a demo this Thursday at 3 PM.')}
                  className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[11px] text-emerald-700 font-semibold"
                >
                  &ldquo;Confirm Demo&rdquo;
                </button>
                <button
                  onClick={() => handleSimulateInbound('Please stop contacting our team. Unsubscribe.')}
                  className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[11px] text-rose-700 font-semibold"
                >
                  &ldquo;Unsubscribe&rdquo;
                </button>
              </div>
            </div>

            {/* Human Rep Reply Input */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2 flex-shrink-0">
              <input
                type="text"
                placeholder="Type a human reply or intervention..."
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendHumanReply()}
                className="flex-1 text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-indigo-500"
              />
              <button
                onClick={handleSendHumanReply}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
            Select a conversation thread to view
          </div>
        )}

        {/* Right: AI Intelligence & Qualification Panel */}
        {selectedConv && (
          <div className="w-72 border-l border-slate-200 p-4 space-y-4 bg-slate-50/50 flex flex-col">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Conversation Intelligence
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Detected Intent</span>
                <div className="font-bold text-indigo-700">
                  {selectedConv.latest_intent || 'INTERESTED'}
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Buying Stage</span>
                <div className="font-semibold text-slate-800">{selectedConv.buying_stage}</div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Sentiment</span>
                <div className="font-semibold text-emerald-600">{selectedConv.sentiment}</div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <h4 className="text-[11px] font-bold text-slate-700 mb-1">Qualification Signals:</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {selectedConv.qualification_notes?.need ||
                  'Prospect seeking to automate SDR outbound to expand tier-2 industrial inquiries.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
