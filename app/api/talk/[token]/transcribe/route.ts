import { NextRequest, NextResponse } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { hashToken } from '@/lib/voice/talk-links';

export const dynamic = 'force-dynamic';

const LANGUAGE_CODES: Record<string, string> = { en: 'en', hi: 'hi', bn: 'bn', hinglish: 'hi' };

/**
 * Speech-to-text fallback for browsers without the Web Speech API: multipart {file, language}
 * → Groq Whisper (free tier). Returns 503 when no GROQ_API_KEY is configured so the client
 * falls back to typing.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const store = getDemoStore();
  const hash = hashToken(params.token);
  const session = store.findTalkSessionByTokenHash(hash) || store.getTalkSessions().find((s) => s.token === params.token);
  if (!session) return NextResponse.json({ error: 'Talk session not found' }, { status: 404 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || process.env.DEMO_MODE === 'true') {
    return NextResponse.json({ error: 'Transcription is not configured (GROQ_API_KEY)' }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: 'file is required' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'audio too large (max 10 MB)' }, { status: 413 });
    const language = LANGUAGE_CODES[String(form.get('language') || 'en')] || 'en';

    const upstream = new FormData();
    upstream.append('file', file, 'audio.webm');
    upstream.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
    upstream.append('language', language);
    upstream.append('response_format', 'json');
    upstream.append('temperature', '0');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json({ error: `Groq transcription failed (${res.status}): ${detail.slice(0, 200)}` }, { status: 502 });
    }
    const json = (await res.json()) as { text?: string };
    return NextResponse.json({ success: true, text: (json.text || '').trim() });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Transcription failed' }, { status: 500 });
  }
}
