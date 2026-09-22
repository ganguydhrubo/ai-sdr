# Platform Status (2026-09-22, evening) — "all features working, free stack"

Supersedes the voice-only status note of the same morning. Trigger: after the voice handoff the app was
still "not working" end to end. Root cause and what changed are below; every item landed with
`npm run lint && npm run typecheck && npm run test && npm run build` green.

## Root cause of "still not working"

Every admin page was a `'use client'` component that instantiated **its own copy** of the in-memory
store in the browser, while the API routes used a **separate** server copy. Minting a talk link,
toggling the kill switch, adding suppressions, approving drafts — each wrote to one copy and read from
another, and a page reload discarded everything. Approve & Send never dispatched anything; the AI runs
were never recorded; the dashboard funnel, budget and "Just now" labels were hard-coded.

## What changed

| Area | Now | Where |
|---|---|---|
| Source of truth | Server store persisted to `.data/apex-store.json` (debounced atomic writes, cap on audit/AI-run history, `Reset demo data`) | `lib/store/persistence.ts`, `lib/store/demo-store.ts` |
| UI data flow | One snapshot `GET /api/state`; every action is an API route; shared `useAppState()` hook with slow polling | `app/api/state`, `lib/client/*`, all `app/**/page.tsx` |
| Delivery | Approve → `approveAndDispatch()` → Resend / Evolution API / simulator with a `DeliveryReceipt` on the message; delivery modes SIMULATED · LIVE_REDIRECT · LIVE; queue flush; honest FAILED + Retry | `lib/outreach/dispatch.ts`, Settings page |
| AI | Tracked provider records every call (tokens, list-price cost, latency, model) + budget circuit breaker; Groq free-tier model chain; ICP weights from Settings feed the scoring prompt; industry inferred from company name for bare leads | `lib/ai/tracked.ts`, `lib/ai/groq.ts`, `lib/orchestrator/sdr-orchestrator.ts` |
| Conversations | Inbound reply → classification → handoff task → AI reply **drafted** (sent automatically only when "Autonomous replies" is on); human replies delivered over the channel | `/api/leads/[id]/reply`, `/api/conversations/[id]/*` |
| Leads | Validated creation, +91/email normalisation, duplicate detection, CSV import (file/paste/sample), suppress/unsuppress, status changes, notes | `lib/leads/*`, `/api/leads*` |
| Campaigns | Create with a default 4-touch sequence, enrol leads (step 1 runs immediately), run any step for a lead, pause/resume, toggle steps | `lib/orchestrator/campaigns.ts`, `/api/campaigns*` |
| Meetings | Free Jitsi rooms, `.ics` download/email invite, reschedule/complete/cancel, AI brief | `lib/meetings/service.ts`, `lib/adapters/calendar.ts` |
| Voice | **Free in-browser agent** on `/talk/[token]`: Web Speech API → push-to-talk (Groq Whisper) → typing fallbacks; GPT-OSS on the versioned script; browser TTS (optional Groq Orpheus); books meetings / hands off / opt-outs (EN/HI/BN) live; call recorded with transcript + extraction | `app/talk/[token]/local-voice-driver.ts`, `lib/voice/agent.ts`, `/api/talk/[token]/{agent,transcribe,speak,events}` |
| Voice Hub | Mint links (manual / email / WhatsApp), copy/QR/revoke, real analytics, gated PSTN dialer with the 8-point reasons | `app/voice/page.tsx`, `/api/voice/{talk-links,dial}` |
| Settings | Delivery mode + test recipients, autonomous replies, AI budget, ICP matrix + minimum score, suppression add/remove, live integration health, reset | `app/settings/page.tsx`, `/api/settings*`, `lib/integrations/status.ts` |

## Verified in the browser (dev server, DEMO_MODE=false, live Groq)

1. Approve in LIVE mode → real Resend call → HTTP 403 (free tier, unverified domain) surfaced with Retry.
2. Settings → SIMULATED → Retry → sent (simulated), lead CONTACTED, audit trail complete.
3. Add lead → live scoring (80/100 after the industry-inference fix) → GPT-OSS drafted email → approved.
4. Reply lab → INTERESTED, handoff task, AI draft → sent. Book meeting → Jitsi room + brief + invite.
5. Mint talk link → talk page → call (mic blocked in the pane → text mode) → agent booked the meeting and
   closed the call → `vc_local_*` recorded with transcript, extraction and linked meeting; analytics updated.
6. Every other page (campaigns, inbox, pipeline, tasks, meetings, activity, WhatsApp Hub with a live
   Baileys QR) loads from the server without runtime errors.

Tests: 106 vitest (20 files), Playwright voice + admin-flow suites.

## Still open (needs a person)

- Resend: verify a domain, or use LIVE_REDIRECT with the account's own email (the only free-tier recipient).
- WhatsApp: scan the QR once (Evolution API instance `apex_sales_01` is `close`); then LIVE / LIVE_REDIRECT sends are real.
- Supabase: migrations 001/002 are not applied (tables 404); the JSON store is the source of truth regardless.
- Real Dograh workspace + Vobiz SIP trunk owner — unchanged from the morning note (PSTN gate items).
- Admin shell below ~768px hides the sidebar (mobile nav not built); the public talk page is mobile-first.
