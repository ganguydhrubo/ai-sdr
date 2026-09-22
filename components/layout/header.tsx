'use client';

import Link from 'next/link';
import { Search, AlertOctagon, Building, Loader2, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import type { IntegrationStatus } from '../../lib/integrations/status';
import type { User } from '../../lib/types';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  killSwitchActive: boolean;
  onToggleKillSwitch: () => void;
  toggling?: boolean;
  integrations?: IntegrationStatus;
  orgName?: string;
  user?: User;
  onSignOut?: () => void;
}

function Chip({ ok, label, title }: { ok: boolean | undefined; label: string; title?: string }) {
  return (
    <span
      title={title}
      className={clsx(
        'hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
        ok === undefined
          ? 'bg-slate-100 text-slate-500 border-slate-200'
          : ok
            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
            : 'bg-amber-50 text-amber-700 border-amber-200'
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', ok === undefined ? 'bg-slate-400' : ok ? 'bg-emerald-500' : 'bg-amber-500')} />
      {label}
    </span>
  );
}

export function Header({ onOpenCommandPalette, killSwitchActive, onToggleKillSwitch, toggling, integrations, orgName, user, onSignOut }: HeaderProps) {
  const initials = (user?.full_name || 'Operator')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const modeLabel = integrations
    ? integrations.demo_mode
      ? 'DEMO MODE · all simulated'
      : integrations.delivery_mode === 'SIMULATED'
        ? 'DELIVERY · SIMULATED'
        : integrations.delivery_mode === 'LIVE_REDIRECT'
          ? 'DELIVERY · LIVE, REDIRECTED TO TEST INBOX'
          : 'DELIVERY · LIVE'
    : 'Connecting…';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 gap-3">
      {/* Left: Organization & Universal Search Bar */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded-md text-xs font-medium text-slate-700 border border-slate-200 whitespace-nowrap">
          <Building className="w-3.5 h-3.5 text-slate-500" />
          <span>{orgName ? orgName.replace(/ India Pvt Ltd$/, '') : 'Apex Technologies'} (IN)</span>
        </div>

        {/* Universal Search Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 transition-colors w-full max-w-xs justify-between"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5" />
            Search leads, companies, campaigns...
          </span>
          <kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-600 shadow-xs">Ctrl+K</kbd>
        </button>
      </div>

      {/* Right: Mode Tag, Integration chips, Kill Switch & User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/settings"
          data-testid="mode-pill"
          className={clsx(
            'hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
            integrations && !integrations.demo_mode && integrations.delivery_mode === 'LIVE'
              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
              : 'bg-slate-100 text-slate-700 border-slate-200'
          )}
          title="Delivery mode — change in Settings"
        >
          <span className={clsx('w-2 h-2 rounded-full', integrations && !integrations.demo_mode ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
          <span>{modeLabel}</span>
        </Link>

        <Chip ok={integrations?.ai.live} label={!integrations ? 'AI' : integrations.ai.live ? `AI · ${integrations.ai.model.split('/').pop()}` : 'AI · offline simulator'} title={integrations?.ai.reason} />
        <Chip ok={integrations?.email.live} label={!integrations ? 'Email' : integrations.email.live ? 'Resend' : 'Email · simulated'} title={integrations?.email.domain_note || integrations?.email.reason} />
        <Chip
          ok={integrations ? integrations.whatsapp.instanceState === 'open' : undefined}
          label={
            integrations
              ? integrations.whatsapp.instanceState === 'open'
                ? 'WhatsApp · linked'
                : integrations.whatsapp.reachable
                  ? 'WhatsApp · scan QR'
                  : 'WhatsApp · offline'
              : 'WhatsApp'
          }
          title={integrations?.whatsapp.url}
        />

        {/* Global Emergency Kill Switch */}
        <button
          onClick={onToggleKillSwitch}
          disabled={toggling}
          data-testid="kill-switch"
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all shadow-sm disabled:opacity-60',
            killSwitchActive
              ? 'bg-rose-600 text-white animate-pulse hover:bg-rose-700'
              : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200'
          )}
          title="Emergency Stop All Outbound Communications"
        >
          {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertOctagon className={clsx('w-3.5 h-3.5', killSwitchActive ? 'text-white' : 'text-rose-600')} />}
          <span>{killSwitchActive ? 'OUTREACH HALTED' : 'Kill Switch'}</span>
        </button>

        {/* User Identity */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs border border-indigo-200">
            {initials}
          </div>
          <div className="text-left hidden md:block">
            <div className="text-xs font-semibold text-slate-800">{user?.full_name || 'Operator'}</div>
            <div className="text-[10px] text-slate-500">{user ? user.role.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : ''}</div>
          </div>
          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Sign out"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              data-testid="sign-out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
