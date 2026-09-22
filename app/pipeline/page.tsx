'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Kanban, Building, ArrowRight, Plus, Ban } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppState } from '../../lib/client/use-app-state';
import { api } from '../../lib/client/api';
import { PageLoading, PageError, Notice, useNotice, btn } from '../../components/ui';
import type { LeadStatus } from '../../lib/types';

const PIPELINE_COLUMNS: { id: LeadStatus; title: string; color: string }[] = [
  { id: 'NEW', title: 'New Leads', color: 'border-slate-300' },
  { id: 'QUALIFIED', title: 'ICP Qualified', color: 'border-indigo-400' },
  { id: 'OUTREACH', title: 'Outreach Queued', color: 'border-blue-400' },
  { id: 'CONTACTED', title: 'Contacted', color: 'border-sky-400' },
  { id: 'ENGAGED', title: 'Engaged / Replies', color: 'border-amber-400' },
  { id: 'QUALIFIED_OPPORTUNITY', title: 'Qualified Opps', color: 'border-purple-400' },
  { id: 'MEETING', title: 'Meeting Booked', color: 'border-emerald-500' },
  { id: 'SALES_HANDOFF', title: 'AE Handoff', color: 'border-rose-400' },
  { id: 'NURTURE', title: 'Nurture / Later', color: 'border-slate-400' },
  { id: 'WON', title: 'Won', color: 'border-emerald-600' },
];

export default function PipelinePage() {
  const { state, loading, error, refresh } = useAppState({ pollMs: 20_000 });
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();

  if (error && !state) return <PageError message={error} />;
  if (loading || !state) return <PageLoading />;
  const leads = state.leads;
  const disqualified = leads.filter((l) => l.status === 'DISQUALIFIED' || l.status === 'LOST' || l.status === 'RESEARCHING');

  const moveLead = async (leadId: string, newStatus: LeadStatus) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    setMoving(leadId);
    try {
      await api.patch(`/api/leads/${leadId}`, { status: newStatus });
      await refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setMoving(null);
      setDraggingLeadId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-full mx-auto h-[calc(100vh-6.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Kanban className="w-5 h-5 text-indigo-600" />
            B2B Enterprise Pipeline Kanban
          </h1>
          <p className="text-xs text-slate-500">Drag cards between stages (or use the stage menu on a card). Every move is audited and persisted.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/leads" className={btn.primary}>
            <Plus className="w-3.5 h-3.5" /> Ingest Lead
          </Link>
        </div>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {/* Kanban Board Horizontal Scroll Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2">
        <div className="flex gap-3 h-full min-w-max">
          {PIPELINE_COLUMNS.map((column) => {
            const columnLeads = leads.filter((l) => l.status === column.id);

            return (
              <div
                key={column.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => draggingLeadId && moveLead(draggingLeadId, column.id)}
                className="w-72 bg-slate-100/70 rounded-xl border border-slate-200/80 p-3 flex flex-col h-full"
                data-testid={`column-${column.id}`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-2 h-2 rounded-full border-2', column.color)} />
                    <span className="text-xs font-bold text-slate-800">{column.title}</span>
                  </div>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">{columnLeads.length}</span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDraggingLeadId(lead.id)}
                      onDragEnd={() => setDraggingLeadId(null)}
                      className={clsx('bg-white p-3 rounded-lg border border-slate-200 shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all group', moving === lead.id && 'opacity-50')}
                      data-testid={`card-${lead.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">{lead.full_name}</div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">{lead.score?.score ?? '—'}</span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Building className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{lead.company_name}</span>
                      </div>

                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {lead.city}, {lead.state}
                      </div>
                      {lead.requires_human_attention && <div className="text-[10px] text-amber-700 mt-1 truncate">⚠ {lead.attention_reason || 'Needs attention'}</div>}

                      <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
                        <select
                          value={lead.status}
                          onChange={(e) => moveLead(lead.id, e.target.value as LeadStatus)}
                          disabled={moving !== null}
                          className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 max-w-[7.5rem]"
                          aria-label="Move to stage"
                        >
                          {PIPELINE_COLUMNS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                        <Link href={`/leads/${lead.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-0.5">
                          View <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}

                  {columnLeads.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[11px] text-slate-400">Drop leads here</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Parked column: disqualified / lost / suppressed */}
          <div className="w-64 bg-rose-50/40 rounded-xl border border-rose-100 p-3 flex flex-col h-full">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-100">
              <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
                <Ban className="w-3 h-3" /> Disqualified / Lost
              </span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">{disqualified.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {disqualified.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`} className="block bg-white p-2.5 rounded-lg border border-slate-200 text-xs opacity-75 hover:opacity-100">
                  <div className="font-semibold text-slate-800">{lead.full_name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{lead.suppression_reason || lead.status}</div>
                </Link>
              ))}
              {disqualified.length === 0 && <div className="text-[11px] text-slate-400 text-center py-6">Nothing parked</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
