import fs from 'fs';
import path from 'path';

/**
 * JSON-file persistence for the in-memory store.
 *
 * The store is the single source of truth on the server; every mutation schedules a debounced
 * atomic write of the full snapshot to `.data/apex-store.json` (override with APEX_DATA_DIR).
 * Zero external services, survives `next start` / `next dev` restarts.
 *
 * Disabled automatically in the browser, under Vitest, and when APEX_PERSIST=false
 * (the Playwright dev server runs that way so every e2e run starts from seed data).
 */
export const SNAPSHOT_VERSION = 3;

export interface SnapshotEnvelope<T> {
  version: number;
  saved_at: string;
  data: T;
}

export function persistenceEnabled(): boolean {
  if (typeof window !== 'undefined') return false;
  if (process.env.APEX_PERSIST === 'false') return false;
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return false;
  return true;
}

export function dataDir(): string {
  return process.env.APEX_DATA_DIR || path.join(process.cwd(), '.data');
}

export function dataFilePath(): string {
  return path.join(dataDir(), 'apex-store.json');
}

export function readSnapshotFile<T>(): SnapshotEnvelope<T> | null {
  if (!persistenceEnabled()) return null;
  try {
    const file = dataFilePath();
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as SnapshotEnvelope<T>;
    if (!parsed || parsed.version !== SNAPSHOT_VERSION || !parsed.data) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[persistence] could not read snapshot, starting from seed data:', (err as Error).message);
    return null;
  }
}

let pending: (() => unknown) | undefined;
let timer: NodeJS.Timeout | undefined;
let exitHookInstalled = false;

function writeAtomic(json: string) {
  const file = dataFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, json, 'utf-8');
  fs.renameSync(tmp, file);
}

/** Writes whatever is pending right now (used on process exit and by tests). */
export function flushWrite(): boolean {
  if (!pending) return false;
  const getSnapshot = pending;
  pending = undefined;
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  try {
    const envelope: SnapshotEnvelope<unknown> = {
      version: SNAPSHOT_VERSION,
      saved_at: new Date().toISOString(),
      data: getSnapshot(),
    };
    writeAtomic(JSON.stringify(envelope));
    return true;
  } catch (err) {
    console.warn('[persistence] snapshot write failed:', (err as Error).message);
    return false;
  }
}

/** Debounced snapshot write; safe to call on every mutation. */
export function scheduleWrite(getSnapshot: () => unknown, delayMs = 200): void {
  if (!persistenceEnabled()) return;
  pending = getSnapshot;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    flushWrite();
  }, delayMs);
  // Do not keep the process alive just for the timer.
  if (typeof timer.unref === 'function') timer.unref();

  if (!exitHookInstalled) {
    exitHookInstalled = true;
    process.once('exit', () => {
      flushWrite();
    });
  }
}

export function deleteSnapshotFile(): void {
  pending = undefined;
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  try {
    const file = dataFilePath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (err) {
    console.warn('[persistence] could not delete snapshot:', (err as Error).message);
  }
}

export function snapshotFileInfo(): { enabled: boolean; path: string; exists: boolean; saved_at?: string; bytes?: number } {
  const file = dataFilePath();
  const enabled = persistenceEnabled();
  try {
    if (enabled && fs.existsSync(file)) {
      const stat = fs.statSync(file);
      let savedAt: string | undefined;
      try {
        savedAt = (JSON.parse(fs.readFileSync(file, 'utf-8')) as SnapshotEnvelope<unknown>).saved_at;
      } catch {
        savedAt = undefined;
      }
      return { enabled, path: file, exists: true, saved_at: savedAt, bytes: stat.size };
    }
  } catch {
    // fall through
  }
  return { enabled, path: file, exists: false };
}
