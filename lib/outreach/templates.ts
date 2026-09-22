import { Lead } from '../types';

/**
 * Template variables available in campaign step subject/body templates.
 * `{{talk_link}}` is only resolved by a TALK_INVITE step (lib/orchestrator/talk-invite.ts).
 */
export const TEMPLATE_VARIABLES: Array<{ key: string; description: string }> = [
  { key: 'first_name', description: "Prospect's first name" },
  { key: 'full_name', description: "Prospect's full name" },
  { key: 'company', description: 'Prospect company name' },
  { key: 'job_title', description: 'Prospect job title' },
  { key: 'city', description: 'Prospect city (from the company record)' },
  { key: 'org_name', description: 'Your organisation name (sender)' },
  { key: 'sender_name', description: 'Human sender name shown in the signature' },
  { key: 'talk_link', description: 'Personal "Talk to our AI" link (TALK_INVITE steps only)' },
  { key: 'talk_link_expires', description: 'Expiry date of the talk link, DD/MM/YYYY (TALK_INVITE steps only)' },
];

export type TemplateVariables = Partial<Record<(typeof TEMPLATE_VARIABLES)[number]['key'], string>> &
  Record<string, string | undefined>;

export interface RenderedTemplate {
  text: string;
  /** Variable names that were present in the template but had no value. */
  unresolved: string[];
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderTemplate(template: string, vars: TemplateVariables): RenderedTemplate {
  const unresolved = new Set<string>();
  const text = template.replace(PLACEHOLDER, (whole, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null || value === '') {
      unresolved.add(key);
      return whole;
    }
    return String(value);
  });
  return { text, unresolved: Array.from(unresolved) };
}

export function templateUsesVariable(template: string | undefined, key: string): boolean {
  if (!template) return false;
  return new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}').test(template);
}

export function formatIndianDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Builds the standard variable set for a lead; talk-link variables are added by the dispatcher. */
export function leadTemplateVariables(
  lead: Lead,
  extras: { city?: string; orgName: string; senderName?: string }
): TemplateVariables {
  return {
    first_name: lead.first_name,
    full_name: lead.full_name,
    company: lead.company_name,
    job_title: lead.job_title,
    city: extras.city,
    org_name: extras.orgName,
    sender_name: extras.senderName || `${extras.orgName} Sales Team`,
  };
}
