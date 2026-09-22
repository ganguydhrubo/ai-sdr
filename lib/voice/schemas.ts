import { z } from 'zod';

// ==========================================
// PRE-CALL DATA FETCH SCHEMAS
// ==========================================

export const PreCallRequestSchema = z.object({
  event: z.string().default('call_inbound'),
  call_inbound: z
    .object({
      agent_id: z.union([z.string(), z.number()]).optional(),
      from_number: z.string().optional(),
      to_number: z.string().optional(),
    })
    .optional(),
  initial_context: z
    .object({
      talk_ref: z.string().min(1, 'talk_ref nonce is required'),
    })
    .passthrough(),
});

export type PreCallRequest = z.infer<typeof PreCallRequestSchema>;

export const VerifiedResearchFactSchema = z.object({
  fact_key: z.string(),
  fact_value: z.string(),
  source: z.string().default('VERIFIED_RESEARCH'),
  confidence: z.number().min(0).max(1).default(0.9),
});

export const PreCallResponseSchema = z.object({
  initial_context: z.object({
    first_name: z.string(),
    company: z.string(),
    role: z.string().optional(),
    org_name: z.string(),
    campaign_summary: z.string().optional(),
    language: z.string().default('en'),
    allowed_topics: z.string().optional(),
    verified_research_facts: z.array(VerifiedResearchFactSchema).default([]),
  }),
});

export type PreCallResponse = z.infer<typeof PreCallResponseSchema>;

// ==========================================
// IN-CALL TOOLS SCHEMAS
// ==========================================

export const ProductKnowledgeRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
});

export const ProductKnowledgeResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()).optional(),
  confidence: z.number().default(0.95),
});

export const AvailabilityRequestSchema = z.object({
  days_ahead: z.number().int().min(1).max(14).default(5),
});

export const AvailabilityResponseSchema = z.object({
  available_slots: z.array(z.string()),
  timezone: z.string().default('Asia/Kolkata'),
});

export const BookMeetingRequestSchema = z.object({
  selected_slot: z.string().min(1, 'Slot is required'),
  topic: z.string().default('AI SDR Product Discovery Demo'),
});

export const BookMeetingResponseSchema = z.object({
  success: z.boolean(),
  meeting_id: z.string(),
  meet_link: z.string().url(),
  scheduled_at: z.string(),
});

export const HandoffRequestSchema = z.object({
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  reason: z.string().min(1, 'Handoff reason is required'),
});

export const HandoffResponseSchema = z.object({
  success: z.boolean(),
  handoff_id: z.string(),
  assigned_rep: z.string(),
  status: z.string().default('QUEUED'),
});

export const OptOutRequestSchema = z.object({
  reason: z.string().default('Prospect requested DO NOT CONTACT during voice call'),
});

export const OptOutResponseSchema = z.object({
  success: z.boolean(),
  suppressed: z.boolean().default(true),
  status: z.enum(['ACTIVE', 'REVOKED']).default('REVOKED'),
});

// ==========================================
// DOGRAH END-OF-CALL WEBHOOK SCHEMA
// ==========================================

export const DograhWebhookPayloadSchema = z.object({
  workflow_run_id: z.union([z.string(), z.number()]),
  workflow_run_name: z.string().optional(),
  workflow_id: z.union([z.string(), z.number()]).optional(),
  workflow_name: z.string().optional(),
  campaign_id: z.union([z.string(), z.number()]).nullable().optional(),
  call_time: z.string().optional(),
  initial_context: z
    .object({
      talk_ref: z.string().optional(),
    })
    .passthrough()
    .optional(),
  gathered_context: z
    .object({
      call_status: z.string().optional(),
      call_disposition: z.string().optional(),
      mapped_call_disposition: z.string().optional(),
      intent: z.string().optional(),
      buying_stage: z.string().optional(),
      sentiment: z.string().optional(),
      qualification: z
        .object({
          problem: z.string().optional(),
          need: z.string().optional(),
          urgency: z.string().optional(),
          authority: z.string().optional(),
          timeline: z.string().optional(),
          budget_signal: z.string().optional(),
        })
        .optional(),
      meeting_requested: z.boolean().optional(),
      meeting_id: z.string().optional(),
      handoff_requested: z.boolean().optional(),
      opt_out: z.boolean().optional(),
      language: z.string().optional(),
      summary: z.string().optional(),
    })
    .passthrough()
    .optional(),
  cost_info: z
    .object({
      call_duration_seconds: z.number().nonnegative().optional(),
    })
    .optional(),
  recording_url: z.string().url().optional(),
  transcript_url: z.string().url().optional(),
});

export type DograhWebhookPayload = z.infer<typeof DograhWebhookPayloadSchema>;

// ==========================================
// OUTBOUND PSTN TRIGGER SCHEMAS
// ==========================================

export const PstnTriggerRequestSchema = z.object({
  lead_id: z.string().min(1, 'lead_id is required'),
  greeting_override: z.string().optional(),
  language: z.enum(['en', 'hi', 'bn', 'hinglish']).default('en'),
});

export type PstnTriggerRequest = z.infer<typeof PstnTriggerRequestSchema>;

export const PstnTriggerResponseSchema = z.object({
  status: z.enum(['initiated', 'queued', 'failed']),
  workflow_run_id: z.union([z.string(), z.number()]),
  call_id: z.string(),
  carrier: z.string().default('Vobiz SIP'),
});

export type PstnTriggerResponse = z.infer<typeof PstnTriggerResponseSchema>;
