/**
 * Zhipu GLM LLM Provider
 */

import type { Env } from "../../types";
import type { LLMProvider, LLMRequest, LLMResponse } from "../types";

const DEFAULT_MODEL = "GLM-4-FlashX-250414";
const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

export const zhipuProvider: LLMProvider = {
  id: "zhipu",
  name: "Zhipu GLM",

  isConfigured(env: Env): boolean {
    return !!env.GLM_API_KEY;
  },

  async call(
    request: LLMRequest,
    env: Env,
    timeoutMs = 20000
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = DEFAULT_MODEL;

    console.log(`[LLM:Zhipu] Calling ${model}...`);
    console.log(`[LLM:Zhipu] Prompt length: system=${request.systemPrompt.length}, user=${request.userPrompt.length}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[LLM:Zhipu] Timeout triggered at ${Date.now() - startTime}ms`);
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.GLM_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 2000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      console.log(`[LLM:Zhipu] Response in ${latencyMs}ms, status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Zhipu API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as {
        choices?: Array<{
          message?: { content?: string };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const content = result.choices?.[0]?.message?.content || "";
      console.log(`[LLM:Zhipu] Got response: ${content.length} chars`);

      return {
        content,
        provider: "zhipu",
        model,
        latencyMs,
        tokenUsage: result.usage ? {
          prompt: result.usage.prompt_tokens || 0,
          completion: result.usage.completion_tokens || 0,
          total: result.usage.total_tokens || 0,
        } : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Zhipu timeout after ${latencyMs}ms`);
      }
      throw error;
    }
  },
};
