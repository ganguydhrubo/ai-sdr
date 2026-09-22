/** Simple ID/password gate for the admin app. Not multi-user auth — one shared operator login. */
export const SESSION_COOKIE = 'apex_session';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function authConfigured(): boolean {
  return !!process.env.AUTH_PASSWORD;
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.AUTH_USERNAME || 'admin';
  const expectedPass = process.env.AUTH_PASSWORD || '';
  return expectedPass.length > 0 && username === expectedUser && password === expectedPass;
}

/** Deterministic session token derived from server-only secrets; never sent anywhere but the cookie. */
export async function sessionToken(): Promise<string> {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.AUTH_PASSWORD || 'apex-sdr-dev-secret';
  return sha256Hex(`apex-sdr-session:${secret}`);
}
