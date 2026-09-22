import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { ComplianceGuard } from '@/lib/compliance/guard';
import { getIntegrationStatus, invalidateIntegrationCache } from '@/lib/integrations/status';
import { normalizeEmail, normalizeIndianPhone } from '@/lib/normalization/india';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';
import type { DeliveryMode, ICPConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ICP_WEIGHT_KEYS: Array<keyof ICPConfig> = [
  'weight_industry',
  'weight_company_size',
  'weight_role_seniority',
  'weight_geography',
  'weight_tech_fit',
  'weight_business_signals',
  'weight_contact_quality',
];

export async function GET() {
  const store = getDemoStore();
  return jsonOk({
    org: store.org,
    icp: store.icp,
    suppressionList: ComplianceGuard.getSuppressionList(),
    integrations: await getIntegrationStatus(),
  });
}

/** Organisation settings: delivery mode & test recipients, autonomous outreach, AI budget, ICP matrix. */
export async function PUT(req: NextRequest) {
  try {
    const store = getDemoStore();
    const body = await readJson<{
      delivery_mode?: DeliveryMode;
      outbound_test_email?: string;
      outbound_test_phone?: string;
      is_autonomous_outreach_enabled?: boolean;
      monthly_ai_budget?: number;
      icp?: Partial<ICPConfig>;
    }>(req);
    const changes: string[] = [];

    if (body.delivery_mode !== undefined) {
      if (!['SIMULATED', 'LIVE', 'LIVE_REDIRECT'].includes(body.delivery_mode)) return jsonError('Invalid delivery_mode', 400);
      if (body.delivery_mode !== store.org.delivery_mode) changes.push(`delivery ${store.org.delivery_mode} → ${body.delivery_mode}`);
      store.org.delivery_mode = body.delivery_mode;
    }
    if (body.outbound_test_email !== undefined) {
      const value = body.outbound_test_email.trim();
      if (value && !normalizeEmail(value).isValid) return jsonError('Invalid test email', 400);
      store.org.outbound_test_email = value ? normalizeEmail(value).normalized : undefined;
      changes.push('test email');
    }
    if (body.outbound_test_phone !== undefined) {
      const value = body.outbound_test_phone.trim();
      if (value && !normalizeIndianPhone(value).isValid) return jsonError('Invalid test phone (Indian mobile expected)', 400);
      store.org.outbound_test_phone = value ? normalizeIndianPhone(value).normalized : undefined;
      changes.push('test phone');
    }
    if (body.is_autonomous_outreach_enabled !== undefined) {
      store.org.is_autonomous_outreach_enabled = !!body.is_autonomous_outreach_enabled;
      changes.push(`autonomous outreach ${store.org.is_autonomous_outreach_enabled ? 'on' : 'off'}`);
    }
    if (body.monthly_ai_budget !== undefined) {
      const budget = Number(body.monthly_ai_budget);
      if (!Number.isFinite(budget) || budget < 0) return jsonError('Invalid monthly_ai_budget', 400);
      store.org.monthly_ai_budget = budget;
      changes.push(`AI budget $${budget}`);
    }
    if (body.icp) {
      const next = { ...store.icp };
      for (const key of ICP_WEIGHT_KEYS) {
        const v = body.icp[key];
        if (v !== undefined) {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0 || n > 100) return jsonError(`Invalid ${key}`, 400);
          (next as Record<string, unknown>)[key] = Math.round(n);
        }
      }
      const total = ICP_WEIGHT_KEYS.reduce((acc, k) => acc + Number(next[k]), 0);
      if (total !== 100) return jsonError(`ICP weights must sum to 100 (got ${total})`, 400);
      if (body.icp.minimum_qualifying_score !== undefined) {
        const min = Number(body.icp.minimum_qualifying_score);
        if (!Number.isFinite(min) || min < 0 || min > 100) return jsonError('Invalid minimum_qualifying_score', 400);
        next.minimum_qualifying_score = Math.round(min);
      }
      for (const key of ['target_industries', 'target_roles', 'target_geographies'] as const) {
        if (Array.isArray(body.icp[key])) next[key] = (body.icp[key] as string[]).map(String).filter(Boolean);
      }
      store.icp = next;
      changes.push('ICP matrix');
    }

    store.recordAuditLog('USER', 'ORG_SETTINGS_UPDATED', 'organization', store.org.id, changes.length ? `Updated: ${changes.join(', ')}` : 'Settings saved (no changes)');
    invalidateIntegrationCache();
    store.persist();
    return jsonOk({ org: store.org, icp: store.icp, integrations: await getIntegrationStatus() });
  } catch (err) {
    return errorResponse(err);
  }
}
