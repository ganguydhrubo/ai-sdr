# infra/dograh — running Dograh for ApexSDR

Dograh is the voice-agent engine behind the "Talk to our AI" module (WebRTC) and the optional
PSTN route (via Vobiz). This folder documents the two ways to run it and what the ApexSDR app
needs from it. Application-side configuration is in [docs/voice/DOGRAH_SETUP.md](../../docs/voice/DOGRAH_SETUP.md);
payload contracts in [docs/voice/DOGRAH_CONTRACTS.md](../../docs/voice/DOGRAH_CONTRACTS.md).

## Option A — Dograh cloud (recommended to start)

- Sign up, create a workspace, generate an API key.
- `DOGRAH_BASE_URL=https://api.dograh.com`
- Nothing to host. Usage is billed by Dograh; carrier minutes (PSTN) by Vobiz. Neither is included
  in the ApexSDR subscription.

## Option B — self-hosted Dograh

Dograh publishes self-hosting instructions in its documentation index (see
[docs.dograh.com](https://docs.dograh.com)). Follow the official instructions for the current
release rather than a copied compose file — image names and required services change between
versions. What ApexSDR needs from a self-hosted instance:

| Requirement | Why |
|---|---|
| HTTPS base URL reachable from the app server | `DograhVoiceProvider` calls `{DOGRAH_BASE_URL}/api/v1/public/agent/{trigger}` for PSTN |
| Outbound HTTPS from Dograh to the app | Pre-call fetch, the five tools and the end-of-call webhook all target `{APP_URL}/api/voice/...` |
| Public widget script URL | `NEXT_PUBLIC_DOGRAH_WIDGET_SRC` for the talk page (served over HTTPS; browsers block mixed content) |
| Persistent storage for recordings/transcripts | `recording_url` / `transcript_url` in webhooks must stay resolvable for as long as the DPDP retention policy requires |
| Time in sync (NTP) | Talk nonces expire after 5 minutes; clock drift makes pre-call fetch fail with 404 |
| A model/LLM provider key inside Dograh | The agent's reasoning runs inside Dograh; ApexSDR's Groq key is not used for the call |

Sizing: WebRTC calls are handled by Dograh's media layer; plan CPU for concurrent calls per the
official guidance. The ApexSDR endpoints are stateless and cheap (one DB read/write per tool call).

## Network and secrets checklist

- [ ] `DOGRAH_TOOL_SECRET` set in the app and as the `X-Tool-Secret` header on every Dograh tool
- [ ] `DOGRAH_WEBHOOK_SECRET` set in the app and as `X-Webhook-Secret` on the Dograh webhook
- [ ] App firewall allows Dograh's egress IPs (cloud) or the self-hosted host to reach `/api/voice/*`
- [ ] Rate limiting in front of `/api/voice/tools/*` and `/api/voice/webhooks/dograh` (they are secret-protected, not public)
- [ ] Recordings bucket is private; links are signed or expire
- [ ] Dograh workspace members limited to the voice team; API key rotated when someone leaves

## Telephony (Vobiz) — only when PSTN is in scope

Vobiz credentials (Auth ID, Auth Token, Application ID) are configured **inside Dograh's telephony
configurations**, never in ApexSDR. Prerequisites before the SIP trunk can be used for outbound:

1. Commercial Vobiz account with an Indian 140/1600-series number assigned (owner: the commercial
   relationship holder — this is an open question in the handoff).
2. DLT Principal Entity registration completed; the entity id goes into ApexSDR Voice Settings.
3. Advance autodialer notice filed with the OAP; date and document recorded in Voice Settings.
4. Vobiz application's answer URL pointed at Dograh (`{DOGRAH_BASE_URL}/api/v1/telephony/inbound/run`).
5. In ApexSDR, `/settings/voice` shows the gate as READY; only then enable the PSTN toggle.

## Environments

| Environment | Provider | Notes |
|---|---|---|
| Local dev / demo | `demo` | Simulation on the talk page; webhooks accepted with any secret if `DOGRAH_WEBHOOK_SECRET` is unset or `demo_webhook_secret` |
| Staging | `dograh` (cloud), PSTN off | Real WebRTC calls against a staging workflow; test leads only |
| Production | `dograh`, PSTN per gate | Separate workspace/workflow from staging; separate secrets |

Never point a staging Dograh workflow's webhook at the production app or vice versa — the
`workflow_run_id` namespaces would collide in `voice_calls`.
