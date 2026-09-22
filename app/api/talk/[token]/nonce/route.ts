import { NextRequest, NextResponse } from 'next/server';
import { resolveTalkToken, mintTalkNonce } from '@/lib/voice/talk-links';

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const resolution = await resolveTalkToken(token);

    if (!resolution.valid || !resolution.session) {
      return NextResponse.json(
        { error: resolution.error || 'Talk link is invalid or expired' },
        { status: 403 }
      );
    }

    const session = resolution.session;
    const { nonce, expiresAt } = await mintTalkNonce(
      session.id,
      session.organization_id,
      session.lead_id,
      300 // 5 minutes TTL
    );

    return NextResponse.json({
      success: true,
      nonce,
      expiresAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to mint call nonce' },
      { status: 500 }
    );
  }
}
