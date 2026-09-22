'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  QrCode,
  Smartphone,
  ShieldCheck,
  Zap,
  Clock,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Sparkles,
  Link2,
  Unlink,
} from 'lucide-react';
import { EvolutionWhatsAppEngine, WhatsAppInstance } from '../../lib/adapters/whatsapp-evolution';
import { clsx } from 'clsx';

export default function WhatsAppHubPage() {
  const [instance, setInstance] = useState<WhatsAppInstance>(EvolutionWhatsAppEngine.getInstance());
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Anti-Ban Settings State
  const [minDelay, setMinDelay] = useState(instance.antiBan.minDelaySeconds);
  const [maxDelay, setMaxDelay] = useState(instance.antiBan.maxDelaySeconds);
  const [aiVariation, setAiVariation] = useState(instance.antiBan.enableDynamicAiVariation);
  const [dailyLimit, setDailyLimit] = useState(instance.antiBan.dailyLimit);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Live Test Sandbox State
  const [testPhone, setTestPhone] = useState('+91 98765 43210');
  const [testName, setTestName] = useState('Rajesh Sharma');
  const [testCompany, setTestCompany] = useState('Bharat Forgings Ltd');
  const [testBaseMessage, setTestBaseMessage] = useState(
    'Saw your team expanding B2B operations in Pune. Would love to share a short case study on sales automation.'
  );
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);

  const handleGenerateQR = async () => {
    setIsLoading(true);
    const qr = await EvolutionWhatsAppEngine.generatePairingQR('apex_sales_01');
    setQrCodeUrl(qr);
    setInstance({ ...EvolutionWhatsAppEngine.getInstance() });
    setIsLoading(false);
  };

  const handleSimulatePair = () => {
    const updated = EvolutionWhatsAppEngine.confirmDeviceLink('+919876543210', 'Apex Sales Representative');
    setInstance({ ...updated });
    setQrCodeUrl(null);
  };

  const handleDisconnect = () => {
    const updated = EvolutionWhatsAppEngine.disconnect();
    setInstance({ ...updated });
    setQrCodeUrl(null);
  };

  const handleSaveAntiBan = () => {
    EvolutionWhatsAppEngine.updateAntiBanSettings({
      minDelaySeconds: minDelay,
      maxDelaySeconds: maxDelay,
      enableDynamicAiVariation: aiVariation,
      dailyLimit: dailyLimit,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleTestDispatch = async () => {
    setIsSending(true);
    setDispatchResult(null);

    const result = await EvolutionWhatsAppEngine.dispatchSafeMessage({
      instanceName: instance.name,
      recipientPhone: testPhone,
      recipientName: testName,
      recipientCompany: testCompany,
      baseMessageText: testBaseMessage,
    });

    setDispatchResult(result);
    setIsSending(false);
    setInstance({ ...EvolutionWhatsAppEngine.getInstance() });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-emerald-600" />
            WhatsApp Instance & Anti-Ban Architecture
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect personal or business WhatsApp via Baileys / Evolution API QR Code with enterprise anti-ban protection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border',
              instance.status === 'CONNECTED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            )}
          >
            <span
              className={clsx(
                'w-2 h-2 rounded-full',
                instance.status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              )}
            />
            {instance.status === 'CONNECTED' ? 'LINKED & ACTIVE' : 'AWAITING PAIRING'}
          </span>
        </div>
      </div>

      {/* Main Grid: Device Connection + Anti-Ban Defense */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Device Pairing & QR Scanner */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-indigo-600" />
                Device Pairing Hub (Baileys Multi-Device)
              </h2>
              <p className="text-xs text-slate-500">
                Scan with your phone to send autonomous SDR messages directly from your WhatsApp number.
              </p>
            </div>
            {instance.status === 'CONNECTED' && (
              <button
                onClick={handleDisconnect}
                className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Unlink className="w-3 h-3" /> Unlink
              </button>
            )}
          </div>

          {instance.status === 'CONNECTED' ? (
            <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  ✓
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{instance.profileName}</div>
                  <div className="text-xs font-semibold text-emerald-800">{instance.connectedPhone}</div>
                  <div className="text-[10px] text-slate-500">Instance: {instance.name} · Protocol: Baileys WebSockets</div>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs text-emerald-900">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Session Healthy
                </span>
                <span className="font-semibold">Warm-up: {instance.antiBan.sentToday}/{instance.antiBan.dailyLimit} Sent Today</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl space-y-4 text-center">
              {qrCodeUrl ? (
                <div className="space-y-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCodeUrl} alt="WhatsApp QR Code" className="w-48 h-48 mx-auto" />
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    1. Open WhatsApp on your phone<br />
                    2. Go to <strong>Settings &gt; Linked Devices</strong><br />
                    3. Tap <strong>Link a Device</strong> and point your camera at this QR code
                  </p>
                  <button
                    onClick={handleSimulatePair}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    Confirm Device Linked (Test Mode)
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <QrCode className="w-12 h-12 text-slate-400 mx-auto" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">No Active WhatsApp Session</h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Generate a QR code to link your team&apos;s WhatsApp number.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateQR}
                    disabled={isLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 mx-auto transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin')} />
                    <span>{isLoading ? 'Generating...' : 'Generate New Pairing QR'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Baileys Instructions */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1 leading-relaxed">
            <span className="font-bold text-slate-800 block text-xs">Why use Baileys / Evolution API?</span>
            <p>
              • <strong>Bypasses Meta Template Restrictions:</strong> Send flexible, conversational messages without waiting for 24-hour template approvals.
            </p>
            <p>
              • <strong>₹0 Provider Surcharges:</strong> Runs directly over WhatsApp Web protocol without per-message Meta utility/marketing fees.
            </p>
          </div>
        </div>

        {/* Right: Anti-Ban Defense Shield Configuration */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Anti-Ban Protection Shield
              </h2>
              <p className="text-xs text-slate-500">
                Multi-layer algorithmic defenses designed to prevent WhatsApp account blocks.
              </p>
            </div>
            <button
              onClick={handleSaveAntiBan}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              Save Shield Settings
            </button>
          </div>

          {settingsSaved && (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Anti-Ban settings updated successfully.
            </div>
          )}

          <div className="space-y-4 text-xs">
            {/* Feature 1: Random Jitter Delay */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" /> Randomized Human Typing Delays
                </span>
                <span className="font-mono text-indigo-600 font-bold">
                  {minDelay}s — {maxDelay}s
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Randomizes pause duration between consecutive outbound messages to simulate realistic human typing and avoid automated bot detection.
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

            {/* Feature 2: AI Dynamic Message Variation */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> AI Dynamic Paraphrasing (Anti-Hash Shield)
                </span>
                <input
                  type="checkbox"
                  checked={aiVariation}
                  onChange={(e) => setAiVariation(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Uses Groq Llama-3 to dynamically re-phrase every single outbound message. No two prospects ever receive identical message text, preventing Meta broadcast spam bans.
              </p>
            </div>

            {/* Feature 3: Daily Warm-Up Rate Limiter */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600" /> Daily Warm-Up Safeguard
                </span>
                <span className="font-mono text-emerald-700 font-bold">{dailyLimit} / day</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Automatically halts outreach once your daily quota is reached, protecting freshly linked numbers from sudden volume spikes.
              </p>
              <input
                type="range"
                min="10"
                max="150"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Sandbox: Test Anti-Ban Dispatch */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            Live Anti-Ban WhatsApp Dispatch Sandbox
          </h2>
          <p className="text-xs text-slate-500">
            Test the live pipeline: see how Groq synthesizes a unique variant on the fly and applies randomized timing jitter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Recipient Phone (+91)</label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 focus:outline-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Prospect Full Name</label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 focus:outline-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Company Name</label>
            <input
              type="text"
              value={testCompany}
              onChange={(e) => setTestCompany(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2 focus:outline-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-700 font-semibold mb-1">Base Message Concept</label>
          <textarea
            rows={2}
            value={testBaseMessage}
            onChange={(e) => setTestBaseMessage(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-indigo-500"
          />
        </div>

        <button
          onClick={handleTestDispatch}
          disabled={isSending}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{isSending ? 'Synthesizing Unique AI Variant & Applying Jitter...' : 'Test AI Anti-Ban Dispatch'}</span>
        </button>

        {dispatchResult && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Dispatched Successfully
              </span>
              <span className="font-mono text-slate-500 text-[11px]">
                Randomized Jitter: {dispatchResult.delayAppliedSeconds}s Delay Applied
              </span>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-800 font-sans leading-relaxed">
              <span className="font-semibold text-slate-400 text-[10px] block mb-1">AI Generated Unique Content:</span>
              &ldquo;{dispatchResult.dispatchedMessage}&rdquo;
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Message ID: {dispatchResult.messageId}</span>
              <span>Account Protected: Unique Text Hash Verified</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
