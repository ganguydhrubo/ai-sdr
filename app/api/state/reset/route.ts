import { resetDemoStore } from '@/lib/store/demo-store';
import { invalidateIntegrationCache } from '@/lib/integrations/status';
import { jsonOk } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Throws away the persisted snapshot and reseeds the demo data. */
export async function POST() {
  const store = resetDemoStore();
  invalidateIntegrationCache();
  return jsonOk({ leads: store.leads.length, campaigns: store.campaigns.length, reset_at: new Date().toISOString() });
}
