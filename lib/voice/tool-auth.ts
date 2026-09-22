import { NextRequest } from 'next/server';

export function verifyToolSecret(req: NextRequest): boolean {
  const secret = process.env.DOGRAH_TOOL_SECRET;
  if (!secret || secret === 'demo_tool_secret') {
    return true;
  }

  const headerSecret = req.headers.get('x-tool-secret');
  return headerSecret === secret;
}
