import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { evaluatePstnGate } from '../lib/voice/compliance';
import { GET as getSettings, PUT as putSettings } from '../app/api/voice/settings/route';
import { getDemoStore } from '../lib/store/demo-store';
import { ComplianceGuard } from '../lib/compliance/guard';
import type { VoiceSettings } from '../lib/types';

const READY: VoiceSettings = {
  id: 'vset_test',
  organization_id: 'org_test',
  voice_enabled: true,
  web_voice_enabled: true,
  pstn_enabled: true,
  dlt_entity_id: '110155223344',
  caller_id_series: '1600',
  advance_notice_given: true,
  oap_autodialer_notice_date: '2026-09-01',
  calling_window_start: '09:00',
  calling_window_end: '21:00',
  timezone: 'Asia/Kolkata',
  pstn_daily_cap: 50,
  talk_link_ttl_days: 7,
  talk_link_max_calls: 3,
  recording_enabled: true,
};

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/voice/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PSTN readiness gate (Voice Settings)', () => {
  afterEach(() => {
    if (ComplianceGuard.isEmergencyKillSwitchActive()) getDemoStore().toggleKillSwitch();
  });

  it('passes all eight items for a fully configured organisation', () => {
    const gate = evaluatePstnGate(READY);
    expect(gate.total).toBe(8);
    expect(gate.passed).toBe(8);
    expect(gate.ready).toBe(true);
    expect(gate.items.map((i) => i.id)).toEqual([
      'kill_switch',
      'voice_enabled',
      'pstn_enabled',
      'calling_window',
      'dlt_entity_id',
      'caller_id_series',
      'oap_advance_notice',
      'lead_scrubbing',
    ]);
    expect(gate.items.find((i) => i.id === 'lead_scrubbing')?.runtime).toBe(true);
  });

  it('names every failing item with an action for the operator', () => {
    const gate = evaluatePstnGate({
      ...READY,
      pstn_enabled: false,
      dlt_entity_id: '',
      caller_id_series: undefined,
      advance_notice_given: false,
      calling_window_start: '08:00',
    });
    expect(gate.ready).toBe(false);
    const failing = gate.items.filter((i) => !i.passed);
    expect(failing.map((i) => i.id)).toEqual([
      'pstn_enabled',
      'calling_window',
      'dlt_entity_id',
      'caller_id_series',
      'oap_advance_notice',
    ]);
    for (const item of failing) expect(item.action, item.id).toBeTruthy();
  });

  it('fails the first item while the emergency kill switch is engaged', () => {
    getDemoStore().toggleKillSwitch();
    const gate = evaluatePstnGate(READY);
    expect(gate.items[0].passed).toBe(false);
    expect(gate.ready).toBe(false);
  });
});

describe('GET/PUT /api/voice/settings', () => {
  it('returns settings, the gate, the provider and the script version', async () => {
    const res = await getSettings();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.settings.talk_link_ttl_days).toBeGreaterThan(0);
    expect(json.gate.items).toHaveLength(8);
    expect(json.provider).toBe('demo');
    expect(json.script_version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(json.provider_cost_note).toMatch(/Provider cost not included/);
  });

  it('rejects invalid values', async () => {
    const res = await putSettings(putRequest({ caller_id_series: '9999', talk_link_ttl_days: 0 }));
    expect(res.status).toBe(400);
  });

  it('refuses to enable PSTN while the gate fails, and allows it once everything passes', async () => {
    const store = getDemoStore();
    const blocked = await putSettings(putRequest({ pstn_enabled: true, advance_notice_given: false }));
    expect(blocked.status).toBe(422);
    const blockedJson = await blocked.json();
    expect(blockedJson.failing).toContain('Advance autodialer notice filed with the OAP');
    expect(store.getVoiceSettings().pstn_enabled).toBe(false);

    const ok = await putSettings(
      putRequest({
        pstn_enabled: true,
        advance_notice_given: true,
        oap_autodialer_notice_date: '2026-09-01',
        dlt_entity_id: '110155223344',
        caller_id_series: '140',
        calling_window_start: '09:00',
        calling_window_end: '21:00',
      })
    );
    expect(ok.status).toBe(200);
    const okJson = await ok.json();
    expect(okJson.settings.pstn_enabled).toBe(true);
    expect(okJson.gate.ready).toBe(true);
    expect(store.auditLogs.some((l) => l.action === 'VOICE_SETTINGS_UPDATED')).toBe(true);

    // leave the store as it was for other tests
    await putSettings(putRequest({ pstn_enabled: false }));
  });
});
