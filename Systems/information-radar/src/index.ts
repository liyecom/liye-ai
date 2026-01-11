/**
 * Information OS - Main Entry Point
 * Cloudflare Workers Cron Handler
 *
 * Version: 1.0.0
 * Push Subsystem: v1.0 (Channel Router)
 */

import type { RawItem, Signal, SummaryResult } from "./types";
import type { PushEnv } from "./outputs/push/types";
import { fetchHackerNews } from "./sources/hackernews";
import { fetchProductHunt } from "./sources/producthunt";
import { filterNewItems, markAsSeen, isSeen } from "./processors/dedup";
import { processItems, summarizeItem, ProcessedSignal } from "./processors/summarizer";
import { batchPush, getChannelStatus } from "./outputs/push";
import { storeSignalWithSummary } from "./storage/signal-store";
import { determineCronType, handleDailyDigestCron, handleWeeklyDigestCron } from "./cron/router";

// 合并 Env 类型
interface Env extends PushEnv {
  SEEN_ITEMS: KVNamespace;
  // V2.0 KV namespaces (optional until created)
  SIGNAL_STORE?: KVNamespace;
  DIGEST_HISTORY?: KVNamespace;
  // LLM API keys (at least one required)
  GLM_API_KEY?: string;      // Zhipu GLM-4 (recommended)
  GEMINI_API_KEY?: string;   // Google Gemini (backup)
  PH_ACCESS_TOKEN: string;
  HN_RSS_URL: string;
  PUSH_THRESHOLD: string;
  MAX_ITEMS_PER_PUSH: string;
  MERGE_WINDOW_MINUTES: string;
  // V2.0 Config
  ENABLE_REALTIME_PUSH?: string;
  DAILY_DIGEST_ENABLED?: string;
  WEEKLY_DIGEST_ENABLED?: string;
  // Enterprise WeChat App (v2.0)
  WECOM_CORPID?: string;
  WECOM_AGENT_ID?: string;
  WECOM_SECRET?: string;
  WECOM_APP_TOUSER?: string;
}

export default {
  /**
   * Scheduled cron handler
   * V2.0: Routes to ingestion, daily digest, or weekly digest
   */
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const cronType = determineCronType(controller.cron);
    console.log(`[Information OS] Cron triggered: ${controller.cron} (${cronType}) at ${new Date().toISOString()}`);

    // V2.0: Route to appropriate handler
    if (cronType === "daily_digest") {
      await handleDailyDigestCron(env);
      return;
    }

    if (cronType === "weekly_digest") {
      await handleWeeklyDigestCron(env);
      return;
    }

    // Default: ingestion

    try {
      // 1. Fetch from all sources in parallel
      const [hnItems, phItems] = await Promise.allSettled([
        fetchHackerNews(env),
        fetchProductHunt(env),
      ]);

      const allItems: RawItem[] = [];

      if (hnItems.status === "fulfilled") {
        allItems.push(...hnItems.value);
        console.log(`[HN] Fetched ${hnItems.value.length} items`);
      } else {
        console.error(`[HN] Fetch failed:`, hnItems.reason);
      }

      if (phItems.status === "fulfilled") {
        allItems.push(...phItems.value);
        console.log(`[PH] Fetched ${phItems.value.length} items`);
      } else {
        console.error(`[PH] Fetch failed:`, phItems.reason);
      }

      if (allItems.length === 0) {
        console.log("[Information OS] No items fetched, exiting");
        return;
      }

      // 2. Filter out already seen items
      const allNewItems = await filterNewItems(allItems, env);
      console.log(`[Dedup] ${allNewItems.length} new items (${allItems.length - allNewItems.length} duplicates)`);

      if (allNewItems.length === 0) {
        console.log("[Information OS] No new items, exiting");
        return;
      }

      // 3. Limit items per run to avoid Workers timeout (30s limit)
      // Process max 5 items per cron, rest will be picked up next run
      const MAX_ITEMS_PER_RUN = 5;
      const newItems = allNewItems.slice(0, MAX_ITEMS_PER_RUN);
      if (allNewItems.length > MAX_ITEMS_PER_RUN) {
        console.log(`[Throttle] Processing ${newItems.length} of ${allNewItems.length} items (rest next run)`);
      }

      // 4. Process with LLM (summarize + score)
      const processedSignals = await processItems(newItems, env);
      console.log(`[Summarizer] ${processedSignals.length} items passed threshold`);

      // 4. Mark all fetched items as seen (including below-threshold)
      await markAsSeen(newItems, env);

      // 5. V2.0: Store signals in SIGNAL_STORE (for digest generation)
      if (processedSignals.length > 0 && env.SIGNAL_STORE) {
        for (const ps of processedSignals) {
          await storeSignalWithSummary(
            ps.signal,
            ps.itemId,
            ps.keyPoints,
            ps.targetAudience,
            env
          );
        }
        console.log(`[SignalStore] Stored ${processedSignals.length} signals`);
      }

      // 6. Push signals via Channel Router (P0-4: 自动合并/降噪)
      // V2.0: Only push if realtime push is enabled (default: false)
      const enableRealtimePush = env.ENABLE_REALTIME_PUSH === "true";
      const signals = processedSignals.map((ps) => ps.signal);

      if (signals.length > 0 && enableRealtimePush) {
        const result = await batchPush(signals, env);
        console.log(
          `[Push] ${result.success ? "Success" : "Failed"} via ${result.channel}: ` +
          `${result.sentCount} sent, ${result.failedCount} failed`
        );
        if (result.errors) {
          console.error(`[Push] Errors:`, result.errors);
        }
      } else if (signals.length > 0 && !enableRealtimePush) {
        console.log(`[Push] Realtime push disabled, ${signals.length} signals stored for digest`);
      }

      console.log(`[Information OS] Completed successfully`);
    } catch (error) {
      console.error(`[Information OS] Fatal error:`, error);
      throw error;
    }
  },

  /**
   * HTTP handler for manual trigger / health check / admin API
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Enterprise WeChat domain verification
    if (url.pathname === "/WW_verify_bF9GMgkOoyfqpp0f.txt") {
      return new Response("bF9GMgkOoyfqpp0f", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Health check
    if (url.pathname === "/health") {
      const channelStatus = await getChannelStatus(env);
      return new Response(
        JSON.stringify({
          status: "ok",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
          push: {
            channels: channelStatus,
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Push channel status
    if (url.pathname === "/push/status") {
      const channelStatus = await getChannelStatus(env);
      return new Response(
        JSON.stringify({
          channels: channelStatus,
          priority: env.PUSH_CHANNEL_PRIORITY || "wechat_test,wecom_bot,pushplus",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Manual trigger (for testing)
    if (url.pathname === "/trigger" && request.method === "POST") {
      ctx.waitUntil(
        this.scheduled(
          { scheduledTime: Date.now(), cron: "manual" } as ScheduledController,
          env,
          ctx
        )
      );

      return new Response(
        JSON.stringify({
          status: "triggered",
          message: "Manual trigger started",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Test push (send a test message)
    if (url.pathname === "/push/test" && request.method === "POST") {
      const testSignal: Signal = {
        // V0 fields
        source: "hacker_news",
        title: "Test Message from Information OS",
        summary_zh: "这是一条测试消息，用于验证推送通道是否正常工作。",
        value_score: 5,
        link: "https://github.com/liyecom/liye-os",
        detected_at: new Date().toISOString(),
        // V2.0 fields (Patch 1: Score Calibration)
        score_confidence: 1.0,
        score_breakdown: {
          innovation: 5,
          relevance: 5,
          actionability: 5,
          signal_strength: 5,
          timeliness: 5,
        },
        score_reasoning: "测试消息，所有维度满分",
        feedback_count: 0,
      };

      const result = await batchPush([testSignal], env);

      return new Response(
        JSON.stringify({
          status: result.success ? "success" : "failed",
          result,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Debug endpoint - test each processing stage
    if (url.pathname === "/debug" && request.method === "GET") {
      const stages: Record<string, unknown> = {};

      // Stage 1: Test HN fetch
      try {
        const hnItems = await fetchHackerNews(env);
        stages.hn_fetch = {
          success: true,
          count: hnItems.length,
          sample: hnItems.slice(0, 3).map((i) => ({ id: i.id, title: i.title })),
        };
      } catch (e) {
        stages.hn_fetch = { success: false, error: String(e) };
      }

      // Stage 2: Test PH fetch
      try {
        const phItems = await fetchProductHunt(env);
        stages.ph_fetch = {
          success: true,
          count: phItems.length,
          sample: phItems.slice(0, 3).map((i) => ({ id: i.id, title: i.title })),
        };
      } catch (e) {
        stages.ph_fetch = { success: false, error: String(e) };
      }

      // Stage 3: Check dedup status for a sample item
      try {
        const hnItems = await fetchHackerNews(env);
        if (hnItems.length > 0) {
          const sampleId = hnItems[0].id;
          const seen = await isSeen(sampleId, env);
          stages.dedup_check = {
            success: true,
            sample_id: sampleId,
            already_seen: seen,
          };
        }
      } catch (e) {
        stages.dedup_check = { success: false, error: String(e) };
      }

      // Stage 4: Test LLM API with a sample item
      try {
        const testItem: RawItem = {
          id: "debug_test",
          title: "Debug Test: AI Coding Assistant",
          link: "https://example.com",
          source: "hacker_news",
        };
        const summary = await summarizeItem(testItem, env);
        stages.llm_api = {
          success: true,
          provider: env.GLM_API_KEY ? "zhipu" : "gemini",
          summary: summary.summary_zh,
          score: summary.value_score,
        };
      } catch (e) {
        stages.llm_api = { success: false, error: String(e) };
      }

      // Stage 5: Check secrets presence
      stages.secrets = {
        GLM_API_KEY: env.GLM_API_KEY ? "set" : "missing",
        GEMINI_API_KEY: env.GEMINI_API_KEY ? "set" : "missing",
        PH_ACCESS_TOKEN: env.PH_ACCESS_TOKEN ? "set" : "missing",
        WECHAT_APPID: env.WECHAT_APPID ? "set" : "missing",
        WECHAT_SECRET: env.WECHAT_SECRET ? "set" : "missing",
        WECHAT_TEMPLATE_ID: env.WECHAT_TEMPLATE_ID ? "set" : "missing",
      };

      return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        stages,
      }, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Registry management - GET to view, POST to update
    if (url.pathname === "/registry") {
      const { getRegistry, updateRegistry } = await import("./outputs/push/registry");

      if (request.method === "GET") {
        const registry = await getRegistry(env);
        return new Response(JSON.stringify(registry, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (request.method === "POST") {
        try {
          const body = await request.json() as { wechat_test?: { core: string[]; extended: string[]; inactive: string[] } };
          const registry = await getRegistry(env);

          if (body.wechat_test) {
            registry.wechat_test = body.wechat_test;
          }

          await updateRegistry(env, registry);
          return new Response(JSON.stringify({
            status: "updated",
            registry,
          }, null, 2), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({
            error: String(e),
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    // V2.0: Digest preview endpoint
    if (url.pathname === "/digest/preview" && request.method === "GET") {
      const { generateTodayDigest } = await import("./generators/daily-digest");
      const { generateCurrentWeekDigest } = await import("./generators/weekly-digest");

      const type = url.searchParams.get("type") || "daily";

      try {
        let result;
        if (type === "weekly") {
          result = await generateCurrentWeekDigest(env);
        } else {
          result = await generateTodayDigest(env);
        }

        return new Response(JSON.stringify({
          type,
          markdown: result.markdown,
          messages: result.messages,  // V2.1: Multi-message array for mobile
          message_stats: result.messages.map((m, i) => ({
            index: i + 1,
            chars: m.length,
            bytes: new TextEncoder().encode(m).length,
          })),
          record: result.record ? {
            digest_id: result.record.digest_id,
            signals_count: result.record.signals.length,
            themes: result.record.themes,
            generation_time_ms: result.record.generation_time_ms,
            content_length: result.record.content_length,
          } : null,
        }, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({
          error: String(e),
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // V2.0: View today's signals
    if (url.pathname === "/signals/today" && request.method === "GET") {
      const { getTodaySignals } = await import("./storage/signal-store");

      try {
        const signals = await getTodaySignals(env);
        return new Response(JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          count: signals.length,
          signals: signals.map((s) => ({
            id: s.id,
            title: s.title,
            source: s.source,
            value_score: s.value_score,
            score_breakdown: s.score_breakdown,
            score_confidence: s.score_confidence,
          })),
        }, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({
          error: String(e),
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // V2.0: Signal statistics
    if (url.pathname === "/signals/stats" && request.method === "GET") {
      const { getSignalStats } = await import("./storage/signal-store");

      const days = parseInt(url.searchParams.get("days") || "7");
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);

      try {
        const stats = await getSignalStats(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0],
          env
        );

        return new Response(JSON.stringify({
          period: `${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`,
          ...stats,
        }, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({
          error: String(e),
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // V2.0: Trigger daily digest manually
    if (url.pathname === "/digest/trigger" && request.method === "POST") {
      const type = url.searchParams.get("type") || "daily";

      ctx.waitUntil(
        (async () => {
          if (type === "weekly") {
            await handleWeeklyDigestCron(env);
          } else {
            await handleDailyDigestCron(env);
          }
        })()
      );

      return new Response(JSON.stringify({
        status: "triggered",
        type,
        message: `${type} digest generation started`,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        name: "Information OS",
        version: "2.0.0",
        push_subsystem: "v2.0",
        features: {
          digest_mode: "Intelligent daily/weekly digest generation",
          score_calibration: "5-dimension scoring with confidence",
          channels: ["wechat_test", "wecom_bot", "wecom_app", "pushplus"],
        },
        endpoints: {
          "/health": "GET - Health check with channel status",
          "/trigger": "POST - Manual ingestion trigger",
          "/push/status": "GET - Push channel status",
          "/push/test": "POST - Send test message",
          "/debug": "GET - Debug each processing stage",
          "/registry": "GET/POST - View or update push registry",
          "/digest/preview": "GET - Preview digest (?type=daily|weekly)",
          "/digest/trigger": "POST - Trigger digest generation (?type=daily|weekly)",
          "/signals/today": "GET - View today's signals",
          "/signals/stats": "GET - Signal statistics (?days=7)",
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  },
};
