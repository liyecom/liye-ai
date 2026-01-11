/**
 * LLM Provider Types
 * Multi-provider architecture with automatic fallback
 */

import type { Env } from "../types";

/**
 * LLM provider identifier
 */
export type LLMProviderId = "gemini" | "zhipu" | "openai" | "anthropic";

/**
 * LLM request parameters
 */
export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

/**
 * LLM response
 */
export interface LLMResponse {
  content: string;
  provider: LLMProviderId;
  model: string;
  latencyMs: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * LLM provider error
 */
export interface LLMError {
  provider: LLMProviderId;
  error: string;
  isTimeout: boolean;
  latencyMs: number;
}

/**
 * LLM provider interface
 */
export interface LLMProvider {
  id: LLMProviderId;
  name: string;

  /**
   * Check if provider is configured (has API key)
   */
  isConfigured(env: Env): boolean;

  /**
   * Call the LLM API
   */
  call(request: LLMRequest, env: Env, timeoutMs?: number): Promise<LLMResponse>;
}

/**
 * LLM router result
 */
export interface LLMRouterResult {
  success: boolean;
  response?: LLMResponse;
  errors: LLMError[];
  totalLatencyMs: number;
}
