import { CompletionOptions, CompletionResult, LLMProvider, extractJsonObject } from './provider';
import { DemoAIProvider } from './demo-provider';
import { SDR_SYSTEM_PROMPT } from './prompts/sdr-system-prompt';

/** Models on Groq's free tier, in fallback order (checked against /openai/v1/models on 2026-09-22). */
export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b';
export const GROQ_FALLBACK_MODELS = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

/** List-price equivalents in USD per 1M tokens — the free tier bills ₹0; these feed the budget breaker. */
const MODEL_PRICING_USD_PER_M: Record<string, { input: number; output: number }> = {
  'openai/gpt-oss-120b': { input: 0.15, output: 0.6 },
  'openai/gpt-oss-20b': { input: 0.075, output: 0.3 },
  'qwen/qwen3.8-27b': { input: 0.29, output: 0.59 },
};

export function isGroqConfigured(): boolean {
  return process.env.DEMO_MODE !== 'true' && !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_');
}

export function getAIRuntimeInfo(): { live: boolean; provider: string; model: string; reason: string } {
  if (process.env.DEMO_MODE === 'true') {
    return { live: false, provider: 'offline-simulator', model: 'offline-simulator', reason: 'DEMO_MODE=true' };
  }
  if (!isGroqConfigured()) {
    return { live: false, provider: 'offline-simulator', model: 'offline-simulator', reason: 'GROQ_API_KEY not set' };
  }
  return {
    live: true,
    provider: 'groq',
    model: process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
    reason: 'Groq free tier (OpenAI-compatible API)',
  };
}

export class GroqProvider implements LLMProvider {
  public name = 'GroqProvider (GPT-OSS-120B / GPT-OSS-20B / Qwen3.8-27B)';
  private apiKey?: string;
  private defaultModel: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY;
    this.defaultModel = model || process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
  }

  public async generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult> {
    // If no API key is provided or DEMO_MODE is true, degrade gracefully to DemoAIProvider
    if (!this.apiKey || process.env.DEMO_MODE === 'true') {
      const demo = new DemoAIProvider();
      return demo.generateCompletion(prompt, options);
    }

    const startTime = Date.now();
    const systemPrompt = options?.systemPrompt || SDR_SYSTEM_PROMPT;
    const modelsToTry = Array.from(new Set([this.defaultModel, ...GROQ_FALLBACK_MODELS]));
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(options?.history || []).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: prompt },
    ];

    let lastError = '';
    for (const modelName of modelsToTry) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: options?.temperature ?? 0.2,
            max_tokens: options?.maxTokens ?? 1024,
            response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
          }),
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          lastError = `${modelName} → HTTP ${response.status} ${detail.slice(0, 200)}`;
          console.warn(`Groq model ${modelName} returned status ${response.status}`);
          continue;
        }

        const json = await response.json();
        const choice = json.choices?.[0];
        const text: string = choice?.message?.content || '';
        const promptTokens = json.usage?.prompt_tokens || 0;
        const completionTokens = json.usage?.completion_tokens || 0;
        const totalTokens = json.usage?.total_tokens || promptTokens + completionTokens;

        const pricing = MODEL_PRICING_USD_PER_M[modelName] || { input: 0.15, output: 0.6 };
        const estimatedCostUsd = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
        const latencyMs = Date.now() - startTime;

        return {
          text,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
          latencyMs,
          model: modelName,
          simulated: false,
        };
      } catch (err) {
        lastError = `${modelName} → ${(err as Error).message}`;
        console.warn(`Attempt with ${modelName} failed:`, err);
      }
    }

    // If all models failed, fall back to Demo Provider
    console.warn(`All Groq models failed or rate limited (${lastError}), falling back to Demo Provider`);
    const fallback = new DemoAIProvider();
    return fallback.generateCompletion(prompt, options);
  }

  public async generateStructuredJson<T>(
    prompt: string,
    schemaDescription: string,
    options?: CompletionOptions
  ): Promise<{ data: T; result: CompletionResult }> {
    const fullPrompt = `${prompt}\n\nStrictly respond with a single valid JSON object (no prose, no markdown) adhering to the schema:\n${schemaDescription}`;
    const result = await this.generateCompletion(fullPrompt, { ...options, jsonMode: true });
    try {
      const json = extractJsonObject(result.text) || result.text;
      const parsed = JSON.parse(json) as T;
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
