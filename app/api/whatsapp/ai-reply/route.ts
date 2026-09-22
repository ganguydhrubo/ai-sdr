import { NextResponse } from 'next/server';
import { getTrackedAI } from '@/lib/ai/tracked';
import { getDemoStore } from '@/lib/store/demo-store';

export const dynamic = 'force-dynamic';

/** WhatsApp Hub "AI brain" sandbox: classifies an inbound objection and drafts the reply (metered like every AI call). */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prospectMessage, prospectName, prospectCompany } = body;

    if (!prospectMessage) {
      return NextResponse.json(
        { success: false, error: 'prospectMessage is required' },
        { status: 400 }
      );
    }

    const store = getDemoStore();
    const lead = store.leads.find((l) => l.full_name === prospectName);
    const ai = getTrackedAI('WhatsAppBrainAgent', lead?.id);
    const first = String(prospectName || 'the prospect').split(' ')[0];
    const prompt = `You are an enterprise AI SDR for B2B sales automation (${store.org.name}).
A prospect (${prospectName || 'the prospect'}${prospectCompany ? `, at ${prospectCompany}` : ''}) just sent this WhatsApp message to your business number:
"${prospectMessage}"
The prospect's first name is ${first}.

INSTRUCTIONS FOR AI BRAIN:
1. Determine their intent: "OBJECTION_HANDLING", "REQUEST_PRICING", "REQUEST_DEMO", "TECHNICAL_QUERY", "UNSUBSCRIBE" or "NOT_INTERESTED".
2. Formulate a consultative, professional, and respectful reply in warm Indian English / Hinglish business style.
3. Address their specific objection or question concisely (under 60 words).
4. Propose a brief 15-minute discovery call as the natural next step (never after an unsubscribe).
5. Format your output strictly as valid JSON:
{"intent": "OBJECTION_HANDLING", "reply": "string"}`;

    const res = await ai.generateStructuredJson<{ intent: string; reply: string }>(
      prompt,
      '{"intent": string, "reply": string}',
      { task: 'whatsapp_reply', temperature: 0.6, maxTokens: 300 }
    );

    return NextResponse.json({
      success: true,
      data: res.data?.reply
        ? res.data
        : {
            intent: 'OBJECTION_HANDLING',
            reply: `Understood ${first}. Most sales teams we partner with started with manual spreadsheets. ${store.org.name.split(' ')[0]} automates repetitive follow-ups so your reps focus purely on qualified leads. Would 15 minutes this Thursday work for a quick benchmark preview?`,
          },
      model: res.result.model,
      simulated: !!res.result.simulated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'AI Brain synthesis failed' },
      { status: 500 }
    );
  }
}
