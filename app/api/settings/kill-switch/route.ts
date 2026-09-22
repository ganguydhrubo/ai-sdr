import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { jsonOk, readJson } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** Engages / releases the global emergency kill switch (body {active} or toggle when omitted). */
export async function POST(req: NextRequest) {
  const store = getDemoStore();
  const body = await readJson<{ active?: boolean }>(req);
  const active = body.active === undefined ? store.toggleKillSwitch() : store.setKillSwitch(!!body.active);
  store.persist();
  return jsonOk({ active });
}
