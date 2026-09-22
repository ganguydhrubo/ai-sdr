import { CompletionOptions, CompletionResult, LLMProvider, extractJsonObject } from './provider';
import type { AITask } from '../types';

/**
 * DemoAIProvider provides high-fidelity simulated enterprise AI reasoning
 * for Indian B2B SDR workflows with zero external API dependencies or costs.
 * It answers by task (options.task) and falls back to prompt keywords for older call sites.
 */
export class DemoAIProvider implements LLMProvider {
  public name = 'DemoAIProvider (offline simulator)';

  private detectTask(prompt: string, options?: CompletionOptions): AITask | undefined {
    if (options?.task) return options.task;
    const lower = prompt.toLowerCase();
    if (lower.includes('sales brief')) return 'brief';
    if (prompt.includes('score') || prompt.includes('ICP')) return 'score';
    if (prompt.includes('intent') || prompt.includes('classify')) return 'intent';
    if (prompt.includes('personalize') || prompt.includes('outreach')) return 'outreach';
    if (lower.includes('anti-ban')) return 'whatsapp_variation';
    return undefined;
  }

  private nameFrom(prompt: string, pattern: RegExp, fallback: string): string {
    const m = prompt.match(pattern);
    return m?.[1]?.trim() || fallback;
  }

  public async generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult> {
    const startTime = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 120)); // realistic latency simulation

    const task = this.detectTask(prompt, options);
    const lower = prompt.toLowerCase();
    let simulatedText =
      'Thank you for reaching out. Based on your profile, we would love to schedule a brief 15-minute discovery call.';

    switch (task) {
      case 'score': {
        simulatedText = JSON.stringify({
          score: 86,
          classification: 'HOT',
          reasoning: [
            'High industry match: target B2B manufacturing/tech sector',
            'Role seniority: VP/Director holds direct budget authority',
            'Tier-1 Indian metro geography fit',
          ],
          confidence: 0.91,
        });
        break;
      }
      case 'intent': {
        // Only the quoted prospect message decides — the prompt itself lists every allowed intent.
        const message = (prompt.match(/Message:\s*"([\s\S]*?)"/i)?.[1] || prompt).toLowerCase();
        if (/(unsubscribe|remove m|stop contacting|stop calling|do not contact|don'?t contact|not interested)/.test(message)) {
          simulatedText = JSON.stringify({
            intent: 'UNSUBSCRIBE',
            buying_stage: 'UNAWARE',
            sentiment: 'NEGATIVE',
            needs_human: false,
            next_action: 'UNSUBSCRIBE_LEAD',
          });
        } else if (/(not (right )?now|next (financial )?year|next quarter|later|reach out (again )?in|after diwali|busy this month)/.test(message)) {
          simulatedText = JSON.stringify({
            intent: 'NOT_NOW',
            buying_stage: 'PROBLEM_AWARE',
            sentiment: 'NEUTRAL',
            needs_human: false,
            next_action: 'SCHEDULE_FOLLOW_UP',
          });
        } else if (/(pricing|price|cost|rate card|commercials)/.test(message)) {
          simulatedText = JSON.stringify({
            intent: 'REQUEST_PRICING',
            buying_stage: 'EVALUATING',
            sentiment: 'POSITIVE',
            needs_human: true,
            next_action: 'SEND_PRICING_OVERVIEW',
          });
        } else if (/(demo|walkthrough|show us)/.test(message)) {
          simulatedText = JSON.stringify({
            intent: 'REQUEST_DEMO',
            buying_stage: 'EVALUATING',
            sentiment: 'POSITIVE',
            needs_human: true,
            next_action: 'SEND_CALENDAR_LINK',
          });
        } else {
          simulatedText = JSON.stringify({
            intent: 'INTERESTED',
            buying_stage: 'EVALUATING',
            sentiment: 'POSITIVE',
            needs_human: true,
            next_action: 'TRIGGER_SALES_HANDOFF',
          });
        }
        break;
      }
      case 'outreach': {
        simulatedText = JSON.stringify({
          email_subject: 'Streamlining B2B sales pipeline efficiency at {{company}}',
          email_body:
            "Hi {{first_name}},\n\nNoticed {{company}}'s recent expansion in enterprise services across India. Many sales leaders we work with in the sector are cutting manual prospecting time by 60% with autonomous SDR workflows.\n\nWould you be open to a 15-minute discovery call this Thursday to explore how this fits your growth targets?\n\nBest regards,\nArjun Mehta",
          whatsapp_message:
            "Namaste {{first_name}} ji, saw {{company}}'s strong growth in {{city}}. Would love to share a 2-page brief on how Indian enterprise sales teams are automating outbound pipelines. Best day for a quick chat?",
          linkedin_message:
            "Hi {{first_name}}, impressed by {{company}}'s trajectory in {{city}}. Would love to connect and share notes on enterprise B2B sales development in India.",
        });
        break;
      }
      case 'brief': {
        const company = this.nameFrom(prompt, /Company:\s*([^\n(]+)/, 'the account');
        const contact = this.nameFrom(prompt, /Contact:\s*([^\n(]+)/, 'the decision maker');
        const city = this.nameFrom(prompt, /City:\s*([^\n]+)/, 'India');
        simulatedText = JSON.stringify({
          account_overview: `${company} is an active enterprise prospect headquartered in ${city}; the account matches the primary Indian B2B ICP on industry, size and geography.`,
          contact_role: `${contact} holds purchasing influence over sales tooling and revenue operations.`,
          company_context: 'Scaling B2B sales coverage across Indian regions with a growing field team and rising inbound enquiry volume.',
          verified_pain_points: [
            'Sales reps spend 15+ hours a week on manual LinkedIn, email and WhatsApp follow-ups',
            'Inbound tier-2 enquiries wait more than 48 hours for a first response',
          ],
          buying_signals: ['Replied to outreach within a business day', 'Asked about implementation timelines and pricing tiers'],
          recommended_questions: [
            'What is the current turnaround from a new lead to a booked call?',
            'How do regional sales heads run follow-up cadences in Hindi vs English?',
            'Which CRM or spreadsheet is the system of record today?',
          ],
          anticipated_objections: [
            '"We already have a CRM" → the AI SDR works alongside it; the meeting is to check whether it adds pipeline',
            '"WhatsApp compliance risk" → self-hosted Baileys channel with opt-out scrubbing and TRAI-window enforcement',
          ],
          recommended_discovery_approach:
            'Open with the verified expansion signal, quantify the manual follow-up cost, then demo the approval queue and the zero-cost WebRTC talk link.',
        });
        break;
      }
      case 'reply':
      case 'whatsapp_reply': {
        const first = this.nameFrom(prompt, /first name is\s*([^\n.,]+)/i, this.nameFrom(prompt, /prospect \(([^,()]+)/i, 'there'));
        const detected = (prompt.match(/Detected intent:\s*([A-Z_]+)/)?.[1] || '').toUpperCase();
        const message = (
          prompt.match(/(?:Latest prospect message|message to your business number):\s*"([\s\S]*?)"/i)?.[1] || ''
        ).toLowerCase();
        if (detected === 'UNSUBSCRIBE' || detected === 'NOT_INTERESTED' || /(unsubscribe|stop contacting|remove m)/.test(message)) {
          simulatedText = JSON.stringify({
            intent: 'UNSUBSCRIBE',
            reply: `Understood ${first} — you have been removed from all future outreach. Apologies for the interruption, and thank you for letting us know.`,
          });
        } else if (detected === 'REQUEST_PRICING' || /(pricing|price|cost)/.test(message)) {
          simulatedText = JSON.stringify({
            intent: 'REQUEST_PRICING',
            reply: `Thanks ${first}. Pricing is seat-based with volume tiers for Indian enterprises; the exact number depends on your team size and channels. Could we hold a 15-minute call this week so a specialist can share the right tier and a case study?`,
          });
        } else if (detected === 'REQUEST_DEMO' || /(demo|thursday|\byes\b)/.test(message)) {
          simulatedText = JSON.stringify({
            intent: 'REQUEST_DEMO',
            reply: `Great, ${first} — I will lock that in and send a calendar invite to your work email shortly. Is there a colleague from sales ops you would like to include?`,
          });
        } else {
          simulatedText = JSON.stringify({
            intent: 'OBJECTION_HANDLING',
            reply: `Understood ${first}. Most sales teams we partner with started exactly there — manual spreadsheets and cold calling. The AI SDR removes the repetitive follow-ups so reps only spend time on qualified conversations. Would a 15-minute walkthrough this Thursday be useful to see it on your own pipeline?`,
          });
        }
        break;
      }
      case 'whatsapp_variation': {
        const first = this.nameFrom(prompt, /message to\s*([^\n]+?) at /i, 'there');
        const company = this.nameFrom(prompt, / at ([^\n.]+?)\.\n/i, 'your company');
        simulatedText = `Namaste ${first} ji, saw ${company}'s recent momentum. Wanted to share a short 2-page brief on how B2B sales teams are automating outbound follow-ups without adding headcount. Would Thursday work for a quick 10-minute chat?`;
        break;
      }
      case 'voice_turn': {
        simulatedText = JSON.stringify(simulateVoiceTurn(prompt, options));
        break;
      }
      case 'voice_extract': {
        simulatedText = JSON.stringify(simulateVoiceExtraction(prompt));
        break;
      }
      default:
        break;
    }

    const latencyMs = Date.now() - startTime;
    return {
      text: simulatedText,
      promptTokens: 380,
      completionTokens: 140,
      totalTokens: 520,
      estimatedCostUsd: 0,
      latencyMs,
      model: 'offline-simulator',
      simulated: true,
    };
  }

  public async generateStructuredJson<T>(
    prompt: string,
    schemaDescription: string,
    options?: CompletionOptions
  ): Promise<{ data: T; result: CompletionResult }> {
    const result = await this.generateCompletion(prompt, { ...options, jsonMode: true });
    try {
      const json = extractJsonObject(result.text) || result.text;
      const parsed = JSON.parse(json) as T;
      return { data: parsed, result };
    } catch {
      // Fallback
      return { data: {} as T, result };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Offline voice agent: a small rule-based conversation used when no live model is configured.
// The prompt carries the transcript so far; the last user line drives the next agent line.
// ---------------------------------------------------------------------------------------------

function lastUserUtterance(prompt: string, options?: CompletionOptions): string {
  // The current utterance travels in the prompt; the history only holds earlier turns.
  const m = prompt.match(/Prospect said:\s*"([^"]*)"/i);
  if (m?.[1]) return m[1].toLowerCase();
  const history = options?.history || [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user') return history[i].content.toLowerCase();
  }
  return '';
}

function agentTurnsSoFar(options?: CompletionOptions): number {
  return (options?.history || []).filter((h) => h.role === 'assistant').length;
}

export function simulateVoiceTurn(prompt: string, options?: CompletionOptions) {
  const user = lastUserUtterance(prompt, options);
  const turns = agentTurnsSoFar(options);
  const first = (prompt.match(/first_name:\s*([^\n]+)/i)?.[1] || 'there').trim();
  const org = (prompt.match(/org_name:\s*([^\n]+)/i)?.[1] || 'Apex Technologies').trim();
  const slotLine = prompt.match(/Available slots \(IST\):\s*([^\n]+)/i)?.[1];
  const firstSlotIso = prompt.match(/first_slot_iso:\s*(\S+)/i)?.[1];

  const wantsHuman = /\b(human|person|someone|real|colleague|manager|call me|speak to)\b/.test(user);
  const saysYes = /\b(yes|yeah|sure|ok|okay|haan|theek|confirm|works|fine|book|sounds good|done|let's do|lets do)\b/.test(user);
  const saysNo = /\b(no|not interested|nahi|nope|busy|later|next quarter|next year)\b/.test(user);
  const asksPrice = /\b(price|pricing|cost|charges|kitna|rate)\b/.test(user);

  if (wantsHuman) {
    return {
      reply: `Of course, ${first}. I have passed this to our team — a colleague from ${org} will contact you within one business day. Thank you for your time.`,
      intent: 'INTERESTED',
      actions: { handoff: true, handoff_reason: 'Prospect asked to speak with a human', end_call: true },
    };
  }

  if (turns === 0) {
    return {
      reply: `Namaste ${first}! This is Apex AI SDR — ${org}'s AI assistant, not a human. Thanks for tapping the link. This call is recorded and transcribed so I can send you a summary. Is that okay, and can I ask what your sales team's biggest follow-up headache is today?`,
      intent: 'INTERESTED',
      actions: {},
    };
  }

  if (asksPrice) {
    return {
      reply:
        'Pricing is seat-based with volume tiers for Indian enterprises — the exact tier depends on team size and channels, so I would rather have a specialist give you the precise number. Shall I book a 15-minute slot for that?',
      intent: 'REQUEST_PRICING',
      actions: {},
    };
  }

  if (turns === 1) {
    const slots = slotLine || 'Thursday at 3:00 PM or Friday at 11:30 AM';
    return {
      reply: `Got it — that is exactly what ${org} automates: the repetitive follow-ups, so your reps only spend time on qualified conversations. Would you be open to a 15-minute walkthrough with our solutions director? I have ${slots} IST.`,
      intent: 'INTERESTED',
      actions: {},
    };
  }

  if (saysYes && firstSlotIso) {
    return {
      reply: `Done — I have booked that slot in IST and the calendar invite is on its way to your work email. Thank you ${first}, looking forward to it. Have a good day!`,
      intent: 'REQUEST_DEMO',
      actions: { book_meeting: true, meeting_slot: firstSlotIso, end_call: true },
    };
  }

  if (saysNo) {
    return {
      reply: `No problem at all, ${first}. I will send a short summary by email and we can reconnect when the timing is better. Thank you for your time — have a good day!`,
      intent: 'NOT_NOW',
      actions: { end_call: true },
    };
  }

  return {
    reply: `Understood. Just to confirm — shall I book the 15-minute walkthrough for ${slotLine ? slotLine.split(' or ')[0] : 'Thursday at 3:00 PM'} IST, or would you prefer a summary by email instead?`,
    intent: 'INTERESTED',
    actions: {},
  };
}

export function simulateVoiceExtraction(prompt: string) {
  const lower = prompt.toLowerCase();
  const booked = lower.includes('meeting booked: true');
  const handoff = lower.includes('handoff: true');
  const optOut = lower.includes('opt_out: true');
  return {
    call_status: 'completed',
    intent: optOut ? 'OPT_OUT' : booked ? 'REQUEST_DEMO' : handoff ? 'INTERESTED' : lower.includes('not now') ? 'NOT_NOW' : 'INTERESTED',
    buying_stage: booked ? 'DECIDING' : 'EVALUATING',
    sentiment: optOut ? 'NEGATIVE' : 'POSITIVE',
    qualification: {
      problem: 'Manual follow-ups across email and WhatsApp consume rep time',
      need: 'Automated, compliant outbound follow-up with human approval',
      urgency: booked ? 'HIGH' : 'MEDIUM',
      authority: 'Sales leadership',
      timeline: booked ? 'This month' : 'This quarter',
      budget_signal: 'Not discussed',
    },
    meeting_requested: booked,
    handoff_requested: handoff,
    opt_out: optOut,
    language: 'English',
    summary: booked
      ? 'Prospect described manual follow-up pain and accepted a 15-minute discovery walkthrough; invite sent.'
      : handoff
        ? 'Prospect asked for a human contact; handoff task created for the sales team.'
        : optOut
          ? 'Prospect asked not to be contacted; suppressed and talk link revoked.'
          : 'Prospect discussed follow-up pain and asked for a summary by email; reconnect later.',
  };
}
