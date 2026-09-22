# ApexSDR India - Enterprise AI SDR & Sales Automation Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Groq](https://img.shields.io/badge/Groq-GPT--OSS--120B%20(free%20tier)-orange.svg)](https://groq.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade **Autonomous AI Sales Development Representative (SDR) Platform** tailored specifically for Indian B2B enterprises, manufacturing firms, SaaS companies, IT services, and logistics distributors.

---

## ⚡ Complete End-to-End SDR Lifecycle

```text
Lead Ingestion (+91 / GST Normalization)
   ↓
Automated Research (Public & MCA verified signals)
   ↓
ICP Scoring (Dynamic weighted matrix)
   ↓
Personalization Engine (Anti-hallucination, verified facts only)
   ↓
Multi-Channel Dispatch (Email, Meta WhatsApp Cloud API, LinkedIn, Voice)
   ↓
Inbound Reply Intent Classification & Qualification
   ↓
Human Sales Handoff (Buying intent thresholding)
   ↓
Calendar Meeting Booking (Verified Google Calendar slots)
   ↓
AI Sales Brief Generation & Kanban CRM Pipeline Update
```

---

## 🆓 Runs 100% free — the working stack (2026-09-22)

Every feature of the app works end-to-end on free tiers and self-hosted pieces; nothing is billed.

| Capability | How it works now | Cost |
| :--- | :--- | :--- |
| Source of truth | **Server-side store** (`lib/store/demo-store.ts`) persisted as JSON to `.data/apex-store.json` on every change; survives restarts. Pages never keep their own copy — they render `GET /api/state` and call mutation routes. | ₹0 |
| AI brain (13 agents) | Groq free tier, `openai/gpt-oss-120b` with automatic fallback to `gpt-oss-20b` / `qwen3.8-27b`, then to the built-in offline simulator. Every call is metered on the Activity page; a monthly budget breaker degrades to the simulator. | ₹0 |
| Outbound email | Resend free tier (3,000/mo). **Delivery modes** in Settings: `SIMULATED` · `LIVE_REDIRECT` (real send to *your* inbox with the original recipient noted — works on the free tier without a verified domain) · `LIVE`. Approving a draft really dispatches it; failures show the provider's reason with Retry. | ₹0 |
| WhatsApp | Self-hosted Evolution API (Baileys) in Docker — scan the QR on the WhatsApp Hub. Same delivery modes; anti-ban settings persist. | ₹0 |
| "Talk to our AI" voice | **Free in-browser agent**: Web Speech API (or Groq Whisper `whisper-large-v3-turbo` for push-to-talk, or typing) → GPT-OSS on the versioned call script → browser TTS (optional Groq Orpheus). Books meetings, hands off, honours opt-outs in EN/HI/BN, records transcript + extraction. | ₹0 carrier |
| Meetings | Free Jitsi Meet rooms (no account) + downloadable / emailed `.ics` invites + AI sales brief. | ₹0 |
| Persistence mirror | Supabase stays optional/best-effort (migrations not applied → the panel tells you). | ₹0 |

### Run it

```bash
npm install
npm run dev            # http://localhost:3000 — DEMO_MODE=false + GROQ_API_KEY in .env.local = live model
```

- **Settings → Delivery mode** decides whether approvals leave the machine. On Resend's free tier pick
  `LIVE_REDIRECT` and enter your own Resend account email — every approved message then really arrives in
  your inbox, labelled with the intended prospect.
- **Settings → Reset demo data** reseeds everything; `.data/` is git-ignored.
- Admin API used by the UI: `GET /api/state`, `POST /api/leads` (+`/import` CSV), `POST /api/leads/[id]/{process,reply,meeting,brief}`,
  `POST /api/messages/[id]/{approve,reject,send}`, `POST /api/outbox/flush`, `POST /api/campaigns` (+`/[id]/enroll`, `/[id]/run-step`),
  `POST /api/conversations/[id]/{reply,ai-reply,send}`, `POST/PATCH /api/tasks`, `POST /api/meetings` (+`/[id]/ics`, `/[id]/invite`),
  `GET/PUT /api/settings` (+`/kill-switch`, `/suppression`), `POST /api/voice/talk-links`, `POST /api/voice/dial`,
  `POST /api/talk/[token]/{agent,transcribe,speak,events}`, `GET /api/integrations`.

---

## 🚀 Key Architectural Pillars

1. **Zero-Cost Out-of-the-Box Operation (`DEMO_MODE=true`)**:
   Runs completely locally without requiring external paid API keys or live third-party services. Features high-fidelity Indian B2B seed data (50+ companies across Bangalore, Mumbai, NCR, Pune, Hyderabad, Chennai, 100+ leads, campaigns, conversations, and meetings). When API keys (`GROQ_API_KEY`, `RESEND_API_KEY`, `WHATSAPP_ACCESS_TOKEN`) are added, integrations switch seamlessly to production mode.

2. **Controlled 13-Agent SDR Operating System**:
   Deterministic state machine and compliance guardrails wrapped around Groq LLM reasoning (GPT-OSS-120B on the free tier, offline simulator fallback):
   - `Lead Intelligence Agent`
   - `Research Agent`
   - `ICP Qualification Agent`
   - `Lead Scoring Agent`
   - `Personalization Agent`
   - `Outreach Agent`
   - `Conversation Agent`
   - `Follow-up Agent`
   - `Meeting Agent`
   - `Sales Handoff Agent`
   - `CRM Agent`
   - `Analytics Agent`
   - `Compliance/Guardrail Agent`

3. **Indian B2B Native Engineering**:
   - `+91` E.164 phone normalizer with telecom circle and 10-digit mobile detection
   - Indian corporate entity classification (`Pvt Ltd`, `LLP`, `Ltd`, `MSME`, `Proprietorship`)
   - GSTIN structural verification and 36-state mapping code resolution
   - Multi-language communication support (English, Hinglish, Hindi, Bengali)

4. **Multi-Channel Adapters (`/lib/adapters/`)**:
   - **Email**: Resend API & SMTP adapter with opt-out enforcement
   - **WhatsApp**: Official Meta Cloud API adapter
   - **Calendar**: Google Calendar / Calendly availability checker
   - **Voice**: Local telephony demo simulator + Exotel/Twilio pipeline

5. **Security, Compliance & Cost Circuit Breakers**:
   - Global Emergency Kill Switch ("STOP ALL OUTREACH")
   - Suppression & Opt-out Registry (Email, Phone, Domain)
   - Prompt Injection & Prohibited Marketing Claims detector
   - Real-time token accounting and monthly AI budget cutoff

---

## 🛠️ Quick Local Setup

### 1. Prerequisites
- Node.js `v18+` or `v20+` or `v24+`
- npm `v9+` or `v10+`

### 2. Installation
```bash
git clone <repo-url>
cd ai-sdr
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Test Suite & Typecheck
```bash
npm run lint
npm run typecheck
npm run test          # vitest unit/integration suite (tests/*.test.ts) — 106 tests
npm run build
```

### 5. Browser verification (Playwright)
```bash
npx playwright install chromium   # once
npm run test:e2e                  # dev server on port 3100 in DEMO_MODE (APEX_PERSIST=false); voice + admin flows, mobile-375 + desktop
npm run test:e2e:mobile           # only the 375px project (the voice module's acceptance criterion)
npx playwright show-report
```
`tests/e2e/voice-module.e2e.ts` covers the public talk page (disclosure, consent, a full simulated call,
server-side completion), the Voice Settings gate, the TALK_INVITE campaign step and the dashboard voice cards.

---

## 🐳 Self-Hosted n8n Automation Engine

To launch the accompanying background orchestration layer:

```bash
cd docker
docker compose up -d
```
Access the n8n canvas at [http://localhost:5678](http://localhost:5678).

Import the workflow exports from `n8n/workflows/` (Workflows → Import from file). The voice module
ships four: `talk-invite-dispatch`, `talk-invite-reminder`, `post-call-followup`, `talk-link-expiry`
(regenerate with `python n8n/workflows/build_voice_workflows.py`). They only need environment
variables in n8n: `APP_URL`, `DOGRAH_TOOL_SECRET`, `SLACK_WEBHOOK_URL`, `RESEND_API_KEY`,
`RESEND_FROM`, `N8N_WEBHOOK_SECRET`.

---

## 🎙️ Voice Module ("Talk to our AI" + optional PSTN)

- Zero-carrier-cost WebRTC talk links minted per lead by `TALK_INVITE` campaign steps (`{{talk_link}}`),
  the public talk page at `/talk/[token]`, Dograh in-call tools, and the end-of-call webhook that
  closes the loop (`/api/voice/webhooks/dograh`).
- Optional TRAI/DPDP-gated PSTN calling through Dograh + Vobiz — enabled only when the eight-point
  gate on `/settings/voice` passes.
- Docs: [docs/voice/DOGRAH_SETUP.md](docs/voice/DOGRAH_SETUP.md) (runbook),
  [docs/voice/DOGRAH_CONTRACTS.md](docs/voice/DOGRAH_CONTRACTS.md) (payloads),
  [infra/dograh/README.md](infra/dograh/README.md) (hosting), call script at
  `lib/voice/prompts/sdr-talk-agent.md`.

---

## 📂 Project Repository Structure

```text
ai-sdr/
├── app/                        # Next.js 14 App Router UI
│   ├── activity/              # AI Activity Center & Observability
│   ├── campaigns/             # Campaigns & Multi-step Sequences
│   ├── inbox/                 # Multi-channel Conversation Inbox
│   ├── leads/                 # Lead Intelligence & Ingestion
│   │   └── [id]/              # Lead 360° Detail Dossier
│   ├── meetings/              # Verified Meetings & AI Sales Briefs
│   ├── pipeline/              # Kanban CRM Pipeline
│   ├── settings/              # Admin Control Center & ICP Matrix
│   │   └── voice/             # Voice Settings + eight-point PSTN gate
│   ├── talk/[token]/          # Public "Talk to our AI" page (WebRTC)
│   ├── api/voice/             # Dograh tools, webhook, talk-invite, sessions, calls, settings
│   ├── tasks/                 # Human Sales Handoff Tasks
│   ├── globals.css            # Enterprise Theme & Tailwind Styles
│   ├── layout.tsx             # Root Application Shell
│   └── page.tsx               # Executive Sales Dashboard
│
├── components/                 # Reusable UI Primitives
│   ├── command-palette.tsx    # Universal Command Bar (Cmd/Ctrl + K)
│   └── layout/                # Sidebar, Header, Breadcrumbs
│
├── lib/                        # Core Business Logic & AI Engines
│   ├── adapters/              # Email, WhatsApp, Calendar, Voice adapters
│   ├── ai/                    # Groq, Demo LLM, Prompts, Zod Schemas
│   ├── compliance/            # ComplianceGuard, Suppression, Kill Switch
│   ├── normalization/         # +91 Phone, GSTIN, Entity Type parsing
│   ├── orchestrator/          # 13-Agent SDR Orchestrator State Machine + talk-invite dispatch
│   ├── outreach/              # Campaign template rendering ({{first_name}}, {{talk_link}} …)
│   ├── voice/                 # Providers (demo/Dograh), free browser agent (agent.ts), tokens, nonces, compliance gate, prompts
│   ├── store/                 # Server store + JSON persistence (.data/apex-store.json)
│   ├── outreach/dispatch.ts   # Approve → real delivery (Resend / Evolution / simulator) with receipts
│   ├── leads/                 # Lead validation, CSV import
│   ├── client/                # useAppState() snapshot hook + fetch helpers for the admin UI
│   └── types.ts               # Core TypeScript definitions
│
├── supabase/                   # Supabase PostgreSQL Engine
│   ├── migrations/            # SQL Schemas, Indexes, RLS Policies
│   └── seed.sql               # Indian B2B Seed Ecosystem (50+ comps, 100+ leads)
│
├── docker/                     # Dockerized n8n Orchestrator
├── n8n/workflows/              # Importable n8n exports (lead ingestion + 4 voice workflows)
├── infra/dograh/               # Running Dograh (cloud vs self-hosted) for the voice module
├── docs/voice/                 # Dograh setup runbook and integration contracts
├── tests/                      # Automated Vitest Suite
└── package.json
```

---

## 🔒 Security & Privacy Architecture
- Strict Row-Level Security (RLS) isolating all records per `organization_id`.
- Zero credentials exposed to frontend client code.
- Outbound verification blocking prompt injection, hallucinated guarantees, or missing opt-out links.
