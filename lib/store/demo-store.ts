import {
  Organization,
  User,
  Company,
  Lead,
  LeadScore,
  ICPConfig,
  Campaign,
  CampaignStep,
  OutboundMessage,
  Conversation,
  Meeting,
  Task,
  AuditLog,
  AIRun,
  LeadStatus,
  FitClassification,
  Channel,
  AISalesBrief,
  TalkSession,
  TalkCallNonce,
  VoiceCall,
  VoiceSettings,
} from '../types';
import { normalizeIndianPhone, normalizeEmail, detectIndianEntityType } from '../normalization/india';

// Default Organization
export const DEFAULT_ORG: Organization = {
  id: 'org_apex_india_001',
  name: 'Apex Technologies India Pvt Ltd',
  slug: 'apex-technologies',
  domain: 'apextech.in',
  gstin: '29AAACA1234A1Z5',
  cin: 'U72200KA2020PTC134567',
  industry: 'Enterprise B2B Automation & AI',
  headquarters_city: 'Bengaluru',
  headquarters_state: 'Karnataka',
  country: 'IN',
  plan_tier: 'ENTERPRISE',
  monthly_ai_budget: 500.0,
  daily_ai_budget: 50.0,
  ai_budget_spent_current_month: 28.45,
  is_autonomous_outreach_enabled: false,
  emergency_kill_switch_active: false,
  created_at: new Date('2024-01-15T00:00:00Z').toISOString(),
};

// Organization Users
export const INITIAL_USERS: User[] = [
  {
    id: 'usr_01',
    organization_id: DEFAULT_ORG.id,
    email: 'vikram.malhotra@apextech.in',
    full_name: 'Vikram Malhotra',
    role: 'ADMIN',
    is_active: true,
    daily_send_limit: 250,
  },
  {
    id: 'usr_02',
    organization_id: DEFAULT_ORG.id,
    email: 'ananya.sen@apextech.in',
    full_name: 'Ananya Sen',
    role: 'SALES_MANAGER',
    is_active: true,
    daily_send_limit: 200,
  },
  {
    id: 'usr_03',
    organization_id: DEFAULT_ORG.id,
    email: 'rohit.verma@apextech.in',
    full_name: 'Rohit Verma',
    role: 'SDR',
    is_active: true,
    daily_send_limit: 150,
  },
  {
    id: 'usr_04',
    organization_id: DEFAULT_ORG.id,
    email: 'priya.iyer@apextech.in',
    full_name: 'Priya Iyer',
    role: 'SALES_REP',
    is_active: true,
    daily_send_limit: 150,
  },
];

// Default ICP Config with customizable weights
export const DEFAULT_ICP: ICPConfig = {
  id: 'icp_01',
  organization_id: DEFAULT_ORG.id,
  name: 'Indian B2B Enterprise Growth ICP',
  target_industries: [
    'Industrial Manufacturing',
    'Logistics & Supply Chain',
    'SaaS & Cloud Software',
    'IT Services & Consulting',
    'FMCG / FMCD Distribution',
  ],
  target_employee_ranges: ['50-200', '201-1000', '1001-5000', '5000+'],
  target_roles: [
    'Founder & CEO',
    'VP Sales',
    'Head of Business Development',
    'Chief Revenue Officer',
    'Chief Operating Officer',
    'Director of Sales',
  ],
  target_geographies: ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Kolkata'],
  weight_industry: 20,
  weight_company_size: 15,
  weight_role_seniority: 20,
  weight_geography: 10,
  weight_tech_fit: 10,
  weight_business_signals: 15,
  weight_contact_quality: 10,
  minimum_qualifying_score: 70,
};

// Helper generator for Indian realistic sample companies
function generateIndianCompanies(): Company[] {
  const seedList = [
    { name: 'Bharat Forgings & Precision Ltd', type: 'LTD', ind: 'Industrial Manufacturing', city: 'Pune', state: 'Maharashtra', rev: 450, empMin: 800, empMax: 1500, gstin: '27AAACB2345B1Z1' },
    { name: 'QuickLogix Supply Solutions Pvt Ltd', type: 'PVT_LTD', ind: 'Logistics & Supply Chain', city: 'Gurugram', state: 'Haryana', rev: 180, empMin: 300, empMax: 600, gstin: '06AAACQ4567Q1Z8' },
    { name: 'Kavach Cloud Systems LLP', type: 'LLP', ind: 'SaaS & Cloud Software', city: 'Bengaluru', state: 'Karnataka', rev: 45, empMin: 90, empMax: 220, gstin: '29AABCK8910K1Z2' },
    { name: 'Siddhivinayak Agro Enterprises', type: 'MSME', ind: 'FMCG / FMCD Distribution', city: 'Ahmedabad', state: 'Gujarat', rev: 85, empMin: 50, empMax: 120, gstin: '24AAAPS9988S1Z0' },
    { name: 'Vanguard IT Solutions India Pvt Ltd', type: 'PVT_LTD', ind: 'IT Services & Consulting', city: 'Hyderabad', state: 'Telangana', rev: 620, empMin: 1200, empMax: 2800, gstin: '36AAACV3456V1Z9' },
    { name: 'Zenith ElectroMech India Ltd', type: 'LTD', ind: 'Industrial Manufacturing', city: 'Chennai', state: 'Tamil Nadu', rev: 320, empMin: 650, empMax: 1100, gstin: '33AAACZ7890Z1Z4' },
    { name: 'NxtGen OmniLogistics Pvt Ltd', type: 'PVT_LTD', ind: 'Logistics & Supply Chain', city: 'Mumbai', state: 'Maharashtra', rev: 210, empMin: 400, empMax: 750, gstin: '27AAACN5678N1Z3' },
    { name: 'FinPulse Software Technologies LLP', type: 'LLP', ind: 'SaaS & Cloud Software', city: 'Bengaluru', state: 'Karnataka', rev: 65, empMin: 110, empMax: 240, gstin: '29AABCF1234F1Z7' },
    { name: 'Aarohan Packaging & Containers Ltd', type: 'LTD', ind: 'Industrial Manufacturing', city: 'Faridabad', state: 'Haryana', rev: 140, empMin: 250, empMax: 500, gstin: '06AAACA9012A1Z6' },
    { name: 'Samriddhi Cold Chain Logistics LLP', type: 'LLP', ind: 'Logistics & Supply Chain', city: 'Indore', state: 'Madhya Pradesh', rev: 55, empMin: 80, empMax: 160, gstin: '23AABCS3456S1Z5' },
    { name: 'CyberShield InfoTech Solutions Pvt Ltd', type: 'PVT_LTD', ind: 'IT Services & Consulting', city: 'Noida', state: 'Uttar Pradesh', rev: 175, empMin: 350, empMax: 700, gstin: '09AAACC7890C1Z2' },
    { name: 'KisanBazaar Agrotech Pvt Ltd', type: 'PVT_LTD', ind: 'FMCG / FMCD Distribution', city: 'Jaipur', state: 'Rajasthan', rev: 92, empMin: 140, empMax: 280, gstin: '08AAACK2345K1Z1' },
  ];

  return seedList.map((item, idx) => ({
    id: `comp_${String(idx + 1).padStart(3, '0')}`,
    organization_id: DEFAULT_ORG.id,
    name: item.name,
    legal_name: item.name,
    entity_type: item.type as any,
    domain: item.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) + '.in',
    website: `https://${item.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}.in`,
    industry: item.ind,
    employee_count_min: item.empMin,
    employee_count_max: item.empMax,
    annual_revenue_cr: item.rev,
    gstin: item.gstin,
    city: item.city,
    state: item.state,
    country: 'IN',
    created_at: new Date(Date.now() - (idx + 1) * 86400000 * 2).toISOString(),
  }));
}

// Helper generator for Indian realistic leads
function generateIndianLeads(companies: Company[]): Lead[] {
  const indianNames = [
    { first: 'Rajesh', last: 'Sharma', role: 'VP Sales & BD', lang: 'en' },
    { first: 'Amitabh', last: 'Chakraborty', role: 'Chief Operating Officer', lang: 'hinglish' },
    { first: 'Karthik', last: 'Subramanian', role: 'Co-Founder & CEO', lang: 'en' },
    { first: 'Harish', last: 'Patel', role: 'Managing Director', lang: 'hi' },
    { first: 'Sunita', last: 'Reddy', role: 'Director - Enterprise Sales', lang: 'en' },
    { first: 'Manoj', last: 'Kulkarni', role: 'Head of Supply Chain', lang: 'hinglish' },
    { first: 'Deepak', last: 'Bhattacharya', role: 'VP Commercial & Alliances', lang: 'bn' },
    { first: 'Vikramaditya', last: 'Rathore', role: 'General Manager - Sales', lang: 'hi' },
    { first: 'Swati', last: 'Deshmukh', role: 'Chief Revenue Officer', lang: 'en' },
    { first: 'Anil', last: 'Agarwal', role: 'Executive Vice President', lang: 'en' },
    { first: 'Siddharth', last: 'Menon', role: 'Director of Business Strategy', lang: 'en' },
    { first: 'Pooja', last: 'Chopra', role: 'Head of Corporate Sales', lang: 'hinglish' },
  ];

  const statuses: LeadStatus[] = [
    'ENGAGED',
    'MEETING',
    'QUALIFIED_OPPORTUNITY',
    'OUTREACH',
    'QUALIFIED',
    'NEW',
    'RESEARCHING',
    'CONTACTED',
    'SALES_HANDOFF',
    'NURTURE',
  ];

  const leads: Lead[] = [];

  indianNames.forEach((n, idx) => {
    const comp = companies[idx % companies.length];
    const email = `${n.first.toLowerCase()}.${n.last.toLowerCase()}@${comp.domain}`;
    const phone = `+9198${(10000000 + idx * 765432).toString().slice(0, 8)}`;
    const status = statuses[idx % statuses.length];

    const scoreNum = 70 + (idx % 25);
    const classification: FitClassification = scoreNum >= 85 ? 'HOT' : scoreNum >= 75 ? 'HIGH_FIT' : 'MEDIUM_FIT';

    leads.push({
      id: `lead_${String(idx + 1).padStart(3, '0')}`,
      organization_id: DEFAULT_ORG.id,
      company_id: comp.id,
      company_name: comp.name,
      first_name: n.first,
      last_name: n.last,
      full_name: `${n.first} ${n.last}`,
      job_title: n.role,
      email,
      normalized_email: email,
      phone,
      normalized_phone: phone,
      city: comp.city,
      state: comp.state,
      status,
      lead_source: idx % 2 === 0 ? 'CSV_IMPORT' : 'WEBHOOK_ENQUIRY',
      campaign_name: 'Indian Manufacturing & Tech Sales Leaders',
      preferred_language: n.lang as any,
      assigned_user_id: INITIAL_USERS[2].id,
      is_suppressed: false,
      is_dnc_registered: false,
      requires_human_attention: status === 'SALES_HANDOFF' || status === 'ENGAGED',
      attention_reason: status === 'SALES_HANDOFF' ? 'High buying intent detected; request for commercial proposal' : undefined,
      created_at: new Date(Date.now() - (idx + 1) * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      score: {
        score: scoreNum,
        classification,
        reasoning: [
          `Target industry fit: ${comp.industry}`,
          `Role seniority (${n.role}) holds P&L / purchasing authority`,
          `Tier 1/2 commercial hub in ${comp.city}, ${comp.state}`,
        ],
        confidence: 0.9,
        industry_score: 18,
        size_score: 15,
        role_score: 19,
        geo_score: 10,
        signals_score: 14,
        calculated_at: new Date().toISOString(),
      },
      company: comp,
    });
  });

  return leads;
}

// Default Campaigns
export const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp_01',
    organization_id: DEFAULT_ORG.id,
    name: 'Indian Manufacturing & Tech Sales Leaders',
    description: 'Autonomous multi-channel sequence targeting VP Sales and COOs across Pune, NCR, and Bengaluru manufacturing corridors.',
    status: 'ACTIVE',
    approval_mode: 'MANUAL',
    target_persona: 'VP Sales / Head of BD / COO',
    target_industry: 'Industrial Manufacturing & Tech',
    daily_lead_limit: 50,
    business_hours_start: '09:30',
    business_hours_end: '18:30',
    timezone: 'Asia/Kolkata',
    working_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    steps_count: 5,
    leads_count: 42,
    open_rate: 64.2,
    reply_rate: 22.8,
    positive_reply_rate: 14.5,
    created_at: new Date('2024-02-01T00:00:00Z').toISOString(),
  },
  {
    id: 'camp_02',
    organization_id: DEFAULT_ORG.id,
    name: 'Cold-Chain & 3PL Logistics Modernization',
    description: 'WhatsApp-first outbound cadence engaging supply chain directors on fleet tracking and sales automation.',
    status: 'ACTIVE',
    approval_mode: 'SEMI_AUTOMATIC',
    target_persona: 'Chief Operating Officer / Logistics Head',
    target_industry: 'Logistics & Supply Chain',
    daily_lead_limit: 40,
    business_hours_start: '10:00',
    business_hours_end: '19:00',
    timezone: 'Asia/Kolkata',
    working_days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    steps_count: 4,
    leads_count: 28,
    open_rate: 78.4,
    reply_rate: 31.0,
    positive_reply_rate: 18.2,
    created_at: new Date('2024-02-10T00:00:00Z').toISOString(),
  },
  {
    id: 'camp_03',
    organization_id: DEFAULT_ORG.id,
    name: 'B2B SaaS Founder Pipeline Acceleration',
    description: 'Consultative email and LinkedIn sequences offering outbound SDR benchmarking for Seed/Series-A founders.',
    status: 'ACTIVE',
    approval_mode: 'MANUAL',
    target_persona: 'Founder & CEO',
    target_industry: 'SaaS & Cloud Software',
    daily_lead_limit: 30,
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    timezone: 'Asia/Kolkata',
    working_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    steps_count: 5,
    leads_count: 35,
    open_rate: 58.0,
    reply_rate: 19.5,
    positive_reply_rate: 12.0,
    created_at: new Date('2024-02-15T00:00:00Z').toISOString(),
  },
];

// In-Memory Global Store Instance
class DemoStore {
  public org: Organization = DEFAULT_ORG;
  public users: User[] = [...INITIAL_USERS];
  public icp: ICPConfig = DEFAULT_ICP;
  public companies: Company[] = generateIndianCompanies();
  public leads: Lead[] = [];
  public campaigns: Campaign[] = [...INITIAL_CAMPAIGNS];
  public messages: OutboundMessage[] = [];
  public conversations: Conversation[] = [];
  public meetings: Meeting[] = [];
  public tasks: Task[] = [];
  public auditLogs: AuditLog[] = [];
  public aiRuns: AIRun[] = [];
  public talkSessions: TalkSession[] = [];
  public talkCallNonces: TalkCallNonce[] = [];
  public voiceCalls: VoiceCall[] = [];
  public voiceSettings: VoiceSettings = {
    id: 'vset_01',
    organization_id: DEFAULT_ORG.id,
    voice_enabled: true,
    web_voice_enabled: true,
    pstn_enabled: false,
    dlt_entity_id: '110155223344',
    caller_id_series: '140',
    calling_window_start: '09:00',
    calling_window_end: '21:00',
    timezone: 'Asia/Kolkata',
    pstn_daily_cap: 50,
    talk_link_ttl_days: 7,
    talk_link_max_calls: 3,
    recording_enabled: true,
    human_booking_url: 'https://cal.com/apex-enterprise/discovery',
  };

  constructor() {
    this.leads = generateIndianLeads(this.companies);
    this.seedInitialOutboundAndConversations();
    this.seedInitialVoiceModule();
  }

  private seedInitialOutboundAndConversations() {
    // Seed Outbound Messages pending approval
    this.messages.push({
      id: 'msg_001',
      organization_id: this.org.id,
      lead_id: this.leads[0].id,
      lead_name: this.leads[0].full_name,
      lead_company: this.leads[0].company_name || 'Bharat Forgings',
      campaign_id: this.campaigns[0].id,
      campaign_name: this.campaigns[0].name,
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      subject: 'Optimizing auto component sales pipeline velocity for Bharat Forgings',
      body: `Hi Rajesh,\n\nNoticed Bharat Forgings' recent expansion in the Pune industrial belt. Several Tier-1 auto-component suppliers we partner with have streamlined their enterprise sales cycles by 40% with automated pipeline intelligence.\n\nWould you have 15 minutes this Thursday for a brief discussion on your expansion priorities?\n\nBest regards,\nRohit Verma\nApex Technologies India\n\nTo opt out of future communications, reply with unsubscribe.`,
      status: 'PENDING_APPROVAL',
      requires_approval: true,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    });

    this.messages.push({
      id: 'msg_002',
      organization_id: this.org.id,
      lead_id: this.leads[1].id,
      lead_name: this.leads[1].full_name,
      lead_company: this.leads[1].company_name || 'QuickLogix',
      campaign_id: this.campaigns[1].id,
      campaign_name: this.campaigns[1].name,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      body: `Namaste Amitabh ji, saw QuickLogix scaling 3PL cold-chain capacity across Haryana. Quick question: how are your regional sales managers currently following up on inbound client RFQs? Would love to share a short 2-page brief on automated lead qualification.`,
      status: 'SENT',
      requires_approval: false,
      sent_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
    });

    // Seed Conversation with Amitabh
    this.conversations.push({
      id: 'conv_001',
      organization_id: this.org.id,
      lead_id: this.leads[1].id,
      lead_name: this.leads[1].full_name,
      lead_company: this.leads[1].company_name || 'QuickLogix',
      lead_email: this.leads[1].email,
      lead_phone: this.leads[1].phone,
      channel: 'WHATSAPP',
      status: 'ACTIVE',
      latest_intent: 'INTERESTED',
      sentiment: 'POSITIVE',
      buying_stage: 'EVALUATING',
      needs_human_attention: true,
      qualification_notes: {
        need: 'Reduce SDR prospecting time and automate RFQ follow-ups across 12 newly hired sales reps.',
        urgency: 'Immediate (this quarter rollout).',
        budget: 'Approved INR 15L-25L annual sales enablement budget.',
      },
      messages: [
        {
          id: 'cm_01',
          conversation_id: 'conv_001',
          sender_type: 'AI_SDR',
          sender_name: 'Apex AI Assistant',
          content: 'Namaste Amitabh ji, saw QuickLogix scaling 3PL cold-chain capacity across Haryana. Quick question: how are your regional sales managers currently following up on inbound client RFQs?',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'cm_02',
          conversation_id: 'conv_001',
          sender_type: 'PROSPECT',
          sender_name: 'Amitabh Chakraborty',
          content: 'Yes, interested. We are currently spending too much manual time on LinkedIn and tier-2 inquiries. Can you share a deck or show a demo?',
          intent_detected: 'INTERESTED',
          created_at: new Date(Date.now() - 43200000).toISOString(),
        },
        {
          id: 'cm_03',
          conversation_id: 'conv_001',
          sender_type: 'AI_SDR',
          sender_name: 'Apex AI Assistant',
          content: 'Certainly Amitabh ji! I can arrange a tailored 20-minute walkthrough with Priya from our solutions team. Would Wednesday 3:30 PM IST work for you?',
          created_at: new Date(Date.now() - 36000000).toISOString(),
        },
      ],
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 36000000).toISOString(),
    });

    // Seed Confirmed Meeting
    this.meetings.push({
      id: 'meet_001',
      organization_id: this.org.id,
      lead_id: this.leads[1].id,
      lead_name: this.leads[1].full_name,
      lead_company: this.leads[1].company_name || 'QuickLogix',
      host_user_id: INITIAL_USERS[3].id,
      host_user_name: INITIAL_USERS[3].full_name,
      title: 'Discovery Call: Apex SDR x QuickLogix Sales Automation',
      description: 'Discovery session on cold-chain logistics lead qualification and multi-channel WhatsApp outreach.',
      start_time: new Date(Date.now() + 86400000 * 1.5).toISOString(),
      end_time: new Date(Date.now() + 86400000 * 1.5 + 1800000).toISOString(),
      meet_url: 'https://meet.google.com/apx-sdr-qck',
      calendar_provider: 'Google Calendar [SIMULATED]',
      status: 'CONFIRMED',
      sales_brief: {
        account_overview: 'QuickLogix is a ₹180Cr revenue 3PL cold-chain logistics enterprise headquartered in Gurugram, Haryana.',
        contact_role: 'Amitabh Chakraborty is the COO, owning revenue operations and regional sales head productivity.',
        company_context: 'Rapidly scaling across North India; currently hiring 12 sales reps to capture industrial FMCG clients.',
        verified_pain_points: [
          'High manual prospecting friction across tier-2 Haryana industrial belts',
          'SDR response latency to inbound website & WhatsApp RFQs exceeds 48 hours',
        ],
        buying_signals: [
          'Actively seeking sales deck and live demo',
          'Immediate implementation timeline for Q1 targets',
        ],
        recommended_questions: [
          'What is your target customer acquisition cost across northern cold-chain distribution hubs?',
          'How do your regional sales managers prefer handling Hinglish vs English communication?',
        ],
        anticipated_objections: [
          'Integration compatibility with existing internal ERP / CRM software',
          'Meta Cloud API messaging compliance under Indian TRAI regulations',
        ],
        recommended_discovery_approach: 'Present the Indian B2B WhatsApp + Email unified queue, highlighting the 3-minute lead response guarantee.',
      },
      created_at: new Date(Date.now() - 18000000).toISOString(),
    });

    // Seed Task
    this.tasks.push({
      id: 'task_001',
      organization_id: this.org.id,
      lead_id: this.leads[1].id,
      lead_name: this.leads[1].full_name,
      assigned_user_id: INITIAL_USERS[3].id,
      assigned_user_name: INITIAL_USERS[3].full_name,
      title: 'Prepare Custom Deck for QuickLogix COO Discovery Meeting',
      description: 'Review AI Sales Brief, include cold-chain logistics benchmark numbers, and verify Google Meet link.',
      priority: 'HIGH',
      due_date: new Date(Date.now() + 86400000).toISOString(),
      status: 'IN_PROGRESS',
      created_by_ai: true,
      created_at: new Date(Date.now() - 10000000).toISOString(),
    });

    // Seed Audit Logs
    this.auditLogs.push(
      {
        id: 'aud_01',
        organization_id: this.org.id,
        actor_name: 'AI Agent (LeadIntelligence)',
        actor_type: 'AI_AGENT',
        action: 'LEAD_INGESTED_AND_NORMALIZED',
        entity_type: 'lead',
        entity_id: this.leads[0].id,
        details: 'Normalized +919876543210, validated GSTIN 27AAACB2345B1Z1, detected entity type LTD.',
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'aud_02',
        organization_id: this.org.id,
        actor_name: 'AI Agent (ScoringAgent)',
        actor_type: 'AI_AGENT',
        action: 'ICP_FIT_CALCULATED',
        entity_type: 'lead',
        entity_id: this.leads[0].id,
        details: 'Assigned score 88 (Classification: HOT). Target industry match & VP Sales seniority.',
        created_at: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: 'aud_03',
        organization_id: this.org.id,
        actor_name: 'Rohit Verma',
        actor_type: 'USER',
        action: 'CAMPAIGN_ENROLLMENT',
        entity_type: 'campaign',
        entity_id: this.campaigns[0].id,
        details: 'Enrolled Rajesh Sharma (Bharat Forgings) in Indian Manufacturing Sales Leaders campaign.',
        created_at: new Date(Date.now() - 4000000).toISOString(),
      }
    );

    // Seed AI Runs
    this.aiRuns.push(
      {
        id: 'airun_01',
        organization_id: this.org.id,
        lead_id: this.leads[0].id,
        agent_name: 'LeadScoringAgent',
        provider: 'GROQ',
        model: 'llama-3.3-70b-versatile',
        prompt_tokens: 420,
        completion_tokens: 110,
        total_tokens: 530,
        estimated_cost_usd: 0.000041,
        latency_ms: 382,
        success: true,
        created_at: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: 'airun_02',
        organization_id: this.org.id,
        lead_id: this.leads[0].id,
        agent_name: 'PersonalizationAgent',
        provider: 'GROQ',
        model: 'llama-3.3-70b-versatile',
        prompt_tokens: 680,
        completion_tokens: 220,
        total_tokens: 900,
        estimated_cost_usd: 0.000078,
        latency_ms: 540,
        success: true,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      }
    );
  }

  private seedInitialVoiceModule() {
    // 10 Demo Talk Sessions
    const statuses: Array<{ id: string; leadIdx: number; status: any; channel: any; expiresOffsetDays: number; sentOffsetH?: number; openedOffsetH?: number; revokedReason?: string }> = [
      { id: 'ts_01', leadIdx: 0, status: 'CREATED', channel: 'email', expiresOffsetDays: 7 },
      { id: 'ts_02', leadIdx: 1, status: 'SENT', channel: 'whatsapp', expiresOffsetDays: 6, sentOffsetH: 12 },
      { id: 'ts_03', leadIdx: 2, status: 'SENT', channel: 'email', expiresOffsetDays: 6, sentOffsetH: 24 },
      { id: 'ts_04', leadIdx: 3, status: 'OPENED', channel: 'email', expiresOffsetDays: 5, sentOffsetH: 30, openedOffsetH: 2 },
      { id: 'ts_05', leadIdx: 4, status: 'OPENED', channel: 'whatsapp', expiresOffsetDays: 5, sentOffsetH: 18, openedOffsetH: 1 },
      { id: 'ts_06', leadIdx: 5, status: 'CALL_STARTED', channel: 'email', expiresOffsetDays: 4, sentOffsetH: 20, openedOffsetH: 0.5 },
      { id: 'ts_07', leadIdx: 0, status: 'COMPLETED', channel: 'email', expiresOffsetDays: 3, sentOffsetH: 48, openedOffsetH: 24 },
      { id: 'ts_08', leadIdx: 1, status: 'COMPLETED', channel: 'whatsapp', expiresOffsetDays: 3, sentOffsetH: 50, openedOffsetH: 25 },
      { id: 'ts_09', leadIdx: 6, status: 'EXPIRED', channel: 'email', expiresOffsetDays: -2, sentOffsetH: 200 },
      { id: 'ts_10', leadIdx: 7, status: 'REVOKED', channel: 'whatsapp', expiresOffsetDays: 2, sentOffsetH: 36, revokedReason: 'Prospect requested DO NOT CONTACT' },
    ];

    statuses.forEach((s) => {
      const lead = this.leads[s.leadIdx] || this.leads[0];
      const token = `demo_token_${s.id}_${Math.random().toString(36).substring(2, 10)}`;
      this.talkSessions.push({
        id: s.id,
        organization_id: this.org.id,
        lead_id: lead.id,
        lead_name: lead.full_name,
        lead_company: lead.company_name,
        campaign_id: this.campaigns[0]?.id,
        channel: s.channel,
        token_hash: `hash_${s.id}_${token.substring(0, 12)}`,
        token: token,
        status: s.status,
        expires_at: new Date(Date.now() + s.expiresOffsetDays * 86400000).toISOString(),
        max_calls: 3,
        call_count: s.status === 'COMPLETED' ? 1 : s.status === 'CALL_STARTED' ? 1 : 0,
        sent_at: s.sentOffsetH ? new Date(Date.now() - s.sentOffsetH * 3600000).toISOString() : undefined,
        opened_at: s.openedOffsetH ? new Date(Date.now() - s.openedOffsetH * 3600000).toISOString() : undefined,
        last_opened_at: s.openedOffsetH ? new Date(Date.now() - s.openedOffsetH * 3600000).toISOString() : undefined,
        revoked_at: s.status === 'REVOKED' ? new Date().toISOString() : undefined,
        revoked_reason: s.revokedReason,
        language: 'en',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      });
    });

    // 5 Completed Demo Voice Calls
    this.voiceCalls.push(
      {
        id: 'vc_01',
        organization_id: this.org.id,
        lead_id: this.leads[0].id,
        lead_name: this.leads[0].full_name,
        lead_company: this.leads[0].company_name || 'Bharat Forgings',
        talk_session_id: 'ts_07',
        mode: 'webrtc',
        provider: 'demo',
        provider_run_id: 'run_webrtc_001',
        status: 'COMPLETED',
        started_at: new Date(Date.now() - 86400000).toISOString(),
        ended_at: new Date(Date.now() - 86400000 + 185000).toISOString(),
        duration_seconds: 185,
        transcript: [
          { role: 'agent', text: 'Namaste Rajesh ji, this is Apex AI calling from Apex Technologies regarding your B2B sales pipeline expansion in Pune. Do you have a moment?' },
          { role: 'user', text: 'Yes, but be quick. We have reps using Excel and manual follow-ups right now.' },
          { role: 'agent', text: 'Understood. We partner with Tier-1 manufacturers to automate 15+ weekly hours of manual follow-ups so reps focus purely on qualified leads. Would you be open to a short discovery demo this Thursday?' },
          { role: 'user', text: 'That could be useful. What time on Thursday?' },
          { role: 'agent', text: 'I have 3:00 PM IST or 4:30 PM IST available with our senior solutions architect. Which works best?' },
          { role: 'user', text: '3:00 PM IST works. Send the calendar invite to my email.' },
        ],
        extracted: {
          intent: 'REQUEST_DEMO',
          buying_stage: 'EVALUATING',
          sentiment: 'POSITIVE',
          qualification: {
            problem: 'Manual Excel tracking and delayed lead follow-ups',
            need: 'Automated pipeline prioritization',
            urgency: 'HIGH',
            authority: 'VP Sales (Sole Signer)',
            timeline: 'This Quarter',
            budget_signal: 'Approved annual sales enablement budget',
          },
          meeting_requested: true,
          meeting_id: 'meet_01',
          handoff_requested: true,
          opt_out: false,
          language: 'Hinglish',
          summary: 'Rajesh confirmed pain with manual rep follow-ups. Booked 15-minute discovery demo for Thursday at 3:00 PM IST.',
        },
        intent: 'REQUEST_DEMO',
        sentiment: 'POSITIVE',
        disclosure_given: true,
        consent_transcript: true,
        recording_url: 'https://demo-storage.apextech.in/recordings/call_01.mp3',
        carrier_cost_estimate_inr: 0.0,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'vc_02',
        organization_id: this.org.id,
        lead_id: this.leads[1].id,
        lead_name: this.leads[1].full_name,
        lead_company: this.leads[1].company_name || 'QuickLogix',
        talk_session_id: 'ts_08',
        mode: 'webrtc',
        provider: 'demo',
        provider_run_id: 'run_webrtc_002',
        status: 'COMPLETED',
        started_at: new Date(Date.now() - 72000000).toISOString(),
        ended_at: new Date(Date.now() - 72000000 + 142000).toISOString(),
        duration_seconds: 142,
        transcript: [
          { role: 'agent', text: 'Hi Amitabh ji, Apex AI assistant here. Reaching out regarding your 3PL fleet cold-chain expansion in Haryana.' },
          { role: 'user', text: 'Hello. We are looking at automation solutions, what is your commercial pricing?' },
          { role: 'agent', text: 'We offer seat-based and volume-based plans tailored for Indian logistics MSMEs. Would you like our solutions director to share the specific commercial tier breakdown over a brief call?' },
          { role: 'user', text: 'Yes, please have someone connect with me on Friday morning.' },
        ],
        extracted: {
          intent: 'REQUEST_PRICING',
          buying_stage: 'EVALUATING',
          sentiment: 'POSITIVE',
          qualification: {
            problem: 'Scaling inbound client inquiries across newly expanded fleet',
            urgency: 'MEDIUM',
            budget_signal: 'INR 15L-25L allocated for automation',
          },
          handoff_requested: true,
          meeting_requested: true,
          opt_out: false,
          language: 'English',
          summary: 'Amitabh inquired about commercial tiers for QuickLogix. Requested Account Executive follow-up Friday morning.',
        },
        intent: 'REQUEST_PRICING',
        sentiment: 'POSITIVE',
        disclosure_given: true,
        consent_transcript: true,
        recording_url: 'https://demo-storage.apextech.in/recordings/call_02.mp3',
        carrier_cost_estimate_inr: 0.0,
        created_at: new Date(Date.now() - 72000000).toISOString(),
      },
      {
        id: 'vc_03',
        organization_id: this.org.id,
        lead_id: this.leads[2].id,
        lead_name: this.leads[2].full_name,
        lead_company: this.leads[2].company_name || 'Fintech Infra',
        mode: 'webrtc',
        provider: 'demo',
        provider_run_id: 'run_webrtc_003',
        status: 'COMPLETED',
        started_at: new Date(Date.now() - 54000000).toISOString(),
        ended_at: new Date(Date.now() - 54000000 + 95000).toISOString(),
        duration_seconds: 95,
        transcript: [
          { role: 'agent', text: 'Hello Sunita ji, this is Apex AI calling from Apex Technologies. Am I speaking with Sunita?' },
          { role: 'user', text: 'Yes, but we are currently heads-down in our SOC-2 compliance audit this month. Not looking at sales tools right now.' },
          { role: 'agent', text: 'Completely understand Sunita ji. Good luck with the audit. May we reconnect in mid-November once your audit concludes?' },
          { role: 'user', text: 'Sure, drop an email around Diwali.' },
        ],
        extracted: {
          intent: 'NOT_NOW',
          buying_stage: 'NURTURE',
          sentiment: 'NEUTRAL',
          timeline: 'Post-Diwali / November',
          opt_out: false,
          summary: 'Sunita busy with SOC-2 audit. Requested follow-up in November post-Diwali.',
        },
        intent: 'NOT_NOW',
        sentiment: 'NEUTRAL',
        disclosure_given: true,
        consent_transcript: true,
        carrier_cost_estimate_inr: 0.0,
        created_at: new Date(Date.now() - 54000000).toISOString(),
      },
      {
        id: 'vc_04',
        organization_id: this.org.id,
        lead_id: this.leads[3].id,
        lead_name: this.leads[3].full_name,
        lead_company: this.leads[3].company_name || 'Surat Textiles',
        mode: 'pstn',
        provider: 'demo',
        provider_run_id: 'run_pstn_004',
        status: 'COMPLETED',
        started_at: new Date(Date.now() - 36000000).toISOString(),
        ended_at: new Date(Date.now() - 36000000 + 210000).toISOString(),
        duration_seconds: 210,
        transcript: [
          { role: 'agent', text: 'Namaste Deepa ji, this is an automated call from Apex Technologies on a verified business line regarding your export inquiries.' },
          { role: 'user', text: 'Namaste. Haan boliye, kya jankari chahiye?' },
          { role: 'agent', text: 'Hum Indian export textile companies ke saath partner karte hain buyer leads qualify karne ke liye. Kya humare business manager aapko ek chhota demo dikha sakte hain?' },
          { role: 'user', text: 'Haan theek hai, Monday afternoon connect kar lijiye.' },
        ],
        extracted: {
          intent: 'INTERESTED',
          buying_stage: 'EVALUATING',
          sentiment: 'POSITIVE',
          language: 'Hindi',
          meeting_requested: true,
          opt_out: false,
          summary: 'Deepa confirmed interest in export buyer lead automation. Agreed to Monday afternoon demo.',
        },
        intent: 'INTERESTED',
        sentiment: 'POSITIVE',
        disclosure_given: true,
        consent_transcript: true,
        carrier_cost_estimate_inr: 4.2,
        created_at: new Date(Date.now() - 36000000).toISOString(),
      },
      {
        id: 'vc_05',
        organization_id: this.org.id,
        lead_id: this.leads[4].id,
        lead_name: this.leads[4].full_name,
        lead_company: this.leads[4].company_name || 'Bengaluru SaaS',
        mode: 'webrtc',
        provider: 'demo',
        provider_run_id: 'run_webrtc_005',
        status: 'COMPLETED',
        started_at: new Date(Date.now() - 18000000).toISOString(),
        ended_at: new Date(Date.now() - 18000000 + 65000).toISOString(),
        duration_seconds: 65,
        transcript: [
          { role: 'agent', text: 'Hi Vikram, this is Apex AI calling from Apex Technologies.' },
          { role: 'user', text: 'Please remove my number and do not contact me again.' },
          { role: 'agent', text: 'Understood Vikram. I have immediately opted you out and removed your record from all future communications. Have a good day.' },
        ],
        extracted: {
          intent: 'UNSUBSCRIBE',
          sentiment: 'NEGATIVE',
          opt_out: true,
          summary: 'Prospect explicitly requested DO NOT CONTACT. Immediately suppressed and session revoked.',
        },
        intent: 'UNSUBSCRIBE',
        sentiment: 'NEGATIVE',
        disclosure_given: true,
        consent_transcript: true,
        carrier_cost_estimate_inr: 0.0,
        created_at: new Date(Date.now() - 18000000).toISOString(),
      }
    );
  }

  public getLeads(): Lead[] {
    return this.leads;
  }

  public getTalkSessions(): TalkSession[] {
    return this.talkSessions;
  }

  public getVoiceCalls(): VoiceCall[] {
    return this.voiceCalls;
  }

  public getVoiceSettings(): VoiceSettings {
    return this.voiceSettings;
  }

  public getOrg(): Organization {
    return this.org;
  }

  public getTalkSession(idOrToken: string): TalkSession | undefined {
    return this.talkSessions.find(
      (ts) => ts.id === idOrToken || ts.token_hash === idOrToken || ts.token === idOrToken
    );
  }

  public createTalkSession(session: Partial<TalkSession>): TalkSession {
    return this.addTalkSession(session);
  }

  public addTalkSession(session: Partial<TalkSession>): TalkSession {
    const fullSession: TalkSession = {
      id: session.id || `ts_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: this.org.id,
      lead_id: session.lead_id || this.leads[0].id,
      lead_name: session.lead_name,
      lead_company: session.lead_company,
      campaign_id: session.campaign_id,
      channel: session.channel || 'email',
      token_hash: session.token_hash || `hash_${Date.now()}`,
      token: session.token,
      status: session.status || 'CREATED',
      expires_at: session.expires_at || new Date(Date.now() + 7 * 86400000).toISOString(),
      max_calls: session.max_calls || 3,
      call_count: session.call_count || 0,
      language: session.language || 'en',
      created_at: new Date().toISOString(),
    };
    this.talkSessions.unshift(fullSession);
    return fullSession;
  }

  public updateTalkSession(id: string, updates: Partial<TalkSession>): TalkSession | undefined {
    const session = this.talkSessions.find((ts) => ts.id === id);
    if (session) {
      Object.assign(session, updates);
    }
    return session;
  }

  public recordVoiceCall(callData: Partial<VoiceCall>): VoiceCall {
    const fullCall: VoiceCall = {
      id: callData.id || `vc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: this.org.id,
      lead_id: callData.lead_id || this.leads[0].id,
      lead_name: callData.lead_name,
      lead_company: callData.lead_company,
      talk_session_id: callData.talk_session_id,
      mode: callData.mode || 'webrtc',
      provider: callData.provider || 'demo',
      provider_run_id: callData.provider_run_id || `run_${Date.now()}`,
      status: callData.status || 'COMPLETED',
      started_at: callData.started_at || new Date().toISOString(),
      ended_at: callData.ended_at || new Date().toISOString(),
      duration_seconds: callData.duration_seconds || 0,
      transcript: callData.transcript || [],
      extracted: callData.extracted || {},
      intent: callData.intent,
      sentiment: callData.sentiment,
      disclosure_given: callData.disclosure_given ?? true,
      consent_transcript: callData.consent_transcript ?? true,
      recording_url: callData.recording_url,
      carrier_cost_estimate_inr: callData.carrier_cost_estimate_inr || 0.0,
      created_at: new Date().toISOString(),
    };
    this.voiceCalls.unshift(fullCall);
    return fullCall;
  }

  public updateVoiceSettings(updates: Partial<VoiceSettings>): VoiceSettings {
    Object.assign(this.voiceSettings, updates);
    return this.voiceSettings;
  }

  public findTalkSessionByTokenHash(tokenHash: string): TalkSession | undefined {
    return this.talkSessions.find((ts) => ts.token_hash === tokenHash);
  }

  public createTalkNonce(nonceData: TalkCallNonce): TalkCallNonce {
    this.talkCallNonces.unshift(nonceData);
    return nonceData;
  }

  public findTalkNonceByHash(nonceHash: string): TalkCallNonce | undefined {
    return this.talkCallNonces.find((n) => n.nonce_hash === nonceHash);
  }

  public consumeTalkNonceByHash(nonceHash: string): { success: boolean; nonce?: TalkCallNonce; error?: string } {
    const nonceRecord = this.talkCallNonces.find((n) => n.nonce_hash === nonceHash);
    if (!nonceRecord) {
      return { success: false, error: 'Nonce not found' };
    }
    if (nonceRecord.is_used) {
      return { success: false, error: 'Nonce has already been used' };
    }
    if (new Date(nonceRecord.expires_at).getTime() < Date.now()) {
      return { success: false, error: 'Nonce has expired' };
    }
    nonceRecord.is_used = true;
    nonceRecord.used_at = new Date().toISOString();
    return { success: true, nonce: nonceRecord };
  }


  // Lead Management
  public addLead(leadData: Partial<Lead>): Lead {
    const rawPhone = leadData.phone || '+919800000000';
    const normPhone = normalizeIndianPhone(rawPhone);
    const normEmail = normalizeEmail(leadData.email || '');

    const newLead: Lead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: this.org.id,
      company_name: leadData.company_name || 'Independent Enterprise',
      first_name: leadData.first_name || 'Prospect',
      last_name: leadData.last_name || '',
      full_name: `${leadData.first_name || 'Prospect'} ${leadData.last_name || ''}`.trim(),
      job_title: leadData.job_title || 'Decision Maker',
      email: leadData.email || '',
      normalized_email: normEmail.normalized,
      phone: rawPhone,
      normalized_phone: normPhone.normalized,
      city: leadData.city || 'Bengaluru',
      state: leadData.state || 'Karnataka',
      status: 'NEW',
      lead_source: leadData.lead_source || 'MANUAL_ENTRY',
      preferred_language: leadData.preferred_language || 'en',
      assigned_user_id: INITIAL_USERS[2].id,
      is_suppressed: false,
      is_dnc_registered: false,
      requires_human_attention: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      score: {
        score: 75,
        classification: 'HIGH_FIT',
        reasoning: ['Ingested and normalized against Indian B2B registry'],
        confidence: 0.85,
        industry_score: 15,
        size_score: 15,
        role_score: 15,
        geo_score: 15,
        signals_score: 15,
        calculated_at: new Date().toISOString(),
      },
    };

    this.leads.unshift(newLead);
    this.recordAuditLog('AI_AGENT', 'LEAD_CREATED', 'lead', newLead.id, `Created lead ${newLead.full_name}`);
    return newLead;
  }

  public updateLeadStatus(leadId: string, status: LeadStatus, reason?: string): Lead | undefined {
    const lead = this.leads.find((l) => l.id === leadId);
    if (lead) {
      const prevStatus = lead.status;
      lead.status = status;
      lead.updated_at = new Date().toISOString();
      if (reason) {
        lead.attention_reason = reason;
      }
      this.recordAuditLog(
        'USER',
        'LEAD_STATUS_UPDATED',
        'lead',
        leadId,
        `Changed status from ${prevStatus} to ${status}`
      );
    }
    return lead;
  }

  public approveMessage(messageId: string): OutboundMessage | undefined {
    const msg = this.messages.find((m) => m.id === messageId);
    if (msg) {
      msg.status = 'SENT';
      msg.approved_by = INITIAL_USERS[1].full_name;
      msg.approved_at = new Date().toISOString();
      msg.sent_at = new Date().toISOString();

      // Update corresponding lead status to CONTACTED if currently NEW/QUALIFIED
      const lead = this.leads.find((l) => l.id === msg.lead_id);
      if (lead && (lead.status === 'NEW' || lead.status === 'QUALIFIED' || lead.status === 'OUTREACH')) {
        lead.status = 'CONTACTED';
      }

      this.recordAuditLog(
        'USER',
        'OUTREACH_APPROVED_AND_SENT',
        'message',
        messageId,
        `Approved ${msg.channel} outbound to ${msg.lead_name}`
      );
    }
    return msg;
  }

  public rejectMessage(messageId: string, reason: string): OutboundMessage | undefined {
    const msg = this.messages.find((m) => m.id === messageId);
    if (msg) {
      msg.status = 'CANCELLED';
      msg.error_message = `Rejected by SDR: ${reason}`;
      this.recordAuditLog('USER', 'OUTREACH_REJECTED', 'message', messageId, `Rejected outbound: ${reason}`);
    }
    return msg;
  }

  public toggleKillSwitch(): boolean {
    this.org.emergency_kill_switch_active = !this.org.emergency_kill_switch_active;
    this.recordAuditLog(
      'USER',
      this.org.emergency_kill_switch_active ? 'EMERGENCY_KILL_SWITCH_ACTIVATED' : 'KILL_SWITCH_DEACTIVATED',
      'setting',
      this.org.id,
      this.org.emergency_kill_switch_active
        ? 'STOP ALL OUTREACH engaged. All queues paused.'
        : 'Outreach queues resumed.'
    );
    return this.org.emergency_kill_switch_active;
  }

  public recordAuditLog(
    actorType: 'USER' | 'AI_AGENT' | 'SYSTEM_WORKER',
    action: string,
    entityType: string,
    entityId: string,
    details: string
  ) {
    this.auditLogs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: this.org.id,
      actor_name: actorType === 'USER' ? 'Ananya Sen (Sales Manager)' : 'Apex AI SDR Agent',
      actor_type: actorType,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      created_at: new Date().toISOString(),
    });
  }

  public getStats() {
    const totalLeads = this.leads.length;
    const qualifiedLeads = this.leads.filter((l) => ['QUALIFIED', 'OUTREACH', 'CONTACTED', 'ENGAGED', 'QUALIFIED_OPPORTUNITY', 'MEETING', 'SALES_HANDOFF', 'WON'].includes(l.status)).length;
    const contacted = this.leads.filter((l) => ['CONTACTED', 'ENGAGED', 'QUALIFIED_OPPORTUNITY', 'MEETING', 'SALES_HANDOFF', 'WON'].includes(l.status)).length;
    const engaged = this.leads.filter((l) => ['ENGAGED', 'QUALIFIED_OPPORTUNITY', 'MEETING', 'SALES_HANDOFF', 'WON'].includes(l.status)).length;
    const meetings = this.meetings.length;
    const opportunities = this.leads.filter((l) => l.status === 'QUALIFIED_OPPORTUNITY').length;
    const handoffs = this.leads.filter((l) => l.status === 'SALES_HANDOFF' || l.requires_human_attention).length;
    const pendingApprovals = this.messages.filter((m) => m.status === 'PENDING_APPROVAL').length;

    const conversionRate = totalLeads > 0 ? ((meetings / totalLeads) * 100).toFixed(1) : '0.0';

    return {
      totalLeads,
      qualifiedLeads,
      contacted,
      engaged,
      meetings,
      opportunities,
      handoffs,
      pendingApprovals,
      conversionRate,
      aiSpendCurrentMonth: this.org.ai_budget_spent_current_month,
      aiBudgetTotal: this.org.monthly_ai_budget,
      killSwitchActive: this.org.emergency_kill_switch_active,
    };
  }
}

// Global Singleton for Demo Store
declare global {
  var __demoStoreInstance: DemoStore | undefined;
}

export function getDemoStore(): DemoStore {
  if (!global.__demoStoreInstance) {
    global.__demoStoreInstance = new DemoStore();
  }
  return global.__demoStoreInstance;
}
