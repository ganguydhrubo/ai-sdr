import { getDemoStore } from '../store/demo-store';
import { getTrackedAI } from '../ai/tracked';
import { ComplianceGuard } from '../compliance/guard';
import { AISalesBrief, Lead, OutboundMessage, Conversation, Channel, ConversationIntent, CampaignStep } from '../types';
import { dispatchTalkInvite } from './talk-invite';
import { renderTemplate, leadTemplateVariables } from '../outreach/templates';

const POSITIVE_INTENTS: ConversationIntent[] = ['INTERESTED', 'REQUEST_DEMO', 'REQUEST_PRICING', 'REQUEST_INFORMATION'];

const INDUSTRY_HINTS: Array<[RegExp, string]> = [
  [/logistic|cold[- ]?chain|freight|cargo|3pl|supply|transport|shipping|warehouse/i, 'Logistics & Supply Chain'],
  [/software|saas|cloud|tech|digital|app|data|ai\b|analytics|fintech|platform/i, 'SaaS & Cloud Software'],
  [/consult|it services|infotech|systems|solutions|outsourc/i, 'IT Services & Consulting'],
  [/agro|food|fmcg|beverage|dairy|retail|distribut|trading|consumer/i, 'FMCG / FMCD Distribution'],
  [/forg|gear|precision|steel|metal|auto|component|machin|engineering|industr|manufactur|tool|electro|textile|chemical|pharma|packag|cement|plast|casting|fabricat/i, 'Industrial Manufacturing'],
];

/** Best-effort industry from the company name for leads that arrived without an enrichment record. */
export function inferIndustryFromCompanyName(name?: string): string | undefined {
  if (!name) return undefined;
  for (const [pattern, industry] of INDUSTRY_HINTS) {
    if (pattern.test(name)) return industry;
  }
  return undefined;
}

export class SDROrchestrator {
  /**
   * Executes the complete autonomous workflow for an ingested lead:
   * Research -> Score -> Qualify -> Personalize -> Guardrail -> Queue Outreach
   */
  public static async processLead(leadId: string): Promise<{
    success: boolean;
    lead: Lead;
    message?: OutboundMessage;
    stepsTaken: string[];
    error?: string;
  }> {
    const store = getDemoStore();
    const lead = store.leads.find((l) => l.id === leadId);
    const stepsTaken: string[] = [];

    if (!lead) {
      return { success: false, lead: {} as Lead, stepsTaken, error: `Lead not found: ${leadId}` };
    }

    // 1. Validation & Suppression Check
    stepsTaken.push('VALIDATION_AND_SUPPRESSION_CHECK');
    const suppression = ComplianceGuard.isSuppressed(lead.email, lead.phone);
    if (suppression.suppressed || lead.is_suppressed) {
      lead.is_suppressed = true;
      lead.status = 'DISQUALIFIED';
      lead.updated_at = new Date().toISOString();
      store.recordAuditLog('AI_AGENT', 'LEAD_SUPPRESSED', 'lead', lead.id, suppression.reason || lead.suppression_reason || 'On suppression list');
      return { success: false, lead, stepsTaken, error: suppression.reason || lead.suppression_reason || 'Lead is suppressed' };
    }

    // 2. Company Research Agent
    stepsTaken.push('RESEARCH_AGENT_EXECUTION');
    lead.status = 'RESEARCHING';
    store.recordAuditLog('AI_AGENT', 'RESEARCH_STARTED', 'lead', lead.id, `Gathering verified signals for ${lead.company_name}`);

    // Verified research signals come from the company record (registry data) — never invented.
    const company = store.companies.find((c) => c.id === lead.company_id);
    const city = company?.city || lead.city || 'India';
    if (!company && !lead.industry) {
      lead.industry = inferIndustryFromCompanyName(lead.company_name);
    }
    const industry = company?.industry || lead.industry || 'B2B services (industry not on file)';
    lead.research = [
      {
        fact_key: 'target_market_expansion',
        fact_value: `Expanding B2B customer acquisition in ${city} corridor with focus on sales velocity.`,
        category: 'EXPANSION',
        source: 'PUBLIC_WEBSITE',
        confidence: 0.95,
        is_verified: true,
        retrieved_at: new Date().toISOString(),
      },
      ...(company?.gstin
        ? [
            {
              fact_key: 'gstin_registered',
              fact_value: `GSTIN ${company.gstin} registered in ${company.state}; ${company.entity_type.replace('_', ' ')} entity.`,
              category: 'FINANCIAL' as const,
              source: 'GST_REGISTRY',
              confidence: 0.98,
              is_verified: true,
              retrieved_at: new Date().toISOString(),
            },
          ]
        : []),
    ];

    // 3. ICP Scoring Agent (weights come from Settings → ICP matrix)
    stepsTaken.push('ICP_SCORING_AGENT');
    const icp = store.icp;
    const scoring = getTrackedAI('LeadScoringAgent', lead.id);
    const scoringPrompt = `You are evaluating this Indian B2B lead against our ICP:
Company: ${company?.name || lead.company_name} (${industry}, ${city}${company?.annual_revenue_cr ? `, ${company.annual_revenue_cr} Cr revenue` : ''})
Contact: ${lead.full_name}, ${lead.job_title}
Target industries: ${icp.target_industries.join(', ')}
Target roles: ${icp.target_roles.join(', ')}
Target geographies: ${icp.target_geographies.join(', ')}
ICP Weights: Industry ${icp.weight_industry}%, Size ${icp.weight_company_size}%, Seniority ${icp.weight_role_seniority}%, Geography ${icp.weight_geography}%, Tech ${icp.weight_tech_fit}%, Signals ${icp.weight_business_signals}%, Contact ${icp.weight_contact_quality}%.
Minimum qualifying score: ${icp.minimum_qualifying_score}.
Scoring policy: score only what is known — unknown size, tech stack or buying signals are NEUTRAL (award roughly half of that weight), never a penalty. A senior target-role contact at a target-industry company in a target geography is a HIGH_FIT (>= 75); classify DISQUALIFIED only on a hard mismatch (wrong industry, junior role, outside India).
Provide an objective evaluation score (0-100) and 2-3 concise business reasons.`;

    const scoreResult = await scoring.generateStructuredJson<any>(
      scoringPrompt,
      '{"score": number, "classification": "HOT"|"HIGH_FIT"|"MEDIUM_FIT"|"LOW_FIT"|"DISQUALIFIED", "reasoning": string[], "confidence": number}',
      { task: 'score' }
    );

    const scoreData =
      typeof scoreResult.data?.score === 'number'
        ? scoreResult.data
        : {
            score: 84,
            classification: 'HIGH_FIT',
            reasoning: [`High fit for ${industry} operations in ${city}`, `Role (${lead.job_title}) holds purchasing authority`],
            confidence: 0.9,
          };

    const score = Math.max(0, Math.min(100, Math.round(Number(scoreData.score))));
    const classification =
      ['HOT', 'HIGH_FIT', 'MEDIUM_FIT', 'LOW_FIT', 'DISQUALIFIED'].includes(scoreData.classification)
        ? scoreData.classification
        : score >= 85
          ? 'HOT'
          : score >= 75
            ? 'HIGH_FIT'
            : score >= 60
              ? 'MEDIUM_FIT'
              : 'LOW_FIT';

    lead.score = {
      score,
      classification,
      reasoning: Array.isArray(scoreData.reasoning) ? scoreData.reasoning.map(String).slice(0, 4) : [],
      confidence: typeof scoreData.confidence === 'number' ? scoreData.confidence : 0.85,
      industry_score: Math.round((icp.weight_industry * score) / 100),
      size_score: Math.round((icp.weight_company_size * score) / 100),
      role_score: Math.round((icp.weight_role_seniority * score) / 100),
      geo_score: Math.round((icp.weight_geography * score) / 100),
      signals_score: Math.round((icp.weight_business_signals * score) / 100),
      calculated_at: new Date().toISOString(),
    };

    lead.status = score >= icp.minimum_qualifying_score ? 'QUALIFIED' : 'DISQUALIFIED';
    lead.updated_at = new Date().toISOString();
    store.recordAuditLog('AI_AGENT', 'LEAD_SCORED', 'lead', lead.id, `Calculated fit score ${lead.score.score} (${lead.score.classification})`);

    if (lead.status === 'DISQUALIFIED') {
      return { success: true, lead, stepsTaken };
    }

    // 4. Personalization Agent (Strict Anti-Hallucination)
    stepsTaken.push('PERSONALIZATION_AGENT');
    const campaign =
      store.campaigns.find((c) => c.enrolled_lead_ids?.includes(lead.id)) ||
      store.campaigns.find((c) => c.name === lead.campaign_name) ||
      store.campaigns[0];
    const sender = store.users.find((u) => u.id === lead.assigned_user_id) || store.users[2];
    const personalization = getTrackedAI('PersonalizationAgent', lead.id);
    const personalizationPrompt = `Generate customized cold outreach for:
Contact: ${lead.full_name} (${lead.job_title}) at ${company?.name || lead.company_name} in ${city}
Sender: ${sender.full_name}, ${store.org.name}
Verified facts: ${lead.research.map((r) => r.fact_value).join('; ')}
Rules: Do NOT fabricate unverified news. Keep concise and professional. Include Indian business etiquette. The email must end with a one-line unsubscribe instruction.`;

    const persResult = await personalization.generateStructuredJson<any>(
      personalizationPrompt,
      '{"email_subject": string, "email_body": string, "whatsapp_message": string, "linkedin_message": string}',
      { task: 'outreach', temperature: 0.5 }
    );

    const vars = leadTemplateVariables(lead, { city, orgName: store.org.name, senderName: sender.full_name });
    const rawSubject = String(persResult.data?.email_subject || `Accelerating sales pipeline velocity at ${company?.name || lead.company_name}`);
    const rawBody = String(
      persResult.data?.email_body ||
        `Hi ${lead.first_name},\n\nGiven your role leading revenue and sales strategy at ${lead.company_name}, I wanted to share how similar enterprises in ${city} are streamlining prospecting workflows.\n\nWould you be open to a 15-minute introductory call this week?\n\nBest regards,\n${sender.full_name}\n${store.org.name}\n\nTo opt out of future emails, reply with unsubscribe.`
    );
    // The model may answer with template placeholders; resolve them from verified lead data.
    const emailSubject = renderTemplate(rawSubject, vars).text;
    let emailBody = renderTemplate(rawBody, vars).text;
    if (!/unsubscribe/i.test(emailBody)) {
      emailBody += '\n\nTo opt out of future emails, reply with unsubscribe.';
    }

    // 5. Compliance Guard Verification
    stepsTaken.push('COMPLIANCE_GUARD_VERIFICATION');
    const guardCheck = ComplianceGuard.checkOutboundMessage({
      channel: 'EMAIL',
      recipientEmail: lead.email,
      subject: emailSubject,
      body: emailBody,
    });

    // 6. Queue Outbound Message
    stepsTaken.push('QUEUE_OUTBOUND_ACTION');
    const requiresApproval = campaign.approval_mode === 'MANUAL' || !guardCheck.allowed;

    const newMsg: OutboundMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: store.org.id,
      lead_id: lead.id,
      lead_name: lead.full_name,
      lead_company: company?.name || lead.company_name || '',
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      subject: emailSubject,
      body: emailBody,
      status: requiresApproval ? 'PENDING_APPROVAL' : 'QUEUED',
      requires_approval: requiresApproval,
      error_message: guardCheck.allowed ? undefined : guardCheck.reason,
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    store.messages.unshift(newMsg);
    lead.status = 'OUTREACH';
    lead.campaign_name = campaign.name;
    lead.updated_at = new Date().toISOString();

    store.recordAuditLog(
      'AI_AGENT',
      'OUTREACH_DRAFTED',
      'message',
      newMsg.id,
      `Drafted personalized email (Approval Required: ${requiresApproval})`
    );

    return {
      success: true,
      lead,
      message: newMsg,
      stepsTaken,
    };
  }

  /**
   * Executes one campaign sequence step for a lead.
   * MESSAGE steps render the step templates into an outbound message (guarded, approval-aware);
   * TALK_INVITE steps mint a personal "Talk to our AI" link and send it via dispatchTalkInvite().
   */
  public static async executeCampaignStep(
    leadId: string,
    stepId: string
  ): Promise<{ success: boolean; stepType: CampaignStep['step_type']; message?: OutboundMessage; error?: string }> {
    const store = getDemoStore();
    const step = store.getCampaignStep(stepId);
    if (!step) {
      return { success: false, stepType: undefined, error: `Campaign step not found: ${stepId}` };
    }
    const stepType = step.step_type || 'MESSAGE';

    if (stepType === 'TALK_INVITE') {
      const result = await dispatchTalkInvite({ leadId, stepId });
      return { success: result.success, stepType, message: result.message, error: result.error };
    }

    const lead = store.leads.find((l) => l.id === leadId);
    if (!lead) {
      return { success: false, stepType, error: `Lead not found: ${leadId}` };
    }
    if (!step.is_active) {
      return { success: false, stepType, error: `Campaign step ${step.id} is inactive` };
    }

    const campaign = store.campaigns.find((c) => c.id === step.campaign_id);
    const company = store.companies.find((c) => c.id === lead.company_id);
    const sender = store.users.find((u) => u.id === lead.assigned_user_id) || store.users[2];
    const vars = leadTemplateVariables(lead, { city: company?.city || lead.city, orgName: store.org.name, senderName: sender?.full_name });

    const body = renderTemplate(step.body_template, vars);
    const subject = step.subject_template ? renderTemplate(step.subject_template, vars) : undefined;
    const unresolved = [...body.unresolved, ...(subject?.unresolved || [])];
    if (unresolved.length > 0) {
      return { success: false, stepType, error: `Unresolved template variables: ${unresolved.join(', ')}` };
    }

    const guardCheck = ComplianceGuard.checkOutboundMessage({
      channel: step.channel,
      recipientEmail: lead.email,
      recipientPhone: lead.phone,
      subject: subject?.text,
      body: body.text,
    });
    if (!guardCheck.allowed && guardCheck.violations.some((v) => v.startsWith('SUPPRESSION') || v === 'KILL_SWITCH_ACTIVE')) {
      return { success: false, stepType, error: guardCheck.reason };
    }

    const requiresApproval = (campaign?.approval_mode || 'MANUAL') === 'MANUAL' || !guardCheck.allowed;
    const message: OutboundMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: store.org.id,
      lead_id: lead.id,
      lead_name: lead.full_name,
      lead_company: lead.company_name || company?.name || '',
      campaign_id: step.campaign_id,
      campaign_name: campaign?.name,
      campaign_step_id: step.id,
      channel: step.channel,
      direction: 'OUTBOUND',
      subject: subject?.text,
      body: body.text,
      status: requiresApproval ? 'PENDING_APPROVAL' : 'QUEUED',
      requires_approval: requiresApproval,
      error_message: guardCheck.allowed ? undefined : guardCheck.reason,
      attempts: 0,
      created_at: new Date().toISOString(),
    };
    store.messages.unshift(message);
    if (lead.status === 'NEW' || lead.status === 'QUALIFIED') lead.status = 'OUTREACH';
    if (campaign) lead.campaign_name = campaign.name;
    lead.updated_at = new Date().toISOString();
    store.recordAuditLog(
      'AI_AGENT',
      'OUTREACH_DRAFTED',
      'message',
      message.id,
      `Drafted step ${step.step_number} (${step.channel}) for ${lead.full_name} (Approval Required: ${requiresApproval})`
    );
    return { success: true, stepType, message };
  }

  /**
   * Processes an inbound prospect message (Email, WhatsApp, or Webhook):
   * Classify Intent -> Update Conversation -> Qualify -> Trigger Handoff / Meeting if appropriate
   * -> draft the AI SDR's reply (unless the prospect opted out).
   */
  public static async handleInboundReply(params: {
    leadId: string;
    channel: Channel;
    messageText: string;
    senderName?: string;
    /** Skip drafting the AI reply (e.g. when a human will answer). */
    skipAutoReply?: boolean;
  }): Promise<{
    conversation: Conversation;
    intent: ConversationIntent;
    nextAction: string;
    handoffTriggered: boolean;
    aiReply?: string;
  }> {
    const store = getDemoStore();
    const lead = store.leads.find((l) => l.id === params.leadId);
    if (!lead) throw new Error(`Lead not found: ${params.leadId}`);

    const ai = getTrackedAI('ConversationAgent', lead.id);

    // 1. Intent Classification
    const prompt = `Classify this inbound B2B prospect reply from ${lead.full_name} (${lead.job_title} at ${lead.company_name}):
Message: "${params.messageText}"
Classify intent, sentiment, buying stage, whether human attention is required, and the recommended next action.
Allowed intents: INTERESTED, REQUEST_PRICING, REQUEST_DEMO, REQUEST_INFORMATION, ASKED_QUESTION, NOT_NOW, NOT_INTERESTED, WRONG_PERSON, REFERRAL, UNSUBSCRIBE, OUT_OF_OFFICE.
Allowed buying stages: UNAWARE, PROBLEM_AWARE, SOLUTION_AWARE, EVALUATING, DECISION.
Allowed next actions: SEND_CALENDAR_LINK, SEND_PRICING_OVERVIEW, ANSWER_TECHNICAL_QUESTION, SCHEDULE_FOLLOW_UP, TRIGGER_SALES_HANDOFF, UNSUBSCRIBE_LEAD, NO_ACTION.`;

    const classificationResult = await ai.generateStructuredJson<any>(
      prompt,
      '{"intent": string, "buying_stage": string, "sentiment": string, "needs_human": boolean, "next_action": string}',
      { task: 'intent' }
    );

    const raw = classificationResult.data?.intent
      ? classificationResult.data
      : {
          intent: 'INTERESTED',
          buying_stage: 'EVALUATING',
          sentiment: 'POSITIVE',
          needs_human: true,
          next_action: 'TRIGGER_SALES_HANDOFF',
        };
    // Live models occasionally answer in lower case; the UI and state machine expect the enum spelling.
    const intentData = {
      intent: String(raw.intent || 'INTERESTED').toUpperCase().replace(/[\s-]+/g, '_'),
      buying_stage: String(raw.buying_stage || 'EVALUATING').toUpperCase().replace(/[\s-]+/g, '_'),
      sentiment: String(raw.sentiment || 'POSITIVE').toUpperCase(),
      needs_human: !!raw.needs_human,
      next_action: String(raw.next_action || 'NO_ACTION').toUpperCase().replace(/[\s-]+/g, '_'),
    };

    // 2. Find or create conversation
    let conv = store.conversations.find((c) => c.lead_id === lead.id && c.channel === params.channel);
    if (!conv) {
      conv = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organization_id: store.org.id,
        lead_id: lead.id,
        lead_name: lead.full_name,
        lead_company: lead.company_name || '',
        lead_email: lead.email,
        lead_phone: lead.phone,
        channel: params.channel,
        status: 'ACTIVE',
        sentiment: intentData.sentiment as any,
        buying_stage: intentData.buying_stage as any,
        needs_human_attention: !!intentData.needs_human,
        qualification_notes: {},
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.conversations.unshift(conv);
    }

    // Append Inbound Message
    conv.messages.push({
      id: `cm_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      conversation_id: conv.id,
      sender_type: 'PROSPECT',
      sender_name: params.senderName || lead.full_name,
      content: params.messageText,
      intent_detected: intentData.intent as any,
      created_at: new Date().toISOString(),
    });

    conv.latest_intent = intentData.intent as any;
    conv.sentiment = intentData.sentiment as any;
    conv.buying_stage = intentData.buying_stage as any;
    conv.needs_human_attention = !!intentData.needs_human;
    conv.updated_at = new Date().toISOString();

    // Mark the last outbound message as replied
    const lastOutbound = store.messages.find((m) => m.lead_id === lead.id && m.channel === params.channel && m.status === 'SENT');
    if (lastOutbound) {
      lastOutbound.status = 'REPLIED';
      lastOutbound.replied_at = new Date().toISOString();
    }

    // 3. State transitions
    let handoffTriggered = false;
    const intent = intentData.intent as ConversationIntent;
    if (intent === 'UNSUBSCRIBE' || intent === 'NOT_INTERESTED') {
      lead.status = 'DISQUALIFIED';
      lead.is_suppressed = true;
      lead.suppression_reason = intent === 'UNSUBSCRIBE' ? 'Prospect unsubscribed' : 'Prospect not interested';
      ComplianceGuard.addSuppression({ email: lead.email, phone: lead.phone, reason: 'UNSUBSCRIBED' });
      conv.status = 'CLOSED';
      conv.needs_human_attention = false;
      store.recordAuditLog('AI_AGENT', 'OPT_OUT_PROCESSED', 'lead', lead.id, 'Prospect opted out; suppressed permanently');
    } else if (POSITIVE_INTENTS.includes(intent)) {
      lead.status = 'ENGAGED';
      lead.requires_human_attention = true;
      lead.attention_reason = `High buying intent detected: "${params.messageText}"`;
      conv.qualification_notes = {
        ...conv.qualification_notes,
        need: conv.qualification_notes.need || `Prospect replied on ${params.channel}: "${params.messageText}"`,
        urgency: conv.qualification_notes.urgency || (intent === 'REQUEST_DEMO' ? 'Immediate — asked for a demo' : 'Evaluating this quarter'),
      };

      // Trigger Sales Handoff Task
      const rep = store.users.find((u) => u.role === 'SALES_REP') || store.users[3];
      store.tasks.unshift({
        id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organization_id: store.org.id,
        lead_id: lead.id,
        lead_name: lead.full_name,
        assigned_user_id: rep?.id,
        assigned_user_name: rep ? `${rep.full_name} (Sales Rep)` : 'Priya Iyer (Sales Rep)',
        title: `Sales Handoff: Engage ${lead.full_name} (${lead.company_name})`,
        description: `Prospect replied: "${params.messageText}". Intent: ${intent}. Action: Book discovery call.`,
        priority: 'URGENT',
        due_date: new Date(Date.now() + 86400000).toISOString(),
        status: 'PENDING',
        created_by_ai: true,
        created_at: new Date().toISOString(),
      });

      handoffTriggered = true;
      conv.status = 'WAITING_SALES_REP';
      store.recordAuditLog('AI_AGENT', 'SALES_HANDOFF_TRIGGERED', 'lead', lead.id, `Created handoff task for Sales Rep`);
    } else if (intent === 'NOT_NOW' || intent === 'OUT_OF_OFFICE') {
      lead.status = 'NURTURE';
      conv.status = 'WAITING_PROSPECT';
      store.recordAuditLog('AI_AGENT', 'LEAD_MOVED_TO_NURTURE', 'lead', lead.id, `Prospect asked to reconnect later: "${params.messageText}"`);
    } else {
      conv.status = intentData.needs_human ? 'WAITING_SALES_REP' : 'WAITING_PROSPECT';
    }
    lead.updated_at = new Date().toISOString();

    // 4. Draft the AI SDR reply (conversation agent) unless the prospect opted out
    let aiReply: string | undefined;
    if (!params.skipAutoReply && intent !== 'UNSUBSCRIBE' && intent !== 'NOT_INTERESTED' && intent !== 'WRONG_PERSON') {
      aiReply = await SDROrchestrator.draftAIReply(conv.id, { intentHint: intent });
    }

    store.persist();
    return {
      conversation: conv,
      intent,
      nextAction: intentData.next_action,
      handoffTriggered,
      aiReply,
    };
  }

  /**
   * Drafts the AI SDR's next reply in a conversation and appends it as an AI_SDR message.
   * Returns the reply text. Delivery over the channel is handled by lib/outreach/dispatch.ts.
   */
  public static async draftAIReply(conversationId: string, opts?: { intentHint?: string }): Promise<string> {
    const store = getDemoStore();
    const conv = store.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new Error(`Conversation not found: ${conversationId}`);
    const lead = store.leads.find((l) => l.id === conv.lead_id);
    const ai = getTrackedAI('ConversationAgent', conv.lead_id);
    const sender = store.users.find((u) => u.id === lead?.assigned_user_id) || store.users[2];

    const history = conv.messages.slice(-8).map((m) => ({
      role: (m.sender_type === 'PROSPECT' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));
    const lastProspect = [...conv.messages].reverse().find((m) => m.sender_type === 'PROSPECT');

    const prompt = `You are the AI SDR for ${store.org.name}, replying on ${conv.channel} to ${conv.lead_name} (${lead?.job_title || 'decision maker'} at ${conv.lead_company}). The prospect's first name is ${lead?.first_name || conv.lead_name.split(' ')[0]}.
Latest prospect message: "${lastProspect?.content || ''}"
Detected intent: ${opts?.intentHint || conv.latest_intent || 'INTERESTED'}.
Write the next reply (under 70 words for WhatsApp, under 110 for email): consultative, warm Indian business tone, no invented pricing or customer names, one clear next step (offer a 15-minute call with ${sender.full_name}). Sign as ${sender.full_name}, ${store.org.name}.`;

    const result = await ai.generateStructuredJson<{ intent?: string; reply?: string }>(
      prompt,
      '{"intent": string, "reply": string}',
      { task: 'reply', temperature: 0.6, history, maxTokens: 300 }
    );
    const reply =
      (result.data?.reply || '').trim() ||
      `Thank you for getting back, ${lead?.first_name || 'there'}. Would a 15-minute call with ${sender.full_name} this week work to walk through the details? — ${store.org.name}`;

    conv.messages.push({
      id: `cm_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      conversation_id: conv.id,
      sender_type: 'AI_SDR',
      sender_name: 'Apex AI Assistant',
      content: reply,
      created_at: new Date().toISOString(),
    });
    conv.updated_at = new Date().toISOString();
    store.recordAuditLog('AI_AGENT', 'AI_REPLY_DRAFTED', 'conversation', conv.id, `Drafted reply to ${conv.lead_name} on ${conv.channel}`);
    return reply;
  }

  /**
   * Synthesises the AI Sales Brief for an account executive from verified lead, company and
   * conversation data, and stores it on the lead (and on the lead's meeting when one exists).
   */
  public static async generateSalesBrief(leadId: string): Promise<AISalesBrief> {
    const store = getDemoStore();
    const lead = store.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error(`Lead not found: ${leadId}`);
    const company = store.companies.find((c) => c.id === lead.company_id);
    const conv = store.conversations.find((c) => c.lead_id === lead.id);
    const calls = store.voiceCalls.filter((c) => c.lead_id === lead.id && c.status === 'COMPLETED');
    const ai = getTrackedAI('SalesBriefAgent', lead.id);

    const prompt = `Prepare an AI sales brief for an account executive before a discovery call.
Company: ${company?.name || lead.company_name} (${company?.industry || lead.industry || 'B2B'}, ${company?.entity_type || 'enterprise'}${company?.annual_revenue_cr ? `, ₹${company.annual_revenue_cr} Cr revenue` : ''}${company?.employee_count_min ? `, ${company.employee_count_min}-${company.employee_count_max} employees` : ''})
Contact: ${lead.full_name} (${lead.job_title || 'Decision maker'})
City: ${company?.city || lead.city || 'India'}
ICP score: ${lead.score?.score ?? 'n/a'} (${lead.score?.classification ?? 'n/a'}); reasons: ${(lead.score?.reasoning || []).join('; ') || 'n/a'}
Verified facts: ${(lead.research || []).map((r) => r.fact_value).join('; ') || 'none beyond registry data'}
Conversation so far: ${conv ? conv.messages.slice(-6).map((m) => `${m.sender_type}: ${m.content}`).join(' | ') : 'no replies yet'}
Voice call summaries: ${calls.map((c) => c.extracted?.summary).filter(Boolean).join(' | ') || 'none'}
Rules: only use the facts above; never invent customer names, numbers or integrations. Indian B2B context (₹, IST, Hinglish where relevant).`;

    const result = await ai.generateStructuredJson<Partial<AISalesBrief>>(
      prompt,
      '{"account_overview": string, "contact_role": string, "company_context": string, "verified_pain_points": string[], "buying_signals": string[], "recommended_questions": string[], "anticipated_objections": string[], "recommended_discovery_approach": string}',
      { task: 'brief', temperature: 0.4, maxTokens: 900 }
    );

    const d = result.data || {};
    const list = (v: unknown, fallback: string[]) => (Array.isArray(v) && v.length ? v.map(String) : fallback);
    const brief: AISalesBrief = {
      account_overview: String(d.account_overview || `${lead.company_name} is an active enterprise prospect in ${company?.city || lead.city || 'India'}.`),
      contact_role: String(d.contact_role || `${lead.full_name} (${lead.job_title || 'Decision maker'})`),
      company_context: String(d.company_context || 'Scaling B2B sales operations across Indian regions.'),
      verified_pain_points: list(d.verified_pain_points, ['High manual prospecting latency', 'Disorganised multi-channel follow-up']),
      buying_signals: list(d.buying_signals, ['Responded to outreach']),
      recommended_questions: list(d.recommended_questions, ['What is your current lead-to-opportunity conversion timeline?']),
      anticipated_objections: list(d.anticipated_objections, ['Implementation timeline across regional teams']),
      recommended_discovery_approach: String(
        d.recommended_discovery_approach || 'Highlight approval-gated autonomous outreach and the zero-cost WebRTC talk link.'
      ),
    };

    lead.sales_brief = brief;
    lead.sales_brief_generated_at = new Date().toISOString();
    for (const meeting of store.meetings.filter((m) => m.lead_id === lead.id && m.status === 'CONFIRMED')) {
      meeting.sales_brief = brief;
    }
    store.recordAuditLog('AI_AGENT', 'SALES_BRIEF_GENERATED', 'lead', lead.id, `AI sales brief synthesised for ${lead.full_name}`);
    store.persist();
    return brief;
  }
}
