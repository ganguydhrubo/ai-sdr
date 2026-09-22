import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as webhookHandler } from '../app/api/voice/webhooks/dograh/route';
import { DograhVoiceProvider } from '../lib/voice/dograh';
import { mintTalkNonce } from '../lib/voice/talk-links';
import { getDemoStore } from '../lib/store/demo-store';
import { ComplianceGuard } from '../lib/compliance/guard';

const WEBHOOK_URL = 'http://localhost:3000/api/voice/webhooks/dograh';

function createWebhookRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    workflow_run_id: 98765,
    workflow_run_name: 'WR-API-98765',
    workflow_id: 101,
    workflow_name: 'SDR Talk Agent',
    campaign_id: null,
    call_time: '2026-09-22T04:25:00.000Z',
    gathered_context: {
      call_status: 'completed',
      intent: 'REQUEST_DEMO',
      buying_stage: 'EVALUATING',
      sentiment: 'POSITIVE',
      meeting_requested: false,
      handoff_requested: false,
      opt_out: false,
      language: 'Hinglish',
      summary: 'Prospect confirmed interest in automating outbound touches.',
    },
    cost_info: { call_duration_seconds: 195 },
    recording_url: 'https://storage.dograh.com/recordings/rec_98765.mp3',
    ...overrides,
  };
}

describe('Dograh end-of-call webhook route (closes the voice loop)', () => {
  const originalSecret = process.env.DOGRAH_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.DOGRAH_WEBHOOK_SECRET;
    } else {
      process.env.DOGRAH_WEBHOOK_SECRET = originalSecret;
    }
  });

  it('rejects a request whose X-Webhook-Secret does not match the configured secret', async () => {
    process.env.DOGRAH_WEBHOOK_SECRET = 'whsec_real_secret_for_test';

    const res = await webhookHandler(
      createWebhookRequest(basePayload(), { 'X-Webhook-Secret': 'wrong-secret' })
    );
    expect(res.status).toBe(401);

    const ok = await webhookHandler(
      createWebhookRequest(basePayload({ workflow_run_id: 'wr_sig_ok' }), {
        'X-Webhook-Secret': 'whsec_real_secret_for_test',
      })
    );
    expect(ok.status).toBe(200);
  });

  it('rejects malformed JSON and payloads that fail the Zod contract', async () => {
    const badJson = await webhookHandler(createWebhookRequest('{ not json'));
    expect(badJson.status).toBe(400);

    const missingRunId = await webhookHandler(
      createWebhookRequest({ workflow_name: 'SDR Talk Agent', gathered_context: {} })
    );
    expect(missingRunId.status).toBe(400);
    const json = await missingRunId.json();
    expect(json.issues?.length).toBeGreaterThan(0);
  });

  it('records a WebRTC call against the lead resolved from talk_ref and books the meeting', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[4];
    const session = store.getTalkSessions()[4];
    const { nonce } = await mintTalkNonce(session.id, session.organization_id, lead.id, 300);

    const res = await webhookHandler(
      createWebhookRequest(
        basePayload({
          workflow_run_id: 'wr_webrtc_001',
          initial_context: { talk_ref: nonce },
          gathered_context: {
            ...basePayload().gathered_context,
            meeting_requested: true,
            meeting_id: 'meet_apex_7781',
          },
        })
      )
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.duplicate).toBe(false);
    expect(json.lead_id).toBe(lead.id);
    expect(json.status).toBe('COMPLETED');

    const record = store.getVoiceCalls().find((c) => c.provider_run_id === 'wr_webrtc_001');
    expect(record).toBeDefined();
    expect(record?.mode).toBe('webrtc');
    expect(record?.talk_session_id).toBe(session.id);
    expect(record?.duration_seconds).toBe(195);
    expect(record?.recording_url).toContain('rec_98765');
    expect(record?.carrier_cost_estimate_inr).toBe(0);
    expect(lead.status).toBe('MEETING');
  });

  it('is idempotent: a redelivered webhook updates the existing call instead of creating a second row', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[5];

    // A PSTN call already has an INITIATED row from initiateOutboundCall()
    store.recordVoiceCall({
      id: 'vc_demo_pstn_777',
      lead_id: lead.id,
      lead_name: lead.full_name,
      lead_company: lead.company_name,
      mode: 'pstn',
      provider: 'demo',
      provider_run_id: 'wr_777',
      status: 'INITIATED',
      carrier_cost_estimate_inr: 0.85,
    });

    const payload = basePayload({
      workflow_run_id: 'wr_777',
      gathered_context: { ...basePayload().gathered_context, handoff_requested: true },
    });

    const first = await webhookHandler(createWebhookRequest(payload));
    expect(first.status).toBe(200);
    expect((await first.json()).duplicate).toBe(false);

    const auditCountAfterFirst = store.auditLogs.length;

    const second = await webhookHandler(createWebhookRequest(payload));
    expect(second.status).toBe(200);
    expect((await second.json()).duplicate).toBe(true);

    const rows = store.getVoiceCalls().filter((c) => c.provider_run_id === 'wr_777');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('vc_demo_pstn_777');
    expect(rows[0].status).toBe('COMPLETED');
    expect(rows[0].duration_seconds).toBe(195);
    expect(lead.status).toBe('SALES_HANDOFF');
    expect(lead.requires_human_attention).toBe(true);

    // The duplicate delivery must not re-run post-call actions (only the webhook receipt is logged).
    const handoffLogs = store.auditLogs.filter(
      (l) => l.action === 'VOICE_SDR_HANDOFF_TRIGGERED' && l.entity_id === lead.id
    );
    expect(handoffLogs).toHaveLength(1);
    expect(store.auditLogs.length).toBe(auditCountAfterFirst + 1);
  });

  it('suppresses the lead when the prospect opted out during the call', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[6];
    const session = store.getTalkSessions()[6];
    const { nonce } = await mintTalkNonce(session.id, session.organization_id, lead.id, 300);

    const res = await webhookHandler(
      createWebhookRequest(
        basePayload({
          workflow_run_id: 'wr_optout_001',
          initial_context: { talk_ref: nonce },
          gathered_context: { ...basePayload().gathered_context, opt_out: true, intent: 'NOT_INTERESTED' },
        })
      )
    );
    expect(res.status).toBe(200);
    expect(lead.is_suppressed).toBe(true);
    expect(ComplianceGuard.isSuppressed(lead.email, lead.phone).suppressed).toBe(true);
  });
});

describe('DograhVoiceProvider.processWebhook idempotency', () => {
  it('updates the INITIATED row created at call start and ignores duplicate deliveries', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[7];
    const provider = new DograhVoiceProvider();

    store.recordVoiceCall({
      id: 'vc_dograh_555',
      lead_id: lead.id,
      lead_name: lead.full_name,
      lead_company: lead.company_name,
      mode: 'pstn',
      provider: 'dograh',
      provider_run_id: '555',
      status: 'INITIATED',
      carrier_cost_estimate_inr: 0.85,
    });

    const payload = basePayload({
      workflow_run_id: 555,
      gathered_context: { ...basePayload().gathered_context, meeting_requested: true, meeting_id: 'meet_555' },
    });

    const first = await provider.processWebhook(payload as any);
    expect(first.success).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(first.callRecord?.id).toBe('vc_dograh_555');
    expect(first.callRecord?.status).toBe('COMPLETED');
    expect(first.callRecord?.lead_id).toBe(lead.id);
    expect(lead.status).toBe('MEETING');

    const second = await provider.processWebhook(payload as any);
    expect(second.duplicate).toBe(true);

    expect(store.getVoiceCalls().filter((c) => c.provider_run_id === '555')).toHaveLength(1);
  });

  it('creates a completed record for a run it has never seen', async () => {
    const store = getDemoStore();
    const provider = new DograhVoiceProvider();
    const before = store.getVoiceCalls().length;

    const result = await provider.processWebhook(basePayload({ workflow_run_id: 'brand_new_run' }) as any);
    expect(result.success).toBe(true);
    expect(result.callRecord?.id).toBe('vc_dograh_brand_new_run');
    expect(result.callRecord?.mode).toBe('pstn');
    expect(store.getVoiceCalls().length).toBe(before + 1);
  });
});
