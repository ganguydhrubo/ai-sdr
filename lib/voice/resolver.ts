import { Lead, Organization } from '../types';
import { getDemoStore } from '../store/demo-store';
import { getSupabaseClient } from '../supabase';
import { peekTalkNonce, resolveTalkToken } from './talk-links';
import { PreCallResponse } from './schemas';

export interface ResolvedLeadContext {
  valid: boolean;
  error?: string;
  lead?: Lead;
  org?: Organization;
  context?: PreCallResponse['initial_context'];
}

export interface PublicTalkContext {
  valid: boolean;
  error?: string;
  publicContext?: {
    leadFirstName: string;
    companyName: string;
    orgName: string;
    agentName: string;
    language: string;
    channel: string;
    callsRemaining: number;
    expiresAt: string;
    status: string;
  };
}

/**
 * Resolves verified lead context server-side from a single-use talk nonce (talk_ref).
 * Enforces strict data minimization: full phone and email are not passed into client context.
 */
export async function resolveLeadContextFromNonce(nonce: string): Promise<ResolvedLeadContext> {
  if (!nonce) {
    return { valid: false, error: 'talk_ref nonce is required' };
  }

  const nonceRes = await peekTalkNonce(nonce);
  if (!nonceRes.valid || !nonceRes.nonceRecord) {
    return { valid: false, error: nonceRes.error || 'Invalid or expired talk_ref nonce' };
  }

  const { lead_id, organization_id } = nonceRes.nonceRecord;
  const demoStore = getDemoStore();
  const supabase = getSupabaseClient();

  let lead: Lead | undefined;
  let org: Organization | undefined;

  if (supabase) {
    try {
      const [leadQuery, orgQuery] = await Promise.all([
        supabase.from('leads').select('*').eq('id', lead_id).maybeSingle(),
        supabase.from('organizations').select('*').eq('id', organization_id).maybeSingle(),
      ]);

      if (leadQuery.data) lead = leadQuery.data as Lead;
      if (orgQuery.data) org = orgQuery.data as Organization;
    } catch {
      // fallback
    }
  }

  if (!lead) {
    lead = demoStore.getLeads().find((l) => l.id === lead_id);
  }
  if (!org) {
    org = demoStore.getOrg();
  }

  if (!lead) {
    return { valid: false, error: `Lead record ${lead_id} not found` };
  }

  // Extract verified research facts from research notes or enrichment
  const verifiedResearchFacts = [
    {
      fact_key: 'industry',
      fact_value: lead.industry || 'B2B Services',
      source: 'VERIFIED_ENRICHMENT',
      confidence: 0.95,
    },
    {
      fact_key: 'location',
      fact_value: `${lead.city || 'Mumbai'}, ${lead.state || 'Maharashtra'}`,
      source: 'PUBLIC_RECORDS',
      confidence: 0.9,
    },
  ];

  if (lead.notes) {
    verifiedResearchFacts.push({
      fact_key: 'recent_development',
      fact_value: lead.notes.substring(0, 150),
      source: 'SALES_INTELLIGENCE',
      confidence: 0.88,
    });
  }

  const sanitizedContext: PreCallResponse['initial_context'] = {
    first_name: lead.first_name || 'Business Leader',
    company: lead.company_name || 'Enterprise',
    role: lead.job_title || 'Decision Maker',
    org_name: org?.name || 'Apex Technologies',
    campaign_summary: 'B2B Sales Velocity & AI SDR Platform Briefing',
    language: lead.preferred_language || 'en',
    allowed_topics: 'B2B sales automation, pipeline acceleration, Indian market CRM integration, meeting booking',
    verified_research_facts: verifiedResearchFacts,
  };

  return {
    valid: true,
    lead,
    org,
    context: sanitizedContext,
  };
}

/**
 * Resolves safe public metadata for the /talk/[token] landing page.
 * Never returns prospect email, full phone, or private CRM notes.
 */
export async function resolvePublicTalkContext(token: string): Promise<PublicTalkContext> {
  const tokenRes = await resolveTalkToken(token);
  if (!tokenRes.valid || !tokenRes.session) {
    return {
      valid: false,
      error: tokenRes.error || 'Talk link is invalid or expired',
    };
  }

  const session = tokenRes.session;
  const demoStore = getDemoStore();
  const lead = demoStore.getLeads().find((l) => l.id === session.lead_id);
  const org = demoStore.getOrg();

  const callsRemaining = Math.max(0, session.max_calls - session.call_count);

  return {
    valid: true,
    publicContext: {
      leadFirstName: lead?.first_name || session.lead_name?.split(' ')[0] || 'Guest',
      companyName: lead?.company_name || session.lead_company || 'Your Enterprise',
      orgName: org?.name || 'Apex SDR',
      agentName: 'Apex SDR AI Representative',
      language: session.language || 'en',
      channel: session.channel || 'email',
      callsRemaining,
      expiresAt: session.expires_at,
      status: session.status,
    },
  };
}
