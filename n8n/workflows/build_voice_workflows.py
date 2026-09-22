"""Generates the four voice-module n8n workflow exports next to this file.

Run:  python n8n/workflows/build_voice_workflows.py
The JSON files are what you import into n8n (Workflows → Import from file). They only use
core nodes (webhook, scheduleTrigger, httpRequest, function, if, switch, set) plus environment
variables so no credentials are baked in:
  APP_URL, DOGRAH_TOOL_SECRET, SLACK_WEBHOOK_URL, RESEND_API_KEY, RESEND_FROM, N8N_WEBHOOK_SECRET
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

TOOL_HEADERS = {
    "parameters": [
        {"name": "X-Tool-Secret", "value": "={{ $env.DOGRAH_TOOL_SECRET }}"},
        {"name": "Content-Type", "value": "application/json"},
    ]
}


def node(name, type_, params, x, y, version=1):
    return {"parameters": params, "name": name, "type": type_, "typeVersion": version, "position": [x, y]}


def webhook(name, path, x=240, y=300):
    return node(
        name,
        "n8n-nodes-base.webhook",
        {"httpMethod": "POST", "path": path, "responseMode": "onReceived", "options": {}},
        x,
        y,
    )


def schedule(name, cron, x=240, y=300):
    return node(
        name,
        "n8n-nodes-base.scheduleTrigger",
        {"rule": {"interval": [{"field": "cronExpression", "expression": cron}]}},
        x,
        y,
        version=1.1,
    )


def http(name, method, url, x, y, headers=None, body=None, query=None):
    params = {"method": method, "url": url, "options": {}}
    if headers:
        params["sendHeaders"] = True
        params["headerParameters"] = headers
    if body is not None:
        params["sendBody"] = True
        params["specifyBody"] = "json"
        params["jsonBody"] = body
    if query:
        params["sendQuery"] = True
        params["queryParameters"] = {"parameters": [{"name": k, "value": v} for k, v in query.items()]}
    return node(name, "n8n-nodes-base.httpRequest", params, x, y, version=3)


def function(name, code, x, y):
    return node(name, "n8n-nodes-base.function", {"functionCode": code}, x, y)


def if_bool(name, expr, x, y):
    return node(name, "n8n-nodes-base.if", {"conditions": {"boolean": [{"value1": expr, "value2": True}]}}, x, y)


def slack(name, text_expr, x, y):
    return http(
        name,
        "POST",
        "={{ $env.SLACK_WEBHOOK_URL }}",
        x,
        y,
        headers={"parameters": [{"name": "Content-Type", "value": "application/json"}]},
        body="={{ JSON.stringify({ text: " + text_expr + " }) }}",
    )


def resend(name, to_expr, subject_expr, text_expr, x, y):
    return http(
        name,
        "POST",
        "https://api.resend.com/emails",
        x,
        y,
        headers={
            "parameters": [
                {"name": "Authorization", "value": "=Bearer {{ $env.RESEND_API_KEY }}"},
                {"name": "Content-Type", "value": "application/json"},
            ]
        },
        body="={{ JSON.stringify({ from: $env.RESEND_FROM, to: [" + to_expr + "], subject: " + subject_expr + ", text: " + text_expr + " }) }}",
    )


def connect(*pairs):
    """pairs: (from, to) or (from, to, output_index)"""
    conns = {}
    for pair in pairs:
        src, dst = pair[0], pair[1]
        idx = pair[2] if len(pair) > 2 else 0
        outputs = conns.setdefault(src, {"main": []})["main"]
        while len(outputs) <= idx:
            outputs.append([])
        outputs[idx].append({"node": dst, "type": "main", "index": 0})
    return conns


def write(filename, name, nodes, connections):
    data = {"name": name, "nodes": nodes, "connections": connections}
    with open(os.path.join(HERE, filename), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote", filename, "-", len(nodes), "nodes")


# ---------------------------------------------------------------------------
# 1. talk-invite-dispatch — Webhook → Apex mints + queues the invite → Slack
# ---------------------------------------------------------------------------
dispatch_nodes = [
    webhook("Webhook: Talk Invite Requested", "talk-invite"),
    function(
        "Function: Normalise Request",
        "// Accepts { lead_id, campaign_id?, step_id?, channel?, language? } from the CRM, a campaign\n"
        "// scheduler or a manual trigger, and forwards only the fields the Apex API understands.\n"
        "const b = $json.body || $json;\n"
        "if (!b.lead_id) { throw new Error('lead_id is required'); }\n"
        "return [{ json: {\n"
        "  lead_id: String(b.lead_id),\n"
        "  campaign_id: b.campaign_id || undefined,\n"
        "  step_id: b.step_id || undefined,\n"
        "  channel: b.channel ? String(b.channel).toUpperCase() : undefined,\n"
        "  language: b.language || undefined,\n"
        "} }];",
        460,
        300,
    ),
    http(
        "Apex: Mint & Queue Talk Invite",
        "POST",
        "={{ $env.APP_URL }}/api/voice/talk-invite",
        680,
        300,
        headers=TOOL_HEADERS,
        body="={{ JSON.stringify($json) }}",
    ),
    if_bool("IF: Invite Queued?", "={{ $json.success === true }}", 900, 300),
    slack(
        "Slack: Invite Queued",
        "'🔗 Talk link ' + $json.talk_session_id + ' queued via ' + $json.channel + ' (approval: ' + $json.requires_approval + ', expires ' + $json.expires_at + ')'",
        1120,
        200,
    ),
    slack(
        "Slack: Invite Failed",
        "'⚠️ Talk invite failed: ' + ($json.error || 'unknown error')",
        1120,
        420,
    ),
]
write(
    "talk-invite-dispatch.json",
    "ApexSDR Voice - Talk Invite Dispatch",
    dispatch_nodes,
    connect(
        ("Webhook: Talk Invite Requested", "Function: Normalise Request"),
        ("Function: Normalise Request", "Apex: Mint & Queue Talk Invite"),
        ("Apex: Mint & Queue Talk Invite", "IF: Invite Queued?"),
        ("IF: Invite Queued?", "Slack: Invite Queued", 0),
        ("IF: Invite Queued?", "Slack: Invite Failed", 1),
    ),
)

# ---------------------------------------------------------------------------
# 2. talk-invite-reminder — daily 10:00 IST: unopened links older than 48 h get a fresh link
# ---------------------------------------------------------------------------
reminder_nodes = [
    schedule("Schedule: Daily 10:00 IST", "30 4 * * *"),
    http(
        "Apex: Unopened Links > 48h",
        "GET",
        "={{ $env.APP_URL }}/api/voice/talk-sessions",
        460,
        300,
        headers=TOOL_HEADERS,
        query={"status": "SENT", "unopened": "true", "sent_older_than_hours": "48", "limit": "100"},
    ),
    function(
        "Function: One Item Per Session",
        "const sessions = ($json.sessions || []);\n"
        "return sessions.map(s => ({ json: { lead_id: s.lead_id, reminder_for_session_id: s.id, lead_name: s.lead_name } }));",
        680,
        300,
    ),
    http(
        "Apex: Send Reminder Link",
        "POST",
        "={{ $env.APP_URL }}/api/voice/talk-invite",
        900,
        300,
        headers=TOOL_HEADERS,
        body="={{ JSON.stringify({ lead_id: $json.lead_id, reminder_for_session_id: $json.reminder_for_session_id }) }}",
    ),
    slack(
        "Slack: Reminder Summary",
        "'🔁 Talk-link reminder: ' + ($json.success ? 'new link ' + $json.talk_session_id + ' queued' : 'skipped — ' + $json.error)",
        1120,
        300,
    ),
]
write(
    "talk-invite-reminder.json",
    "ApexSDR Voice - Talk Invite Reminder",
    reminder_nodes,
    connect(
        ("Schedule: Daily 10:00 IST", "Apex: Unopened Links > 48h"),
        ("Apex: Unopened Links > 48h", "Function: One Item Per Session"),
        ("Function: One Item Per Session", "Apex: Send Reminder Link"),
        ("Apex: Send Reminder Link", "Slack: Reminder Summary"),
    ),
)

# ---------------------------------------------------------------------------
# 3. post-call-followup — Apex posts each completed call here (N8N_POST_CALL_WEBHOOK_URL)
# ---------------------------------------------------------------------------
followup_nodes = [
    webhook("Webhook: Voice Call Completed", "post-call"),
    if_bool(
        "IF: Apex Secret Valid?",
        "={{ !$env.N8N_WEBHOOK_SECRET || $json.headers['x-webhook-secret'] === $env.N8N_WEBHOOK_SECRET }}",
        350,
        300,
    ),
    function(
        "Function: Classify Outcome",
        "const c = $json.body || $json;\n"
        "const g = c.extracted || {};\n"
        "const outcome = g.opt_out ? 'OPT_OUT' : g.meeting_requested ? 'MEETING' : g.handoff_requested ? 'HANDOFF' : 'FOLLOW_UP';\n"
        "return [{ json: { ...c, outcome, summary: g.summary || 'Thanks for speaking with our AI assistant.' } }];",
        460,
        300,
    ),
    node(
        "Switch: Outcome",
        "n8n-nodes-base.switch",
        {
            "dataType": "string",
            "value1": "={{ $json.outcome }}",
            "rules": {
                "rules": [
                    {"value2": "OPT_OUT", "output": 0},
                    {"value2": "MEETING", "output": 1},
                    {"value2": "HANDOFF", "output": 2},
                ]
            },
            "fallbackOutput": 3,
        },
        680,
        300,
    ),
    node(
        "Set: Opted Out — No Contact",
        "n8n-nodes-base.set",
        {"values": {"string": [{"name": "note", "value": "Prospect opted out during the call; suppression already applied by Apex. No follow-up sent."}]}, "options": {}},
        900,
        100,
    ),
    resend(
        "Resend: Meeting Confirmation",
        "$json.lead_email",
        "'Your meeting with ' + ($env.ORG_NAME || 'us') + ' is booked'",
        "'Hi ' + ($json.lead_first_name || '') + ',\\n\\nThanks for talking to our AI assistant. Your meeting is booked and the calendar invite is on its way.\\n\\nSummary: ' + $json.summary + '\\n\\nTo opt out of future emails, reply with unsubscribe.'",
        900,
        260,
    ),
    slack(
        "Slack: Human Handoff Needed",
        "'🙋 Handoff requested by ' + $json.lead_name + ' (' + $json.lead_company + '): ' + $json.summary + ' — call ' + $json.call_id",
        900,
        420,
    ),
    resend(
        "Resend: Follow-up Summary",
        "$json.lead_email",
        "'Thanks for talking to us, ' + ($json.lead_first_name || '')",
        "'Hi ' + ($json.lead_first_name || '') + ',\\n\\nThanks for your time today. Here is a short summary of what we discussed:\\n\\n' + $json.summary + '\\n\\nReply to this email if you would like a human to follow up.\\n\\nTo opt out of future emails, reply with unsubscribe.'",
        900,
        580,
    ),
]
write(
    "post-call-followup.json",
    "ApexSDR Voice - Post-Call Follow-up",
    followup_nodes,
    connect(
        ("Webhook: Voice Call Completed", "IF: Apex Secret Valid?"),
        ("IF: Apex Secret Valid?", "Function: Classify Outcome", 0),
        ("Function: Classify Outcome", "Switch: Outcome"),
        ("Switch: Outcome", "Set: Opted Out — No Contact", 0),
        ("Switch: Outcome", "Resend: Meeting Confirmation", 1),
        ("Switch: Outcome", "Slack: Human Handoff Needed", 2),
        ("Switch: Outcome", "Resend: Follow-up Summary", 3),
    ),
)

# ---------------------------------------------------------------------------
# 4. talk-link-expiry — hourly: expire overdue links, report when any expired
# ---------------------------------------------------------------------------
expiry_nodes = [
    schedule("Schedule: Hourly", "0 * * * *"),
    http(
        "Apex: Expire Overdue Talk Links",
        "POST",
        "={{ $env.APP_URL }}/api/voice/talk-sessions/expire",
        460,
        300,
        headers=TOOL_HEADERS,
        body="={{ JSON.stringify({}) }}",
    ),
    if_bool("IF: Any Expired?", "={{ ($json.expired || 0) > 0 }}", 680, 300),
    slack(
        "Slack: Expiry Summary",
        "'⌛ ' + $json.expired + ' talk link(s) expired at ' + $json.checkedAt + ': ' + ($json.sessionIds || []).join(', ')",
        900,
        200,
    ),
]
write(
    "talk-link-expiry.json",
    "ApexSDR Voice - Talk Link Expiry",
    expiry_nodes,
    connect(
        ("Schedule: Hourly", "Apex: Expire Overdue Talk Links"),
        ("Apex: Expire Overdue Talk Links", "IF: Any Expired?"),
        ("IF: Any Expired?", "Slack: Expiry Summary", 0),
    ),
)
