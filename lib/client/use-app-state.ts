'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppState } from '../state-types';

/**
 * One shared snapshot of the server-side store for every page and the shell.
 * Pages call refresh() after a mutation; the shell polls slowly so other tabs / n8n / the talk
 * page's effects show up without a reload.
 */
let cache: AppState | null = null;
let inflight: Promise<AppState> | null = null;
let lastError: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export async function refreshAppState(): Promise<AppState> {
  if (inflight) return inflight;
  inflight = fetch('/api/state', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`GET /api/state → ${res.status}`);
      const json = (await res.json()) as AppState;
      cache = json;
      lastError = null;
      return json;
    })
    .catch((err: Error) => {
      lastError = err.message;
      throw err;
    })
    .finally(() => {
      inflight = null;
      notify();
    });
  return inflight;
}

export function getCachedAppState(): AppState | null {
  return cache;
}

export interface UseAppStateOptions {
  /** Poll interval in ms (0 = no polling). */
  pollMs?: number;
}

export function useAppState(options: UseAppStateOptions = {}) {
  const [, force] = useState(0);
  const pollMs = options.pollMs ?? 0;

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    if (!cache) {
      refreshAppState().catch(() => undefined);
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    if (pollMs > 0) {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') refreshAppState().catch(() => undefined);
      }, pollMs);
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAppState().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      listeners.delete(listener);
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pollMs]);

  const refresh = useCallback(() => refreshAppState(), []);

  return { state: cache, loading: !cache && !lastError, error: lastError, refresh };
}
