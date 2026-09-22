import { NextResponse } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { ComplianceGuard } from '@/lib/compliance/guard';
import { computeVoiceAnalytics } from '@/lib/voice/analytics';
import { checkCallingWindowIST } from '@/lib/voice/compliance';
import { getIntegrationStatus } from '@/lib/integrations/status';
import type { AppState } from '@/lib/state-types';

export const dynamic = 'force-dynamic';

/**
 * The single snapshot every admin page renders from. The server-side store is the source of
 * truth; pages never instantiate their own copy of the data.
 */
export async function GET() {
  const store = getDemoStore();
  const integrations = await getIntegrationStatus();
  const window = checkCallingWindowIST();

  const state: AppState = {
    org: store.org,
    users: store.users,
    icp: store.icp,
    companies: store.companies,
    leads: store.leads,
    campaigns: store.campaigns,
    campaignSteps: store.campaignSteps,
    messages: store.messages,
    conversations: store.conversations,
    meetings: store.meetings,
    tasks: store.tasks,
    auditLogs: store.auditLogs.slice(0, 400),
    aiRuns: store.aiRuns.slice(0, 400),
    talkSessions: store.talkSessions,
    voiceCalls: store.voiceCalls,
    voiceSettings: store.voiceSettings,
    suppressionList: ComplianceGuard.getSuppressionList(),
    whatsappAntiBan: store.whatsappAntiBan,
    stats: store.getStats(),
    voiceAnalytics: computeVoiceAnalytics(),
    callingWindow: { allowed: window.allowed, timeString: window.timeString, reason: window.reason },
    integrations,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    serverTime: new Date().toISOString(),
  };

  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
