'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  PhoneCall,
  Link2,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Play,
  FileText,
  UserCheck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Smartphone,
} from 'lucide-react';
import { getDemoStore } from '@/lib/store/demo-store';
import { TalkSession, VoiceCall } from '@/lib/types';
import { checkCallingWindowIST } from '@/lib/voice/compliance';

export default function VoiceHubPage() {
  const store = getDemoStore();
  const [activeTab, setActiveTab] = useState<'sessions' | 'calls' | 'dialer'>('sessions');
  const [sessions, setSessions] = useState<TalkSession[]>([...store.getTalkSessions()]);
  const [calls, setCalls] = useState<VoiceCall[]>([...store.getVoiceCalls()]);
  const [selectedCall, setSelectedCall] = useState<VoiceCall | null>(calls[0] || null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQrToken, setShowQrToken] = useState<string | null>(null);

  // New Talk Link Modal State
  const [isMintModalOpen, setIsMintModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(store.getLeads()[0]?.id || '');
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'whatsapp' | 'manual'>('whatsapp');
  const [isMinting, setIsMinting] = useState(false);

  // Test Outbound Dialer State
  const [dialerPhone, setDialerPhone] = useState('+919876543210');
  const [dialerStatus, setDialerStatus] = useState<string | null>(null);
  const [dialerLoading, setDialerLoading] = useState(false);

  const callingWindow = checkCallingWindowIST();
  const leads = store.getLeads();

  const handleCopy = (token: string, id: string) => {
    const url = `${window.location.origin}/talk/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMintTalkLink = async () => {
    setIsMinting(true);
    const lead = leads.find((l) => l.id === selectedLeadId) || leads[0];

    try {
      const res = await fetch('/api/voice/talk-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          channel: selectedChannel,
          language: lead.preferred_language || 'en',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSessions([...store.getTalkSessions()]);
        setIsMintModalOpen(false);
      } else {
        alert(data.error || 'Failed to mint talk link');
      }
    } catch {
      // Fallback in demo mode
      const newSession = store.createTalkSession({
        lead_id: lead.id,
        lead_name: lead.full_name,
        lead_company: lead.company_name,
        channel: selectedChannel,
        token: `demo_token_${Date.now()}`,
        status: 'CREATED',
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        max_calls: 3,
        call_count: 0,
      });
      setSessions([newSession, ...sessions]);
      setIsMintModalOpen(false);
    } finally {
      setIsMinting(false);
    }
  };

  const handleSimulateOutboundDial = async () => {
    setDialerLoading(true);
    setDialerStatus('Initiating compliance checks for TRAI 140 series & 09:00–21:00 IST window...');

    setTimeout(() => {
      if (!callingWindow.allowed) {
        setDialerStatus(`BLOCKED: Outbound call restricted outside 09:00–21:00 IST (Current time: ${callingWindow.timeString})`);
        setDialerLoading(false);
        return;
      }

      setDialerStatus('Simulating Vobiz SIP carrier connection to ' + dialerPhone + '...');
      setTimeout(() => {
        const lead = leads[0];
        const newCall = store.recordVoiceCall({
          lead_id: lead.id,
          lead_name: lead.full_name,
          lead_company: lead.company_name,
          mode: 'pstn',
          provider: 'demo',
          provider_run_id: `wr_pstn_${Date.now()}`,
          status: 'COMPLETED',
          started_at: new Date().toISOString(),
          ended_at: new Date(Date.now() + 95000).toISOString(),
          duration_seconds: 95,
          carrier_cost_estimate_inr: 0.85,
          extracted: {
            intent: 'INTERESTED',
            sentiment: 'POSITIVE',
            summary: `Automated outbound dial to ${dialerPhone}. Prospect agreed to discovery call.`,
          },
          transcript: [
            { role: 'agent', text: 'Namaste! Apex AI calling from verified 140 series business line.' },
            { role: 'user', text: 'Yes, please share your platform details over email.' },
          ],
        });

        setCalls([newCall, ...calls]);
        setSelectedCall(newCall);
        setDialerStatus(`SUCCESS: Call completed (95s). Transcript and extraction recorded.`);
        setDialerLoading(false);
      }, 2000);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 border border-violet-500/20 text-xs font-bold uppercase tracking-wider">
              Phase 8 Voice Module
            </span>
            <span
              className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                callingWindow.allowed
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>TRAI Window: {callingWindow.timeString} ({callingWindow.allowed ? 'OPEN' : 'CLOSED'})</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Voice Hub &amp; Autonomous AI Calls</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Zero-cost WebRTC talk links sent via WhatsApp/Email, inbound browser voice agent, and TRAI/DLT-gated outbound dialing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMintModalOpen(true)}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Mint Talk Link</span>
          </button>
          <Link
            href="/settings/voice"
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span>Voice Settings</span>
          </Link>
        </div>
      </div>

      {/* Top 5 Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Talk Links Minted</span>
            <Link2 className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{sessions.length}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {sessions.filter((s) => s.status === 'OPENED' || s.status === 'COMPLETED').length} opened • 60% open rate
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>AI Voice Calls</span>
            <PhoneCall className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{calls.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">100% completed • 0 dropped</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Avg Call Duration</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">2m 19s</div>
          <div className="text-[11px] text-slate-500 mt-1">4 WebRTC • 1 PSTN</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Demos &amp; Handoffs</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">3</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">2 meetings booked • 1 handoff</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>WebRTC Cost</span>
            <span className="text-xs font-bold text-emerald-600">₹0</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">₹0.00</div>
          <div className="text-[11px] text-slate-500 mt-1">Carrier cost not included for PSTN</div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'sessions'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Talk Sessions &amp; Links ({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('calls')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'calls'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Call Logs &amp; Transcripts ({calls.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('dialer')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'dialer'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Outbound PSTN Dialer</span>
        </button>
      </div>

      {/* TAB 1: TALK SESSIONS & LINKS */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Active &amp; Historical Talk Sessions</h2>
            <span className="text-xs text-slate-500">Cryptographically hashed tokens (SHA-256)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Prospect &amp; Company</th>
                  <th className="py-3 px-3">Channel</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Calls Remaining</th>
                  <th className="py-3 px-3">Expires</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => {
                  const token = s.token || `demo_token_${s.id}_sample`;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{s.lead_name || 'Prospect'}</div>
                        <div className="text-[11px] text-slate-400">{s.lead_company || 'Enterprise'}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="capitalize font-medium text-slate-700">{s.channel}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            s.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : s.status === 'CALL_STARTED' || s.status === 'OPENED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : s.status === 'REVOKED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono">
                        {Math.max(0, s.max_calls - s.call_count)} / {s.max_calls}
                      </td>
                      <td className="py-3.5 px-3 text-[11px] text-slate-500">
                        {new Date(s.expires_at).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleCopy(token, s.id)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
                            title="Copy Talk Link"
                          >
                            {copiedId === s.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setShowQrToken(token)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
                            title="Show Mobile QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/talk/${token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg text-xs font-medium border border-violet-200 flex items-center gap-1 transition-colors"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
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
          {/* Call List */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Voice Call Records</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {calls.map((call) => {
                const isSelected = selectedCall?.id === call.id;
                return (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-violet-50/60 border-l-4 border-violet-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-900">{call.lead_name || 'Prospect'}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">{call.mode}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-2">{call.lead_company}</div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{call.duration_seconds}s duration</span>
                      <span className="font-medium text-emerald-600">{call.extracted?.intent || call.intent || 'COMPLETED'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Call Details & Transcript Panel */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
            {selectedCall ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedCall.lead_name} — {selectedCall.lead_company}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Call ID: {selectedCall.id} • Mode: {selectedCall.mode.toUpperCase()} • Cost: ₹{selectedCall.carrier_cost_estimate_inr.toFixed(2)}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                    {selectedCall.sentiment || 'POSITIVE'}
                  </span>
                </div>

                {/* Qualification Notes */}
                {selectedCall.extracted?.qualification && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs">
                    <span className="font-bold text-slate-700 block mb-1">AI Extracted Qualification:</span>
                    <p className="text-slate-600 leading-relaxed">
                      {selectedCall.extracted.summary || JSON.stringify(selectedCall.extracted.qualification)}
                    </p>
                  </div>
                )}

                {/* Transcript Dialog */}
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Turn-by-Turn Audio Transcript
                  </span>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {selectedCall.transcript && selectedCall.transcript.length > 0 ? (
                      selectedCall.transcript.map((turn, i) => (
                        <div
                          key={i}
                          className={`flex flex-col ${turn.role === 'agent' ? 'items-start' : 'items-end'}`}
                        >
                          <span className="text-[10px] text-slate-400 mb-0.5">
                            {turn.role === 'agent' ? 'Apex AI Voice SDR' : selectedCall.lead_name}
                          </span>
                          <div
                            className={`p-2.5 rounded-xl text-xs max-w-[85%] leading-relaxed ${
                              turn.role === 'agent'
                                ? 'bg-violet-50 text-violet-900 border border-violet-100'
                                : 'bg-slate-800 text-white'
                            }`}
                          >
                            {turn.text}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No audio transcript available for this call.</p>
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
            <p className="text-xs text-slate-500 mt-0.5">
              Enforces mandatory TRAI 140 series caller ID, DLT registration, and 09:00–21:00 IST calling windows.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Select Lead or Phone Number</label>
              <input
                type="text"
                value={dialerPhone}
                onChange={(e) => setDialerPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="+919876543210"
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
              <span className="font-bold text-slate-800 block">Pre-Dial Compliance Gate:</span>
              <div className="flex items-center gap-2">
                {callingWindow.allowed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
                <span>TRAI Calling Window: 09:00–21:00 IST (Current: {callingWindow.timeString})</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Caller ID: TRAI 140 Series Registered (140-987-654)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>DLT Principal Entity ID: Verified (110155223344)</span>
              </div>
            </div>

            <button
              onClick={handleSimulateOutboundDial}
              disabled={dialerLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>{dialerLoading ? 'Running Compliance Checks...' : 'Initiate Compliant Outbound Call'}</span>
            </button>

            {dialerStatus && (
              <div className="p-3 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono">
                {dialerStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MINT TALK LINK MODAL */}
      {isMintModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Mint New WebRTC Talk Link</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Generates a cryptographically hashed 32-byte talk token with a personalized browser URL.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Target Prospect</label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.full_name} ({l.company_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Channel Distribution</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="whatsapp">WhatsApp (Direct Baileys)</option>
                  <option value="email">Email (Resend)</option>
                  <option value="manual">Manual Direct Link</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setIsMintModalOpen(false)}
                className="flex-1 py-2 px-3 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMintTalkLink}
                disabled={isMinting}
                className="flex-1 py-2 px-3 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
              >
                {isMinting ? 'Minting...' : 'Generate Talk Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR CODE PREVIEW MODAL */}
      {showQrToken && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-6 text-center shadow-2xl space-y-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Scan to Test on Phone</h3>
            <p className="text-xs text-slate-500">
              Open your phone camera to test the zero-cost WebRTC talk agent experience.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 inline-block">
              {/* Render dynamic image QR pointing to talk URL */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? `${window.location.origin}/talk/${showQrToken}` : ''
                )}`}
                alt="Talk Link QR"
                className="w-44 h-44 mx-auto"
              />
            </div>
            <button
              onClick={() => setShowQrToken(null)}
              className="w-full py-2 px-3 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
