import { NextRequest, NextResponse } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { hashToken } from '@/lib/voice/talk-links';

export const dynamic = 'force-dynamic';

/**
 * Optional server-side TTS (Groq Orpheus, English only, free tier) when VOICE_TTS_PROVIDER=groq.
 * Returns 204 when not configured — the browser then uses speechSynthesis (free, offline).
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const store = getDemoStore();
  const hash = hashToken(params.token);
  const session = store.findTalkSessionByTokenHash(hash) || store.getTalkSessions().find((s) => s.token === params.token);
  if (!session) return NextResponse.json({ error: 'Talk session not found' }, { status: 404 });

  const apiKey = process.env.GROQ_API_KEY;
  if (process.env.VOICE_TTS_PROVIDER !== 'groq' || !apiKey || process.env.DEMO_MODE === 'true') {
    return new Response(null, { status: 204 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { text?: string; language?: string };
    const text = (body.text || '').trim().slice(0, 1200);
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });
    if (body.language && body.language !== 'en') return new Response(null, { status: 204 }); // Orpheus v1 is English-only

    const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english',
        voice: process.env.GROQ_TTS_VOICE || 'tara',
        input: text,
        response_format: 'wav',
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return new Response(null, { status: 204 });
    const audio = await res.arrayBuffer();
    return new Response(audio, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
  } catch {
    return new Response(null, { status: 204 });
  }
}
