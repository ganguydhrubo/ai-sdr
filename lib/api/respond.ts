import { NextRequest, NextResponse } from 'next/server';

/** Uniform JSON envelope for the admin UI routes. */
export function jsonOk<T extends object>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, ...data }, init);
}

export function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error: message, ...extra }, { status });
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest | Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Maps thrown errors to 404 for "not found" and 400 otherwise, without leaking stack traces. */
export function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const status = /not found/i.test(message)
    ? 404
    : /cannot|invalid|required|already|must|only|paused|archived|suppressed|disabled|no leads|unresolved|expired|revoked|is not a|has no /i.test(message)
      ? 400
      : 500;
  return jsonError(message, status);
}
