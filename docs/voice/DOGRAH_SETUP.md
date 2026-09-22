# Dograh Setup — from DEMO_MODE to a live voice agent

This runbook takes the voice module from the built-in simulation (`VOICE_PROVIDER=demo`) to a real
Dograh workspace, and optionally to PSTN calling through Vobiz. Contracts (payload shapes, headers,
URLs) are specified in [DOGRAH_CONTRACTS.md](./DOGRAH_CONTRACTS.md); this document is the order of
operations. Infrastructure choices (Dograh cloud vs self-hosted) are in
[infra/dograh/README.md](../../infra/dograh/README.md).

Status as of 2026-09-22: every step below is implemented in the app and covered by tests
(`npm run test`); the only things that require a real account are steps 2, 4 and 8.

---

## 0. What the app expects to exist on the Dograh side

| Dograh object | Purpose | Where the app references it |
|---|---|---|
| Workflow **"SDR Talk Agent"** | The voice agent; instructions come from `lib/voice/prompts/sdr-talk-agent.md` | `initial_context` via Pre-Call Data Fetch |
| Pre-Call Data Fetch URL | Resolves `talk_ref` → verified lead context | `POST {APP_URL}/api/voice/tools/pre-call` |
| Five HTTP tools | product-knowledge, availability, book-meeting, handoff, opt-out | `POST {APP_URL}/api/voice/tools/*` |
| End-of-call webhook | Delivers `gathered_context` + recording | `POST {APP_URL}/api/voice/webhooks/dograh` |
| Widget embed (WebRTC) | The "Talk to our AI" page | `NEXT_PUBLIC_DOGRAH_WIDGET_SRC` on `/talk/[token]` |
| API trigger (PSTN, optional) | Outbound call for a lead | `DOGRAH_TRIGGER_UUID` used by `DograhVoiceProvider.initiateOutboundCall()` |
| Telephony configuration (PSTN, optional) | Vobiz SIP trunk inside Dograh | `DOGRAH_TELEPHONY_CONFIG_ID`, `DOGRAH_FROM_PHONE_ID` |

## 1. Environment variables

Copy from `.env.example`. Nothing here is committed.

```env
# Provider switch
VOICE_PROVIDER=dograh                 # demo (default) | dograh
DEMO_MODE=false

# Dograh workspace
DOGRAH_API_KEY=                       # Dograh → Settings → API keys
DOGRAH_BASE_URL=https://api.dograh.com  # or your self-hosted base URL, no trailing slash
DOGRAH_WEBHOOK_SECRET=                # random 32+ chars; the same value goes into the Dograh webhook config
DOGRAH_TOOL_SECRET=                   # random 32+ chars; sent by Dograh as X-Tool-Secret on every tool call
NEXT_PUBLIC_DOGRAH_WIDGET_SRC=        # widget script URL from Dograh → Add to website
NEXT_PUBLIC_VOICE_PROVIDER=dograh     # anything other than "demo" turns off the talk-page simulation
NEXT_PUBLIC_APP_URL=https://app.yourdomain.in   # used to build talk links (must be HTTPS in production)

# PSTN only (leave blank until the TRAI gate passes — see step 8)
DOGRAH_TRIGGER_UUID=
DOGRAH_TELEPHONY_CONFIG_ID=
DOGRAH_FROM_PHONE_ID=

# n8n follow-up (optional)
N8N_POST_CALL_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
```

Provider selection logic (`lib/voice/provider.ts`): `VOICE_PROVIDER=dograh` **and** a non-empty
`DOGRAH_API_KEY` selects `DograhVoiceProvider`; anything else falls back to the demo provider. So a
missing key can never send real traffic by accident.

Generate the two secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 2. Create the workflow in Dograh

1. Dograh → Workflows → **New** → name it `SDR Talk Agent`.
2. Paste the whole of `lib/voice/prompts/sdr-talk-agent.md` as the agent instructions. Note the
   `Script version:` line — the Voice Settings page shows which version the repository holds so the
   two can be compared.
3. Language: English (Indian), with auto-switch enabled if the workspace supports it. The script tells
   the agent to follow the prospect into Hindi/Hinglish/Bengali.
4. Save. Copy the workflow id — it appears in webhook payloads as `workflow_id`.

## 3. Pre-Call Data Fetch

Dograh → workflow → **Pre-call data fetch**:

- URL: `https://app.yourdomain.in/api/voice/tools/pre-call`
- Method: `POST`
- Headers: `X-Tool-Secret: <DOGRAH_TOOL_SECRET>`, `Content-Type: application/json`
- The request body Dograh sends contains `initial_context.talk_ref` (the nonce minted by the talk
  page). The response's `initial_context` (first_name, company, role, org_name, campaign_summary,
  language, allowed_topics, verified_research_facts) is what the script's `{{placeholders}}` refer to.

No phone number or email is returned here by design (data minimisation).

## 4. HTTP tools

Add five tools to the workflow, all `POST`, all with header `X-Tool-Secret: <DOGRAH_TOOL_SECRET>`:

| Tool name in Dograh | URL | Body |
|---|---|---|
| `product_knowledge` | `/api/voice/tools/product-knowledge` | `{ "query": "<prospect's words>" }` |
| `availability` | `/api/voice/tools/availability` | `{ "days_ahead": 5 }` |
| `book_meeting` | `/api/voice/tools/book-meeting` | `{ "selected_slot": "<ISO +05:30>", "topic": "…", "talk_ref": "{{initial_context.talk_ref}}" }` |
| `handoff` | `/api/voice/tools/handoff` | `{ "urgency": "LOW\|MEDIUM\|HIGH", "reason": "…", "talk_ref": "{{initial_context.talk_ref}}" }` |
| `opt_out` | `/api/voice/tools/opt-out` | `{ "reason": "…", "talk_ref": "{{initial_context.talk_ref}}" }` |

Describe each tool to the agent with the "When" column from §9 of the script. Always pass
`talk_ref` so the platform can resolve the lead.

## 5. End-of-call webhook

Dograh → workflow → **Webhooks** → add:

- URL: `https://app.yourdomain.in/api/voice/webhooks/dograh`
- Header: `X-Webhook-Secret: <DOGRAH_WEBHOOK_SECRET>` (the app also accepts a hex HMAC-SHA256 of
  the raw body computed with the same secret)
- Events: end of call

The receiver validates the payload against `DograhWebhookPayloadSchema`, updates the call row keyed
by `workflow_run_id` (idempotent), and applies opt-out / meeting / handoff. Ask the agent to fill
`gathered_context` exactly as §8 of the script specifies — that JSON is the contract.

## 6. The talk page (WebRTC)

1. Dograh → **Add to website** → copy the widget script URL into `NEXT_PUBLIC_DOGRAH_WIDGET_SRC`.
2. Set `NEXT_PUBLIC_VOICE_PROVIDER=dograh`. The page at `/talk/[token]` loads the widget and passes only
   `{ talk_ref, lang }` as client context (never lead data — it is visible in devtools).
3. Restart the app. Open a talk link from a TALK_INVITE step (Campaigns) or mint one:

```bash
curl -s -X POST https://app.yourdomain.in/api/voice/talk-invite \
  -H "X-Tool-Secret: $DOGRAH_TOOL_SECRET" -H "Content-Type: application/json" \
  -d '{"lead_id":"<lead id>","channel":"EMAIL"}'
```

The response's `talk_url` opens the page; **Start Voice Call** must be a user click (browser
autoplay rules). The statutory AI disclosure is shown before the call and spoken by the agent.

## 7. Verify end to end (no PSTN needed)

```bash
# 1. Tools answer with the secret and refuse without it
curl -s -X POST https://app.yourdomain.in/api/voice/tools/product-knowledge \
  -H "X-Tool-Secret: $DOGRAH_TOOL_SECRET" -H "Content-Type: application/json" \
  -d '{"query":"pricing"}'                                   # 200 + answer
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://app.yourdomain.in/api/voice/tools/product-knowledge \
  -d '{"query":"pricing"}'                                   # 401

# 2. Webhook accepts a signed payload and rejects a bad secret
curl -s -X POST https://app.yourdomain.in/api/voice/webhooks/dograh \
  -H "X-Webhook-Secret: $DOGRAH_WEBHOOK_SECRET" -H "Content-Type: application/json" \
  -d '{"workflow_run_id":"smoke-1","gathered_context":{"intent":"INTERESTED","summary":"smoke"},"cost_info":{"call_duration_seconds":30}}'
# → {"success":true,"provider":"dograh","duplicate":false,"call_id":"vc_dograh_smoke-1",...}
# send it again → "duplicate": true, and still one call row

# 3. A real WebRTC call: open a talk link, complete a call, then check
curl -s "https://app.yourdomain.in/api/voice/calls?status=COMPLETED&limit=1" -H "X-Tool-Secret: $DOGRAH_TOOL_SECRET"
```

The Voice Settings page (`/settings/voice`) shows `provider: dograh` once the key is present.

## 8. PSTN through Vobiz (optional, gated)

PSTN stays disabled until the **eight-point gate** on `/settings/voice` is green — the API refuses
to enable it otherwise (`PUT /api/voice/settings` → 422 with the failing items). The gate needs:

1. Kill switch off; 2. voice module on; 3. PSTN toggle; 4. calling window 09:00–21:00 IST;
5. DLT Principal Entity ID; 6. a 140/1600/1601-series caller ID; 7. the OAP advance autodialer
notice on file (date + document); 8. per-lead suppression/NDNC scrubbing (automatic).

Then, in Dograh:

1. **Telephony configurations** → add Vobiz (Auth ID, Auth Token, Application ID live in Dograh, not
   in this app). Configure the Vobiz application's answer URL as described in
   [DOGRAH_CONTRACTS.md §6](./DOGRAH_CONTRACTS.md#6-vobiz-telephony-configuration-inside-dograh).
2. Note the telephony configuration id and the from-number id → `DOGRAH_TELEPHONY_CONFIG_ID`,
   `DOGRAH_FROM_PHONE_ID`.
3. Workflow → **API trigger** → copy the trigger UUID → `DOGRAH_TRIGGER_UUID`.
4. Restart the app. `DograhVoiceProvider.initiateOutboundCall()` posts to
   `{DOGRAH_BASE_URL}/api/v1/public/agent/{DOGRAH_TRIGGER_UUID}` with `X-API-Key`, after running
   `checkPstnOutboundCompliance()` for the lead. Every PSTN call is recorded at initiation with
   `provider_run_id`, and the end-of-call webhook updates that same row.

Carrier minutes are billed by Vobiz; Dograh usage by Dograh. Neither is included in the app
(the Voice Settings page says so on its banner).

## 9. Rolling back to demo

Set `VOICE_PROVIDER=demo` (or remove `DOGRAH_API_KEY`) and `NEXT_PUBLIC_VOICE_PROVIDER=demo`,
restart. Talk links keep working in simulation; webhooks are still accepted (demo provider) so a
late Dograh delivery never 500s.

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Webhook returns 401 | Secret mismatch or header missing | Compare `DOGRAH_WEBHOOK_SECRET` with the Dograh webhook header; the header name is `X-Webhook-Secret` |
| Webhook returns 400 with `issues` | Payload shape drifted | Compare against `DograhWebhookPayloadSchema` (`lib/voice/schemas.ts`); `workflow_run_id` is required |
| Tools return 401 | `DOGRAH_TOOL_SECRET` differs from the tool header in Dograh | Regenerate and set both sides |
| Pre-call returns 404 | The nonce expired (5 min) or was consumed | The talk page mints a fresh nonce per call start |
| Talk page still simulates | `NEXT_PUBLIC_VOICE_PROVIDER=demo` or widget src contains "demo" | Set the public vars; they are baked at build time — rebuild |
| `provider: demo` on Voice Settings | `DOGRAH_API_KEY` empty | Set it; restart |
| PSTN call refused with "TRAI PSTN Compliance Block" | Gate item failing or lead suppressed / DND | Read the violation list; fix on `/settings/voice` or skip the lead |
| Two rows for one call | Webhook arrived before the initiation row existed with a different run id | Ensure the API trigger response's `workflow_run_id` is what the webhook sends; both are stored as strings |
