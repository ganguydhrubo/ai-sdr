'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Send, ArrowRight } from 'lucide-react';
import type { Campaign, Lead } from '../lib/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  leads: Lead[];
  campaigns: Campaign[];
}

const PAGES = [
  { label: 'Dashboard', href: '/' },
  { label: 'Leads', href: '/leads' },
  { label: 'Pipeline', href: '/pipeline' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Voice Hub', href: '/voice' },
  { label: 'WhatsApp Hub', href: '/whatsapp' },
  { label: 'Inbox', href: '/inbox' },
  { label: 'Meetings', href: '/meetings' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Activity', href: '/activity' },
  { label: 'Settings', href: '/settings' },
  { label: 'Voice Settings', href: '/settings/voice' },
];

export function CommandPalette({ isOpen, onOpen, onClose, leads, campaigns }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery('');
          onOpen();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onOpen]);

  if (!isOpen) return null;

  const q = query.toLowerCase();
  const filteredLeads = leads.filter(
    (l) =>
      l.full_name.toLowerCase().includes(q) ||
      l.company_name?.toLowerCase().includes(q) ||
      l.job_title?.toLowerCase().includes(q) ||
      l.normalized_email.includes(q)
  );
  const filteredCampaigns = campaigns.filter((c) => c.name.toLowerCase().includes(q));
  const filteredPages = q ? PAGES.filter((p) => p.label.toLowerCase().includes(q)) : [];

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200">
          <Search className="w-4 h-4 text-slate-400 mr-3" />
          <input
            type="text"
            placeholder="Search leads, companies, campaigns, or pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const first = filteredLeads[0] ? `/leads/${filteredLeads[0].id}` : filteredPages[0]?.href || (filteredCampaigns[0] ? '/campaigns' : undefined);
                if (first) go(first);
              }
            }}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded" aria-label="Close search">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100">
          {filteredPages.length > 0 && (
            <div className="py-2">
              <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pages</div>
              {filteredPages.map((p) => (
                <div key={p.href} onClick={() => go(p.href)} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-800">
                  {p.label}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              ))}
            </div>
          )}

          {/* Leads Section */}
          <div className="py-2">
            <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Leads & Decision Makers
            </div>
            {filteredLeads.slice(0, 6).map((lead) => (
              <div
                key={lead.id}
                onClick={() => go(`/leads/${lead.id}`)}
                className="flex items-center justify-between px-3 py-2 hover:bg-indigo-50 rounded-lg cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold">
                    {lead.first_name[0]}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-900 group-hover:text-indigo-900">{lead.full_name}</div>
                    <div className="text-[11px] text-slate-500">
                      {lead.job_title} · {lead.company_name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Fit: {lead.score?.score ?? '—'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                </div>
              </div>
            ))}
            {filteredLeads.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No matching leads</div>}
          </div>

          {/* Campaigns Section */}
          <div className="py-2">
            <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Outbound Campaigns</div>
            {filteredCampaigns.slice(0, 4).map((camp) => (
              <div
                key={camp.id}
                onClick={() => go(`/campaigns?campaign=${camp.id}`)}
                className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4 text-indigo-600" />
                  <div>
                    <div className="text-xs font-medium text-slate-800">{camp.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {camp.target_industry} · Mode: {camp.approval_mode}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">{camp.leads_count} Leads</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500 flex justify-between px-4">
          <span>Enter opens the first result</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
