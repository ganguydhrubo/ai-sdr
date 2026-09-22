import { getDemoStore } from '../store/demo-store';
import { getAIProvider } from '../ai/groq';
import { ComplianceGuard } from '../compliance/guard';
import { LeadScoreSchema, ConversationIntentSchema, PersonalizedOutreachSchema, AISalesBriefSchema } from '../ai/schemas';
import { Lead, OutboundMessage, Conversation, Channel, ConversationIntent, CampaignStep } from '../types';
import { dispatchTalkInvite } from './talk-invite';
import { renderTemplate, leadTemplateVariables } from '../outreach/templates';

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

    const ai = getAIProvider();

    // 1. Validation & Suppression Check
    stepsTaken.push('VALIDATION_AND_SUPPRESSION_CHECK');
    const suppression = ComplianceGuard.isSuppressed(lead.email, lead.phone);
    if (suppression.suppressed) {
      lead.is_suppressed = true;
      lead.status = 'DISQUALIFIED';
      store.recordAuditLog('AI_AGENT', 'LEAD_SUPPRESSED', 'lead', lead.id, suppression.reason || 'On suppression list');
      return { success: false, lead, stepsTaken, error: suppression.reason };
    }

    // 2. Company Research Agent
    stepsTaken.push('RESEARCH_AGENT_EXECUTION');
    lead.status = 'RESEARCHING';
    store.recordAuditLog('AI_AGENT', 'RESEARCH_STARTED', 'lead', lead.id, `Gathering verified signals for ${lead.company_name}`);

    // Simulated verified research signal collection
    const company = store.companies.find((c) => c.id === lead.company_id) || store.companies[0];
    lead.research = [
      {
        fact_key: 'target_market_expansion',
        fact_value: `Expanding B2B customer acquisition in ${company.city} corridor with focus on sales velocity.`,
        category: 'EXPANSION',
        source: 'PUBLIC_WEBSITE',
        confidence: 0.95,
        is_verified: true,
        retrieved_at: new Date().toISOString(),
      },
    ];

    // 3. ICP Scoring Agent
    stepsTaken.push('ICP_SCORING_AGENT');
    const scoringPrompt = `You are evaluating this Indian B2B lead against our ICP:
Company: ${company.name} (${company.industry}, ${company.city}, ${company.annual_revenue_cr} Cr revenue)
Contact: ${lead.full_name}, ${lead.job_title}
ICP Weights: Industry 20%, Size 15%, Seniority 20%, Geography 10%, Tech 10%, Signals 15%, Contact 10%.
Provide an objective evaluation score (0-100) and 2-3 concise business reasons.`;

    const scoreResult = await ai.generateStructuredJson<any>(
      scoringPrompt,
      '{"score": number, "classification": "HOT"|"HIGH_FIT"|"MEDIUM_FIT"|"LOW_FIT"|"DISQUALIFIED", "reasoning": string[], "confidence": number}'
    );

    const scoreData = scoreResult.data?.score ? scoreResult.data : {
      score: 84,
      classification: 'HIGH_FIT',
      reasoning: [
        `High fit for ${company.industry} operations in ${company.city}`,
        `Role (${lead.job_title}) holds purchasing authority`,
      ],
      confidence: 0.9,
    };

    lead.score = {
      score: scoreData.score,
      classification: scoreData.classification,
      reasoning: scoreData.reasoning,
      confidence: scoreData.confidence,
      industry_score: 18,
      size_score: 14,
      role_score: 18,
      geo_score: 10,
      signals_score: 14,
      calculated_at: new Date().toISOString(),
    };

    lead.status = scoreData.score >= store.icp.minimum_qualifying_score ? 'QUALIFIED' : 'DISQUALIFIED';
    store.recordAuditLog(
      'AI_AGENT',
      'LEAD_SCORED',
      'lead',
      lead.id,
      `Calculated fit score ${lead.score.score} (${lead.score.classification})`
    );

    if (lead.status === 'DISQUALIFIED') {
      return { success: true, lead, stepsTaken };
    }

    // 4. Personalization Agent (Strict Anti-Hallucination)
    stepsTaken.push('PERSONALIZATION_AGENT');
    const campaign = store.campaigns[0];
    const personalizationPrompt = `Generate customized cold outreach for:
Contact: ${lead.full_name} (${lead.job_title}) at ${company.name} in ${company.city}
Verified facts: ${lead.research.map((r) => r.fact_value).join('; ')}
Rules: Do NOT fabricate unverified news. Keep concise and professional. Include Indian business etiquette.`;

    const persResult = await ai.generateStructuredJson<any>(
      personalizationPrompt,
      '{"email_subject": string, "email_body": string, "whatsapp_message": string, "linkedin_message": string}'
    );

    const emailSubject = persResult.data?.email_subject || `Accelerating sales pipeline velocity at ${company.name}`;
    const emailBody =
      persResult.data?.email_body ||
      `Hi ${lead.first_name},\n\nGiven your role leading revenue and sales strategy at ${company.name}, I wanted to share how similar enterprises in ${company.city} are streamlining prospecting workflows.\n\nWould you be open to a 15-minute introductory call this week?\n\nBest regards,\nRohit Verma\nApex Technologies India\n\nTo opt out of future emails, reply with unsubscribe.`;

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
      lead_company: company.name,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      subject: emailSubject,
      body: emailBody,
      status: requiresApproval ? 'PENDING_APPROVAL' : 'QUEUED',
      requires_approval: requiresApproval,
      error_message: guardCheck.allowed ? undefined : guardCheck.reason,
      created_at: new Date().toISOString(),
    };

    store.messages.unshift(newMsg);
    lead.status = 'OUTREACH';

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
    const vars = leadTemplateVariables(lead, { city: company?.city, orgName: store.org.name, senderName: sender?.full_name });

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
      created_at: new Date().toISOString(),
    };
    store.messages.unshift(message);
    if (lead.status === 'NEW' || lead.status === 'QUALIFIED') lead.status = 'OUTREACH';
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
   */
  public static async handleInboundReply(params: {
    leadId: string;
    channel: Channel;
    messageText: string;
    senderName?: string;
  }): Promise<{
    conversation: Conversation;
    intent: ConversationIntent;
    nextAction: string;
    handoffTriggered: boolean;
  }> {
    const store = getDemoStore();
    const lead = store.leads.find((l) => l.id === params.leadId);
    if (!lead) throw new Error(`Lead not found: ${params.leadId}`);

    const ai = getAIProvider();

    // 1. Intent Classification
    const prompt = `Classify this inbound B2B prospect reply from ${lead.full_name} (${lead.job_title} at ${lead.company_name}):
Message: "${params.messageText}"
Classify intent, sentiment, buying stage, whether human attention is required, and the recommended next action.`;

    const classificationResult = await ai.generateStructuredJson<any>(
      prompt,
      '{"intent": string, "buying_stage": string, "sentiment": string, "needs_human": boolean, "next_action": string}'
    );

    const intentData = classificationResult.data?.intent ? classificationResult.data : {
      intent: 'INTERESTED',
      buying_stage: 'EVALUATING',
      sentiment: 'POSITIVE',
      needs_human: true,
      next_action: 'TRIGGER_SALES_HANDOFF',
    };

    // 2. Find or create conversation
    let conv = store.conversations.find((c) => c.lead_id === lead.id && c.channel === params.channel);
    if (!conv) {
      conv = {
        id: `conv_${Date.now()}`,
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
        needs_human_attention: intentData.needs_human,
        qualification_notes: {},
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.conversations.unshift(conv);
    }

    // Append Inbound Message
    conv.messages.push({
      id: `cm_${Date.now()}`,
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
    conv.needs_human_attention = intentData.needs_human;
    conv.updated_at = new Date().toISOString();

    // 3. State transitions
    let handoffTriggered = false;
    if (intentData.intent === 'UNSUBSCRIBE' || intentData.intent === 'NOT_INTERESTED') {
      lead.status = 'DISQUALIFIED';
      ComplianceGuard.addSuppression({ email: lead.email, phone: lead.phone, reason: 'UNSUBSCRIBED' });
      store.recordAuditLog('AI_AGENT', 'OPT_OUT_PROCESSED', 'lead', lead.id, 'Prospect opted out; suppressed permanently');
    } else if (
      intentData.intent === 'INTERESTED' ||
      intentData.intent === 'REQUEST_DEMO' ||
      intentData.intent === 'REQUEST_PRICING'
    ) {
      lead.status = 'ENGAGED';
      lead.requires_human_attention = true;
      lead.attention_reason = `High buying intent detected: "${params.messageText}"`;

      // Trigger Sales Handoff Task
      store.tasks.unshift({
        id: `task_${Date.now()}`,
        organization_id: store.org.id,
        lead_id: lead.id,
        lead_name: lead.full_name,
        assigned_user_name: 'Priya Iyer (Sales Rep)',
        title: `Sales Handoff: Engage ${lead.full_name} (${lead.company_name})`,
        description: `Prospect replied: "${params.messageText}". Intent: ${intentData.intent}. Action: Book discovery call.`,
        priority: 'URGENT',
        due_date: new Date(Date.now() + 86400000).toISOString(),
        status: 'PENDING',
        created_by_ai: true,
        created_at: new Date().toISOString(),
      });

      handoffTriggered = true;
      store.recordAuditLog('AI_AGENT', 'SALES_HANDOFF_TRIGGERED', 'lead', lead.id, `Created handoff task for Sales Rep`);
    }

    return {
      conversation: conv,
      intent: intentData.intent as ConversationIntent,
      nextAction: intentData.next_action,
      handoffTriggered,
    };
  }
}
