import { CompletionOptions, CompletionResult, LLMProvider } from './provider';

/**
 * DemoAIProvider provides high-fidelity simulated enterprise AI reasoning
 * for Indian B2B SDR workflows with zero external API dependencies or costs.
 */
export class DemoAIProvider implements LLMProvider {
  public name = 'DemoAIProvider (Simulated Groq/Llama-3)';

  public async generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult> {
    const startTime = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 300)); // realistic latency simulation

    let simulatedText = 'Thank you for reaching out. Based on your profile, we would love to schedule a brief 15-minute discovery call.';

    if (prompt.includes('score') || prompt.includes('ICP')) {
      simulatedText = JSON.stringify({
        score: 86,
        classification: 'HOT',
        reasoning: [
          'High industry match: target B2B manufacturing/tech sector',
          'Role seniority: VP/Director holds direct budget authority',
          'Tier-1 Indian metro geography fit',
        ],
        confidence: 0.91,
      });
    } else if (prompt.includes('intent') || prompt.includes('classify')) {
      const lower = prompt.toLowerCase();
      if (lower.includes('unsubscribe') || lower.includes('remove') || lower.includes('stop')) {
        simulatedText = JSON.stringify({
          intent: 'UNSUBSCRIBE',
          buying_stage: 'UNAWARE',
          sentiment: 'NEGATIVE',
          needs_human: false,
          next_action: 'UNSUBSCRIBE_LEAD',
        });
      } else if (lower.includes('pricing') || lower.includes('cost') || lower.includes('rate')) {
        simulatedText = JSON.stringify({
          intent: 'REQUEST_PRICING',
          buying_stage: 'EVALUATING',
          sentiment: 'POSITIVE',
          needs_human: true,
          next_action: 'SEND_PRICING_OVERVIEW',
        });
      } else {
        simulatedText = JSON.stringify({
          intent: 'INTERESTED',
          buying_stage: 'EVALUATING',
          sentiment: 'POSITIVE',
          needs_human: true,
          next_action: 'TRIGGER_SALES_HANDOFF',
        });
      }
    } else if (prompt.includes('personalize') || prompt.includes('outreach')) {
      simulatedText = JSON.stringify({
        email_subject: 'Streamlining B2B sales pipeline efficiency at {{company}}',
        email_body:
          'Hi {{first_name}},\n\nNoticed {{company}}\'s recent expansion in enterprise services across India. Many sales leaders we work with in the sector are cutting manual prospecting time by 60% with autonomous SDR workflows.\n\nWould you be open to a 15-minute discovery call this Thursday to explore how this fits your growth targets?\n\nBest regards,\nArjun Mehta',
        whatsapp_message:
          'Namaste {{first_name}} ji, saw {{company}}\'s strong growth in {{city}}. Would love to share a 2-page brief on how Indian enterprise sales teams are automating outbound pipelines. Best day for a quick chat?',
        linkedin_message:
          'Hi {{first_name}}, impressed by {{company}}\'s trajectory in {{city}}. Would love to connect and share notes on enterprise B2B sales development in India.',
      });
    }

    const latencyMs = Date.now() - startTime;
    return {
      text: simulatedText,
      promptTokens: 380,
      completionTokens: 140,
      totalTokens: 520,
      estimatedCostUsd: 0.000045, // Groq price simulation
      latencyMs,
      model: 'groq/llama-3.3-70b-versatile [SIMULATED]',
    };
  }

  public async generateStructuredJson<T>(
    prompt: string,
    schemaDescription: string,
    options?: CompletionOptions
  ): Promise<{ data: T; result: CompletionResult }> {
    const result = await this.generateCompletion(prompt, { ...options, jsonMode: true });
    try {
      const parsed = JSON.parse(result.text) as T;
      return { data: parsed, result };
    } catch {
      // Fallback
      return { data: {} as T, result };
    }
  }
}
