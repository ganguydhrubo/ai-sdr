import { describe, it, expect, afterEach } from 'vitest';
import { parseCsvText, parseLeadsCsv, SAMPLE_LEADS_CSV } from '../lib/leads/csv';
import { createLeadRecord, importLeadsFromCsv } from '../lib/leads/service';
import { getDemoStore, resetDemoStore } from '../lib/store/demo-store';

describe('CSV parsing', () => {
  it('handles quoted commas, escaped quotes, CRLF and a BOM', () => {
    const rows = parseCsvText('﻿Name,Company\r\n"Rao, Asha","Rao ""Gears"" Pvt Ltd"\r\nBob,Plain Co\n');
    expect(rows).toEqual([
      ['Name', 'Company'],
      ['Rao, Asha', 'Rao "Gears" Pvt Ltd'],
      ['Bob', 'Plain Co'],
    ]);
  });

  it('maps common Indian CRM headings and reports unmapped or missing columns', () => {
    const parsed = parseLeadsCsv('Full Name,Organisation,Designation,E-mail,Mobile Number,Town,Favourite colour\nAsha Rao,Rao Gears,VP Sales,asha@raogears.in,9876543210,Pune,blue');
    expect(parsed.errors).toEqual([]);
    expect(parsed.unmappedHeaders).toEqual(['Favourite colour']);
    expect(parsed.rows[0]).toMatchObject({ line: 2, name: 'Asha Rao', company: 'Rao Gears', title: 'VP Sales', email: 'asha@raogears.in', phone: '9876543210', city: 'Pune' });

    const missing = parseLeadsCsv('Name,City\nAsha,Pune');
    expect(missing.errors.join(' ')).toMatch(/company/i);
    expect(missing.errors.join(' ')).toMatch(/Email.*Phone/i);
  });
});

describe('Lead creation & CSV import', () => {
  afterEach(() => resetDemoStore());

  it('normalises +91 phones and emails, rejects invalid input and duplicates', () => {
    const ok = createLeadRecord({ name: 'Asha Rao', company: 'Rao Gears Pvt Ltd', phone: '098765 43210', email: 'Asha@RaoGears.in', language: 'hinglish' });
    expect(ok.lead?.normalized_phone).toBe('+919876543210');
    expect(ok.lead?.normalized_email).toBe('asha@raogears.in');
    expect(ok.lead?.preferred_language).toBe('hinglish');
    expect(ok.lead?.status).toBe('NEW');

    expect(createLeadRecord({ name: 'No Company', company: '', phone: '9876543211' }).error).toMatch(/Company/);
    expect(createLeadRecord({ name: 'Bad Phone', company: 'X', phone: '12345' }).error).toMatch(/Invalid Indian phone/);
    expect(createLeadRecord({ name: 'Nothing', company: 'X' }).error).toMatch(/valid email or/);

    const dup = createLeadRecord({ name: 'Asha Again', company: 'Other', email: 'asha@raogears.in' });
    expect(dup.error).toMatch(/Duplicate/);
    expect(dup.duplicateOf).toBe(ok.lead?.id);
  });

  it('imports the bundled sample and skips duplicates on a second run', async () => {
    const store = getDemoStore();
    const before = store.leads.length;
    const first = await importLeadsFromCsv(SAMPLE_LEADS_CSV, { runAgent: false });
    expect(first.created).toBe(5);
    expect(first.skipped).toBe(0);
    expect(store.leads.length).toBe(before + 5);
    expect(store.leads.find((l) => l.normalized_email === 'nikhil.k@zetafin.in')?.preferred_language).toBe('hinglish');

    const second = await importLeadsFromCsv(SAMPLE_LEADS_CSV);
    expect(second.created).toBe(0);
    expect(second.duplicates).toBe(5);
    expect(store.auditLogs[0].action).toBe('LEADS_IMPORTED');
  });

  it('can run the SDR agent on imported leads', async () => {
    const summary = await importLeadsFromCsv('Name,Company,Email\nRun Me,Run Co,run@runco.in', { runAgent: true });
    expect(summary.created).toBe(1);
    expect(summary.processed).toBe(1);
    const lead = getDemoStore().leads.find((l) => l.normalized_email === 'run@runco.in');
    expect(lead?.score?.score).toBeGreaterThan(0);
    expect(lead?.status).toBe('OUTREACH');
  });
});
