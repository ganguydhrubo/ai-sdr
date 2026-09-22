-- ==============================================================================
-- APEXSDR INDIA - PHASE 8: VOICE MODULE DATABASE SCHEMA
-- Zero-Cost "Talk to our AI" Links (WebRTC) + Gated Dograh/Vobiz PSTN Telephony
-- ==============================================================================

-- 1. EXTEND LEADS TABLE WITH VOICE & WHATSAPP COMPLIANCE FIELDS
ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS call_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS call_consent_source VARCHAR(100),
    ADD COLUMN IF NOT EXISTS dnd_checked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) DEFAULT 'en';

-- 2. TALK SESSIONS (Tokenized personalized links for inbound WebRTC voice calls)
CREATE TABLE IF NOT EXISTS talk_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    campaign_step_id UUID,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'whatsapp', 'manual')),
    token_hash TEXT UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'SENT', 'OPENED', 'CALL_STARTED', 'COMPLETED', 'EXPIRED', 'REVOKED')),
    expires_at TIMESTAMPTZ NOT NULL,
    max_calls INT DEFAULT 3,
    call_count INT DEFAULT 0,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    last_opened_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    language VARCHAR(20) DEFAULT 'en',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. TALK CALL NONCES (Single-use short-lived nonces for WebRTC context injection)
CREATE TABLE IF NOT EXISTS talk_call_nonces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    talk_session_id UUID NOT NULL REFERENCES talk_sessions(id) ON DELETE CASCADE,
    nonce_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VOICE CALLS (Unified session records for both WebRTC and PSTN outbound calls)
CREATE TABLE IF NOT EXISTS voice_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    talk_session_id UUID REFERENCES talk_sessions(id) ON DELETE SET NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('webrtc', 'pstn')),
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('demo', 'dograh')),
    provider_run_id VARCHAR(100) UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'CONNECTED', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'BLOCKED')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INT DEFAULT 0,
    transcript JSONB DEFAULT '[]'::jsonb,
    extracted JSONB DEFAULT '{}'::jsonb,
    intent VARCHAR(50),
    sentiment VARCHAR(20),
    disclosure_given BOOLEAN DEFAULT TRUE,
    consent_transcript BOOLEAN DEFAULT TRUE,
    recording_url TEXT,
    carrier_cost_estimate_inr NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. VOICE WEBHOOK EVENTS (Idempotent tracking for post-call webhooks)
CREATE TABLE IF NOT EXISTS voice_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL DEFAULT 'dograh',
    dedupe_key TEXT UNIQUE NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    error TEXT
);

-- 6. VOICE SETTINGS (Per-organization voice compliance and gate configuration)
CREATE TABLE IF NOT EXISTS voice_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    voice_enabled BOOLEAN DEFAULT TRUE,
    web_voice_enabled BOOLEAN DEFAULT TRUE,
    pstn_enabled BOOLEAN DEFAULT FALSE,
    dlt_entity_id VARCHAR(50),
    caller_id_series VARCHAR(10) CHECK (caller_id_series IN ('140', '1600', '1601')),
    oap_autodialer_notice_date DATE,
    oap_notice_doc_url TEXT,
    calling_window_start VARCHAR(10) DEFAULT '09:00',
    calling_window_end VARCHAR(10) DEFAULT '21:00',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    pstn_daily_cap INT DEFAULT 50,
    talk_link_ttl_days INT DEFAULT 7,
    talk_link_max_calls INT DEFAULT 3,
    recording_enabled BOOLEAN DEFAULT TRUE,
    human_booking_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_talk_sessions_org_status ON talk_sessions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_talk_sessions_lead_id ON talk_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_talk_sessions_token_hash ON talk_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_talk_call_nonces_hash ON talk_call_nonces(nonce_hash);
CREATE INDEX IF NOT EXISTS idx_voice_calls_org_status ON voice_calls(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_voice_calls_lead_id ON voice_calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_provider_run ON voice_calls(provider_run_id);
CREATE INDEX IF NOT EXISTS idx_voice_webhook_dedupe ON voice_webhook_events(dedupe_key);

-- 8. ROW LEVEL SECURITY (Tenant Isolation)
ALTER TABLE talk_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE talk_call_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_talk_sessions ON talk_sessions
    FOR ALL
    USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

CREATE POLICY tenant_isolation_talk_call_nonces ON talk_call_nonces
    FOR ALL
    USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

CREATE POLICY tenant_isolation_voice_calls ON voice_calls
    FOR ALL
    USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

CREATE POLICY tenant_isolation_voice_settings ON voice_settings
    FOR ALL
    USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

CREATE POLICY service_role_webhook_events ON voice_webhook_events
    FOR ALL
    USING (true);
