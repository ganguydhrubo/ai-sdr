'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Users, Building, Send, ArrowRight } from 'lucide-react';
import { getDemoStore } from '../lib/store/demo-store';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const store = getDemoStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open
          setQuery('');
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredLeads = store.leads.filter(
    (l) =>
      l.full_name.toLowerCase().includes(query.toLowerCase()) ||
      l.company_name?.toLowerCase().includes(query.toLowerCase()) ||
      l.job_title?.toLowerCase().includes(query.toLowerCase())
  );

  const filteredCampaigns = store.campaigns.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectLead = (leadId: string) => {
    onClose();
    router.push(`/leads/${leadId}`);
  };

  const handleSelectCampaign = (campId: string) => {
    onClose();
    router.push(`/campaigns`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-24 px-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200">
          <Search className="w-4 h-4 text-slate-400 mr-3" />
          <input
            type="text"
            placeholder="Search leads, companies, campaigns, or actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden"
            autoFocus
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100">
          {/* Leads Section */}
          <div className="py-2">
            <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Leads & Decision Makers
            </div>
            {filteredLeads.slice(0, 5).map((lead) => (
              <div
                key={lead.id}
                onClick={() => handleSelectLead(lead.id)}
                className="flex items-center justify-between px-3 py-2 hover:bg-indigo-50 rounded-lg cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold">
                    {lead.first_name[0]}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-900 group-hover:text-indigo-900">
                      {lead.full_name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {lead.job_title} · {lead.company_name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Fit: {lead.score?.score || 75}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                </div>
              </div>
            ))}
          </div>

          {/* Campaigns Section */}
          <div className="py-2">
            <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Outbound Campaigns
            </div>
            {filteredCampaigns.slice(0, 3).map((camp) => (
              <div
                key={camp.id}
                onClick={() => handleSelectCampaign(camp.id)}
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
          <span>Navigate with arrows</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
