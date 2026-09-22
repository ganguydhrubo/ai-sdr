import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { GET as listSessions } from '../app/api/voice/talk-sessions/route';
import { POST as expireSessions } from '../app/api/voice/talk-sessions/expire/route';
import { GET as listCalls } from '../app/api/voice/calls/route';
import { POST as talkInvite } from '../app/api/voice/talk-invite/route';
import { POST as dograhWebhook } from '../app/api/voice/webhooks/dograh/route';
import { expireTalkSessions, listTalkSessions } from '../lib/voice/sessions';
import { notifyPostCallWorkflow } from '../lib/voice/notify';
import { getDemoStore } from '../lib/store/demo-store';

function get(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}
function post(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('n8n workflow exports (Phase V7)', () => {
  const dir = path.join(process.cwd(), 'n8n', 'workflows');
  const expected = ['talk-invite-dispatch.json', 'talk-invite-reminder.json', 'post-call-followup.json', 'talk-link-expiry.json'];

  it('ships the four voice workflows as importable n8n JSON with consistent connections', () => {
    for (const file of expected) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      expect(data.name, file).toMatch(/^ApexSDR Voice/);
      const names = new Set(data.nodes.map((n: { name: string }) => n.name));
      for (const [src, conn] of Object.entries<any>(data.connections)) {
        expect(names.has(src), `${file}: ${src}`).toBe(true);
        for (const outputs of conn.main) for (const o of outputs) expect(names.has(o.node), `${file}: ${o.node}`).toBe(true);
      }
      const serialised = JSON.stringify(data);
      expect(serialised).not.toMatch(/sk_live|whsec_|rzp_live/); // no secrets baked in
      if (serialised.includes('$env.APP_URL')) expect(serialised).toContain('$env.DOGRAH_TOOL_SECRET');
      else expect(serialised).toContain('$env.N8N_WEBHOOK_SECRET'); // inbound-only workflow verifies Apex's secret
    }
  });

  it('points every Apex HTTP node at an endpoint that exists in the app', () => {
    const routes = expected
      .flatMap((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')).nodes)
      .filter((n: any) => n.type === 'n8n-nodes-base.httpRequest' && String(n.parameters.url).includes('$env.APP_URL'))
      .map((n: any) => String(n.parameters.url).replace('={{ $env.APP_URL }}', ''));
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const file = path.join(process.cwd(), 'app', ...route.split('/').filter(Boolean), 'route.ts');
      expect(fs.existsSync(file), route).toBe(true);
    }
  });
});

describe('Talk-session listing and expiry endpoints', () => {
  it('lists sessions by status and filters unopened links older than N hours', async () => {
    const store = getDemoStore();
    const stale = store.createTalkSession({
      id: 'ts_stale_reminder',
      lead_id: store.getLeads()[3].id,
      lead_name: store.getLeads()[3].full_name,
      channel: 'email',
      token_hash: 'hash_stale',
      status: 'SENT',
      expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      sent_at: new Date(Date.now() - 72 * 3600000).toISOString(),
      language: 'en',
    });

    const res = await listSessions(get('http://localhost:3000/api/voice/talk-sessions?status=SENT&unopened=true&sent_older_than_hours=48'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sessions.some((s: { id: string }) => s.id === stale.id)).toBe(true);
    expect(json.sessions.every((s: { status: string; opened_at?: string }) => s.status === 'SENT' && !s.opened_at)).toBe(true);
    expect(JSON.stringify(json)).not.toContain('token_hash');

    const bad = await listSessions(get('http://localhost:3000/api/voice/talk-sessions?status=NOPE'));
    expect(bad.status).toBe(400);
  });

  it('expires overdue live sessions exactly once', async () => {
    const store = getDemoStore();
    store.createTalkSession({
      id: 'ts_overdue_1',
      lead_id: store.getLeads()[4].id,
      channel: 'email',
      token_hash: 'hash_overdue_1',
      status: 'SENT',
      expires_at: new Date(Date.now() - 3600000).toISOString(),
      language: 'en',
    });
    store.createTalkSession({
      id: 'ts_overdue_done',
      lead_id: store.getLeads()[4].id,
      channel: 'email',
      token_hash: 'hash_overdue_done',
      status: 'COMPLETED',
      expires_at: new Date(Date.now() - 3600000).toISOString(),
      language: 'en',
    });

    const first = await expireSessions(post('http://localhost:3000/api/voice/talk-sessions/expire', {}));
    const firstJson = await first.json();
    expect(first.status).toBe(200);
    expect(firstJson.sessionIds).toContain('ts_overdue_1');
    expect(firstJson.sessionIds).not.toContain('ts_overdue_done');
    expect(store.getTalkSessions().find((s) => s.id === 'ts_overdue_1')?.status).toBe('EXPIRED');

    const second = await expireTalkSessions();
    expect(second.sessionIds).not.toContain('ts_overdue_1');
    expect(listTalkSessions({ status: 'EXPIRED' }).some((s) => s.id === 'ts_overdue_1')).toBe(true);
  });

  it('lists completed calls since a timestamp without transcripts', async () => {
    const res = await listCalls(get(`http://localhost:3000/api/voice/calls?status=COMPLETED&since=${encodeURIComponent('2000-01-01T00:00:00Z')}&limit=5`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.calls.length).toBeGreaterThan(0);
    expect(json.calls.length).toBeLessThanOrEqual(5);
    expect(json.calls[0]).not.toHaveProperty('transcript');
    expect(json.calls.every((c: { status: string }) => c.status === 'COMPLETED')).toBe(true);
  });
});

describe('Talk-invite reminders', () => {
  it('supersedes an unopened link with a fresh one and refuses reminders for opened links', async () => {
    const store = getDemoStore();
    const lead = store.getLeads()[5];

    const first = await talkInvite(post('http://localhost:3000/api/voice/talk-invite', { lead_id: lead.id, channel: 'EMAIL' }));
    const firstJson = await first.json();
    expect(first.status).toBe(200);

    const reminder = await talkInvite(
      post('http://localhost:3000/api/voice/talk-invite', { lead_id: lead.id, reminder_for_session_id: firstJson.talk_session_id })
    );
    expect(reminder.status).toBe(200);
    const reminderJson = await reminder.json();
    expect(reminderJson.talk_session_id).not.toBe(firstJson.talk_session_id);
    expect(reminderJson.channel).toBe('EMAIL');

    const old = store.getTalkSessions().find((s) => s.id === firstJson.talk_session_id);
    expect(old?.status).toBe('REVOKED');
    expect(old?.revoked_reason).toMatch(/reminder/i);

    // An opened link must not be superseded.
    const opened = store.getTalkSessions().find((s) => s.id === reminderJson.talk_session_id)!;
    opened.opened_at = new Date().toISOString();
    const refused = await talkInvite(
      post('http://localhost:3000/api/voice/talk-invite', { lead_id: lead.id, reminder_for_session_id: opened.id })
    );
    expect(refused.status).toBe(422);
  });
});

describe('Post-call notification to n8n', () => {
  const originalUrl = process.env.N8N_POST_CALL_WEBHOOK_URL;
  const originalFetch = global.fetch;
  afterEach(() => {
    if (originalUrl === undefined) delete process.env.N8N_POST_CALL_WEBHOOK_URL;
    else process.env.N8N_POST_CALL_WEBHOOK_URL = originalUrl;
    global.fetch = originalFetch;
  });

  it('is a no-op without configuration and posts the outcome (with contact fields) when configured', async () => {
    delete process.env.N8N_POST_CALL_WEBHOOK_URL;
    const store = getDemoStore();
    const call = store.getVoiceCalls()[0];
    expect(await notifyPostCallWorkflow({ success: true, callRecord: call })).toBe(false);

    process.env.N8N_POST_CALL_WEBHOOK_URL = 'https://n8n.example.test/webhook/post-call';
    let captured: any = null;
    global.fetch = (async (url: any, init: any) => {
      captured = { url: String(url), body: JSON.parse(init.body) };
      return { ok: true } as Response;
    }) as any;

    expect(await notifyPostCallWorkflow({ success: true, callRecord: call })).toBe(true);
    expect(captured.url).toBe('https://n8n.example.test/webhook/post-call');
    expect(captured.body.event).toBe('voice.call.completed');
    expect(captured.body.call_id).toBe(call.id);
    expect(captured.body.lead_email).toContain('@');
    expect(captured.body).not.toHaveProperty('transcript');

    // duplicates are never forwarded
    expect(await notifyPostCallWorkflow({ success: true, duplicate: true, callRecord: call })).toBe(false);
  });

  it('is triggered by the Dograh webhook route after a successful, non-duplicate delivery', async () => {
    process.env.N8N_POST_CALL_WEBHOOK_URL = 'https://n8n.example.test/webhook/post-call';
    const calls: string[] = [];
    global.fetch = (async (url: any) => {
      calls.push(String(url));
      return { ok: true } as Response;
    }) as any;

    const res = await dograhWebhook(
      post('http://localhost:3000/api/voice/webhooks/dograh', {
        workflow_run_id: 'wr_n8n_notify_1',
        gathered_context: { intent: 'INTERESTED', summary: 'Wants a brief.' },
        cost_info: { call_duration_seconds: 60 },
      })
    );
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toContain('https://n8n.example.test/webhook/post-call');
  });
});
