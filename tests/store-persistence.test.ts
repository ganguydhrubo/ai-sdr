import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDemoStore, resetDemoStore } from '../lib/store/demo-store';
import { ComplianceGuard } from '../lib/compliance/guard';
import { dataFilePath, flushWrite, persistenceEnabled, readSnapshotFile, scheduleWrite, SNAPSHOT_VERSION } from '../lib/store/persistence';

describe('Store snapshot / hydrate (the server is the single source of truth)', () => {
  afterEach(() => {
    resetDemoStore();
  });

  it('round-trips every collection, the suppression list and the kill switch through a JSON snapshot', () => {
    const store = getDemoStore();
    const lead = store.addLead({ first_name: 'Snap', last_name: 'Shot', company_name: 'Snapshot Ltd', phone: '+919811100001', email: 'snap@snapshot.in' });
    store.addTask({ title: 'Persisted task', lead_id: lead.id });
    store.addMeeting({ lead_id: lead.id, title: 'Persisted meeting', meet_url: 'https://meet.jit.si/ApexSDR-test' });
    ComplianceGuard.addSuppression({ email: 'persist@blocked.in', reason: 'MANUAL_BLOCK' });
    store.setKillSwitch(true);
    store.whatsappAntiBan.dailyLimit = 77;

    const snapshot = JSON.parse(JSON.stringify(store.snapshot()));
    expect(snapshot.leads.some((l: { id: string }) => l.id === lead.id)).toBe(true);
    expect(snapshot.suppressionList.some((s: { email?: string }) => s.email === 'persist@blocked.in')).toBe(true);
    expect(snapshot.org.emergency_kill_switch_active).toBe(true);

    // A fresh (seeded) store hydrated from the snapshot must look identical.
    const fresh = resetDemoStore();
    expect(fresh.leads.some((l) => l.id === lead.id)).toBe(false);
    expect(ComplianceGuard.isEmergencyKillSwitchActive()).toBe(false);

    fresh.hydrate(snapshot);
    expect(fresh.leads.some((l) => l.id === lead.id)).toBe(true);
    expect(fresh.tasks.some((t) => t.title === 'Persisted task')).toBe(true);
    expect(fresh.meetings.some((m) => m.title === 'Persisted meeting')).toBe(true);
    expect(fresh.whatsappAntiBan.dailyLimit).toBe(77);
    expect(ComplianceGuard.isSuppressed('persist@blocked.in').suppressed).toBe(true);
    expect(ComplianceGuard.isEmergencyKillSwitchActive()).toBe(true);
    expect(fresh.org.delivery_mode).toBeDefined();
  });

  it('is disabled under the test runner and writes an atomic versioned file when enabled', () => {
    expect(persistenceEnabled()).toBe(false);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-persist-'));
    const env = { VITEST: process.env.VITEST, NODE_ENV: process.env.NODE_ENV, APEX_DATA_DIR: process.env.APEX_DATA_DIR, APEX_PERSIST: process.env.APEX_PERSIST };
    try {
      delete process.env.VITEST;
      (process.env as Record<string, string>).NODE_ENV = 'development';
      process.env.APEX_DATA_DIR = tmp;
      process.env.APEX_PERSIST = 'true';
      expect(persistenceEnabled()).toBe(true);
      expect(dataFilePath()).toBe(path.join(tmp, 'apex-store.json'));

      scheduleWrite(() => ({ hello: 'world' }));
      expect(flushWrite()).toBe(true);
      const envelope = readSnapshotFile<{ hello: string }>();
      expect(envelope?.version).toBe(SNAPSHOT_VERSION);
      expect(envelope?.data.hello).toBe('world');
      expect(fs.readdirSync(tmp).filter((f) => f.endsWith('.tmp'))).toHaveLength(0);
    } finally {
      if (env.VITEST !== undefined) process.env.VITEST = env.VITEST;
      (process.env as Record<string, string>).NODE_ENV = env.NODE_ENV || 'test';
      if (env.APEX_DATA_DIR === undefined) delete process.env.APEX_DATA_DIR;
      else process.env.APEX_DATA_DIR = env.APEX_DATA_DIR;
      if (env.APEX_PERSIST === undefined) delete process.env.APEX_PERSIST;
      else process.env.APEX_PERSIST = env.APEX_PERSIST;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('resetDemoStore returns to seed data and clears the guard', () => {
    const store = getDemoStore();
    const before = store.leads.length;
    store.addLead({ first_name: 'Temp', company_name: 'Temp Co', phone: '+919811100002', email: 'temp@tempco.in' });
    ComplianceGuard.addSuppression({ email: 'temp@tempco.in', reason: 'MANUAL_BLOCK' });
    const fresh = resetDemoStore();
    expect(fresh.leads.length).toBe(before);
    expect(ComplianceGuard.isSuppressed('temp@tempco.in').suppressed).toBe(false);
    expect(fresh.auditLogs[0].action).toBe('DEMO_DATA_RESET');
  });
});
