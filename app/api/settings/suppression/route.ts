import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { ComplianceGuard, SuppressionEntry } from '@/lib/compliance/guard';
import { normalizeEmail, normalizeIndianPhone } from '@/lib/normalization/india';
import { jsonError, jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

const REASONS: SuppressionEntry['reason'][] = ['UNSUBSCRIBED', 'DO_NOT_CONTACT', 'BOUNCE', 'COMPLAINT', 'MANUAL_BLOCK'];

function classify(identifier: string): Partial<SuppressionEntry> | null {
  const value = identifier.trim();
  if (!value) return null;
  if (value.includes('@')) {
    const email = normalizeEmail(value);
    return email.isValid ? { email: email.normalized } : null;
  }
  if (/^[+\d][\d\s\-()]{6,}$/.test(value)) {
    const phone = normalizeIndianPhone(value);
    return phone.isValid ? { phone: phone.normalized } : null;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return { domain: value.toLowerCase() };
  return null;
}

/** Adds an email, Indian phone or domain to the global suppression registry. */
export async function POST(req: NextRequest) {
  const store = getDemoStore();
  const body = await readJson<{ identifier?: string; reason?: SuppressionEntry['reason'] }>(req);
  const target = classify(body.identifier || '');
  if (!target) return jsonError('Enter a valid email, Indian phone number or domain', 400);
  const reason = body.reason && REASONS.includes(body.reason) ? body.reason : 'MANUAL_BLOCK';
  const entry = ComplianceGuard.addSuppression({ ...target, reason });

  // Flag matching leads so the pipeline shows them as suppressed.
  for (const lead of store.leads) {
    const hit =
      (target.email && lead.normalized_email === target.email) ||
      (target.phone && lead.normalized_phone === target.phone) ||
      (target.domain && lead.normalized_email.endsWith(`@${target.domain}`));
    if (hit) {
      lead.is_suppressed = true;
      lead.suppression_reason = `Suppression list: ${reason}`;
      lead.updated_at = new Date().toISOString();
    }
  }
  store.recordAuditLog('USER', 'SUPPRESSION_ADDED', 'suppression', entry.email || entry.phone || entry.domain || 'entry', `Suppressed ${entry.email || entry.phone || entry.domain} (${reason})`);
  store.persist();
  return jsonOk({ entry, suppressionList: ComplianceGuard.getSuppressionList() });
}

export async function DELETE(req: NextRequest) {
  const store = getDemoStore();
  const body = await readJson<{ identifier?: string }>(req);
  const identifier = (body.identifier || req.nextUrl.searchParams.get('identifier') || '').trim();
  if (!identifier) return jsonError('identifier is required', 400);
  const removed = ComplianceGuard.removeSuppression(identifier);
  if (removed === 0) return jsonError('No matching suppression entry', 404);
  const lower = identifier.toLowerCase();
  const phone = normalizeIndianPhone(identifier);
  for (const lead of store.leads) {
    if (lead.normalized_email === lower || (phone.isValid && lead.normalized_phone === phone.normalized) || lead.normalized_email.endsWith(`@${lower}`)) {
      if (!ComplianceGuard.isSuppressed(lead.email, lead.phone).suppressed) {
        lead.is_suppressed = false;
        lead.suppression_reason = undefined;
        lead.updated_at = new Date().toISOString();
      }
    }
  }
  store.recordAuditLog('USER', 'SUPPRESSION_REMOVED', 'suppression', identifier, `Removed ${identifier} from the suppression list`);
  store.persist();
  return jsonOk({ removed, suppressionList: ComplianceGuard.getSuppressionList() });
}
