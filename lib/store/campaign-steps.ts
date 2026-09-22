import { CampaignStep } from '../types';

/**
 * Seeded campaign sequence steps for the demo store.
 * TALK_INVITE steps mint a personal "Talk to our AI" link and require {{talk_link}} in the template
 * (see lib/orchestrator/talk-invite.ts and lib/outreach/templates.ts).
 */
export const INITIAL_CAMPAIGN_STEPS: CampaignStep[] = [
  // camp_01 — Manufacturing (email-led, MANUAL approval)
  {
    id: 'step_01_1', campaign_id: 'camp_01', step_number: 1, step_type: 'MESSAGE', channel: 'EMAIL', delay_days: 0, is_active: true,
    name: 'Initial personalised email',
    description: 'Value-driven consultative intro highlighting pipeline efficiency for VP Sales. Checked against ComplianceGuard.',
    subject_template: 'Accelerating sales pipeline velocity at {{company}}',
    body_template:
      'Hi {{first_name}},\n\nGiven your role leading revenue at {{company}}, I wanted to share how manufacturers in {{city}} are automating prospecting without adding headcount.\n\nWould you be open to a 15-minute call this week?\n\nBest regards,\n{{sender_name}}\n{{org_name}}\n\nTo opt out of future emails, reply with unsubscribe.',
  },
  {
    id: 'step_01_2', campaign_id: 'camp_01', step_number: 2, step_type: 'MESSAGE', channel: 'WHATSAPP', delay_days: 2, is_active: true,
    name: 'WhatsApp touchpoint',
    description: 'Short message referencing the email with Hindi/Hinglish language options for tier-2 industrial decision makers.',
    whatsapp_template_name: 'apex_intro_followup_v2',
    body_template:
      'Namaste {{first_name}} ji, {{sender_name}} from {{org_name}} here. Sent you a short note on automating outbound for {{company}}. Would a 2-page brief help? Reply STOP to opt out.',
  },
  {
    id: 'step_01_3', campaign_id: 'camp_01', step_number: 3, step_type: 'TALK_INVITE', channel: 'EMAIL', delay_days: 3, is_active: true,
    name: 'Talk to our AI link',
    description: 'Personal WebRTC talk link — the prospect speaks to the AI SDR from the browser, zero carrier cost. Link expires automatically.',
    talk_link_language: 'en', talk_link_expires_in_days: 7, talk_link_max_calls: 3,
    subject_template: "{{first_name}}, talk to {{org_name}}'s AI for 2 minutes — no forms",
    body_template:
      'Hi {{first_name}},\n\nInstead of another email, here is a personal link where you can ask our AI sales assistant anything about {{org_name}} — pricing, integrations, compliance — by voice, from your browser:\n\n{{talk_link}}\n\nIt is private to you and works until {{talk_link_expires}}. If it is useful, it can book a slot with our team on the spot.\n\nBest regards,\n{{sender_name}}\n\nTo opt out of future emails, reply with unsubscribe.',
  },
  {
    id: 'step_01_4', campaign_id: 'camp_01', step_number: 4, step_type: 'MESSAGE', channel: 'EMAIL', delay_days: 5, is_active: true,
    name: 'Value & peer benchmark',
    description: 'Shares a real Indian enterprise case study on reducing SDR ramp time.',
    subject_template: 'How a {{city}} manufacturer cut SDR ramp time by half',
    body_template:
      'Hi {{first_name}},\n\nSharing a short case study relevant to {{company}}: a peer in {{city}} halved SDR ramp time in one quarter.\n\nHappy to walk you through it in 15 minutes.\n\n{{sender_name}}\n{{org_name}}\n\nTo opt out, reply with unsubscribe.',
  },
  {
    id: 'step_01_5', campaign_id: 'camp_01', step_number: 5, step_type: 'MESSAGE', channel: 'EMAIL', delay_days: 14, is_active: true,
    name: 'Polite breakup & resource',
    description: 'Polite breakup note ensuring zero spam escalation. Leaves the door open for future outreach.',
    subject_template: 'Closing the loop, {{first_name}}',
    body_template:
      'Hi {{first_name}},\n\nI will stop here so as not to crowd your inbox. If outbound automation becomes a priority at {{company}}, this thread is the fastest way back to us.\n\nWishing you a strong quarter,\n{{sender_name}}\n{{org_name}}',
  },

  // camp_02 — Logistics (WhatsApp-first, SEMI_AUTOMATIC approval)
  {
    id: 'step_02_1', campaign_id: 'camp_02', step_number: 1, step_type: 'MESSAGE', channel: 'WHATSAPP', delay_days: 0, is_active: true,
    name: 'WhatsApp opener',
    description: 'Consent-aware opener for supply chain leaders (Baileys adapter, jitter-paced).',
    whatsapp_template_name: 'apex_logistics_opener_v1',
    body_template:
      'Namaste {{first_name}} ji, {{sender_name}} from {{org_name}}. We help 3PL and cold-chain operators like {{company}} keep their sales pipeline moving with an AI SDR. Open to a short chat this week? Reply STOP to opt out.',
  },
  {
    id: 'step_02_2', campaign_id: 'camp_02', step_number: 2, step_type: 'TALK_INVITE', channel: 'WHATSAPP', delay_days: 1, is_active: true,
    name: 'Talk to our AI (WhatsApp)',
    description: 'Personal talk link sent on WhatsApp — Hindi/Hinglish capable voice agent, zero carrier cost.',
    talk_link_language: 'hi', talk_link_expires_in_days: 5, talk_link_max_calls: 3,
    body_template:
      '{{first_name}} ji, agar padhne ka time nahi hai — 2 minute baat kar lijiye hamare AI assistant se, seedha browser se: {{talk_link}} (link {{talk_link_expires}} tak valid hai, sirf aapke liye). Reply STOP to opt out.',
  },
  {
    id: 'step_02_3', campaign_id: 'camp_02', step_number: 3, step_type: 'MESSAGE', channel: 'EMAIL', delay_days: 4, is_active: true,
    name: 'Fleet & pipeline brief',
    description: 'Email with a 2-page brief on fleet-tracking and sales automation for logistics.',
    subject_template: 'A 2-page brief for {{company}}: sales automation for logistics',
    body_template:
      'Hi {{first_name}},\n\nAs promised on WhatsApp, a short brief on how logistics operators run outbound with an AI SDR.\n\n{{sender_name}}\n{{org_name}}\n\nTo opt out, reply with unsubscribe.',
  },
  {
    id: 'step_02_4', campaign_id: 'camp_02', step_number: 4, step_type: 'MESSAGE', channel: 'WHATSAPP', delay_days: 9, is_active: true,
    name: 'Final nudge',
    description: 'One last, polite WhatsApp nudge before the sequence ends.',
    whatsapp_template_name: 'apex_final_nudge_v1',
    body_template:
      '{{first_name}} ji, last message from my side. If pipeline automation comes up at {{company}}, just reply here. Dhanyavaad — {{sender_name}}, {{org_name}}. Reply STOP to opt out.',
  },

  // camp_03 — SaaS founders (email + LinkedIn, MANUAL approval)
  {
    id: 'step_03_1', campaign_id: 'camp_03', step_number: 1, step_type: 'MESSAGE', channel: 'EMAIL', delay_days: 0, is_active: true,
    name: 'Founder benchmark email',
    description: 'Outbound SDR benchmarking offer for Seed/Series-A founders.',
    subject_template: '{{company}} vs. 40 Indian SaaS outbound teams — a benchmark',
    body_template:
      'Hi {{first_name}},\n\nWe benchmarked outbound at 40 Indian SaaS companies at your stage. Would a comparison for {{company}} be useful?\n\n{{sender_name}}\n{{org_name}}\n\nTo opt out of future emails, reply with unsubscribe.',
  },
  {
    id: 'step_03_2', campaign_id: 'camp_03', step_number: 2, step_type: 'MESSAGE', channel: 'LINKEDIN', delay_days: 2, is_active: true,
    name: 'LinkedIn connect note',
    description: 'Short LinkedIn connection note referencing the benchmark.',
    body_template:
      "Hi {{first_name}}, impressed by {{company}}'s trajectory. Sent a benchmark note by email — would love to connect and compare outbound notes.",
  },
  {
    id: 'step_03_3', campaign_id: 'camp_03', step_number: 3, step_type: 'TALK_INVITE', channel: 'EMAIL', delay_days: 4, is_active: true,
    name: 'Talk to our AI link',
    description: 'Founders skip forms: a personal voice link to ask the AI about pricing and integrations.',
    talk_link_language: 'en', talk_link_expires_in_days: 7, talk_link_max_calls: 2,
    subject_template: 'Skip the deck — ask our AI directly, {{first_name}}',
    body_template:
      'Hi {{first_name}},\n\nNo deck, no form: {{talk_link}}\n\nAsk our AI assistant anything about {{org_name}} by voice; it can book a slot with a human if you want one. Private to you, valid until {{talk_link_expires}}.\n\n{{sender_name}}\n\nTo opt out of future emails, reply with unsubscribe.',
  },
  {
    id: 'step_03_4', campaign_id: 'camp_03', step_number: 4, step_type: 'MESSAGE', channel: 'EMAIL', delay_days: 8, is_active: true,
    name: 'Benchmark results',
    description: 'Delivers the benchmark comparison as a PDF link.',
    subject_template: 'The benchmark for {{company}}',
    body_template:
      'Hi {{first_name}},\n\nHere is the outbound benchmark for {{company}} against peers. Happy to discuss on a 15-minute call.\n\n{{sender_name}}\n{{org_name}}\n\nTo opt out, reply with unsubscribe.',
  },
  {
    id: 'step_03_5', campaign_id: 'camp_03', step_number: 5, step_type: 'MESSAGE', channel: 'EMAIL', delay_days: 16, is_active: true,
    name: 'Polite breakup',
    description: 'Closes the sequence politely.',
    subject_template: 'Closing the loop, {{first_name}}',
    body_template:
      'Hi {{first_name}},\n\nI will stop here. If outbound becomes a priority at {{company}}, this thread is the fastest way back to us.\n\n{{sender_name}}\n{{org_name}}',
  },
];
