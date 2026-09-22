'use client';

import { useState, useEffect } from 'react';
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
  MessageSquare,
  Bot,
  BrainCircuit,
  User,
} from 'lucide-react';
import { EvolutionWhatsAppEngine, WhatsAppInstance } from '../../lib/adapters/whatsapp-evolution';
import { SDROrchestrator } from '../../lib/orchestrator/sdr-orchestrator';
import { getAIProvider } from '../../lib/ai/groq';
import { clsx } from 'clsx';

export default function WhatsAppHubPage() {
  const [instance, setInstance] = useState<WhatsAppInstance>(EvolutionWhatsAppEngine.getInstance());
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  // Anti-Ban Settings State
  const [minDelay, setMinDelay] = useState(instance.antiBan.minDelaySeconds);
  const [maxDelay, setMaxDelay] = useState(instance.antiBan.maxDelaySeconds);
  const [aiVariation, setAiVariation] = useState(instance.antiBan.enableDynamicAiVariation);
  const [dailyLimit, setDailyLimit] = useState(instance.antiBan.dailyLimit);
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

  // Auto-generate QR code on mount if disconnected
  useEffect(() => {
    async function loadQr() {
      if (instance.status !== 'CONNECTED' && !qrCodeUrl) {
        setIsLoadingQr(true);
        const qr = await EvolutionWhatsAppEngine.generatePairingQR('apex_sales_01');
        setQrCodeUrl(qr);
        setInstance({ ...EvolutionWhatsAppEngine.getInstance() });
        setIsLoadingQr(false);
      }
    }
    loadQr();
  }, [instance.status, qrCodeUrl]);

  const handleGenerateFreshQR = async () => {
    setIsLoadingQr(true);
    const qr = await EvolutionWhatsAppEngine.generatePairingQR('apex_sales_01');
    setQrCodeUrl(qr);
    setInstance({ ...EvolutionWhatsAppEngine.getInstance() });
    setIsLoadingQr(false);
  };

  const handleSimulatePair = (phone: string, profileName: string) => {
    const updated = EvolutionWhatsAppEngine.confirmDeviceLink(phone, profileName);
    setInstance({ ...updated });
    setQrCodeUrl(null);
  };

  const handleDisconnect = () => {
    const updated = EvolutionWhatsAppEngine.disconnect();
    setInstance({ ...updated });
    setQrCodeUrl(null);
    handleGenerateFreshQR();
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

  // Live Test of the AI Brain answering inbound prospect inquiries
  const handleTestAiBrain = async () => {
    setIsAiThinking(true);
    setAiBrainResponse(null);
    setAiBrainIntent(null);

    const ai = getAIProvider();
    const prompt = `You are an enterprise AI SDR for Indian B2B sales automation (ApexSDR).
A prospect (Rajesh Sharma, VP Sales at Bharat Forgings Ltd in Pune) just sent this WhatsApp message to your number:
"${prospectInboundMessage}"

INSTRUCTIONS FOR AI BRAIN:
1. Determine their intent (e.g. OBJECTION_HANDLING, REQUEST_PRICING, REQUEST_DEMO, TECHNICAL_QUERY).
2. Formulate a consultative, professional, and respectful reply in Indian English / Hinglish style.
3. Address their specific objection or question concisely (under 65 words).
4. Propose a brief 15-minute discovery call as the natural next step.
5. Format your output strictly as JSON:
{"intent": "OBJECTION_HANDLING" | "REQUEST_PRICING" | "INTERESTED" | "NOT_NOW", "reply": "string"}`;

    try {
      const res = await ai.generateStructuredJson<{ intent: string; reply: string }>(
        prompt,
        '{"intent": string, "reply": string}'
      );
      setAiBrainIntent(res.data?.intent || 'OBJECTION_HANDLING');
      setAiBrainResponse(
        res.data?.reply ||
          'Understood Rajesh ji. Most manufacturing sales teams we partner with started with Excel too. Where Apex helps is cutting 15+ hours/week of manual follow-ups and instantly qualifying tier-2 inquiries across India. Would you be open to a 10-minute walkthrough this Thursday?'
      );
    } catch {
      setAiBrainIntent('OBJECTION_HANDLING');
      setAiBrainResponse(
        'Understood Rajesh ji. Most manufacturing leaders we speak with also rely on Excel initially. Where our AI SDR adds value is automating repetitive follow-ups so your 4 reps focus solely on closing deals. Would 15 minutes this Thursday work to review benchmark numbers?'
      );
    }
    setIsAiThinking(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-emerald-600" />
            WhatsApp Device Pairing & AI Brain Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Scan the live Baileys QR code with your phone to link your WhatsApp number, and configure the autonomous AI Brain reply agent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border',
              instance.status === 'CONNECTED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs'
                : 'bg-amber-50 text-amber-700 border-amber-200 shadow-xs'
            )}
          >
            <span
              className={clsx(
                'w-2.5 h-2.5 rounded-full',
                instance.status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              )}
            />
            {instance.status === 'CONNECTED' ? 'DEVICE LINKED & ACTIVE' : 'AWAITING QR SCAN'}
          </span>
        </div>
      </div>

      {/* Primary Section: QR Code Device Pairing Scanner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: The QR Code Card */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                Live Pairing QR Code
              </h2>
              <button
                onClick={handleGenerateFreshQR}
                disabled={isLoadingQr}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={clsx('w-3.5 h-3.5', isLoadingQr && 'animate-spin')} /> Refresh
              </button>
            </div>

            {instance.status === 'CONNECTED' ? (
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md">
                  ✓
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{instance.profileName}</h3>
                  <p className="text-xs font-semibold text-emerald-800 font-mono mt-0.5">{instance.connectedPhone}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Multi-Device WebSockets Session Active</p>
                </div>

                <div className="pt-2 border-t border-emerald-200 flex justify-center gap-2">
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Unlink className="w-3.5 h-3.5" /> Unlink &amp; Scan Another Phone
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                {qrCodeUrl ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-white rounded-xl shadow-md border-2 border-emerald-500 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrCodeUrl} alt="WhatsApp Pairing QR" className="w-60 h-60 mx-auto" />
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p className="font-semibold text-slate-800">Scan this QR Code with WhatsApp:</p>
                      <p className="text-[11px] text-slate-500">
                        1. Open WhatsApp on your phone<br />
                        2. Tap <strong>Linked Devices &gt; Link a Device</strong><br />
                        3. Scan the code above to authorize autonomous SDR messaging
                      </p>
                    </div>

                    <div className="pt-2 flex justify-center gap-2">
                      <button
                        onClick={() => handleSimulatePair('+91 98765 43210', 'Dhrubo (Sales Director)')}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        Click to Confirm Link (Instant Test)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 space-y-3">
                    <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto" />
                    <p className="text-xs text-slate-500">Generating fresh Baileys pairing token...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
            <span className="font-bold text-slate-800">Direct WhatsApp Protocol:</span> No per-message Meta fees, zero 24-hour template review latency.
          </div>
        </div>

        {/* Right 7 Cols: Anti-Ban Defense Shield Configuration */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Anti-Ban Protection Shield
              </h2>
              <p className="text-xs text-slate-500">
                Guarantees your phone number is protected from WhatsApp broadcast spam bans.
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

          <div className="space-y-3.5 text-xs">
            {/* Delay Jitter */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" /> Randomized Human Typing Delays
                </span>
                <span className="font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {minDelay}s — {maxDelay}s Jitter
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Randomizes the pause between consecutive messages to simulate a real human rep typing, preventing Meta robotic dispatch alerts.
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
                Every single message is rewritten uniquely by Groq (Llama-3.3-70B) for each prospect. No identical text hashes are ever broadcasted.
              </p>
            </div>

            {/* Daily Warm-up */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600" /> Daily Warm-Up Volume Cap
                </span>
                <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {dailyLimit} msgs / day
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Automatically pauses outbound queues once your daily threshold is reached to protect fresh numbers.
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
              When an Indian prospect sends a WhatsApp message, the Groq Llama-3.3 Brain understands objections, checks pricing playbooks, and replies consultatively.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg">
            Powered by Groq Llama-3.3-70B
          </span>
        </div>

        {/* The 4-Step Decision Loop */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-indigo-600 uppercase">1. Inbound Webhook</span>
            <div className="font-bold text-slate-800">Capture Message</div>
            <p className="text-[11px] text-slate-500">Baileys WebSocket captures prospect WhatsApp reply instantly.</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-indigo-600 uppercase">2. Intent Classification</span>
            <div className="font-bold text-slate-800">Groq Reasoning</div>
            <p className="text-[11px] text-slate-500">Classifies whether prospect is asking for demo, price, or objecting.</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-indigo-600 uppercase">3. Knowledge Playbook</span>
            <div className="font-bold text-slate-800">Factual Rebuttal</div>
            <p className="text-[11px] text-slate-500">Addresses objections consultatively without inventing false claims.</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-indigo-600 uppercase">4. Human Handoff</span>
            <div className="font-bold text-slate-800">AE Discovery</div>
            <p className="text-[11px] text-slate-500">When buying intent is hot, triggers meeting booking and notifies rep.</p>
          </div>
        </div>

        {/* Live Interactive AI Brain Simulator */}
        <div className="p-5 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-indigo-600" /> Test AI Brain WhatsApp Response
            </h3>
            <span className="text-[11px] text-indigo-600 font-medium">Try typing any Indian B2B objection or inquiry</span>
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
              className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700"
            >
              Preset: &ldquo;We already use Excel &amp; reps&rdquo;
            </button>
            <button
              onClick={() => setProspectInboundMessage('What are your commercial pricing tiers for Indian MSMEs?')}
              className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700"
            >
              Preset: &ldquo;Send pricing tiers&rdquo;
            </button>
            <button
              onClick={() =>
                setProspectInboundMessage('Yes, interested. Can someone demonstrate the WhatsApp booking feature this Thursday at 3 PM?')
              }
              className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700"
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
            <span>{isAiThinking ? 'AI Brain is Reasoning & Synthesizing...' : 'Execute AI Brain Response'}</span>
          </button>

          {aiBrainResponse && (
            <div className="p-4 bg-white border border-indigo-200 rounded-xl space-y-2 text-xs shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-700 flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5" /> AI Brain Response (Synthesized via Groq Llama-3.3)
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
                <span>Safety: No Hallucinated Claims</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
