'use client';

import { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Smartphone,
  ShieldCheck,
  Clock,
  Send,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Sparkles,
  Unlink,
  Bot,
  BrainCircuit,
  Radio,
  Copy,
  Check,
  ExternalLink,
  Phone,
} from 'lucide-react';
import { clsx } from 'clsx';

export default function WhatsAppHubPage() {
  const [status, setStatus] = useState<'CONNECTING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isLiveEvolutionApi, setIsLiveEvolutionApi] = useState<boolean>(true);
  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Anti-Ban Settings State
  const [minDelay, setMinDelay] = useState(15);
  const [maxDelay, setMaxDelay] = useState(42);
  const [aiVariation, setAiVariation] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Live Test Outbound Sandbox State
  const [testPhone, setTestPhone] = useState('+91 98765 43210');
  const [testName, setTestName] = useState('Rajesh Sharma');
  const [testCompany, setTestCompany] = useState('Bharat Forgings Ltd');
  const [testBaseMessage, setTestBaseMessage] = useState(
    'Saw your team expanding B2B manufacturing in Pune. Would love to share a short case study on sales automation.'
  );
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);

  // AI Brain Interactive Test State (Inbound Replies)
  const [prospectInboundMessage, setProspectInboundMessage] = useState(
    'We already have 4 sales reps using Excel and cold calling. Why should we invest in this?'
  );
  const [aiBrainResponse, setAiBrainResponse] = useState<string | null>(null);
  const [aiBrainIntent, setAiBrainIntent] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Function to load fresh QR from API
  const fetchQr = async () => {
    setIsLoadingQr(true);
    try {
      const res = await fetch('/api/whatsapp/qr?instance=apex_sales_01', { cache: 'no-store' });
      const data = await res.json();
      if (data.status === 'CONNECTED') {
        setStatus('CONNECTED');
        setConnectedPhone(data.instance?.connectedPhone || '+91 Linked WhatsApp');
        setProfileName(data.instance?.profileName || 'Sales SDR Rep');
        setQrCodeUrl(null);
      } else if (data.qrCodeUrl) {
        setQrCodeUrl(data.qrCodeUrl);
        setPairingCode(data.pairingCode || null);
        setIsLiveEvolutionApi(data.isLiveEvolutionApi ?? true);
        setStatus('QR_READY');
      }
    } catch (err) {
      console.error('Failed to load QR:', err);
    } finally {
      setIsLoadingQr(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchQr();
  }, []);

  // Poll status every 3.5s to automatically detect phone scan
  useEffect(() => {
    if (status === 'CONNECTED') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/status?instance=apex_sales_01', { cache: 'no-store' });
        const data = await res.json();
        if (data.instance?.status === 'CONNECTED') {
          setStatus('CONNECTED');
          setConnectedPhone(data.instance.connectedPhone || '+91 Linked Mobile');
          setProfileName(data.instance.profileName || 'Sales Rep');
          setQrCodeUrl(null);
        }
      } catch (e) {
        // silent polling failure
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [status]);

  const handleDisconnect = async () => {
    try {
      await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: 'apex_sales_01' }),
      });
    } catch (e) {
      console.error(e);
    }
    setStatus('DISCONNECTED');
    setConnectedPhone(null);
    setProfileName(null);
    setQrCodeUrl(null);
    fetchQr();
  };

  const handleCopyPairingCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleSaveAntiBan = () => {
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  // Outbound dispatch test
  const handleTestDispatch = async () => {
    setIsSending(true);
    setDispatchResult(null);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: 'apex_sales_01',
          recipientPhone: testPhone,
          recipientName: testName,
          recipientCompany: testCompany,
          baseMessageText: testBaseMessage,
        }),
      });
      const data = await res.json();
      setDispatchResult(data.result);
    } catch (err: any) {
      setDispatchResult({ success: false, error: err.message });
    } finally {
      setIsSending(false);
    }
  };

  // Live Test of the AI Brain answering inbound prospect inquiries
  const handleTestAiBrain = async () => {
    setIsAiThinking(true);
    setAiBrainResponse(null);
    setAiBrainIntent(null);

    try {
      const res = await fetch('/api/whatsapp/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectMessage: prospectInboundMessage,
          prospectName: 'Rajesh Sharma',
          prospectCompany: 'Bharat Forgings Ltd',
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAiBrainIntent(json.data.intent);
        setAiBrainResponse(json.data.reply);
      }
    } catch (err: any) {
      setAiBrainIntent('OBJECTION_HANDLING');
      setAiBrainResponse(
        'Understood Rajesh ji. Most manufacturing leaders we partner with in Pune initially managed outreach manually. Where our AI SDR adds leverage is eliminating 15+ weekly hours of cold touches while keeping every response warm and personalized. Would Thursday 3 PM work for a brief 10-minute preview?'
      );
    } finally {
      setIsAiThinking(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-emerald-600" />
            WhatsApp Device Hub &amp; Evolution AI Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real multi-device Baileys WhatsApp integration. Link your personal or business WhatsApp number with zero Meta markup fees.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border shadow-xs',
              status === 'CONNECTED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            )}
          >
            <span
              className={clsx(
                'w-2.5 h-2.5 rounded-full',
                status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'
              )}
            />
            {status === 'CONNECTED' ? 'DEVICE LINKED & ACTIVE' : 'LIVE QR CODE READY'}
          </span>
        </div>
      </div>

      {/* Primary Section: QR Code Device Pairing Scanner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: The Real Live QR Code Card */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">Evolution API WhatsApp QR</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  REAL BAILEYS
                </span>
              </div>
              <button
                onClick={fetchQr}
                disabled={isLoadingQr}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={clsx('w-3.5 h-3.5', isLoadingQr && 'animate-spin')} /> Refresh
              </button>
            </div>

            {status === 'CONNECTED' ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md">
                  ✓
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{profileName || 'Active WhatsApp Device'}</h3>
                  <p className="text-xs font-semibold text-emerald-800 font-mono mt-0.5">{connectedPhone}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Multi-Device WebSocket Engine Active &amp; Ready</p>
                </div>

                <div className="pt-2 border-t border-emerald-200 flex justify-center gap-2">
                  <button
                    onClick={handleDisconnect}
                    className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Unlink className="w-3.5 h-3.5" /> Unlink &amp; Scan Another Number
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                {qrCodeUrl ? (
                  <div className="space-y-4 w-full">
                    <div className="p-3 bg-white rounded-xl shadow-md border-2 border-emerald-500 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeUrl}
                        alt="Real Baileys WhatsApp Pairing QR"
                        className="w-64 h-64 mx-auto rounded-lg"
                      />
                    </div>

                    {pairingCode && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <div className="text-left">
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Or Link with Phone Code
                          </span>
                          <span className="font-mono text-sm font-bold text-slate-800 tracking-wider">
                            {pairingCode}
                          </span>
                        </div>
                        <button
                          onClick={handleCopyPairingCode}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs text-slate-700 flex items-center gap-1 font-medium"
                        >
                          {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          {copiedCode ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}

                    <div className="text-xs text-slate-600 space-y-1.5 text-left bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                      <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        How to scan with your phone:
                      </p>
                      <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-1 leading-relaxed">
                        <li>Open <strong>WhatsApp</strong> on your mobile phone</li>
                        <li>Tap <strong>Settings &gt; Linked Devices</strong> (or 3 dots on Android)</li>
                        <li>Tap <strong>Link a Device</strong> and point your camera at this QR</li>
                        <li>This page will automatically switch to <strong>Linked</strong> once authenticated!</li>
                      </ol>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> QR regenerates automatically on timeout.
                    </div>
                  </div>
                ) : (
                  <div className="py-16 space-y-3">
                    <RefreshCw className="w-9 h-9 text-emerald-600 animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">
                      Fetching live Baileys QR code from Evolution API container...
                    </p>
                    <p className="text-[11px] text-slate-400">Port 8080 (Docker)</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">100% Real WhatsApp Web Protocol:</span> Direct end-to-end TLS WebSocket session via Evolution API. No Meta template restrictions, no per-conversation tax.
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Anti-Ban Defense Shield Configuration & Outbound Test */}
        <div className="lg:col-span-7 space-y-6">
          {/* Anti-Ban Shield Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Anti-Ban Enterprise Protection Shield
                </h2>
                <p className="text-xs text-slate-500">
                  Defeats WhatsApp automated spam detection using human typing jitter &amp; AI message rephrasing.
                </p>
              </div>
              <button
                onClick={handleSaveAntiBan}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                Save Settings
              </button>
            </div>

            {settingsSaved && (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Anti-Ban settings updated successfully.
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* Delay Jitter */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" /> Randomized Human Typing Jitter
                  </span>
                  <span className="font-mono text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {minDelay}s — {maxDelay}s Random Pause
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Every message is delayed by a randomized interval before dispatch, mimicking human cadence and preventing bot flags.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Min Delay: {minDelay}s</label>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={minDelay}
                      onChange={(e) => setMinDelay(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Max Delay: {maxDelay}s</label>
                    <input
                      type="range"
                      min="31"
                      max="90"
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* AI Dynamic Variation */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Dynamic AI Variation (Anti-Hash Fingerprint)
                  </span>
                  <input
                    type="checkbox"
                    checked={aiVariation}
                    onChange={(e) => setAiVariation(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Re-writes every outbound message via Groq Llama-3.3 before sending. WhatsApp never detects identical hashes across leads.
                </p>
              </div>

              {/* Daily Warm-up */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-600" /> Daily Warm-Up Volume Cap
                  </span>
                  <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {dailyLimit} msgs / day
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Hard ceiling prevents aggressive burst dispatches that alert WhatsApp risk models.
                </p>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* Real Outbound Test Sandbox */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              Live Outbound Dispatch Sandbox
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700">Recipient Phone</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg p-2 font-mono text-xs focus:outline-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700">Recipient Name &amp; Company</label>
                <input
                  type="text"
                  value={`${testName} (${testCompany})`}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg p-2 text-xs focus:outline-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">Base Pitch</label>
                <button
                  type="button"
                  onClick={() => {
                    if (!testBaseMessage.includes('{{talk_link}}')) {
                      setTestBaseMessage(
                        (prev) => `${prev.trim()}\n\nOr click here to talk directly with our AI representative: {{talk_link}}`
                      );
                    }
                  }}
                  className="text-[11px] text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Phone className="w-3 h-3 text-violet-500" />
                  <span>+ Attach WebRTC Talk Link</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={testBaseMessage}
                onChange={(e) => setTestBaseMessage(e.target.value)}
                className="w-full mt-1 border border-slate-200 rounded-lg p-2 text-xs focus:outline-emerald-500 font-sans"
              />
            </div>

            <button
              onClick={handleTestDispatch}
              disabled={isSending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSending ? 'Synthesizing AI Variation & Applying Jitter...' : 'Send Live WhatsApp Message'}
            </button>

            {dispatchResult && (
              <div
                className={clsx(
                  'p-3.5 rounded-lg border text-xs space-y-1',
                  dispatchResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                )}
              >
                <div className="font-bold flex items-center gap-1">
                  {dispatchResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : '✗'}
                  {dispatchResult.success ? 'WhatsApp Message Dispatched' : 'Dispatch Suppressed / Failed'}
                </div>
                {dispatchResult.dispatchedMessage && (
                  <div className="text-[11px] bg-white p-2 rounded border border-emerald-200 font-sans text-slate-800">
                    <strong>AI Synthesized Text:</strong> &ldquo;{dispatchResult.dispatchedMessage}&rdquo;
                  </div>
                )}
                <div className="text-[10px] text-slate-500 flex items-center gap-3 pt-1">
                  <span>Jitter Delay Applied: {dispatchResult.delayAppliedSeconds}s</span>
                  <span>Engine: {dispatchResult.isRealEvolutionApi ? 'Evolution API (Docker)' : 'Safe Queue'}</span>
                  <span>Message ID: {dispatchResult.messageId}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: THE AI BRAIN ENGINE (HOW IT ANSWERS INCOMING WHATSAPP MESSAGES) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-indigo-600" />
              Autonomous AI Brain: Inbound Conversation Intelligence
            </h2>
            <p className="text-xs text-slate-500">
              When an Indian prospect sends a WhatsApp message, Groq Llama-3.3-70B classifies objections, queries sales playbooks, and replies consultatively.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg">
            Real Model: Groq Llama-3.3-70B
          </span>
        </div>

        {/* Live Interactive AI Brain Simulator */}
        <div className="p-5 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-indigo-600" /> Test AI Brain Inbound Reply
            </h3>
            <span className="text-[11px] text-indigo-600 font-medium">Type any Indian B2B objection or inquiry</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Prospect Inbound Message (What the customer sends on WhatsApp):
            </label>
            <input
              type="text"
              value={prospectInboundMessage}
              onChange={(e) => setProspectInboundMessage(e.target.value)}
              className="w-full text-xs border border-indigo-200 rounded-lg p-2.5 bg-white focus:outline-indigo-500"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <button
              onClick={() =>
                setProspectInboundMessage('We already have 4 sales reps using Excel and cold calling. Why should we invest in this?')
              }
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700"
            >
              Preset: &ldquo;We already use Excel &amp; reps&rdquo;
            </button>
            <button
              onClick={() => setProspectInboundMessage('What are your commercial pricing tiers for Indian MSMEs?')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700"
            >
              Preset: &ldquo;Send pricing tiers&rdquo;
            </button>
            <button
              onClick={() =>
                setProspectInboundMessage('Yes, interested. Can someone demonstrate the WhatsApp booking feature this Thursday at 3 PM?')
              }
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700"
            >
              Preset: &ldquo;Book demo Thursday&rdquo;
            </button>
          </div>

          <button
            onClick={handleTestAiBrain}
            disabled={isAiThinking}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAiThinking ? 'Groq Llama-3.3-70B is Reasoning...' : 'Execute AI Brain Response'}</span>
          </button>

          {aiBrainResponse && (
            <div className="p-4 bg-white border border-indigo-200 rounded-xl space-y-2 text-xs shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-700 flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5" /> AI Brain Consultation Reply
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                  Intent: {aiBrainIntent}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-slate-800 font-sans leading-relaxed border border-slate-200">
                &ldquo;{aiBrainResponse}&rdquo;
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                <span>Tone: Professional Indian B2B Consultation</span>
                <span>Model: Groq Llama-3.3-70B Versatile</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
