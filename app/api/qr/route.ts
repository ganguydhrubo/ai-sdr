import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

/** PNG QR code for a URL (talk links on the Voice Hub) — generated locally, no external service. */
export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get('text') || '';
  if (!text || text.length > 2048) return NextResponse.json({ error: 'text is required (max 2048 chars)' }, { status: 400 });
  const png = await QRCode.toBuffer(text, { margin: 2, scale: 6, color: { dark: '#1e293b', light: '#ffffff' } });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
}
