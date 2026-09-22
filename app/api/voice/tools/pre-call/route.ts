import { NextRequest, NextResponse } from 'next/server';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { resolveLeadContextFromNonce } from '@/lib/voice/resolver';

export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const talkRef =
      body.initial_context?.talk_ref ||
      body.talk_ref ||
      req.nextUrl.searchParams.get('talk_ref');

    if (!talkRef) {
      return NextResponse.json(
        { error: 'Missing talk_ref in initial_context' },
        { status: 400 }
      );
    }

    const resolution = await resolveLeadContextFromNonce(talkRef);
    if (!resolution.valid || !resolution.context) {
      return NextResponse.json(
        { error: resolution.error || 'Failed to resolve context from talk_ref' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      initial_context: resolution.context,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error during pre-call fetch' },
      { status: 500 }
    );
  }
}
