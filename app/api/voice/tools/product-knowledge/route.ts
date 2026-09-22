import { NextRequest, NextResponse } from 'next/server';
import { verifyToolSecret } from '@/lib/voice/tool-auth';
import { ProductKnowledgeRequestSchema } from '@/lib/voice/schemas';

const KNOWLEDGE_BASE: Array<{ keywords: string[]; answer: string; source: string }> = [
  {
    keywords: ['pricing', 'cost', 'commercial', 'price', 'tier'],
    answer:
      'Apex Technologies offers transparent SaaS pricing tailored for Indian B2B organizations starting at INR 45,000 per month for growth teams and INR 1,20,000 for enterprise deployments with dedicated Indian DLT registration support and custom CRM integrations.',
    source: 'Commercial Pricing Guide 2026',
  },
  {
    keywords: ['crm', 'salesforce', 'zoho', 'hubspot', 'integration'],
    answer:
      'ApexSDR natively integrates bi-directionally with Zoho CRM, Salesforce, HubSpot, and LeadSquared. Leads, stages, call transcripts, and meeting bookings sync automatically with zero manual rep data entry.',
    source: 'Integrations & CRM Ecosystem Whitepaper',
  },
  {
    keywords: ['compliance', 'trai', 'dnd', 'dpdp', 'dlt', 'legal'],
    answer:
      'Apex SDR enforces 100% TRAI, DPDP Act 2023, and TCCCPR compliance. We operate strict 09:00 to 21:00 IST calling windows, mandatory AI voice disclosures, National DND scrubbing, and verified 140/1600 series commercial numbering.',
    source: 'Enterprise Compliance & TRAI Regulations Manual',
  },
  {
    keywords: ['whatsapp', 'evolution', 'baileys', 'meta'],
    answer:
      'Our platform features a dual-mode WhatsApp engine supporting both Meta Cloud API templates and direct Baileys WebSocket protocol with automated pairing QR codes, smart jitter delay pacing, and automated intent classification.',
    source: 'Multi-Channel Architecture Specs',
  },
];

export async function POST(req: NextRequest) {
  if (!verifyToolSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid X-Tool-Secret' }, { status: 401 });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = ProductKnowledgeRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const query = parsed.data.query.toLowerCase();
    const match = KNOWLEDGE_BASE.find((k) =>
      k.keywords.some((kw) => query.includes(kw))
    );

    if (match) {
      return NextResponse.json({
        answer: match.answer,
        sources: [match.source],
        confidence: 0.95,
      });
    }

    return NextResponse.json({
      answer:
        'Apex Technologies provides an autonomous AI Sales Development Representative platform designed specifically for Indian enterprise sales teams, orchestrating enrichment, multi-channel outreach, and compliant voice scheduling.',
      sources: ['Apex Overview Sheet'],
      confidence: 0.88,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error processing knowledge query' },
      { status: 500 }
    );
  }
}
