'use client';

/** Thin fetch helpers for the admin UI. Every mutation returns the JSON envelope from lib/api/respond.ts. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: Record<string, unknown>
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text };
  }
  if (!res.ok || payload.success === false) {
    const message = (payload.error as string) || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }
  return payload as T;
}

export const api = {
  get: <T = Record<string, unknown>>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T = Record<string, unknown>>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T = Record<string, unknown>>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T = Record<string, unknown>>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T = Record<string, unknown>>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) }),
};
