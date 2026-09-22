# Voice Module — Status (2026-09-22, end of session)

Picks up from the "Voice Module — End-to-End Handoff & Next Steps" note of 2026-09-22.
All eight items of its recommended order of work are done; each landed as its own commit with
`npm run lint && npm run typecheck && npm run test && npm run build` green.

## Delivered this session

| Phase | What | Where | Tests |
|---|---|---|---|
| Webhook route (gap #1) | `POST /api/voice/webhooks/dograh` — raw-body secret/HMAC check, Zod validation, `provider.processWebhook()`; both providers now update the row keyed by `provider_run_id` (idempotent, duplicate deliveries flagged, side effects not re-run) | `app/api/voice/webhooks/dograh/route.ts`, `lib/voice/{dograh,demo,provider}.ts` | `tests/voice-webhook.test.ts` (7) |
| V8 script | Versioned Dograh agent instructions + loader/renderer | `lib/voice/prompts/sdr-talk-agent.md`, `lib/voice/prompts/index.ts` | `tests/voice-script.test.ts` (4) |
| V6 outreach | `TALK_INVITE` step type, `{{talk_link}}`/`{{talk_link_expires}}` variables, seeded steps per campaign, `dispatchTalkInvite()`, `SDROrchestrator.executeCampaignStep()`, `POST /api/voice/talk-invite`, `POST /api/campaigns/steps/execute`, campaigns page renders real steps | `lib/orchestrator/talk-invite.ts`, `lib/outreach/templates.ts`, `lib/store/campaign-steps.ts` | `tests/voice-talk-invite.test.ts` (8) |
| V9 settings UI | `/settings/voice` with the eight-point gate, "Provider cost not included" banner, `GET/PUT /api/voice/settings` (PSTN cannot be enabled while the gate fails) | `app/settings/voice/page.tsx`, `lib/voice/compliance.ts#evaluatePstnGate` | `tests/voice-settings.test.ts` (6) |
| V7 n8n | Four workflow exports + generator; app endpoints `GET /api/voice/talk-sessions`, `POST /api/voice/talk-sessions/expire`, `GET /api/voice/calls`; reminder support (`reminder_for_session_id`); outbound post-call hand-off (`N8N_POST_CALL_WEBHOOK_URL`) | `n8n/workflows/*.json`, `lib/voice/{sessions,notify}.ts` | `tests/voice-workflows.test.ts` (8) |
| V8 docs | Setup runbook, hosting README, README pointers | `docs/voice/DOGRAH_SETUP.md`, `infra/dograh/README.md` | — |
| V10 analytics | Dashboard voice row + `GET /api/voice/analytics` | `lib/voice/analytics.ts`, `app/page.tsx` | `tests/voice-analytics.test.ts` (4) |
| V11 browser | Playwright, mobile-375 + desktop projects, 10 scenarios | `playwright.config.ts`, `tests/e2e/voice-module.e2e.ts` | `npm run test:e2e` (10/10) |

Vitest: 44 → 81 tests. Playwright: 10 e2e tests (new).

## Defects found and fixed along the way

1. **Talk page rendered inside the admin shell** — at 375px the sidebar consumed the screen and the
   call card was pushed off-screen. `app/layout.tsx` now renders `/talk/*` standalone. (Found by V11.)
2. **`DograhDriver.endCall()` ended a call that never started** — React Strict Mode's effect cleanup
   put the page straight into "Call Concluded" and posted a bogus `call_completed` event. It is now
   a no-op unless a call is active. (Found by V11.)
3. **Kill switch did not reach the ComplianceGuard** — the UI toggled only the org flag; every
   outbound gate reads the guard's static flag. `toggleKillSwitch()` now sets both. (Found by V9 tests.)
4. **`addTalkSession` dropped `sent_at`/`opened_at`/`campaign_step_id`** — needed by reminders/expiry.

## Still open (needs a person)

- Push: the branch is now 13 commits ahead of `origin/main` — still not pushed (the handoff's open question).
- A real Dograh workspace: everything runs in `VOICE_PROVIDER=demo`; the runbook lists exactly what to configure.
- Vobiz SIP trunk commercial owner — a prerequisite for the PSTN gate's caller-ID and OAP items.
- Persistence: the app still runs on the in-memory demo store; Supabase writes are best-effort (`upsert` inside try/catch).
- The admin shell is not responsive below ~1024px (unchanged; outside the voice spec, but worth a ticket).

## How to verify quickly

```bash
npm run lint && npm run typecheck && npm run test && npm run build   # 81 vitest tests
npm run test:e2e                                                      # 10 Playwright tests, 375px + desktop
```
