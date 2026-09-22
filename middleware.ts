import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, authConfigured, sessionToken } from './lib/auth';

// Everything is gated except: the login page/API, static assets, and the public
// prospect-facing talk flow (/talk/* and its API) which must stay reachable without a login.
export const config = {
  matcher: ['/((?!_next|favicon.ico|login|talk|api/auth|api/talk).*)'],
};

export async function middleware(req: NextRequest) {
  // No AUTH_PASSWORD set (e.g. local dev) → gate is off, exactly like before this change.
  if (!authConfigured()) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = await sessionToken();

  if (cookie && cookie === expected) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('from', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
