import { NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/groq';

export const dynamic = 'force-dynamic';

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

    const ai = getAIProvider();
    const prompt = `You are an enterprise AI SDR for Indian B2B sales automation (ApexSDR).
A prospect (${prospectName || 'Rajesh Sharma'}, VP Sales at ${prospectCompany || 'Bharat Forgings Ltd'}) just sent this WhatsApp message to your business number:
"${prospectMessage}"

INSTRUCTIONS FOR AI BRAIN:
1. Determine their intent: "OBJECTION_HANDLING", "REQUEST_PRICING", "REQUEST_DEMO", "TECHNICAL_QUERY", or "NOT_INTERESTED".
2. Formulate a consultative, professional, and respectful reply in warm Indian English / Hinglish business style.
3. Address their specific objection or question concisely (under 60 words).
4. Propose a brief 15-minute discovery call as the natural next step.
5. Format your output strictly as valid JSON:
{"intent": "OBJECTION_HANDLING", "reply": "string"}`;

    const res = await ai.generateStructuredJson<{ intent: string; reply: string }>(
      prompt,
      '{"intent": string, "reply": string}'
    );

    return NextResponse.json({
      success: true,
      data: res.data || {
        intent: 'OBJECTION_HANDLING',
        reply: `Understood ${prospectName || 'Sir'}. Most sales teams we partner with started with manual spreadsheets. Apex automates repetitive follow-ups so your reps focus purely on qualified leads. Would 15 minutes this Thursday work for a quick benchmark preview?`,
      },
      model: 'llama-3.3-70b-versatile',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'AI Brain synthesis failed' },
      { status: 500 }
    );
  }
}
