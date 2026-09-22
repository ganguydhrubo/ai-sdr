import { NextResponse } from 'next/server';
import { SESSION_COOKIE, authConfigured, checkCredentials, sessionToken } from '../../../../lib/auth';

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: 'AUTH_PASSWORD is not configured on the server.' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!checkCredentials(username, password)) {
    return NextResponse.json({ error: 'Invalid ID or password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
