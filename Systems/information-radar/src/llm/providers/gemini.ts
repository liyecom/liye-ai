/**
 * Google Gemini LLM Provider
 */

import type { Env } from "../../types";
import type { LLMProvider, LLMRequest, LLMResponse } from "../types";

const DEFAULT_MODEL = "gemini-2.0-flash-001";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const geminiProvider: LLMProvider = {
  id: "gemini",
  name: "Google Gemini",

  isConfigured(env: Env): boolean {
    return !!env.GEMINI_API_KEY;
  },

  async call(
    request: LLMRequest,
    env: Env,
    timeoutMs = 120000
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = DEFAULT_MODEL;
    const url = `${API_BASE}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    console.log(`[LLM:Gemini] Calling ${model}...`);
    console.log(`[LLM:Gemini] Prompt length: system=${request.systemPrompt.length}, user=${request.userPrompt.length}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[LLM:Gemini] Timeout triggered at ${Date.now() - startTime}ms`);
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${request.systemPrompt}\n\n${request.userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: request.temperature ?? 0.3,
            maxOutputTokens: request.maxTokens ?? 8000,
            responseMimeType: request.responseFormat === "json" ? "application/json" : "text/plain",
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      console.log(`[LLM:Gemini] Response in ${latencyMs}ms, status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string; thought?: boolean }>;
          };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      // Gemini 2.5 Pro may return thinking parts + output parts
      // Extract only non-thinking text parts
      const parts = result.candidates?.[0]?.content?.parts || [];
      let content = "";

      for (const part of parts) {
        // Skip thinking parts (they have thought: true)
        if (part.thought) {
          console.log(`[LLM:Gemini] Skipping thinking part`);
          continue;
        }
        if (part.text) {
          content += part.text;
        }
      }

      console.log(`[LLM:Gemini] Got response: ${content.length} chars (${parts.length} parts)`);

      return {
        content,
        provider: "gemini",
        model,
        latencyMs,
        tokenUsage: result.usageMetadata ? {
          prompt: result.usageMetadata.promptTokenCount || 0,
          completion: result.usageMetadata.candidatesTokenCount || 0,
          total: result.usageMetadata.totalTokenCount || 0,
        } : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Gemini timeout after ${latencyMs}ms`);
      }
      throw error;
    }
  },
};
