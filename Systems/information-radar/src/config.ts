/**
 * Information OS - Configuration
 */

import type { Env } from "./types";

export function getConfig(env: Env) {
  return {
    // Data sources
    hn: {
      rssUrl: env.HN_RSS_URL || "https://hnrss.org/frontpage",
      maxItems: 30, // Max items to fetch per poll
    },

    ph: {
      apiUrl: "https://api.producthunt.com/v2/api/graphql",
      maxItems: 20,
    },

    // Processing
    pushThreshold: parseInt(env.PUSH_THRESHOLD || "3", 10) as 1 | 2 | 3 | 4 | 5,

    // Output
    maxItemsPerPush: parseInt(env.MAX_ITEMS_PER_PUSH || "3", 10),
    mergeWindowMinutes: parseInt(env.MERGE_WINDOW_MINUTES || "10", 10),

    // Dedup
    seenItemTTL: 60 * 60 * 24 * 7, // 7 days in seconds

    // LLM Provider
    llm: {
      provider: "zhipu" as const, // "zhipu" | "gemini"
      zhipu: {
        model: "GLM-4-FlashX-250414",  // 用户验证可用的模型
        apiUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      },
      gemini: {
        model: "gemini-1.5-flash",
        apiUrl: "https://generativelanguage.googleapis.com/v1beta/models",
      },
    },

    // PushPlus
    pushplus: {
      apiUrl: "https://www.pushplus.plus/send",
    },
  };
}

export type Config = ReturnType<typeof getConfig>;
