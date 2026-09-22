export interface CompletionOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface CompletionResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  model: string;
}

export interface LLMProvider {
  name: string;
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;
  generateStructuredJson<T>(prompt: string, schemaDescription: string, options?: CompletionOptions): Promise<{ data: T; result: CompletionResult }>;
}
