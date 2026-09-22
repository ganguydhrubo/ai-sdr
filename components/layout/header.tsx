'use client';

import { useState } from 'react';
import { Search, AlertOctagon, ShieldAlert, Sparkles, Building, UserCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  killSwitchActive: boolean;
  onToggleKillSwitch: () => void;
}

export function Header({ onOpenCommandPalette, killSwitchActive, onToggleKillSwitch }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Organization & Universal Search Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded-md text-xs font-medium text-slate-700 border border-slate-200">
          <Building className="w-3.5 h-3.5 text-slate-500" />
          <span>Apex Technologies (IN)</span>
        </div>

        {/* Universal Search Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 transition-colors w-72 justify-between"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            Search leads, companies, campaigns...
          </span>
          <kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-600 shadow-xs">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Mode Tag, Kill Switch & User Avatar */}
      <div className="flex items-center gap-3">
        {/* Live Production Status Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>PRODUCTION LIVE (Groq &amp; Resend)</span>
        </div>

        {/* Global Emergency Kill Switch */}
        <button
          onClick={onToggleKillSwitch}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all shadow-sm',
            killSwitchActive
              ? 'bg-rose-600 text-white animate-pulse hover:bg-rose-700'
              : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200'
          )}
          title="Emergency Stop All Outbound Communications"
        >
          <AlertOctagon className={clsx('w-3.5 h-3.5', killSwitchActive ? 'text-white' : 'text-rose-600')} />
          <span>{killSwitchActive ? 'OUTREACH HALTED' : 'Kill Switch'}</span>
        </button>

        {/* User Identity */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs border border-indigo-200">
            AS
          </div>
          <div className="text-left hidden md:block">
            <div className="text-xs font-semibold text-slate-800">Ananya Sen</div>
            <div className="text-[10px] text-slate-500">Sales Manager</div>
          </div>
        </div>
      </div>
    </header>
  );
}
