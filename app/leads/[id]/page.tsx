'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  User,
  Zap,
  Send,
  AlertOctagon,
  FileText,
} from 'lucide-react';
import { getDemoStore } from '../../../lib/store/demo-store';
import { SDROrchestrator } from '../../../lib/orchestrator/sdr-orchestrator';
import { CalendarAdapter } from '../../../lib/adapters/calendar';
import { clsx } from 'clsx';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const store = getDemoStore();
  const leadId = params.id as string;

  const [lead, setLead] = useState(store.leads.find((l) => l.id === leadId));
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'RESEARCH' | 'OUTREACH' | 'CONVERSATION' | 'BRIEF'>('OVERVIEW');
  const [isProcessing, setIsProcessing] = useState(false);
  const [simulatedReply, setSimulatedReply] = useState('Yes, interested. Please send pricing details and let us schedule a demo.');
  const [inboundStatus, setInboundStatus] = useState<string | null>(null);

  if (!lead) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Lead not found. <Link href="/leads" className="text-indigo-600 underline">Back to Leads</Link>
      </div>
    );
  }

  const messages = store.messages.filter((m) => m.lead_id === lead.id);
  const conversation = store.conversations.find((c) => c.lead_id === lead.id);
  const meeting = store.meetings.find((m) => m.lead_id === lead.id);
  const tasks = store.tasks.filter((t) => t.lead_id === lead.id);

  const handleApproveMessage = (msgId: string) => {
    store.approveMessage(msgId);
    setLead({ ...lead });
  };

  const handleRunOrchestrator = async () => {
    setIsProcessing(true);
    await SDROrchestrator.processLead(lead.id);
    setIsProcessing(false);
    setLead({ ...store.leads.find((l) => l.id === lead.id)! });
  };

  const handleSimulateReply = async () => {
    setIsProcessing(true);
    const res = await SDROrchestrator.handleInboundReply({
      leadId: lead.id,
      channel: 'EMAIL',
      messageText: simulatedReply,
    });
    setIsProcessing(false);
    setInboundStatus(`Classified Intent: ${res.intent}. Next Action: ${res.nextAction}`);
    setLead({ ...store.leads.find((l) => l.id === lead.id)! });
  };

  const handleBookMeeting = async () => {
    setIsProcessing(true);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(15, 30, 0, 0);

    const booking = await CalendarAdapter.scheduleMeeting({
      leadId: lead.id,
      leadName: lead.full_name,
      leadEmail: lead.email,
      title: `Discovery Session: Apex SDR x ${lead.company_name}`,
      startTime: tomorrow.toISOString(),
      endTime: new Date(tomorrow.getTime() + 1800000).toISOString(),
    });

    if (booking.success) {
      store.meetings.unshift({
        id: booking.meetingId,
        organization_id: store.org.id,
        lead_id: lead.id,
        lead_name: lead.full_name,
        lead_company: lead.company_name || '',
        title: `Discovery Session: Apex SDR x ${lead.company_name}`,
        start_time: tomorrow.toISOString(),
        end_time: new Date(tomorrow.getTime() + 1800000).toISOString(),
        meet_url: booking.meetUrl,
        calendar_provider: 'Google Calendar [SIMULATED]',
        status: 'CONFIRMED',
        sales_brief: {
          account_overview: `${lead.company_name} is an active enterprise lead in ${lead.city}.`,
          contact_role: `${lead.full_name} (${lead.job_title})`,
          company_context: 'Scaling B2B sales operations across Indian regions.',
          verified_pain_points: ['High manual prospecting latency', 'Disorganized multi-channel follow-up'],
          buying_signals: ['Expressed immediate interest in live demo'],
          recommended_questions: ['What is your current lead-to-opportunity conversion timeline?'],
          anticipated_objections: ['Implementation timeline across regional teams'],
          recommended_discovery_approach: 'Highlight autonomous queue approvals and WhatsApp official API integration.',
        },
        created_at: new Date().toISOString(),
      });

      lead.status = 'MEETING';
      store.recordAuditLog('AI_AGENT', 'MEETING_BOOKED', 'meeting', booking.meetingId, `Booked discovery meeting with ${lead.full_name}`);
      setLead({ ...lead });
    }
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/leads')}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{lead.full_name}</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                ICP Fit: {lead.score?.score || 70}/100 ({lead.score?.classification || 'HIGH_FIT'})
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-100 text-slate-700">
                {lead.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{lead.job_title}</span>
              <span>·</span>
              <span className="font-medium text-slate-700">{lead.company_name}</span>
              <span>·</span>
              <span>{lead.city}, {lead.state}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunOrchestrator}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Agent Thinking...' : 'Trigger AI SDR Sequence'}</span>
          </button>
          <button
            onClick={handleBookMeeting}
            disabled={isProcessing || lead.status === 'MEETING'}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Book Verified Meeting</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold text-slate-500">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={clsx('pb-2.5 transition-colors', activeTab === 'OVERVIEW' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'hover:text-slate-800')}
        >
          Lead 360° Profile
        </button>
        <button
          onClick={() => setActiveTab('OUTREACH')}
          className={clsx('pb-2.5 transition-colors flex items-center gap-1', activeTab === 'OUTREACH' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'hover:text-slate-800')}
        >
          <span>Outbound Messages ({messages.length})</span>
          {messages.some((m) => m.status === 'PENDING_APPROVAL') && (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('CONVERSATION')}
          className={clsx('pb-2.5 transition-colors', activeTab === 'CONVERSATION' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'hover:text-slate-800')}
        >
          Inbound Reply & Intent Lab
        </button>
        <button
          onClick={() => setActiveTab('BRIEF')}
          className={clsx('pb-2.5 transition-colors', activeTab === 'BRIEF' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'hover:text-slate-800')}
        >
          AI Sales Brief
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact & Company Details */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Verified Contact Credentials</h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone
                </span>
                <span className="font-semibold text-slate-800">{lead.normalized_phone}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
                </span>
                <span className="font-semibold text-slate-800">{lead.normalized_email}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" /> Entity Type
                </span>
                <span className="font-semibold text-slate-800">Pvt Ltd / Ltd</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Preferred Language</span>
                <span className="font-semibold text-slate-800 uppercase">{lead.preferred_language}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Do Not Call (DNC)</span>
                <span className="font-semibold text-emerald-600">Clean / Not Registered</span>
              </div>
            </div>
          </div>

          {/* AI Score & Reasoning */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">ICP Scoring Breakdown</h3>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-indigo-600">{lead.score?.score || 75}/100</div>
              <div>
                <div className="text-xs font-semibold text-slate-900">{lead.score?.classification || 'HIGH_FIT'}</div>
                <div className="text-[11px] text-slate-500">Confidence: 91%</div>
              </div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-700">Business Rationale:</div>
              {lead.score?.reasoning?.map((r, i) => (
                <div key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Connected Tasks & Meetings */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sales Enablement Tasks</h3>
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div key={t.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <div className="font-semibold text-slate-800">{t.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{t.description}</div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-indigo-600 font-semibold">
                      <span>Priority: {t.priority}</span>
                      <span>Assigned to Sales Rep</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">No outstanding tasks.</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OUTREACH & DRAFTS */}
      {activeTab === 'OUTREACH' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Personalized Multi-Channel Outbound Sequence</h3>
            <span className="text-xs text-slate-500">Strict Anti-Hallucination Policy: Verified Signals Only</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {messages.map((msg) => (
              <div key={msg.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded uppercase">
                      {msg.channel}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {msg.subject || 'Outbound Direct Message'}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'text-xs font-bold px-2.5 py-0.5 rounded-full',
                      msg.status === 'PENDING_APPROVAL'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : msg.status === 'SENT'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    )}
                  >
                    {msg.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap font-sans">
                  {msg.body}
                </div>

                {msg.status === 'PENDING_APPROVAL' && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleApproveMessage(msg.id)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Dispatch Message
                    </button>
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
          {/* Conversation History */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col h-96">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Live Conversation Thread</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {conversation?.messages.map((m) => (
                <div
                  key={m.id}
                  className={clsx(
                    'p-3 rounded-lg text-xs max-w-[85%]',
                    m.sender_type === 'PROSPECT'
                      ? 'bg-slate-100 text-slate-800 ml-auto'
                      : 'bg-indigo-50 text-indigo-900 border border-indigo-100'
                  )}
                >
                  <div className="font-semibold text-[10px] text-slate-500 mb-0.5">
                    {m.sender_name || (m.sender_type === 'PROSPECT' ? lead.full_name : 'Apex AI SDR')}
                  </div>
                  <div>{m.content}</div>
                </div>
              ))}

              {!conversation && (
                <div className="text-center text-xs text-slate-400 py-12">
                  No inbound messages yet. Use the simulator on the right to test intent detection.
                </div>
              )}
            </div>
          </div>

          {/* Inbound Simulator */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Simulate Inbound Prospect Reply</h3>
              <p className="text-xs text-slate-500">
                Test the AI Conversation Agent: Evaluates intent, sentiment, buying stage, and automated handoff.
              </p>
            </div>

            <textarea
              rows={3}
              value={simulatedReply}
              onChange={(e) => setSimulatedReply(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-indigo-500"
            />

            <div className="flex flex-wrap gap-2 text-[11px]">
              <button
                onClick={() => setSimulatedReply('Yes, interested. Please send pricing details and let us schedule a demo.')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
              >
                Preset: Interested & Demo
              </button>
              <button
                onClick={() => setSimulatedReply('Please unsubscribe me. Do not contact me again.')}
                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded text-rose-700"
              >
                Preset: Unsubscribe
              </button>
              <button
                onClick={() => setSimulatedReply('Not right now, please reach out next financial year in April.')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
              >
                Preset: Not Now
              </button>
            </div>

            <button
              onClick={handleSimulateReply}
              disabled={isProcessing}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'Classifying Intent...' : 'Submit & Process Inbound Reply'}
            </button>

            {inboundStatus && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium">
                {inboundStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AI SALES BRIEF */}
      {activeTab === 'BRIEF' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Sales Brief: Executive Discovery Deck</h2>
              <p className="text-xs text-slate-500">Automatically synthesized for Account Executives before discovery calls.</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Generated via Groq Llama-3.3
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-3">
              <div>
                <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Account Overview</h4>
                <p className="text-slate-600 mt-1">
                  {lead.company_name} is an active enterprise player in {lead.city}. Target sector matches our primary B2B ICP.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Verified Pain Points</h4>
                <ul className="list-disc list-inside text-slate-600 mt-1 space-y-1">
                  <li>Sales reps spending 15+ hours/week on manual LinkedIn and email follow-ups</li>
                  <li>Slow response latency to inbound tier-2 inquiries</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Recommended Discovery Questions</h4>
                <ul className="list-disc list-inside text-slate-600 mt-1 space-y-1">
                  <li>What is your current turnaround time between receiving a cold lead and booking a call?</li>
                  <li>How do your regional sales heads manage follow-up cadences in Hindi vs English?</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Anticipated Objections & Rebuttals</h4>
                <ul className="list-disc list-inside text-slate-600 mt-1 space-y-1">
                  <li>&ldquo;Concerned about WhatsApp compliance&rdquo; → Rebut with official Meta Cloud API pre-approved templates</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
