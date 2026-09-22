import { z } from 'zod';

export const LeadScoreSchema = z.object({
  score: z.number().min(0).max(100),
  classification: z.enum(['HOT', 'HIGH_FIT', 'MEDIUM_FIT', 'LOW_FIT', 'DISQUALIFIED']),
  reasoning: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  industry_score: z.number().min(0).max(20).default(15),
  size_score: z.number().min(0).max(20).default(15),
  role_score: z.number().min(0).max(20).default(15),
  geo_score: z.number().min(0).max(15).default(10),
  signals_score: z.number().min(0).max(25).default(15),
});

export type LeadScoreOutput = z.infer<typeof LeadScoreSchema>;

export const ConversationIntentSchema = z.object({
  intent: z.enum([
    'INTERESTED',
    'REQUEST_PRICING',
    'REQUEST_DEMO',
    'REQUEST_INFORMATION',
    'ASKED_QUESTION',
    'NOT_NOW',
    'NOT_INTERESTED',
    'WRONG_PERSON',
    'REFERRAL',
    'UNSUBSCRIBE',
    'OUT_OF_OFFICE',
    'POSITIVE_UNKNOWN',
    'NEGATIVE_UNKNOWN',
  ]),
  buying_stage: z.enum(['UNAWARE', 'PROBLEM_AWARE', 'SOLUTION_AWARE', 'EVALUATING', 'DECISION']),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  needs_human: z.boolean(),
  next_action: z.enum([
    'SEND_CALENDAR_LINK',
    'SEND_PRICING_OVERVIEW',
    'ANSWER_TECHNICAL_QUESTION',
    'SCHEDULE_FOLLOW_UP',
    'TRIGGER_SALES_HANDOFF',
    'UNSUBSCRIBE_LEAD',
    'NO_ACTION',
  ]),
  extracted_notes: z.record(z.string()).optional(),
});

export type ConversationIntentOutput = z.infer<typeof ConversationIntentSchema>;

export const PersonalizedOutreachSchema = z.object({
  email_subject: z.string(),
  email_body: z.string(),
  whatsapp_message: z.string(),
  linkedin_message: z.string(),
  call_opening_hook: z.string().optional(),
});

export type PersonalizedOutreachOutput = z.infer<typeof PersonalizedOutreachSchema>;

export const AISalesBriefSchema = z.object({
  account_overview: z.string(),
  contact_role: z.string(),
  company_context: z.string(),
  verified_pain_points: z.array(z.string()),
  buying_signals: z.array(z.string()),
  recommended_questions: z.array(z.string()),
  anticipated_objections: z.array(z.string()),
  recommended_discovery_approach: z.string(),
});

export type AISalesBriefOutput = z.infer<typeof AISalesBriefSchema>;
