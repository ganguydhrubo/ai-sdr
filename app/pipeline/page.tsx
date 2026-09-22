'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Kanban,
  Building,
  Phone,
  Mail,
  ArrowRight,
  MoreHorizontal,
  Plus,
  Filter,
} from 'lucide-react';
import { getDemoStore } from '../../lib/store/demo-store';
import { Lead, LeadStatus } from '../../lib/types';
import { clsx } from 'clsx';

const PIPELINE_COLUMNS: { id: LeadStatus; title: string; color: string }[] = [
  { id: 'NEW', title: 'New Leads', color: 'border-slate-300' },
  { id: 'QUALIFIED', title: 'ICP Qualified', color: 'border-indigo-400' },
  { id: 'OUTREACH', title: 'Outreach Queued', color: 'border-blue-400' },
  { id: 'CONTACTED', title: 'Contacted', color: 'border-sky-400' },
  { id: 'ENGAGED', title: 'Engaged / Replies', color: 'border-amber-400' },
  { id: 'QUALIFIED_OPPORTUNITY', title: 'Qualified Opps', color: 'border-purple-400' },
  { id: 'MEETING', title: 'Meeting Booked', color: 'border-emerald-500' },
  { id: 'SALES_HANDOFF', title: 'AE Handoff', color: 'border-rose-400' },
];

export default function PipelinePage() {
  const store = getDemoStore();
  const [leads, setLeads] = useState<Lead[]>([...store.leads]);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);

  const handleDragStart = (leadId: string) => {
    setDraggingLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (newStatus: LeadStatus) => {
    if (!draggingLeadId) return;
    store.updateLeadStatus(draggingLeadId, newStatus);
    setLeads([...store.leads]);
    setDraggingLeadId(null);
  };

  return (
    <div className="space-y-4 max-w-full mx-auto h-[calc(100vh-6.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Kanban className="w-5 h-5 text-indigo-600" />
            B2B Enterprise Pipeline Kanban
          </h1>
          <p className="text-xs text-slate-500">
            Interactive drag-and-drop lifecycle progression with automated AI stage triggers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/leads"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Ingest Lead
          </Link>
        </div>
      </div>

      {/* Kanban Board Horizontal Scroll Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2">
        <div className="flex gap-3 h-full min-w-max">
          {PIPELINE_COLUMNS.map((column) => {
            const columnLeads = leads.filter((l) => l.status === column.id);

            return (
              <div
                key={column.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.id)}
                className="w-72 bg-slate-100/70 rounded-xl border border-slate-200/80 p-3 flex flex-col h-full"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-2 h-2 rounded-full border-2', column.color)} />
                    <span className="text-xs font-bold text-slate-800">{column.title}</span>
                  </div>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                    {columnLeads.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead.id)}
                      className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {lead.full_name}
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                          {lead.score?.score || 75}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Building className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{lead.company_name}</span>
                      </div>

                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {lead.city}, {lead.state}
                      </div>

                      <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 text-[10px]">
                          {lead.preferred_language.toUpperCase()}
                        </span>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-0.5"
                        >
                          View <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}

                  {columnLeads.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
                      Drop leads here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
