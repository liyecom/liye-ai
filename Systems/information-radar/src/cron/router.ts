/**
 * Cron Router
 * V2.0: Routes cron triggers to appropriate handlers
 *
 * Cron Schedule:
 * - "* /5 * * * *"  → Signal ingestion (every 5 minutes)
 * - "0 23 * * *"    → Daily digest (UTC 23:00 = Beijing 7:00)
 * - "0 0 * * 1"     → Weekly digest (Monday UTC 00:00 = Beijing 8:00)
 */

import type { Env } from "../types";
import type { PushEnv } from "../outputs/push/types";
import { generateTodayDigest } from "../generators/daily-digest";
import { generateCurrentWeekDigest } from "../generators/weekly-digest";
import { batchPush } from "../outputs/push";

/**
 * Cron job type
 */
export type CronType = "ingestion" | "daily_digest" | "weekly_digest" | "unknown";

/**
 * Determine cron type from cron expression
 */
export function determineCronType(cron: string): CronType {
  // Daily digest: "0 23 * * *" (7:00 AM Beijing)
  if (cron === "0 23 * * *") {
    return "daily_digest";
  }

  // Weekly digest: "0 0 * * 1" (Monday 8:00 AM Beijing)
  if (cron === "0 0 * * 1") {
    return "weekly_digest";
  }

  // Ingestion: "*/5 * * * *" (every 5 minutes)
  if (cron.includes("*/5") || cron === "manual") {
    return "ingestion";
  }

  return "unknown";
}

/**
 * Handle daily digest cron
 * V2.1: Multi-message push for mobile optimization
 */
export async function handleDailyDigestCron(
  env: Env & PushEnv
): Promise<void> {
  console.log("[Cron] Running daily digest generation");

  // Check if daily digest is enabled
  const enabled = env.DAILY_DIGEST_ENABLED !== "false";
  if (!enabled) {
    console.log("[Cron] Daily digest disabled, skipping");
    return;
  }

  try {
    // Generate digest - V2.1: now returns messages array
    const { messages, record } = await generateTodayDigest(env);

    if (!record) {
      console.log("[Cron] No signals for daily digest");
      return;
    }

    console.log(`[Cron] Generated daily digest: ${record.content_length} chars, ${record.signals.length} signals, ${messages.length} messages`);

    // V2.1: Push each message separately for mobile optimization
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.log(`[Cron] Pushing message ${i + 1}/${messages.length} (${msg.length} chars)`);

      // Create a digest signal for pushing
      const digestSignal = {
        source: "hacker_news" as const,
        title: `Information OS 每日简报 - ${record.date}`,
        summary_zh: msg.slice(0, 200),
        value_score: 5 as const,
        link: "",
        detected_at: new Date().toISOString(),
        score_confidence: 1.0,
        score_breakdown: {
          innovation: 5,
          relevance: 5,
          actionability: 5,
          signal_strength: 5,
          timeliness: 5,
        },
        feedback_count: 0,
      };

      const pushResult = await batchPush([digestSignal], env, {
        template: "digest",
        digestMarkdown: msg,
      });

      if (pushResult.success) {
        successCount++;
      } else {
        failCount++;
        console.error(`[Cron] Message ${i + 1} push failed:`, pushResult.errors);
      }

      // Small delay between messages
      if (i < messages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`[Cron] Daily digest push complete: ${successCount}/${messages.length} succeeded`);
  } catch (error) {
    console.error("[Cron] Daily digest failed:", error);
    throw error;
  }
}

/**
 * Handle weekly digest cron
 */
export async function handleWeeklyDigestCron(
  env: Env & PushEnv
): Promise<void> {
  console.log("[Cron] Running weekly digest generation");

  // Check if weekly digest is enabled
  const enabled = env.WEEKLY_DIGEST_ENABLED !== "false";
  if (!enabled) {
    console.log("[Cron] Weekly digest disabled, skipping");
    return;
  }

  try {
    // Generate digest
    const { markdown, record } = await generateCurrentWeekDigest(env);

    if (!record) {
      console.log("[Cron] No signals for weekly digest");
      return;
    }

    console.log(`[Cron] Generated weekly digest: ${record.content_length} chars, ${record.signals.length} signals`);

    // Push digest via channels
    const digestSignal = {
      source: "hacker_news" as const,
      title: `Information OS 周报 - ${record.date}`,
      summary_zh: markdown.slice(0, 500) + "...",
      value_score: 5 as const,
      link: "",
      detected_at: new Date().toISOString(),
      score_confidence: 1.0,
      score_breakdown: {
        innovation: 5,
        relevance: 5,
        actionability: 5,
        signal_strength: 5,
        timeliness: 5,
      },
      feedback_count: 0,
    };

    const pushResult = await batchPush([digestSignal], env, {
      template: "digest",
      digestMarkdown: markdown,
    });

    console.log(`[Cron] Weekly digest push: ${pushResult.success ? "Success" : "Failed"}`);
  } catch (error) {
    console.error("[Cron] Weekly digest failed:", error);
    throw error;
  }
}
