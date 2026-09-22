export type UserRole = 'ADMIN' | 'SALES_MANAGER' | 'SDR' | 'SALES_REP' | 'VIEWER';

export type LeadStatus =
  | 'NEW'
  | 'RESEARCHING'
  | 'QUALIFIED'
  | 'OUTREACH'
  | 'CONTACTED'
  | 'ENGAGED'
  | 'QUALIFIED_OPPORTUNITY'
  | 'MEETING'
  | 'SALES_HANDOFF'
  | 'WON'
  | 'LOST'
  | 'NURTURE'
  | 'DISQUALIFIED';

export type FitClassification = 'HOT' | 'HIGH_FIT' | 'MEDIUM_FIT' | 'LOW_FIT' | 'DISQUALIFIED';

export type ApprovalMode = 'MANUAL' | 'SEMI_AUTOMATIC' | 'AUTONOMOUS';

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export type Channel = 'EMAIL' | 'WHATSAPP' | 'VOICE' | 'LINKEDIN';

export type MessageStatus =
  | 'DRAFTED'
  | 'PENDING_APPROVAL'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'OPENED'
  | 'CLICKED'
  | 'REPLIED'
  | 'BOUNCED'
  | 'FAILED'
  | 'CANCELLED'
  | 'SUPPRESSED';

export type ConversationIntent =
  | 'INTERESTED'
  | 'REQUEST_PRICING'
  | 'REQUEST_DEMO'
  | 'REQUEST_INFORMATION'
  | 'ASKED_QUESTION'
  | 'NOT_NOW'
  | 'NOT_INTERESTED'
  | 'WRONG_PERSON'
  | 'REFERRAL'
  | 'UNSUBSCRIBE'
  | 'OUT_OF_OFFICE'
  | 'POSITIVE_UNKNOWN'
  | 'NEGATIVE_UNKNOWN';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  gstin?: string;
  cin?: string;
  industry?: string;
  headquarters_city: string;
  headquarters_state: string;
  country: string;
  plan_tier: string;
  monthly_ai_budget: number;
  daily_ai_budget: number;
  ai_budget_spent_current_month: number;
  is_autonomous_outreach_enabled: boolean;
  emergency_kill_switch_active: boolean;
  created_at: string;
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  daily_send_limit: number;
}

export interface Company {
  id: string;
  organization_id: string;
  name: string;
  legal_name?: string;
  entity_type: 'PVT_LTD' | 'LLP' | 'LTD' | 'MSME' | 'PROPRIETORSHIP';
  domain?: string;
  website?: string;
  industry: string;
  sub_industry?: string;
  employee_count_min?: number;
  employee_count_max?: number;
  annual_revenue_cr?: number;
  gstin?: string;
  pan?: string;
  city: string;
  state: string;
  country: string;
  linkedin_url?: string;
  description?: string;
  created_at: string;
}

export interface VerifiedFact {
  fact_key: string;
  fact_value: string;
  category: 'TECH_STACK' | 'EXPANSION' | 'HIRING' | 'LEADERSHIP' | 'FINANCIAL';
  source: string;
  source_url?: string;
  confidence: number;
  is_verified: boolean;
  retrieved_at: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  company_id?: string;
  company_name?: string;
  first_name: string;
  last_name?: string;
  full_name: string;
  job_title?: string;
  email: string;
  normalized_email: string;
  phone: string;
  normalized_phone: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  status: LeadStatus;
  lead_source: string;
  campaign_name?: string;
  preferred_language: 'en' | 'hi' | 'bn' | 'hinglish';
  assigned_user_id?: string;
  is_suppressed: boolean;
  is_dnc_registered: boolean;
  requires_human_attention: boolean;
  attention_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;

  // Joined/Computed fields
  score?: LeadScore;
  company?: Company;
  research?: VerifiedFact[];
}

export interface LeadScore {
  score: number;
  classification: FitClassification;
  reasoning: string[];
  confidence: number;
  industry_score: number;
  size_score: number;
  role_score: number;
  geo_score: number;
  signals_score: number;
  calculated_at: string;
}

export interface ICPConfig {
  id: string;
  organization_id: string;
  name: string;
  target_industries: string[];
  target_employee_ranges: string[];
  target_roles: string[];
  target_geographies: string[];
  weight_industry: number;
  weight_company_size: number;
  weight_role_seniority: number;
  weight_geography: number;
  weight_tech_fit: number;
  weight_business_signals: number;
  weight_contact_quality: number;
  minimum_qualifying_score: number;
}

export interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  approval_mode: ApprovalMode;
  target_persona: string;
  target_industry: string;
  daily_lead_limit: number;
  business_hours_start: string;
  business_hours_end: string;
  timezone: string;
  working_days: string[];
  steps_count: number;
  leads_count: number;
  open_rate?: number;
  reply_rate?: number;
  positive_reply_rate?: number;
  created_at: string;
}

export interface CampaignStep {
  id: string;
  campaign_id: string;
  step_number: number;
  channel: Channel;
  delay_days: number;
  subject_template?: string;
  body_template: string;
  whatsapp_template_name?: string;
  is_active: boolean;
}

export interface OutboundMessage {
  id: string;
  organization_id: string;
  lead_id: string;
  lead_name: string;
  lead_company: string;
  campaign_id?: string;
  campaign_name?: string;
  campaign_step_id?: string;
  channel: Channel;
  direction: 'OUTBOUND' | 'INBOUND';
  subject?: string;
  body: string;
  status: MessageStatus;
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: string;
  scheduled_for?: string;
  sent_at?: string;
  delivered_at?: string;
  replied_at?: string;
  error_message?: string;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_type: 'PROSPECT' | 'AI_SDR' | 'HUMAN_REP';
  sender_name?: string;
  content: string;
  intent_detected?: ConversationIntent;
  created_at: string;
}

export interface Conversation {
  id: string;
  organization_id: string;
  lead_id: string;
  lead_name: string;
  lead_company: string;
  lead_email: string;
  lead_phone: string;
  channel: Channel;
  status: 'ACTIVE' | 'WAITING_PROSPECT' | 'WAITING_SALES_REP' | 'CLOSED';
  latest_intent?: ConversationIntent;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  buying_stage: 'UNAWARE' | 'PROBLEM_AWARE' | 'SOLUTION_AWARE' | 'EVALUATING' | 'DECISION';
  needs_human_attention: boolean;
  qualification_notes: Record<string, string>;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

export interface AISalesBrief {
  account_overview: string;
  contact_role: string;
  company_context: string;
  verified_pain_points: string[];
  buying_signals: string[];
  recommended_questions: string[];
  anticipated_objections: string[];
  recommended_discovery_approach: string;
}

export interface Meeting {
  id: string;
  organization_id: string;
  lead_id: string;
  lead_name: string;
  lead_company: string;
  host_user_id?: string;
  host_user_name?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  meet_url: string;
  calendar_provider: string;
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  sales_brief?: AISalesBrief;
  created_at: string;
}

export interface Task {
  id: string;
  organization_id: string;
  lead_id?: string;
  lead_name?: string;
  assigned_user_id?: string;
  assigned_user_name?: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  due_date?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  created_by_ai: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id?: string;
  actor_name: string;
  actor_type: 'USER' | 'AI_AGENT' | 'SYSTEM_WORKER';
  action: string;
  entity_type: string;
  entity_id?: string;
  details: string;
  created_at: string;
}

export interface AIRun {
  id: string;
  organization_id: string;
  lead_id?: string;
  agent_name: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  success: boolean;
  error_message?: string;
  created_at: string;
}

// ==============================================================================
// PHASE 8: VOICE MODULE TYPES
// ==============================================================================

export type TalkSessionStatus =
  | 'CREATED'
  | 'SENT'
  | 'OPENED'
  | 'CALL_STARTED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'REVOKED';

export interface TalkSession {
  id: string;
  organization_id: string;
  lead_id: string;
  lead_name?: string;
  lead_company?: string;
  campaign_id?: string;
  campaign_step_id?: string;
  channel: 'email' | 'whatsapp' | 'manual';
  token_hash: string;
  token?: string; // Only present upon immediate generation
  status: TalkSessionStatus;
  expires_at: string;
  max_calls: number;
  call_count: number;
  sent_at?: string;
  opened_at?: string;
  last_opened_at?: string;
  revoked_at?: string;
  revoked_reason?: string;
  language: string;
  created_at: string;
}

export interface TalkCallNonce {
  id: string;
  organization_id: string;
  talk_session_id: string;
  nonce_hash: string;
  expires_at: string;
  consumed_at?: string;
  created_at: string;
}

export type VoiceCallMode = 'webrtc' | 'pstn';
export type VoiceCallProvider = 'demo' | 'dograh';
export type VoiceCallStatus =
  | 'INITIATED'
  | 'CONNECTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'NO_ANSWER'
  | 'BLOCKED';

export interface VoiceCall {
  id: string;
  organization_id: string;
  lead_id: string;
  lead_name?: string;
  lead_company?: string;
  talk_session_id?: string;
  mode: VoiceCallMode;
  provider: VoiceCallProvider;
  provider_run_id?: string;
  status: VoiceCallStatus;
  started_at?: string;
  ended_at?: string;
  duration_seconds: number;
  transcript: Array<{ role: 'agent' | 'user'; text: string; timestamp?: string }>;
  extracted: {
    intent?: string;
    buying_stage?: string;
    sentiment?: string;
    qualification?: {
      problem?: string;
      need?: string;
      urgency?: string;
      authority?: string;
      timeline?: string;
      budget_signal?: string;
    };
    meeting_requested?: boolean;
    meeting_id?: string;
    handoff_requested?: boolean;
    opt_out?: boolean;
    language?: string;
    summary?: string;
    [key: string]: any;
  };
  intent?: string;
  sentiment?: string;
  disclosure_given: boolean;
  consent_transcript: boolean;
  recording_url?: string;
  carrier_cost_estimate_inr: number;
  created_at: string;
}

export interface VoiceSettings {
  id: string;
  organization_id: string;
  voice_enabled: boolean;
  web_voice_enabled: boolean;
  pstn_enabled: boolean;
  dlt_entity_id?: string;
  caller_id_series?: '140' | '1600' | '1601';
  oap_autodialer_notice_date?: string;
  oap_notice_doc_url?: string;
  calling_window_start: string;
  calling_window_end: string;
  timezone: string;
  pstn_daily_cap: number;
  talk_link_ttl_days: number;
  talk_link_max_calls: number;
  recording_enabled: boolean;
  human_booking_url?: string;
}

