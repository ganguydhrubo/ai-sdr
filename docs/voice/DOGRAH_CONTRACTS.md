# Dograh & Vobiz Integration Contracts

This document specifies the exact request, response, and lifecycle contracts for the **Dograh AI Voice Agent** and **Vobiz SIP Telephony** integration in ApexSDR.

---

## 1. WebRTC Headless Widget Embed & JS API
- **Source**: [Dograh Add to Website Documentation](https://docs.dograh.com/voice-agent/add-to-website.md)

### Embed Snippet
```html
<script>
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s);
    js.id = id;
    js.src = '<NEXT_PUBLIC_DOGRAH_WIDGET_SRC>';
    js.setAttribute('data-dograh-context', JSON.stringify({
      talk_ref: '<SINGLE_USE_CALL_NONCE>',
      lang: 'en'
    }));
    js.async = true;
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'dograh-widget'));
</script>
```

### Context Rules & Limitations
- **Key Constraints**: Keys cannot contain dots (`.`), whitespace, pipes (`|`), or braces (`{}`).
- **Limits**: Maximum 50 variables, 64 chars per key name, 2000 chars per value, total context payload ≤ 8 KB.
- **Security Rule**: Context set on the client is visible and editable in browser devtools. **Never pass PII, secrets, or lead details directly in client context.** Pass only an opaque, short-lived nonce (`talk_ref`). Real verified lead data is pulled server-side via Pre-Call Data Fetch.

### Headless JavaScript API (`window.DograhWidget`)
```typescript
interface DograhWidgetAPI {
  // Initiates WebRTC call; MUST be called synchronously inside a user gesture handler (e.g. click)
  start(): void;

  // Terminates the active call
  end(): void;

  // Sets or merges context for the NEXT call
  setContext(vars: Record<string, any>): void;

  // Retrieves current collected context
  getContext(): Record<string, any>;

  // Lifecycle Callbacks (Single-listener)
  onStatusChange(cb: (status: 'idle' | 'connecting' | 'connected' | 'failed', text?: string, subtext?: string) => void): void;
  onCallStart(cb: () => void): void;
  onCallConnected(cb: (payload: { agentId: string | number; workflowRunId: string | number; token: string }) => void): void;
  onCallDisconnected(cb: (payload: { agentId: string | number; workflowRunId: string | number; token: string; durationSeconds: number }) => void): void;
  onCallEnd(cb: () => void): void;
  onError(cb: (err: Error) => void): void;
}
```

---

## 2. Pre-Call Data Fetch Contract
- **Source**: [Dograh Pre-Call Data Fetch Documentation](https://docs.dograh.com/voice-agent/pre-call-data-fetch.md)
- **Endpoint**: `POST /api/voice/tools/pre-call`
- **Timeout**: 10 seconds (Dograh proceeds without extra context if timed out)
- **Authentication**: Custom Header `X-Tool-Secret: <DOGRAH_TOOL_SECRET>`

### Dograh Request Payload
```json
{
  "event": "call_inbound",
  "call_inbound": {
    "agent_id": 101,
    "from_number": "+919876543210",
    "to_number": "+918045678900"
  },
  "initial_context": {
    "talk_ref": "nonce_a1b2c3d4e5f6..."
  }
}
```

### Application Response Payload
```json
{
  "initial_context": {
    "first_name": "Rajesh",
    "company": "Bharat Forgings Ltd",
    "role": "VP Sales",
    "org_name": "ApexSDR Enterprise",
    "campaign_summary": "B2B Outreach Pipeline Velocity Brief",
    "language": "en",
    "allowed_topics": "Sales automation, CRM sync, Indian B2B lead qualification",
    "verified_research_facts": [
      {
        "fact_key": "expansion_city",
        "fact_value": "Expanding operations in Pune manufacturing hub",
        "source": "PUBLIC_WEBSITE",
        "confidence": 0.95
      }
    ]
  }
}
```
*Note: No prospect phone number or email is returned in pre-call data fetch to uphold data minimization.*

---

## 3. Outbound PSTN Trigger Contract (Dograh API Trigger)
- **Source**: [Dograh API Trigger Documentation](https://docs.dograh.com/voice-agent/api-trigger.md)
- **Endpoint**:
  - Production: `POST ${DOGRAH_BASE_URL}/api/v1/public/agent/${DOGRAH_TRIGGER_UUID}`
  - Test: `POST ${DOGRAH_BASE_URL}/api/v1/public/agent/test/${DOGRAH_TRIGGER_UUID}`
- **Headers**:
  - `X-API-Key: <DOGRAH_API_KEY>`
  - `Content-Type: application/json`

### Outbound Request Body
```json
{
  "phone_number": "+919876543210",
  "initial_context": {
    "talk_ref": "nonce_...",
    "lang": "hi",
    "greeting_override": {
      "type": "text",
      "text": "Namaste Rajesh ji, this is Apex SDR calling on behalf of Apex Enterprise..."
    }
  },
  "telephony_configuration_id": 12,
  "from_phone_number_id": 34
}
```

### Response Body
```json
{
  "status": "initiated",
  "workflow_run_id": 98765,
  "workflow_run_name": "WR-API-98765"
}
```

### Error Responses
- `400`: Telephony provider not configured or call initiation failed
- `401`: Missing or invalid API key
- `403`: API key does not have access to this agent
- `404`: Trigger UUID not found or not published

---

## 4. End-of-Call Webhook Contract
- **Source**: [Dograh Webhook Payloads Documentation](https://docs.dograh.com/developer/webhooks.md)
- **Endpoint**: `POST /api/voice/webhooks/dograh`
- **Headers**:
  - `X-Webhook-Secret: <DOGRAH_WEBHOOK_SECRET>`
  - `Content-Type: application/json`

### Webhook Payload Schema
```json
{
  "workflow_run_id": 98765,
  "workflow_run_name": "WR-API-98765",
  "workflow_id": 101,
  "workflow_name": "SDR Talk Agent",
  "campaign_id": null,
  "call_time": "2026-09-22T04:25:00.000Z",
  "initial_context": {
    "talk_ref": "nonce_98a7b6c5..."
  },
  "gathered_context": {
    "call_status": "completed",
    "call_disposition": "INTERESTED",
    "mapped_call_disposition": "INTERESTED",
    "intent": "REQUEST_DEMO",
    "buying_stage": "EVALUATING",
    "sentiment": "POSITIVE",
    "qualification": {
      "problem": "Manual rep outreach takes 15 hours weekly",
      "need": "Automate outbound touches",
      "urgency": "HIGH",
      "authority": "VP Sales (Sole Signer)",
      "timeline": "Next month",
      "budget_signal": "Budget approved for H2"
    },
    "meeting_requested": true,
    "meeting_id": "meet_apex_7781",
    "handoff_requested": true,
    "opt_out": false,
    "language": "Hinglish",
    "summary": "Rajesh confirmed interest in automating sales touches for Pune team. Booked 15-min discovery demo for Thursday 3 PM IST."
  },
  "cost_info": {
    "call_duration_seconds": 195
  },
  "recording_url": "https://storage.dograh.com/recordings/rec_98765.mp3",
  "transcript_url": "https://storage.dograh.com/transcripts/trans_98765.json"
}
```

---

## 5. Dograh HTTP Tool Endpoints (Agent In-Call Tool Calls)
All tools accept `POST` with header `X-Tool-Secret: <DOGRAH_TOOL_SECRET>` and resolve lead/org context via `resolver.ts`.

### 1. `POST /api/voice/tools/product-knowledge`
- **Request**: `{ "query": "What integrations do you have with Salesforce or Zoho?" }`
- **Response**: `{ "answer": "ApexSDR natively integrates bi-directionally with Zoho CRM and Salesforce..." }`

### 2. `POST /api/voice/tools/availability`
- **Request**: `{ "days_ahead": 5 }`
- **Response**: `{ "available_slots": ["2026-09-24T10:00:00+05:30", "2026-09-24T15:00:00+05:30", "2026-09-25T11:30:00+05:30"] }`

### 3. `POST /api/voice/tools/book-meeting`
- **Request**: `{ "selected_slot": "2026-09-24T15:00:00+05:30", "topic": "ApexSDR Platform Discovery" }`
- **Response**: `{ "success": true, "meeting_id": "meet_apex_7781", "meet_link": "https://meet.google.com/xyz-abcd-efg" }`

### 4. `POST /api/voice/tools/handoff`
- **Request**: `{ "urgency": "HIGH", "reason": "Prospect requested immediate Account Executive consultation" }`
- **Response**: `{ "success": true, "handoff_id": "hnd_4432", "assigned_rep": "Vikram Malhotra" }`

### 5. `POST /api/voice/tools/opt-out`
- **Request**: `{ "reason": "Prospect explicitly requested DO NOT CONTACT" }`
- **Response**: `{ "success": true, "suppressed": true, "status": "REVOKED" }`

---

## 6. Vobiz Telephony Configuration (Inside Dograh)
- **Source**: [Dograh Vobiz Telephony Documentation](https://docs.dograh.com/integrations/telephony/vobiz.md)
- Vobiz credentials (`Auth ID`, `Auth Token`, `Application ID`) reside securely inside Dograh's Telephony Configurations (`/telephony-configurations`), NOT stored in our application database.
- Webhook / Answer URL configured on Vobiz Application: `https://${DOGRAH_BASE_URL}/api/v1/telephony/inbound/run` (POST).
- Carrier costs are billed directly on Vobiz per-minute billing.
