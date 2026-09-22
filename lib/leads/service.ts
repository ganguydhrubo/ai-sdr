import { getDemoStore } from '../store/demo-store';
import { normalizeEmail, normalizeIndianPhone } from '../normalization/india';
import { SDROrchestrator } from '../orchestrator/sdr-orchestrator';
import { parseLeadsCsv, LeadCsvRow } from './csv';
import type { Lead } from '../types';

export interface CreateLeadInput {
  name?: string;
  first_name?: string;
  last_name?: string;
  company: string;
  phone?: string;
  email?: string;
  title?: string;
  city?: string;
  state?: string;
  language?: string;
  industry?: string;
  source?: string;
  notes?: string;
}

export interface CreateLeadOutcome {
  lead?: Lead;
  error?: string;
  duplicateOf?: string;
}

const LANGUAGES = ['en', 'hi', 'bn', 'hinglish'] as const;

function splitName(input: CreateLeadInput): { first: string; last: string } | null {
  if (input.first_name?.trim()) {
    return { first: input.first_name.trim(), last: (input.last_name || '').trim() };
  }
  const full = (input.name || '').trim();
  if (!full) return null;
  const parts = full.split(/\s+/);
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/** Validates, normalises (+91, lower-case email), de-duplicates and stores a lead. */
export function createLeadRecord(input: CreateLeadInput): CreateLeadOutcome {
  const store = getDemoStore();
  const name = splitName(input);
  if (!name) return { error: 'Name is required' };
  if (!input.company?.trim()) return { error: 'Company is required' };

  const email = input.email?.trim() ? normalizeEmail(input.email) : { normalized: '', domain: '', isValid: false };
  const phone = input.phone?.trim() ? normalizeIndianPhone(input.phone) : { normalized: '', isValid: false };
  if (input.email?.trim() && !email.isValid) return { error: `Invalid email: ${input.email}` };
  if (input.phone?.trim() && !phone.isValid) return { error: `Invalid Indian phone: ${input.phone} (${(phone as { error?: string }).error || 'expected 10 digits'})` };
  if (!email.isValid && !phone.isValid) return { error: 'Provide a valid email or an Indian mobile number' };

  const duplicate = store.leads.find(
    (l) => (email.isValid && l.normalized_email === email.normalized) || (phone.isValid && l.normalized_phone === phone.normalized)
  );
  if (duplicate) {
    return { error: `Duplicate of existing lead ${duplicate.full_name} (${duplicate.normalized_email || duplicate.normalized_phone})`, duplicateOf: duplicate.id };
  }

  const language = LANGUAGES.includes((input.language || '').toLowerCase() as (typeof LANGUAGES)[number])
    ? ((input.language as string).toLowerCase() as Lead['preferred_language'])
    : 'en';

  const lead = store.addLead({
    first_name: name.first,
    last_name: name.last,
    company_name: input.company.trim(),
    phone: phone.isValid ? phone.normalized : '',
    email: email.isValid ? email.normalized : '',
    job_title: input.title?.trim() || 'Decision Maker',
    city: input.city?.trim() || 'Bengaluru',
    state: input.state?.trim() || 'Karnataka',
    lead_source: input.source?.trim() || 'MANUAL_ENTRY',
    preferred_language: language,
    industry: input.industry?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  });
  store.persist();
  return { lead };
}

export interface ImportSummary {
  created: number;
  skipped: number;
  duplicates: number;
  processed: number;
  errors: Array<{ line: number; error: string }>;
  leadIds: string[];
  unmappedHeaders: string[];
}

/** Imports a CSV (text) of leads; optionally runs the SDR agent on each new lead. */
export async function importLeadsFromCsv(text: string, opts?: { runAgent?: boolean; source?: string }): Promise<ImportSummary> {
  const parsed = parseLeadsCsv(text);
  const summary: ImportSummary = {
    created: 0,
    skipped: 0,
    duplicates: 0,
    processed: 0,
    errors: parsed.errors.map((e) => ({ line: 1, error: e })),
    leadIds: [],
    unmappedHeaders: parsed.unmappedHeaders,
  };
  if (parsed.errors.length > 0) return summary;

  for (const row of parsed.rows) {
    const outcome = createLeadRecord(rowToInput(row, opts?.source));
    if (outcome.lead) {
      summary.created++;
      summary.leadIds.push(outcome.lead.id);
    } else {
      summary.skipped++;
      if (outcome.duplicateOf) summary.duplicates++;
      summary.errors.push({ line: row.line, error: outcome.error || 'Skipped' });
    }
  }

  if (opts?.runAgent) {
    for (const id of summary.leadIds) {
      try {
        await SDROrchestrator.processLead(id);
        summary.processed++;
      } catch (err) {
        summary.errors.push({ line: 0, error: `Agent failed for ${id}: ${(err as Error).message}` });
      }
    }
  }

  getDemoStore().recordAuditLog(
    'USER',
    'LEADS_IMPORTED',
    'lead',
    summary.leadIds[0] || 'csv',
    `CSV import: ${summary.created} created, ${summary.skipped} skipped (${summary.duplicates} duplicates)${opts?.runAgent ? `, ${summary.processed} processed by the SDR agent` : ''}`
  );
  getDemoStore().persist();
  return summary;
}

function rowToInput(row: LeadCsvRow, source?: string): CreateLeadInput {
  return {
    name: row.name,
    first_name: row.first_name,
    last_name: row.last_name,
    company: row.company || '',
    phone: row.phone,
    email: row.email,
    title: row.title,
    city: row.city,
    state: row.state,
    language: row.language,
    industry: row.industry,
    source: row.source || source || 'CSV_IMPORT',
    notes: row.notes,
  };
}
