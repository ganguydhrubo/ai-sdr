import type { AITask } from '../types';

export interface CompletionOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /** Which specialised prompt this is — the offline provider answers in the matching shape. */
  task?: AITask;
  /** Prior conversation turns (voice agent, inbox replies). */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface CompletionResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  model: string;
  /** True when the answer came from the offline simulator rather than a live model. */
  simulated?: boolean;
}

export interface LLMProvider {
  name: string;
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;
  generateStructuredJson<T>(prompt: string, schemaDescription: string, options?: CompletionOptions): Promise<{ data: T; result: CompletionResult }>;
}

/**
 * Pulls the first JSON object out of a model reply, tolerating ```json fences and prose around it.
 */
export function extractJsonObject(text: string): string | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}
