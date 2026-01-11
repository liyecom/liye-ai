/**
 * LLM Module
 * Multi-provider LLM routing with automatic fallback
 *
 * Usage:
 *   import { callLLMSimple } from "./llm";
 *   const response = await callLLMSimple(systemPrompt, userPrompt, env);
 *
 * Provider Priority:
 *   1. Gemini (default) - Fast global response
 *   2. Zhipu - China-based, may timeout from global edge
 *
 * Configuration:
 *   Set GEMINI_API_KEY and/or GLM_API_KEY in environment
 */

export { callLLM, callLLMSimple, getConfiguredProviders, DEFAULT_PRIORITY } from "./router";
export type {
  LLMProviderId,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMError,
  LLMRouterResult,
} from "./types";
