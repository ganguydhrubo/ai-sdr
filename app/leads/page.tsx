'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Users, Plus, Upload, Search, Filter, Zap, ArrowUpRight, Building, Phone, Mail, Ban, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppState } from '../../lib/client/use-app-state';
import { api } from '../../lib/client/api';
import { PageLoading, PageError, Notice, useNotice, Modal, Field, inputCls, btn, LeadStatusBadge, Spinner } from '../../components/ui';
import type { Lead } from '../../lib/types';

interface ImportSummary {
  created: number;
  skipped: number;
  duplicates: number;
  processed: number;
  errors: Array<{ line: number; error: string }>;
  unmappedHeaders: string[];
}

const STATUS_OPTIONS = ['ALL', 'NEW', 'QUALIFIED', 'OUTREACH', 'CONTACTED', 'ENGAGED', 'MEETING', 'SALES_HANDOFF', 'NURTURE', 'DISQUALIFIED'];

export default function LeadsPage() {
  const { state, loading, error, refresh } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();

  // Manual Ingestion Modal state
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    title: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    language: 'en',
    run: true,
  });

  // CSV import modal
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvRun, setCsvRun] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredLeads = useMemo(() => {
    if (!state) return [];
    const q = searchQuery.toLowerCase();
    return state.leads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.full_name.toLowerCase().includes(q) ||
        lead.company_name?.toLowerCase().includes(q) ||
        lead.job_title?.toLowerCase().includes(q) ||
        lead.city?.toLowerCase().includes(q) ||
        lead.normalized_email.includes(q) ||
        lead.normalized_phone.includes(q);
      const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;
      const matchesAttention = !attentionOnly || lead.requires_human_attention;
      return matchesSearch && matchesStatus && matchesAttention;
    });
  }, [state, searchQuery, statusFilter, attentionOnly]);

  if (error && !state) return <PageError message={error} />;
  if (loading || !state) return <PageLoading />;
  const leads = state.leads;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post<{ lead: Lead; run?: { success: boolean; error?: string } }>('/api/leads', formData);
      setShowModal(false);
      setFormData({ ...formData, name: '', company: '', phone: '', email: '', title: '' });
      setNotice({
        kind: 'ok',
        text: `${res.lead.full_name} ingested (${res.lead.normalized_phone || res.lead.normalized_email}).${formData.run ? res.run?.success ? ' SDR agent ran: scored, drafted outreach for approval.' : ` SDR agent: ${res.run?.error || 'skipped'}` : ''}`,
      });
      await refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleRunOrchestrator = async (leadId: string) => {
    setIsProcessing(leadId);
    try {
      const res = await api.post<{ run: { success: boolean; steps: string[]; error?: string }; message?: { status: string }; delivery?: { sent: number; failed: number } }>(`/api/leads/${leadId}/process`);
      if (res.run.success) {
        setNotice({
          kind: 'ok',
          text: `SDR agent completed ${res.run.steps.length} steps${res.message ? ` — ${res.message.status === 'PENDING_APPROVAL' ? 'email drafted, waiting for approval on the dashboard' : `email ${res.message.status.toLowerCase()}`}` : ''}${res.delivery ? ` (${res.delivery.sent} sent, ${res.delivery.failed} failed)` : ''}.`,
        });
      } else {
        setNotice({ kind: 'error', text: `SDR agent stopped: ${res.run.error}` });
      }
      await refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleImport = async (sample = false) => {
    setImporting(true);
    setImportSummary(null);
    try {
      const res = await api.post<{ summary: ImportSummary }>('/api/leads/import', sample ? { sample: true, run: csvRun } : { csv: csvText, run: csvRun });
      setImportSummary(res.summary);
      setNotice({
        kind: res.summary.created > 0 ? 'ok' : 'error',
        text: `Import: ${res.summary.created} created, ${res.summary.skipped} skipped (${res.summary.duplicates} duplicates)${csvRun ? `, ${res.summary.processed} processed by the SDR agent` : ''}.`,
      });
      await refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setCsvText(await file.text());
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Indian B2B Lead Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Normalized with +91 validation, duplicate detection, and dynamic ICP fit scoring. {leads.length} leads on file.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className={btn.secondary} data-testid="open-import">
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Import CSV</span>
          </button>
          <button onClick={() => setShowModal(true)} className={btn.primary} data-testid="open-add-lead">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Single Lead</span>
          </button>
        </div>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {/* Filters Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Search by prospect, company, designation, city, email or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
            data-testid="lead-search"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} className="accent-indigo-600" />
            Needs attention
          </label>
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? `All Statuses (${leads.length})` : `${s.replace(/_/g, ' ')} (${leads.filter((l) => l.status === s).length})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600" data-testid="leads-table">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Prospect & Contact</th>
                <th className="px-4 py-3">Company & Region</th>
                <th className="px-4 py-3">ICP Fit Score</th>
                <th className="px-4 py-3">Lifecycle Status</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3 text-right">Autonomous Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map((lead) => {
                const score = lead.score?.score ?? 0;
                const isHot = score >= 85;
                const isHigh = score >= 75 && score < 85;

                return (
                  <tr key={lead.id} className={clsx('hover:bg-slate-50/80 transition-colors', lead.is_suppressed && 'opacity-60')} data-testid={`lead-row-${lead.id}`}>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        {lead.full_name}
                        {lead.requires_human_attention && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800" title={lead.attention_reason}>
                            ATTENTION
                          </span>
                        )}
                        {lead.is_suppressed && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 inline-flex items-center gap-0.5" title={lead.suppression_reason}>
                            <Ban className="w-2.5 h-2.5" /> SUPPRESSED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{lead.job_title}</div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        {lead.normalized_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {lead.normalized_phone}
                          </span>
                        )}
                        {lead.normalized_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {lead.normalized_email}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        {lead.company_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {lead.city}, {lead.state}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            'font-bold px-2 py-0.5 rounded-full text-[11px] border',
                            isHot
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isHigh
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                          )}
                        >
                          {lead.score ? `${score}/100 ${lead.score.classification}` : 'Not scored'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 max-w-xs truncate">{lead.score?.reasoning?.[0] || 'Run the SDR agent to score'}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <LeadStatusBadge status={lead.status} />
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="text-[11px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{lead.preferred_language}</span>
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleRunOrchestrator(lead.id)}
                        disabled={isProcessing === lead.id || lead.is_suppressed}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                        data-testid={`run-agent-${lead.id}`}
                      >
                        {isProcessing === lead.id ? <Spinner /> : <Zap className="w-3 h-3 text-indigo-600" />}
                        {isProcessing === lead.id ? 'Running AI...' : 'Run SDR Agent'}
                      </button>

                      <Link href={`/leads/${lead.id}`} className={btn.small}>
                        360° View <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">
                    No leads match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Ingestion Modal */}
      <Modal open={showModal} title="Ingest Indian B2B Lead" description="Phone is normalised to +91; duplicates by email or phone are rejected." onClose={() => setShowModal(false)}>
        <form onSubmit={handleManualSubmit} className="space-y-3" data-testid="add-lead-form">
          <Field label="Prospect Full Name *">
            <input type="text" required placeholder="e.g. Jane Doe" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Company Name *">
            <input type="text" required placeholder="e.g. Bharat Precision Tools Pvt Ltd" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone (+91 auto-normalized)">
              <input type="text" placeholder="9876543210" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Work Email">
              <input type="email" placeholder="vikram@bharatprecision.in" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Job Designation">
              <input type="text" placeholder="VP Sales / Head of BD" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={inputCls} />
            </Field>
            <Field label="City">
              <input type="text" placeholder="Pune" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State">
              <input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Preferred language">
              <select value={formData.language} onChange={(e) => setFormData({ ...formData, language: e.target.value })} className={inputCls}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
                <option value="bn">Bengali</option>
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={formData.run} onChange={(e) => setFormData({ ...formData, run: e.target.checked })} className="accent-indigo-600" />
            Run the SDR agent immediately (research → score → draft outreach)
          </label>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button type="button" onClick={() => setShowModal(false)} className={btn.ghost}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btn.primary} data-testid="submit-add-lead">
              {saving ? <Spinner /> : <Plus className="w-3.5 h-3.5" />} {formData.run ? 'Ingest & Run AI SDR' : 'Ingest Lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV import modal */}
      <Modal
        open={showImport}
        title="Import leads from CSV"
        description="Columns recognised: Name / First name / Last name, Company, Designation, Email, Mobile, City, State, Language, Industry, Source, Notes."
        onClose={() => setShowImport(false)}
        wide
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} className={btn.secondary}>
              <Upload className="w-3.5 h-3.5" /> Choose CSV file
            </button>
            <a href="/api/leads/import" className={btn.ghost} download>
              <Download className="w-3.5 h-3.5" /> Download sample CSV
            </a>
            <button type="button" onClick={() => handleImport(true)} disabled={importing} className={btn.ghost} data-testid="import-sample">
              {importing ? <Spinner /> : null} Import bundled sample (5 leads)
            </button>
          </div>
          <textarea
            rows={8}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'Name,Company,Designation,Email,Mobile,City,State\nAsha Rao,Rao Gears Pvt Ltd,VP Sales,asha@raogears.in,9876543210,Pune,Maharashtra'}
            className={`${inputCls} font-mono`}
            data-testid="csv-textarea"
          />
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={csvRun} onChange={(e) => setCsvRun(e.target.checked)} className="accent-indigo-600" />
            Run the SDR agent on every imported lead (slower with a live model)
          </label>
          {importSummary && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1" data-testid="import-summary">
              <div className="font-semibold text-slate-800">
                {importSummary.created} created · {importSummary.skipped} skipped · {importSummary.duplicates} duplicates
                {csvRun ? ` · ${importSummary.processed} processed` : ''}
              </div>
              {importSummary.unmappedHeaders.length > 0 && <div className="text-slate-500">Ignored columns: {importSummary.unmappedHeaders.join(', ')}</div>}
              {importSummary.errors.slice(0, 8).map((e, i) => (
                <div key={i} className="text-rose-700">
                  {e.line ? `Line ${e.line}: ` : ''}
                  {e.error}
                </div>
              ))}
            </div>
          )}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button type="button" onClick={() => setShowImport(false)} className={btn.ghost}>
              Close
            </button>
            <button type="button" onClick={() => handleImport(false)} disabled={importing || !csvText.trim()} className={btn.primary} data-testid="import-csv">
              {importing ? <Spinner /> : <Upload className="w-3.5 h-3.5" />} Import {csvText.trim() ? `${Math.max(0, csvText.trim().split(/\r?\n/).length - 1)} rows` : ''}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
