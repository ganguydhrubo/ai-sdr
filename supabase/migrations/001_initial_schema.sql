-- ==============================================================================
-- ENTERPRISE AI SDR & SALES AUTOMATION PLATFORM - DATABASE SCHEMA
-- PostgreSQL / Supabase with Row Level Security (RLS) & Multi-Tenancy
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ORGANIZATIONS (Multi-Tenancy Root)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    gstin VARCHAR(15),
    cin VARCHAR(21),
    industry VARCHAR(100),
    headquarters_city VARCHAR(100) DEFAULT 'Bengaluru',
    headquarters_state VARCHAR(100) DEFAULT 'Karnataka',
    country VARCHAR(10) DEFAULT 'IN',
    plan_tier VARCHAR(50) DEFAULT 'ENTERPRISE',
    monthly_ai_budget NUMERIC(10, 2) DEFAULT 500.00,
    daily_ai_budget NUMERIC(10, 2) DEFAULT 50.00,
    ai_budget_spent_current_month NUMERIC(10, 2) DEFAULT 0.00,
    is_autonomous_outreach_enabled BOOLEAN DEFAULT FALSE,
    emergency_kill_switch_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. USERS & ROLES
CREATE TYPE user_role AS ENUM ('ADMIN', 'SALES_MANAGER', 'SDR', 'SALES_REP', 'VIEWER');

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role DEFAULT 'SDR',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    daily_send_limit INT DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(organization_id, email)
);

-- 3. COMPANIES (Target Indian Accounts)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    entity_type VARCHAR(50) DEFAULT 'PVT_LTD', -- PVT_LTD, LLP, LTD, MSME, PROPRIETORSHIP
    domain VARCHAR(255),
    website TEXT,
    industry VARCHAR(100),
    sub_industry VARCHAR(100),
    employee_count_min INT,
    employee_count_max INT,
    annual_revenue_cr NUMERIC(10, 2), -- In Indian Crores (INR Cr)
    gstin VARCHAR(15),
    pan VARCHAR(10),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(10) DEFAULT 'IN',
    linkedin_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 4. COMPANY RESEARCH & VERIFIED PUBLIC SIGNALS
CREATE TABLE IF NOT EXISTS company_research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fact_key VARCHAR(100) NOT NULL,
    fact_value TEXT NOT NULL,
    category VARCHAR(50), -- TECH_STACK, EXPANSION, HIRING, LEADERSHIP, FINANCIAL
    source VARCHAR(100) NOT NULL, -- MCA_PORTAL, PUBLIC_WEBSITE, PRESS_RELEASE, GST_REGISTRY
    source_url TEXT,
    confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    is_verified BOOLEAN DEFAULT TRUE,
    retrieved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. LEADS (Central Pipeline Entity)
CREATE TYPE lead_status AS ENUM (
    'NEW',
    'RESEARCHING',
    'QUALIFIED',
    'OUTREACH',
    'CONTACTED',
    'ENGAGED',
    'QUALIFIED_OPPORTUNITY',
    'MEETING',
    'SALES_HANDOFF',
    'WON',
    'LOST',
    'NURTURE',
    'DISQUALIFIED'
);

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    full_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(150),
    email VARCHAR(255) NOT NULL,
    normalized_email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    normalized_phone VARCHAR(30) NOT NULL, -- Normalized to E.164 +91XXXXXXXXXX
    linkedin_url TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    status lead_status DEFAULT 'NEW',
    lead_source VARCHAR(100) DEFAULT 'CSV_IMPORT',
    campaign_name VARCHAR(150),
    preferred_language VARCHAR(20) DEFAULT 'en', -- en, hi, bn, hinglish
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_suppressed BOOLEAN DEFAULT FALSE,
    is_dnc_registered BOOLEAN DEFAULT FALSE,
    requires_human_attention BOOLEAN DEFAULT FALSE,
    attention_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. ICP CONFIGURATION & LEAD SCORES
CREATE TYPE fit_classification AS ENUM ('HOT', 'HIGH_FIT', 'MEDIUM_FIT', 'LOW_FIT', 'DISQUALIFIED');

CREATE TABLE IF NOT EXISTS icp_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_industries JSONB DEFAULT '["IT Services", "SaaS", "Manufacturing", "Logistics"]',
    target_employee_ranges JSONB DEFAULT '["50-200", "201-1000", "1001-5000"]',
    target_roles JSONB DEFAULT '["CEO", "Founder", "VP Sales", "Sales Head", "Chief Revenue Officer", "COO"]',
    target_geographies JSONB DEFAULT '["Bengaluru", "Mumbai", "Delhi NCR", "Pune", "Hyderabad", "Chennai"]',
    weight_industry INT DEFAULT 20,
    weight_company_size INT DEFAULT 15,
    weight_role_seniority INT DEFAULT 20,
    weight_geography INT DEFAULT 10,
    weight_tech_fit INT DEFAULT 10,
    weight_business_signals INT DEFAULT 15,
    weight_contact_quality INT DEFAULT 10,
    minimum_qualifying_score INT DEFAULT 70,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    score INT NOT NULL CHECK (score >= 0 AND score <= 100),
    classification fit_classification NOT NULL,
    reasoning JSONB NOT NULL DEFAULT '[]', -- Array of concise business rationale strings
    confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.85,
    industry_score INT DEFAULT 0,
    size_score INT DEFAULT 0,
    role_score INT DEFAULT 0,
    geo_score INT DEFAULT 0,
    signals_score INT DEFAULT 0,
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CAMPAIGNS & SEQUENCES
CREATE TYPE approval_mode AS ENUM ('MANUAL', 'SEMI_AUTOMATIC', 'AUTONOMOUS');
CREATE TYPE campaign_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status campaign_status DEFAULT 'DRAFT',
    approval_mode approval_mode DEFAULT 'MANUAL',
    target_persona VARCHAR(150),
    target_industry VARCHAR(100),
    daily_lead_limit INT DEFAULT 50,
    business_hours_start TIME DEFAULT '09:30:00',
    business_hours_end TIME DEFAULT '18:30:00',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    working_days JSONB DEFAULT '["MON", "TUE", "WED", "THU", "FRI"]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    channel VARCHAR(30) NOT NULL, -- EMAIL, WHATSAPP, LINKEDIN, VOICE
    delay_days INT NOT NULL DEFAULT 0,
    subject_template TEXT,
    body_template TEXT NOT NULL,
    whatsapp_template_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    current_step_number INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ENROLLED', -- ENROLLED, IN_PROGRESS, REPLIED, BOUNCED, COMPLETED, STOPPED
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    last_action_at TIMESTAMPTZ,
    next_action_due TIMESTAMPTZ,
    UNIQUE(campaign_id, lead_id)
);

-- 8. MESSAGES & OUTREACH QUEUE
CREATE TYPE message_status AS ENUM (
    'DRAFTED',
    'PENDING_APPROVAL',
    'QUEUED',
    'SENT',
    'DELIVERED',
    'OPENED',
    'CLICKED',
    'REPLIED',
    'BOUNCED',
    'FAILED',
    'CANCELLED',
    'SUPPRESSED'
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    campaign_step_id UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,
    channel VARCHAR(30) NOT NULL, -- EMAIL, WHATSAPP, VOICE, LINKEDIN
    direction VARCHAR(10) DEFAULT 'OUTBOUND', -- OUTBOUND, INBOUND
    subject TEXT,
    body TEXT NOT NULL,
    status message_status DEFAULT 'DRAFTED',
    requires_approval BOOLEAN DEFAULT TRUE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    external_provider_id VARCHAR(255),
    error_message TEXT,
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CONVERSATIONS & INBOUND INTENT
CREATE TYPE conversation_intent AS ENUM (
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
    'NEGATIVE_UNKNOWN'
);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    channel VARCHAR(30) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, WAITING_PROSPECT, WAITING_SALES_REP, CLOSED
    latest_intent conversation_intent,
    sentiment VARCHAR(20) DEFAULT 'NEUTRAL', -- POSITIVE, NEUTRAL, NEGATIVE
    buying_stage VARCHAR(30) DEFAULT 'UNAWARE', -- UNAWARE, PROBLEM_AWARE, SOLUTION_AWARE, EVALUATING, DECISION
    needs_human_attention BOOLEAN DEFAULT FALSE,
    qualification_notes JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- PROSPECT, AI_SDR, HUMAN_REP
    sender_name VARCHAR(100),
    content TEXT NOT NULL,
    raw_payload JSONB,
    intent_detected conversation_intent,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. MEETINGS & AI SALES BRIEFS
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    host_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    meet_url TEXT,
    calendar_event_id VARCHAR(255),
    calendar_provider VARCHAR(50) DEFAULT 'GOOGLE_CALENDAR',
    status VARCHAR(50) DEFAULT 'CONFIRMED', -- CONFIRMED, COMPLETED, CANCELLED, RESCHEDULED
    sales_brief JSONB, -- AI Sales Brief: Account overview, Pain points, Buying signals, Objections, Discovery questions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TASKS & SALES HANDOFFS
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
    due_date TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    created_by_ai BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. SUPPRESSION LIST & COMPLIANCE GUARD
CREATE TABLE IF NOT EXISTS suppression_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255),
    phone VARCHAR(30),
    domain VARCHAR(255),
    reason VARCHAR(50) NOT NULL, -- UNSUBSCRIBED, DO_NOT_CONTACT, BOUNCE, COMPLAINT, MANUAL_BLOCK
    source VARCHAR(100) DEFAULT 'USER_REQUEST',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email),
    UNIQUE(organization_id, phone)
);

-- 13. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_type VARCHAR(30) DEFAULT 'USER', -- USER, AI_AGENT, SYSTEM_WORKER
    action VARCHAR(100) NOT NULL, -- LEAD_INGESTED, LEAD_SCORED, OUTREACH_APPROVED, MESSAGE_SENT, KILL_SWITCH_ENGAGED
    entity_type VARCHAR(50) NOT NULL, -- lead, message, campaign, company, meeting, setting
    entity_id UUID,
    previous_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. AI RUNS & TOKEN OBSERVABILITY
CREATE TABLE IF NOT EXISTS ai_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    agent_name VARCHAR(50) NOT NULL, -- LeadIntelligence, ResearchAgent, ScoringAgent, PersonalizationAgent, ConversationAgent
    provider VARCHAR(50) NOT NULL, -- GROQ, OPENAI, ANTHROPIC, DEMO
    model VARCHAR(100) NOT NULL,
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    estimated_cost_usd NUMERIC(8, 6) DEFAULT 0.000000,
    latency_ms INT DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_normalized_email ON leads(organization_id, normalized_email);
CREATE INDEX IF NOT EXISTS idx_leads_normalized_phone ON leads(organization_id, normalized_phone);
CREATE INDEX IF NOT EXISTS idx_companies_org_name ON companies(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_messages_status_scheduled ON messages(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_suppression_lookup ON suppression_list(organization_id, normalized_email, normalized_phone);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_date ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_org_date ON ai_runs(organization_id, created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;

-- Helper policy: isolate data by organization_id matching auth JWT tenant metadata
CREATE POLICY org_isolation_leads ON leads
    FOR ALL
    USING (organization_id = (current_setting('app.current_org_id', true))::uuid);

CREATE POLICY org_isolation_companies ON companies
    FOR ALL
    USING (organization_id = (current_setting('app.current_org_id', true))::uuid);

CREATE POLICY org_isolation_campaigns ON campaigns
    FOR ALL
    USING (organization_id = (current_setting('app.current_org_id', true))::uuid);

CREATE POLICY org_isolation_messages ON messages
    FOR ALL
    USING (organization_id = (current_setting('app.current_org_id', true))::uuid);

CREATE POLICY org_isolation_meetings ON meetings
    FOR ALL
    USING (organization_id = (current_setting('app.current_org_id', true))::uuid);
