# Enterprise Security, Compliance & Data Privacy Architecture

ApexSDR is designed with enterprise-grade defense-in-depth principles for Indian B2B operations.

---

## 1. ComplianceGuard Engine
Every outbound communication (Email, WhatsApp, Voice, LinkedIn) must clear `ComplianceGuard.checkOutboundMessage()` before dispatch:
1. **Global Emergency Kill Switch**: When engaged, halts all autonomous queues with immediate zero-latency propagation.
2. **Global Suppression & Opt-Out Registry**: Enforces permanent blacklisting by email address, normalized phone number, or company domain.
3. **Prompt Injection & Adversarial Defense**: Regex and heuristic filtering blocking jailbreaks and extraction of hidden SDR instructions.
4. **Prohibited Claims Filter**: Blocks misleading commercial assertions (e.g. fabricated guarantees, artificial urgency, unverified government claims).
5. **Mandatory Opt-Out Notice**: Enforces unsubscribe instructions on every outbound cold email.

---

## 2. Multi-Tenancy & Data Isolation
- **Row-Level Security (RLS)**: Enforced across all Supabase PostgreSQL tables. Every query is filtered by `organization_id = (current_setting('app.current_org_id'))::uuid`.
- **RBAC**: Strict separation between `ADMIN`, `SALES_MANAGER`, `SDR`, `SALES_REP`, and `VIEWER`.
- **Secret Isolation**: Sensitive keys (`GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`) are strictly server-side environment variables and never exposed to the client bundle.
