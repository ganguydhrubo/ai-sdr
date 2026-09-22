import { CompletionOptions, CompletionResult, LLMProvider } from './provider';
import { DemoAIProvider } from './demo-provider';
import { SDR_SYSTEM_PROMPT } from './prompts/sdr-system-prompt';

export class GroqProvider implements LLMProvider {
  public name = 'GroqProvider (Llama-3.3-70B)';
  private apiKey?: string;
  private defaultModel: string;

  constructor(apiKey?: string, model = 'llama-3.3-70b-versatile') {
    this.apiKey = apiKey || process.env.GROQ_API_KEY;
    this.defaultModel = model;
  }

  public async generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult> {
    // If no API key is provided or DEMO_MODE is true, degrade gracefully to DemoAIProvider
    if (!this.apiKey || process.env.DEMO_MODE === 'true') {
      const demo = new DemoAIProvider();
      return demo.generateCompletion(prompt, options);
    }

    const startTime = Date.now();
    const systemPrompt = options?.systemPrompt || SDR_SYSTEM_PROMPT;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 1024,
          response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API returned status ${response.status}: ${await response.text()}`);
      }

      const json = await response.json();
      const choice = json.choices?.[0];
      const text = choice?.message?.content || '';
      const promptTokens = json.usage?.prompt_tokens || 0;
      const completionTokens = json.usage?.completion_tokens || 0;
      const totalTokens = json.usage?.total_tokens || promptTokens + completionTokens;

      // Approximate cost for Groq Llama-3.3-70B: ~$0.59 / 1M prompt, $0.79 / 1M completion
      const estimatedCostUsd = (promptTokens * 0.59 + completionTokens * 0.79) / 1_000_000;
      const latencyMs = Date.now() - startTime;

      return {
        text,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
        latencyMs,
        model: this.defaultModel,
      };
    } catch (error) {
      console.warn('Groq API call failed or rate limited, falling back to Demo Provider:', error);
      const fallback = new DemoAIProvider();
      return fallback.generateCompletion(prompt, options);
    }
  }

  public async generateStructuredJson<T>(
    prompt: string,
    schemaDescription: string,
    options?: CompletionOptions
  ): Promise<{ data: T; result: CompletionResult }> {
    const fullPrompt = `${prompt}\n\nStrictly respond with a valid JSON object adhering to the schema:\n${schemaDescription}`;
    const result = await this.generateCompletion(fullPrompt, { ...options, jsonMode: true });
    try {
      const parsed = JSON.parse(result.text) as T;
      return { data: parsed, result };
    } catch {
      // If parsing fails, use Demo fallback
      const demo = new DemoAIProvider();
      return demo.generateStructuredJson<T>(prompt, schemaDescription, options);
    }
  }
}

/**
 * AI Provider Factory
 */
export function getAIProvider(): LLMProvider {
  const providerType = process.env.LLM_PROVIDER || 'groq';

  if (process.env.DEMO_MODE === 'true' || !process.env.GROQ_API_KEY) {
    return new DemoAIProvider();
  }

  if (providerType === 'groq') {
    return new GroqProvider();
  }

  return new DemoAIProvider();
}
