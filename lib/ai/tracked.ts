import { CompletionOptions, CompletionResult, LLMProvider } from './provider';
import { DemoAIProvider } from './demo-provider';
import { getAIProvider } from './groq';
import { getDemoStore } from '../store/demo-store';

/**
 * Wraps the configured LLM provider so every call is written to the store as an AIRun
 * (tokens, list-price cost, latency, model) and counted against the organisation's monthly
 * AI budget. When the budget is exhausted the wrapper degrades to the offline simulator and
 * logs the circuit-breaker trip — the app keeps working at ₹0.
 */
export class TrackedAIProvider implements LLMProvider {
  public name: string;

  constructor(
    private readonly inner: LLMProvider,
    private readonly agentName: string,
    private readonly leadId?: string
  ) {
    this.name = inner.name;
  }

  private budgetExhausted(): boolean {
    const org = getDemoStore().org;
    return org.monthly_ai_budget > 0 && org.ai_budget_spent_current_month >= org.monthly_ai_budget;
  }

  private record(result: CompletionResult, success: boolean, error?: string) {
    const store = getDemoStore();
    store.recordAIRun({
      lead_id: this.leadId,
      agent_name: this.agentName,
      provider: result.simulated ? 'OFFLINE_SIMULATOR' : 'GROQ',
      model: result.model,
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
      total_tokens: result.totalTokens,
      estimated_cost_usd: result.estimatedCostUsd,
      latency_ms: result.latencyMs,
      success,
      error_message: error,
    });
  }

  public async generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult> {
    let provider = this.inner;
    if (this.budgetExhausted() && !(provider instanceof DemoAIProvider)) {
      const store = getDemoStore();
      store.recordAuditLog(
        'SYSTEM_WORKER',
        'AI_BUDGET_CIRCUIT_BREAKER',
        'organization',
        store.org.id,
        `Monthly AI budget of $${store.org.monthly_ai_budget} reached — ${this.agentName} ran on the offline simulator.`
      );
      provider = new DemoAIProvider();
    }
    try {
      const result = await provider.generateCompletion(prompt, options);
      this.record(result, true);
      return result;
    } catch (err) {
      const message = (err as Error).message;
      this.record(
        { text: '', promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0, latencyMs: 0, model: 'unknown' },
        false,
        message
      );
      throw err;
    }
  }

  public async generateStructuredJson<T>(
    prompt: string,
    schemaDescription: string,
    options?: CompletionOptions
  ): Promise<{ data: T; result: CompletionResult }> {
    let provider = this.inner;
    if (this.budgetExhausted() && !(provider instanceof DemoAIProvider)) {
      provider = new DemoAIProvider();
    }
    try {
      const out = await provider.generateStructuredJson<T>(prompt, schemaDescription, options);
      this.record(out.result, true);
      return out;
    } catch (err) {
      const message = (err as Error).message;
      this.record(
        { text: '', promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0, latencyMs: 0, model: 'unknown' },
        false,
        message
      );
      throw err;
    }
  }
}

export function getTrackedAI(agentName: string, leadId?: string): LLMProvider {
  return new TrackedAIProvider(getAIProvider(), agentName, leadId);
}
