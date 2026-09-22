'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Video,
  User,
  Building,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { getDemoStore } from '../../lib/store/demo-store';
import { Meeting } from '../../lib/types';
import { clsx } from 'clsx';

export default function MeetingsPage() {
  const store = getDemoStore();
  const [meetings, setMeetings] = useState<Meeting[]>([...store.meetings]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(meetings[0] || null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Confirmed Discovery Meetings & AI Briefs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified calendar bookings with auto-synthesized Account Executive briefing dossiers.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Meetings List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Upcoming Bookings ({meetings.length})
          </h2>

          {meetings.map((m) => {
            const isSelected = selectedMeeting?.id === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setSelectedMeeting(m)}
                className={clsx(
                  'p-4 bg-white rounded-xl border cursor-pointer transition-all shadow-xs space-y-2',
                  isSelected
                    ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {m.status}
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {new Date(m.start_time).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-900 line-clamp-1">{m.title}</h3>

                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Building className="w-3 h-3 text-slate-400" />
                  <span>{m.lead_company} · {m.lead_name}</span>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
                  <span className="text-[11px] text-slate-500">Host: {m.host_user_name || 'Sales Rep'}</span>
                  <a
                    href={m.meet_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 text-[11px]"
                  >
                    Join <Video className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: AI Sales Brief Dossier (2 Cols) */}
        {selectedMeeting ? (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> AI Sales Brief
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedMeeting.title}</h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  Prospect: {selectedMeeting.lead_name} ({selectedMeeting.lead_company})
                </div>
              </div>

              <a
                href={selectedMeeting.meet_url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Video className="w-4 h-4" /> Open Video Room
              </a>
            </div>

            {selectedMeeting.sales_brief ? (
              <div className="space-y-5 text-xs">
                {/* Account & Contact Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Account Overview</span>
                    <p className="text-slate-700 leading-relaxed">
                      {selectedMeeting.sales_brief.account_overview}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Contact Role</span>
                    <p className="text-slate-700 leading-relaxed">
                      {selectedMeeting.sales_brief.contact_role}
                    </p>
                  </div>
                </div>

                {/* Pain Points & Buying Signals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-rose-50/50 rounded-lg border border-rose-200 space-y-2">
                    <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                      Verified Pain Points
                    </span>
                    <ul className="list-disc list-inside text-rose-900 space-y-1">
                      {selectedMeeting.sales_brief.verified_pain_points.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-2">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      Buying Signals
                    </span>
                    <ul className="list-disc list-inside text-emerald-900 space-y-1">
                      {selectedMeeting.sales_brief.buying_signals.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommended Questions to Ask */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Recommended Discovery Questions (India B2B Context)
                  </span>
                  <ol className="list-decimal list-inside text-slate-700 space-y-1">
                    {selectedMeeting.sales_brief.recommended_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>

                {/* Anticipated Objections */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Anticipated Objections & Suggested Rebuttals
                  </span>
                  <ul className="list-disc list-inside text-slate-700 space-y-1">
                    {selectedMeeting.sales_brief.anticipated_objections.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                AI Sales Brief is being synthesized.
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
            Select a meeting to view details.
          </div>
        )}
      </div>
    </div>
  );
}
