'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Upload,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Building,
  Phone,
  Mail,
} from 'lucide-react';
import { getDemoStore } from '../../lib/store/demo-store';
import { SDROrchestrator } from '../../lib/orchestrator/sdr-orchestrator';
import { Lead, FitClassification } from '../../lib/types';
import { clsx } from 'clsx';

export default function LeadsPage() {
  const store = getDemoStore();
  const [leads, setLeads] = useState<Lead[]>([...store.leads]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Manual Ingestion Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    title: '',
    city: 'Bengaluru',
    state: 'Karnataka',
  });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.company || !formData.phone || !formData.email) return;

    const names = formData.name.trim().split(' ');
    const firstName = names[0];
    const lastName = names.slice(1).join(' ');

    const newLead = store.addLead({
      first_name: firstName,
      last_name: lastName,
      company_name: formData.company,
      phone: formData.phone,
      email: formData.email,
      job_title: formData.title || 'Director of Sales',
      city: formData.city,
      state: formData.state,
      lead_source: 'MANUAL_ENTRY',
    });

    setShowModal(false);
    setLeads([...store.leads]);

    // Automatically trigger autonomous research & scoring for newly ingested lead
    setIsProcessing(newLead.id);
    await SDROrchestrator.processLead(newLead.id);
    setIsProcessing(null);
    setLeads([...store.leads]);
  };

  const handleRunOrchestrator = async (leadId: string) => {
    setIsProcessing(leadId);
    await SDROrchestrator.processLead(leadId);
    setIsProcessing(null);
    setLeads([...store.leads]);
  };

  const handleUploadSampleCSV = async () => {
    // Ingest sample batch of Indian B2B leads
    const sampleBatch = [
      { name: 'Aditya Birla', company: 'Hindalco Industrial Systems Ltd', phone: '+919811223344', email: 'aditya.b@hindalco.ind.in', title: 'VP Commercial Strategy', city: 'Mumbai', state: 'Maharashtra' },
      { name: 'Meenakshi Sundaram', company: 'TVS Supply Dynamics Pvt Ltd', phone: '+919822334455', email: 'meenakshi@tvssupply.in', title: 'Head of Procurement', city: 'Chennai', state: 'Tamil Nadu' },
      { name: 'Nikhil Kashyap', company: 'Zeta FinTech Solutions LLP', phone: '+919833445566', email: 'nikhil.k@zetafin.in', title: 'Chief Operating Officer', city: 'Bengaluru', state: 'Karnataka' },
    ];

    for (const item of sampleBatch) {
      const names = item.name.split(' ');
      const lead = store.addLead({
        first_name: names[0],
        last_name: names.slice(1).join(' '),
        company_name: item.company,
        phone: item.phone,
        email: item.email,
        job_title: item.title,
        city: item.city,
        state: item.state,
        lead_source: 'CSV_IMPORT',
      });
      await SDROrchestrator.processLead(lead.id);
    }

    setLeads([...store.leads]);
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.job_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.city?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
            Normalized with +91 validation, GSTIN registry verification, and dynamic ICP fit scoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUploadSampleCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border border-slate-300"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Import CSV Sample</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Single Lead</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Search by prospect name, company, designation, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden"
          >
            <option value="ALL">All Statuses ({leads.length})</option>
            <option value="NEW">New</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="OUTREACH">Outreach</option>
            <option value="ENGAGED">Engaged</option>
            <option value="MEETING">Meeting Booked</option>
            <option value="SALES_HANDOFF">Sales Handoff</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
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
                const score = lead.score?.score || 70;
                const isHot = score >= 85;
                const isHigh = score >= 75 && score < 85;

                return (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{lead.full_name}</div>
                      <div className="text-[11px] text-slate-500">{lead.job_title}</div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {lead.normalized_phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {lead.normalized_email}
                        </span>
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
                          {score}/100 {lead.score?.classification || 'FIT'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 max-w-xs truncate">
                        {lead.score?.reasoning?.[0] || 'Verified public signals match'}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={clsx(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider',
                          lead.status === 'MEETING'
                            ? 'bg-emerald-100 text-emerald-800'
                            : lead.status === 'ENGAGED'
                            ? 'bg-blue-100 text-blue-800'
                            : lead.status === 'SALES_HANDOFF'
                            ? 'bg-purple-100 text-purple-800'
                            : lead.status === 'OUTREACH'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        )}
                      >
                        {lead.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="text-[11px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {lead.preferred_language}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleRunOrchestrator(lead.id)}
                        disabled={isProcessing === lead.id}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <Zap className="w-3 h-3 text-indigo-600" />
                        {isProcessing === lead.id ? 'Running AI...' : 'Run SDR Agent'}
                      </button>

                      <Link
                        href={`/leads/${lead.id}`}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded text-xs font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        360° View <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Ingestion Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Ingest Indian B2B Lead</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Prospect Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Malhotra"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bharat Precision Tools Pvt Ltd"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone (+91 auto-normalized) *</label>
                  <input
                    type="text"
                    required
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Work Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="vikram@bharatprecision.in"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Job Designation</label>
                  <input
                    type="text"
                    placeholder="VP Sales / Head of BD"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Pune"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  Ingest & Run AI SDR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
