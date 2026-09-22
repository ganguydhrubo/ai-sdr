'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Radio,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DograhDriver, CallState, TranscriptTurn } from './dograh-driver';

interface TalkClientInterfaceProps {
  token: string;
  context: {
    leadFirstName: string;
    companyName: string;
    orgName: string;
    agentName: string;
    language: string;
    channel: string;
    callsRemaining: number;
    expiresAt: string;
    status: string;
  };
}

export default function TalkClientInterface({
  token,
  context,
}: TalkClientInterfaceProps) {
  const [consentChecked, setConsentChecked] = useState(false);
  const [language, setLanguage] = useState<string>(context.language || 'en');
  const [callState, setCallState] = useState<CallState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true);
  const [callSummary, setCallSummary] = useState<string | null>(null);
  const [optOutConfirmed, setOptOutConfirmed] = useState(false);
  const [optOutLoading, setOptOutLoading] = useState(false);
  const [showOptOutModal, setShowOptOutModal] = useState(false);

  const driverRef = useRef<DograhDriver | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const driver = new DograhDriver({
      token,
      language,
      onStateChange: (state, details) => {
        setCallState(state);
        if (details) setStatusMessage(details);
      },
      onTranscriptTurn: (turn) => {
        setTranscript((prev) => [...prev, turn]);
      },
      onCallComplete: (summary) => {
        setCallSummary(summary);
      },
    });

    driver.loadScript();
    driverRef.current = driver;

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      driver.endCall();
    };
  }, [token, language]);

  // Duration timer
  useEffect(() => {
    if (['connecting', 'connected', 'speaking', 'listening'].includes(callState)) {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [callState]);

  const handleStartCall = async () => {
    if (!consentChecked) return;

    try {
      // Request fresh single-use call nonce
      const res = await fetch(`/api/talk/${token}/nonce`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.nonce) {
        setStatusMessage(data.error || 'Failed to start call. Please try again.');
        setCallState('error');
        return;
      }

      await driverRef.current?.startCall(
        data.nonce,
        context.leadFirstName,
        context.companyName
      );
    } catch {
      setStatusMessage('Network connection failure. Please check your audio connection.');
      setCallState('error');
    }
  };

  const handleEndCall = () => {
    driverRef.current?.endCall();
  };

  const handleOptOut = async () => {
    setOptOutLoading(true);
    try {
      await fetch(`/api/talk/${token}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'opt_out',
          reason: 'Prospect 1-click opt out on talk page',
        }),
      });
      setOptOutConfirmed(true);
      setShowOptOutModal(false);
      setCallState('ended');
    } catch {
      // ignore
    } finally {
      setOptOutLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };

  if (optOutConfirmed) {
    return (
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
          <CheckCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Unsubscribed & Suppressed</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Your request has been registered in our National DND/TRAI compliance registry.
          No further automated emails, WhatsApp messages, or phone calls will be initiated.
        </p>
        <p className="text-xs text-slate-500">
          Reference Org: {context.orgName} • Compliance ID: DPDP-OPT-2026
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-2xl flex flex-col gap-5">
      {/* Header & Org Info */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            {context.orgName}
          </span>
          <h1 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>{context.agentName}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active</span>
        </div>
      </div>

      {/* Greeting Banner */}
      <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-200">
          Namaste, {context.leadFirstName}!
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Exploring B2B sales automation solutions for{' '}
          <span className="text-slate-300 font-medium">{context.companyName}</span>.
        </p>
      </div>

      {/* Mandatory AI Disclosure (DPDP/TRAI Compliance) */}
      <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 sm:p-4 text-xs text-amber-200/90 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-amber-300">Statutory AI Voice Disclosure:</strong> You are
          speaking with an Artificial Intelligence SDR representative developed by {context.orgName}.
          This conversation is processed and transcribed to service your sales enquiry.
        </div>
      </div>

      {/* Interactive Calling State */}
      {callState === 'idle' && (
        <div className="flex flex-col gap-4">
          {/* Language selector */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Preferred Language:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="bn">বাংলা (Bengali)</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>

          {/* Consent Checkbox */}
          <label className="flex items-start gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-blue-600 rounded bg-slate-800 border-slate-700 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-300 leading-normal">
              I consent to speaking with an AI assistant and allow real-time call transcription for this session.
            </span>
          </label>

          {/* Start Call CTA */}
          <button
            onClick={handleStartCall}
            disabled={!consentChecked}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg ${
              consentChecked
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Mic className="w-5 h-5" />
            <span>Start Voice Call (WebRTC)</span>
          </button>
          <p className="text-[11px] text-center text-slate-500">
            Zero carrier phone charges • Connects directly through your browser
          </p>
        </div>
      )}

      {/* Active Call UI */}
      {['requesting_permission', 'connecting', 'connected', 'speaking', 'listening'].includes(callState) && (
        <div className="flex flex-col items-center gap-5 py-4">
          {/* Animated Waveform & Status */}
          <div className="relative flex flex-col items-center">
            <div className="relative w-28 h-28 rounded-full flex items-center justify-center bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30">
              <div
                className={`absolute inset-0 rounded-full border-2 border-blue-500/40 ${
                  callState === 'speaking' || callState === 'listening' ? 'animate-ping' : ''
                }`}
              />
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/50">
                <Volume2 className="w-8 h-8 animate-pulse" />
              </div>
            </div>

            {/* Audio Waveform Bars */}
            <div className="flex items-center gap-1.5 mt-4 h-8">
              {[40, 75, 100, 60, 90, 45, 80, 55, 30].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 bg-blue-400 rounded-full transition-all duration-150 ${
                    callState === 'speaking' ? 'animate-pulse' : 'opacity-40'
                  }`}
                  style={{
                    height:
                      callState === 'speaking' || callState === 'listening'
                        ? `${Math.max(12, (h * (isMuted ? 0.2 : 1)) / 3)}px`
                        : '8px',
                  }}
                />
              ))}
            </div>

            {/* Timer and Status text */}
            <div className="mt-3 text-center">
              <div className="text-xl font-mono font-bold text-slate-100">
                {formatTime(duration)}
              </div>
              <div className="text-xs font-medium text-blue-400 mt-0.5">
                {callState === 'speaking'
                  ? 'Apex AI is speaking...'
                  : callState === 'listening'
                  ? 'Listening to you...'
                  : statusMessage || 'Connecting audio channel...'}
              </div>
            </div>
          </div>

          {/* In-Call Controls */}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3.5 rounded-full border transition-colors ${
                isMuted
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={handleEndCall}
              className="py-3 px-6 bg-red-600 hover:bg-red-500 text-white rounded-full font-semibold text-sm flex items-center gap-2 shadow-lg shadow-red-600/30 transition-colors"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Call</span>
            </button>
          </div>
        </div>
      )}

      {/* Call Completed Summary Card */}
      {callState === 'ended' && (
        <div className="flex flex-col gap-4 bg-slate-950/60 border border-slate-800 rounded-2xl p-5 text-center">
          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Call Concluded</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {callSummary || 'Thank you for connecting with our AI representative.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 mt-1">
            <a
              href="https://cal.com/apex-enterprise/discovery"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <Calendar className="w-4 h-4" />
              <span>Confirm 15-Min Meeting</span>
            </a>
            <button
              onClick={() => {
                setCallState('idle');
                setTranscript([]);
                setDuration(0);
                setCallSummary(null);
              }}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition-colors"
            >
              Restart Call
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {callState === 'error' && (
        <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 text-xs text-red-300">
          <div className="font-semibold text-red-400 mb-1">Audio Connection Issue</div>
          <div>{statusMessage || 'Unable to establish WebRTC voice channel.'}</div>
          <button
            onClick={() => setCallState('idle')}
            className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Live Transcript Drawer */}
      {transcript.length > 0 && (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/40">
          <button
            onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors bg-slate-900/50"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Real-Time Transcript ({transcript.length} turns)</span>
            </div>
            {isTranscriptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {isTranscriptOpen && (
            <div className="p-3 max-h-48 overflow-y-auto space-y-2.5 text-xs">
              {transcript.map((turn, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${turn.role === 'agent' ? 'items-start' : 'items-end'}`}
                >
                  <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1">
                    <span>{turn.role === 'agent' ? 'Apex AI' : context.leadFirstName}</span>
                    <span>•</span>
                    <span>{turn.time}</span>
                  </div>
                  <div
                    className={`px-3 py-2 rounded-xl max-w-[85%] leading-relaxed ${
                      turn.role === 'agent'
                        ? 'bg-slate-800 text-slate-200 border border-slate-700/60'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {turn.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alternative Options & TRAI Footer */}
      <div className="border-t border-slate-800/80 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
        <a
          href="mailto:outreach@apextech.in"
          className="hover:text-slate-300 transition-colors"
        >
          Prefer to email? outreach@apextech.in
        </a>
        <button
          onClick={() => setShowOptOutModal(true)}
          className="text-slate-400 hover:text-red-400 transition-colors underline decoration-slate-700"
        >
          Opt out / Do Not Contact (TRAI/DND)
        </button>
      </div>

      {/* 1-Click Opt-Out Confirmation Modal */}
      {showOptOutModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 text-center shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">Confirm Opt-Out</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              We respect your privacy. Clicking confirm will permanently suppress your contact record
              across Email, WhatsApp, and Voice communications under DPDP & TRAI regulations.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowOptOutModal(false)}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleOptOut}
                disabled={optOutLoading}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {optOutLoading ? 'Processing...' : 'Confirm Opt-Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
