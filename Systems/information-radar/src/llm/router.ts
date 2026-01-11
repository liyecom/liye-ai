/**
 * LLM Router
 * Multi-provider routing with automatic fallback
 */

import type { Env } from "../types";
import type {
  LLMProvider,
  LLMProviderId,
  LLMRequest,
  LLMResponse,
  LLMError,
  LLMRouterResult,
} from "./types";
import { geminiProvider } from "./providers/gemini";
import { zhipuProvider } from "./providers/zhipu";

/**
 * All registered LLM providers
 */
const PROVIDERS: Record<LLMProviderId, LLMProvider> = {
  gemini: geminiProvider,
  zhipu: zhipuProvider,
  // Future: add openai, anthropic, etc.
  openai: geminiProvider, // placeholder
  anthropic: geminiProvider, // placeholder
};

/**
 * Default provider priority order
 * Gemini first (global infrastructure, faster from Cloudflare)
 * Zhipu second (China network, may timeout from global edge)
 */
const DEFAULT_PRIORITY: LLMProviderId[] = ["gemini", "zhipu"];

/**
 * Get configured providers in priority order
 */
export function getConfiguredProviders(
  env: Env,
  priority: LLMProviderId[] = DEFAULT_PRIORITY
): LLMProvider[] {
  return priority
    .map((id) => PROVIDERS[id])
    .filter((provider) => provider && provider.isConfigured(env));
}

/**
 * Call LLM with automatic fallback
 */
export async function callLLM(
  request: LLMRequest,
  env: Env,
  options?: {
    priority?: LLMProviderId[];
    timeoutMs?: number;
  }
): Promise<LLMRouterResult> {
  const startTime = Date.now();
  const priority = options?.priority || DEFAULT_PRIORITY;
  const timeoutMs = options?.timeoutMs;

  const providers = getConfiguredProviders(env, priority);
  const errors: LLMError[] = [];

  console.log(`[LLM:Router] Configured providers: ${providers.map((p) => p.id).join(", ")}`);

  if (providers.length === 0) {
    console.error("[LLM:Router] No LLM providers configured!");
    return {
      success: false,
      errors: [{
        provider: "gemini",
        error: "No LLM providers configured (missing API keys)",
        isTimeout: false,
        latencyMs: 0,
      }],
      totalLatencyMs: Date.now() - startTime,
    };
  }

  for (const provider of providers) {
    console.log(`[LLM:Router] Trying provider: ${provider.id} (${provider.name})`);

    try {
      const response = await provider.call(request, env, timeoutMs);

      console.log(`[LLM:Router] Success via ${provider.id} in ${response.latencyMs}ms`);

      return {
        success: true,
        response,
        errors,
        totalLatencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes("timeout");
      const latencyMs = Date.now() - startTime;

      console.error(`[LLM:Router] Provider ${provider.id} failed: ${errorMessage}`);

      errors.push({
        provider: provider.id,
        error: errorMessage,
        isTimeout,
        latencyMs,
      });

      // Continue to next provider
    }
  }

  // All providers failed
  console.error(`[LLM:Router] All providers failed after ${errors.length} attempts`);

  return {
    success: false,
    errors,
    totalLatencyMs: Date.now() - startTime,
  };
}

/**
 * Call LLM and get content (simple interface)
 * Returns null if all providers fail
 */
export async function callLLMSimple(
  systemPrompt: string,
  userPrompt: string,
  env: Env,
  options?: {
    priority?: LLMProviderId[];
    timeoutMs?: number;
    responseFormat?: "text" | "json";
  }
): Promise<string | null> {
  const result = await callLLM(
    {
      systemPrompt,
      userPrompt,
      responseFormat: options?.responseFormat,
    },
    env,
    options
  );

  if (result.success && result.response) {
    return result.response.content;
  }

  return null;
}

/**
 * Export provider IDs for configuration
 */
export { DEFAULT_PRIORITY };
export type { LLMProviderId };
