/**
 * Small RFC 4180-style CSV parser plus a header mapper for lead imports.
 * Accepts the common Indian CRM export headings (Name / Company / Mobile / Designation / …).
 */

export interface LeadCsvRow {
  line: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
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

export interface ParsedLeadCsv {
  headers: string[];
  rows: LeadCsvRow[];
  unmappedHeaders: string[];
  errors: string[];
}

const HEADER_ALIASES: Record<keyof Omit<LeadCsvRow, 'line'>, string[]> = {
  name: ['name', 'full name', 'fullname', 'contact', 'contact name', 'prospect', 'prospect name', 'lead name'],
  first_name: ['first name', 'firstname', 'first'],
  last_name: ['last name', 'lastname', 'last', 'surname'],
  company: ['company', 'company name', 'organisation', 'organization', 'account', 'firm', 'business'],
  phone: ['phone', 'mobile', 'mobile number', 'phone number', 'contact number', 'whatsapp', 'cell', 'tel'],
  email: ['email', 'e-mail', 'email address', 'work email', 'mail'],
  title: ['title', 'job title', 'designation', 'role', 'position'],
  city: ['city', 'location', 'town'],
  state: ['state', 'region', 'province'],
  language: ['language', 'preferred language', 'lang'],
  industry: ['industry', 'sector', 'vertical'],
  source: ['source', 'lead source', 'origin'],
  notes: ['notes', 'note', 'comments', 'remarks'],
};

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/_+/g, ' ').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
}

export function mapHeaders(headers: string[]): { mapping: Record<number, keyof Omit<LeadCsvRow, 'line'>>; unmapped: string[] } {
  const mapping: Record<number, keyof Omit<LeadCsvRow, 'line'>> = {};
  const unmapped: string[] = [];
  headers.forEach((raw, idx) => {
    const h = normalizeHeader(raw);
    const key = (Object.keys(HEADER_ALIASES) as Array<keyof Omit<LeadCsvRow, 'line'>>).find((k) => HEADER_ALIASES[k].includes(h));
    if (key) mapping[idx] = key;
    else unmapped.push(raw);
  });
  return { mapping, unmapped };
}

export function parseLeadsCsv(text: string): ParsedLeadCsv {
  const table = parseCsvText(text);
  if (table.length === 0) {
    return { headers: [], rows: [], unmappedHeaders: [], errors: ['The file is empty'] };
  }
  const headers = table[0].map((h) => h.trim());
  const { mapping, unmapped } = mapHeaders(headers);
  const errors: string[] = [];
  const mappedKeys = new Set(Object.values(mapping));
  if (!mappedKeys.has('name') && !mappedKeys.has('first_name')) {
    errors.push('No name column found (expected "Name" or "First name")');
  }
  if (!mappedKeys.has('company')) {
    errors.push('No company column found (expected "Company")');
  }
  if (!mappedKeys.has('email') && !mappedKeys.has('phone')) {
    errors.push('Need an "Email" or "Phone" column');
  }

  const rows: LeadCsvRow[] = table.slice(1).map((cells, i) => {
    const row: LeadCsvRow = { line: i + 2 };
    cells.forEach((value, idx) => {
      const key = mapping[idx];
      if (key) (row as unknown as Record<string, unknown>)[key] = value.trim();
    });
    return row;
  });

  return { headers, rows, unmappedHeaders: unmapped, errors };
}

export const SAMPLE_LEADS_CSV = `Name,Company,Designation,Email,Mobile,City,State,Language
Aditya Birla,Hindalco Industrial Systems Ltd,VP Commercial Strategy,aditya.b@hindalco.ind.in,+91 98112 23344,Mumbai,Maharashtra,en
Meenakshi Sundaram,TVS Supply Dynamics Pvt Ltd,Head of Procurement,meenakshi@tvssupply.in,9822334455,Chennai,Tamil Nadu,en
Nikhil Kashyap,Zeta FinTech Solutions LLP,Chief Operating Officer,nikhil.k@zetafin.in,09833445566,Bengaluru,Karnataka,hinglish
Farida Sheikh,Sheikh Cold Storage Enterprises,Managing Partner,farida@sheikhcold.in,+919844556677,Nashik,Maharashtra,hi
Debashish Roy,Roy Logistics Pvt Ltd,Director Operations,d.roy@roylogistics.in,9855667788,Kolkata,West Bengal,bn`;
