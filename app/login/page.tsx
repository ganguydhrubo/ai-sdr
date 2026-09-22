'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Lock, User, ArrowRight, Loader2, Phone, Mail, MessageSquare, Zap, ShieldCheck } from 'lucide-react';

const FEATURES = [
  { icon: Zap, title: '13-agent AI SDR', text: 'Scores, enrols and drafts outreach on every inbound lead automatically.' },
  { icon: Phone, title: 'Voice agent', text: 'Browser-based AI calls that qualify, handle objections and book meetings.' },
  { icon: Mail, title: 'Multi-channel delivery', text: 'Email and WhatsApp outreach with human-in-the-loop approval.' },
  { icon: MessageSquare, title: 'Live inbox', text: 'Replies classified, drafted and handed off in real time.' },
];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Invalid ID or password.');
        return;
      }
      const dest = searchParams.get('from') || '/';
      router.replace(dest.startsWith('/login') ? '/' : dest);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 relative overflow-hidden flex items-center justify-center px-4 py-10 sm:py-16">
      {/* Ambient glow background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[32rem] h-[32rem] bg-indigo-600/30 rounded-full blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 w-[36rem] h-[36rem] bg-violet-600/25 rounded-full blur-[130px]" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left: brand + feature pitch */}
        <div className="hidden lg:block">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold tracking-wide text-indigo-300 mb-6">
            <ShieldCheck className="w-3.5 h-3.5" /> ENTERPRISE AI SDR OPERATING SYSTEM
          </div>
          <h1 className="text-4xl font-bold tracking-tight leading-tight mb-4">
            Apex<span className="text-indigo-400">SDR</span>
            <br />
            runs your outbound while you sleep.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-md">
            One command center for leads, outreach, replies, meetings and AI voice calls —
            built for Indian B2B revenue teams.
          </p>
          <div className="space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4 h-4 text-indigo-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-100">{f.title}</div>
                  <div className="text-xs text-slate-400">{f.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: login card */}
        <div className="w-full max-w-sm mx-auto">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              Apex<span className="text-indigo-400">SDR</span>
            </span>
          </div>

          <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-7 shadow-2xl shadow-black/40">
            <div className="hidden lg:flex w-11 h-11 rounded-xl bg-indigo-600 items-center justify-center mb-5">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Sign in to the console</h2>
            <p className="text-xs text-slate-400 mb-6">Authorized operators only.</p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">ID</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-900/60 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60"
                    placeholder="your ID"
                    data-testid="login-username"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900/60 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60"
                    placeholder="••••••••••••"
                    data-testid="login-password"
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2" data-testid="login-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-colors mt-1"
                data-testid="login-submit"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {loading ? 'Verifying…' : 'Enter console'}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-slate-500 mt-5">
            Prospect on a call link?{' '}
            <span className="text-slate-400">You don&rsquo;t need this — use the link you were sent.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
