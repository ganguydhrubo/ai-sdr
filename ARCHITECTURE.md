# ApexSDR System Architecture & Engineering Blueprint

This document details the architectural design of **ApexSDR India**, an enterprise-grade AI Sales Development Representative Operating System built for Indian B2B market dynamics.

---

## 1. High-Level System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS 14 APP ROUTER UI                        │
│   Dashboard  |  Leads 360°  |  Pipeline CRM  |  Inbox  |  Settings     │
│             Command Palette (Cmd+K)  |  Emergency Kill Switch          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    CENTRAL 13-AGENT SDR ORCHESTRATOR                   │
│        Deterministic State Machine & Human Approval Queue              │
│                                                                        │
│  [1. Lead Intel] ──> [2. Research] ──> [3. ICP Score] ──> [4. Pers]   │
│         ▲                                                    │         │
│         │                                                    ▼         │
│  [9. CRM Agent] <── [8. Handoff] <── [7. Meeting] <── [5. Outreach]   │
│         ▲                                                    │         │
│         │              [6. Conversation Agent] <─────────────┘         │
│         │                         │                                    │
│         └────────── [10. ComplianceGuard Gatekeeper] ──────────────────┘
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                       PLUGGABLE ADAPTER LAYER                          │
│   LLMProvider       EmailAdapter      WhatsAppAdapter    Calendar      │
│   ├── Groq Llama3   ├── Resend        ├── Meta Cloud API ├── GCalendar │
│   └── DemoProvider  └── DemoEmail     └── DemoWhatsApp   └── DemoMeet  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                       DATA & STORAGE LAYER                             │
│   Supabase PostgreSQL  |  Row-Level Security (RLS)  |  Audit Log       │
│   Persistent In-Memory Demo Store (Zero-Cost Immediate Preview)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Controlled 13-Agent SDR Operating System

Unlike monolithic or unregulated LLM wrappers, ApexSDR strictly isolates reasoning from state mutations:

1. **Lead Intelligence Agent**: Validates records, normalizes `+91` numbers, checks GSTIN formatting, and detects duplicate leads across email, phone, domain, and company contact.
2. **Research Agent**: Collects public business metadata, company filings signals, expansion news, and job opening alerts with provenance `{ source, source_url, retrieved_at, confidence }`.
3. **ICP Qualification Agent**: Applies dynamic, admin-weighted scoring across Industry, Company Size, Role Seniority, Geography (Tier 1/2 hubs), and Tech signals.
4. **Lead Scoring Agent**: Generates structured fit evaluations (`HOT`, `HIGH_FIT`, `MEDIUM_FIT`, `LOW_FIT`, `DISQUALIFIED`) with concise business rationale.
5. **Personalization Agent**: Synthesizes grounded, factual outreach across Email, WhatsApp, and LinkedIn without inventing claims.
6. **Outreach Agent**: Executes sequences respecting Indian business hours (09:30–18:30 IST) and working days.
7. **Conversation Agent**: Evaluates inbound prospect responses, classifying intent (`INTERESTED`, `REQUEST_PRICING`, `REQUEST_DEMO`, `NOT_NOW`, `UNSUBSCRIBE`, etc.), sentiment, and buying stages.
8. **Follow-Up Agent**: Orchestrates cadence delays, value hooks, and polite breakup messages.
9. **Meeting Agent**: Checks verified calendar slots before proposing availability, generating confirmed meeting records.
10. **Sales Handoff Agent**: Halts autonomous messaging and routes engaged leads to assigned Account Executives.
11. **CRM Agent**: Syncs lifecycle transitions to the Kanban board and internal CRM tables.
12. **Analytics Agent**: Computes funnel velocity, reply conversion rates, and channel ROI.
13. **Compliance/Guardrail Agent (`ComplianceGuard`)**: Enforces suppression lists, rate limits, anti-injection checks, and emergency kill switches.

---

## 3. Indian B2B Specialization

- **Phone Normalization**: Standardizes 10-digit mobile numbers to E.164 `+91XXXXXXXXXX`, removing leading `0` or `91` prefixes and validating mobile prefixes (6, 7, 8, 9).
- **GSTIN Validation**: Validates 15-character GSTIN structure, verifying state codes against 36 Indian states and union territories, and extracting embedded PAN numbers.
- **Entity Type Parsing**: Classifies corporate structures (`Pvt Ltd`, `LLP`, `Ltd`, `MSME`, `Proprietorship`).
- **Multilingual Support**: Supports English, Hinglish, Hindi, and Bengali tailored to regional business preferences.
