/**
 * Daily Digest Generator
 * V2.0: Generates daily tech digest with structured anchors (Patch 2)
 * V2.1: Multi-LLM provider support with automatic fallback
 */

import type { StoredSignal, DigestRecord, Env } from "../types";
import { getTodaySignals, getSignalsByDate } from "../storage/signal-store";
import { callLLMSimple } from "../llm";
import {
  DAILY_DIGEST_PROMPT,
  DAILY_DIGEST_USER_PROMPT,
  formatSignalsForPrompt,
  hashPrompt,
  PROMPT_VERSION,
} from "./prompts";

/**
 * LLM response structure for daily digest
 */
interface DailyDigestLLMResponse {
  title: string;
  date: string;
  totalCount: number;
  fullSummary: Array<{
    rank: number;
    signal_id: string;
    title: string;
    source: string;
    score: number;
    summary: string;
    link: string;
  }>;
  briefList: Array<{
    rank: number;
    signal_id: string;
    title: string;
    score: number;
    link: string;
  }>;
  themes: string[];
  insights: string;
}

/**
 * Call LLM API to generate digest (via multi-provider router)
 */
async function callLLMForDigest(
  userPrompt: string,
  systemPrompt: string,
  env: Env
): Promise<string> {
  console.log(`[DailyDigest] Calling LLM Router...`);
  console.log(`[DailyDigest] Prompt length: system=${systemPrompt.length}, user=${userPrompt.length}`);

  const response = await callLLMSimple(systemPrompt, userPrompt, env, {
    responseFormat: "json",
    timeoutMs: 120000, // 120 seconds for Gemini 3 Pro
  });

  if (!response) {
    throw new Error("All LLM providers failed");
  }

  return response;
}

/**
 * Get Beijing timezone date
 * Important: Cron runs at UTC 23:00 = Beijing 7:00 AM next day
 * So we need to use Beijing timezone for correct date
 */
function getBeijingDate(date: Date = new Date()): Date {
  // Add 8 hours to UTC to get Beijing time
  const beijingOffset = 8 * 60 * 60 * 1000; // 8 hours in ms
  return new Date(date.getTime() + beijingOffset);
}

/**
 * Format date as YYYY-MM-DD (Beijing timezone)
 */
function formatDate(date: Date): string {
  const beijing = getBeijingDate(date);
  return beijing.toISOString().split("T")[0];
}

/**
 * Get day of week in Chinese (Beijing timezone)
 */
function getDayOfWeekCN(date: Date): string {
  const beijing = getBeijingDate(date);
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return days[beijing.getUTCDay()];
}

/**
 * Format a single signal item for message
 */
function formatSignalItem(item: DailyDigestLLMResponse["fullSummary"][0]): string {
  const sourceEmoji = item.source === "hacker_news" ? "🔴" : "🚀";
  const sourceLabel = item.source === "hacker_news" ? "HN" : "PH";
  const stars = "★".repeat(item.score);

  const lines: string[] = [];
  lines.push(`**${item.rank}. ${sourceEmoji}[${sourceLabel}] ${item.title}** ${stars}`);
  lines.push("");
  lines.push(item.summary);
  lines.push("");
  lines.push(`[查看原文](${item.link})`);
  return lines.join("\n");
}

/**
 * Generate markdown messages from LLM response
 * V2.3: Returns 4 messages for mobile optimization with sequence numbers
 * - Message 1: Header + TOP 1-3
 * - Message 2: TOP 4-6
 * - Message 3: TOP 7-10
 * - Message 4: 关键词 + 趋势洞察
 *
 * Each message includes [消息 N/4] prefix for reading order when delivered in parallel
 */
function generateMarkdownMessages(response: DailyDigestLLMResponse): string[] {
  const messages: string[] = [];
  const items = response.fullSummary;
  const totalMsgs = 4; // Fixed 4-message structure

  // Message 1: Header + TOP 1-3
  const msg1Lines: string[] = [];
  msg1Lines.push(`**[消息 1/${totalMsgs}]**`);
  msg1Lines.push("");
  msg1Lines.push(`**📡 ${response.title}**`);
  msg1Lines.push(`${response.date} | 今日收录 ${response.totalCount} 条`);
  msg1Lines.push("");
  msg1Lines.push("**【今日 TOP 10 精选 · 1/3】**");
  msg1Lines.push("");

  for (const item of items.slice(0, 3)) {
    msg1Lines.push(formatSignalItem(item));
    msg1Lines.push("");
  }
  messages.push(msg1Lines.join("\n").trim());

  // Message 2: TOP 4-6
  if (items.length > 3) {
    const msg2Lines: string[] = [];
    msg2Lines.push(`**[消息 2/${totalMsgs}]**`);
    msg2Lines.push("");
    msg2Lines.push("**【今日 TOP 10 精选 · 2/3】**");
    msg2Lines.push("");

    for (const item of items.slice(3, 6)) {
      msg2Lines.push(formatSignalItem(item));
      msg2Lines.push("");
    }
    messages.push(msg2Lines.join("\n").trim());
  }

  // Message 3: TOP 7-10
  if (items.length > 6) {
    const msg3Lines: string[] = [];
    msg3Lines.push(`**[消息 3/${totalMsgs}]**`);
    msg3Lines.push("");
    msg3Lines.push("**【今日 TOP 10 精选 · 3/3】**");
    msg3Lines.push("");

    for (const item of items.slice(6, 10)) {
      msg3Lines.push(formatSignalItem(item));
      msg3Lines.push("");
    }
    messages.push(msg3Lines.join("\n").trim());
  }

  // Message 4: 关键词 + 趋势洞察 (严格只有这两项)
  const msg4Lines: string[] = [];
  msg4Lines.push(`**[消息 4/${totalMsgs}]**`);
  msg4Lines.push("");

  if (response.themes.length > 0) {
    msg4Lines.push("**【今日关键词】**");
    msg4Lines.push(response.themes.join(" "));
    msg4Lines.push("");
  }

  if (response.insights) {
    msg4Lines.push("**【今日趋势洞察】**");
    msg4Lines.push(response.insights);
  }

  if (msg4Lines.length > 2) { // Has content beyond sequence header
    messages.push(msg4Lines.join("\n").trim());
  }

  return messages;
}

/**
 * Generate single markdown (for storage/compatibility)
 */
function generateMarkdown(response: DailyDigestLLMResponse): string {
  return generateMarkdownMessages(response).join("\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n");
}

/**
 * Generate simple markdown without LLM (fallback)
 */
function generateSimpleMarkdown(
  signals: StoredSignal[],
  dateStr: string,
  dayOfWeek: string
): string {
  const lines: string[] = [];

  lines.push(`📡 **Information Radar 每日简报**`);
  lines.push(`${dateStr} (${dayOfWeek}) | 今日收录 ${signals.length} 条`);
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Sort by score descending
  const sorted = [...signals].sort((a, b) => b.value_score - a.value_score);

  for (let i = 0; i < sorted.length; i++) {
    const signal = sorted[i];
    const sourceEmoji = signal.source === "hacker_news" ? "🔴" : "🚀";
    const sourceLabel = signal.source === "hacker_news" ? "HN" : "PH";
    const stars = "★".repeat(signal.value_score) + "☆".repeat(5 - signal.value_score);

    lines.push(`**${i + 1}. ${sourceEmoji} [${sourceLabel}] ${signal.title}** ${stars}`);
    lines.push("");
    lines.push(signal.summary_zh);
    lines.push("");
    lines.push(`[查看原文](${signal.link})`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate daily digest
 * V2.1: Returns messages array for multi-message push
 */
export async function generateDailyDigest(
  date: Date,
  env: Env,
  options?: { useLLM?: boolean }
): Promise<{
  markdown: string;
  messages: string[];  // V2.1: Array of messages for mobile-optimized push
  record: DigestRecord | null;
}> {
  const dateStr = formatDate(date);
  const dayOfWeek = getDayOfWeekCN(date);
  const useLLM = options?.useLLM ?? true;

  // Get signals for the date
  const signals = await getSignalsByDate(dateStr, env);

  if (signals.length === 0) {
    const emptyMsg = `📡 **Information Radar 每日简报**\n${dateStr} (${dayOfWeek})\n\n今日暂无新信号收录。`;
    return {
      markdown: emptyMsg,
      messages: [emptyMsg],
      record: null,
    };
  }

  console.log(`[DailyDigest] Generating digest for ${dateStr} with ${signals.length} signals (LLM: ${useLLM})`);

  const startTime = Date.now();

  // Simple mode: no LLM, just format signals directly
  if (!useLLM || (!env.GLM_API_KEY && !env.GEMINI_API_KEY)) {
    console.log(`[DailyDigest] Using simple template (no LLM)`);
    const markdown = generateSimpleMarkdown(signals, dateStr, dayOfWeek);
    const generationTime = Date.now() - startTime;

    const digestId = `daily_${dateStr}`;
    const record: DigestRecord = {
      digest_id: digestId,
      type: "daily",
      date: dateStr,
      signals: signals.map((s, i) => ({
        signal_id: s.id,
        rank: i + 1,
        section: "full" as const,
      })),
      themes: [],
      generated_by: "simple_template",
      prompt_version: PROMPT_VERSION,
      prompt_hash: "none",
      generation_time_ms: generationTime,
      content_markdown: markdown,
      content_length: markdown.length,
      created_at: new Date().toISOString(),
    };

    if (env.DIGEST_HISTORY) {
      await env.DIGEST_HISTORY.put(
        `digest:daily:${dateStr}`,
        JSON.stringify(record),
        { expirationTtl: 60 * 60 * 24 * 365 }
      );
    }

    return { markdown, messages: [markdown], record };
  }

  // LLM mode: generate with AI
  try {
    // Limit signals to top 10 by score to avoid Worker timeout (30s limit)
    const MAX_SIGNALS_FOR_LLM = 10;
    const topSignals = [...signals]
      .sort((a, b) => b.value_score - a.value_score)
      .slice(0, MAX_SIGNALS_FOR_LLM);

    console.log(`[DailyDigest] Using top ${topSignals.length} signals for LLM (of ${signals.length} total)`);

    // Prepare user prompt
    const signalsText = formatSignalsForPrompt(
      topSignals.map((s) => ({
        ...s,
        detected_at: s.detected_at,
      }))
    );

    const userPrompt = DAILY_DIGEST_USER_PROMPT
      .replace("{{count}}", String(signals.length))
      .replace("{{date}}", dateStr)
      .replace("{{dayOfWeek}}", dayOfWeek)
      .replace("{{signals}}", signalsText);

    // Call LLM with timeout
    const llmResponse = await callLLMForDigest(userPrompt, DAILY_DIGEST_PROMPT, env);

    // Parse response
    const cleanResponse = llmResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleanResponse) as DailyDigestLLMResponse;

    // Generate markdown
    const messages = generateMarkdownMessages(parsed);
    const markdown = generateMarkdown(parsed);

    const generationTime = Date.now() - startTime;

    // Build DigestRecord (Patch 2: Structured Anchors)
    const digestId = `daily_${dateStr}`;
    const record: DigestRecord = {
      digest_id: digestId,
      type: "daily",
      date: dateStr,
      signals: [
        ...parsed.fullSummary.map((s) => ({
          signal_id: s.signal_id,
          rank: s.rank,
          section: "full" as const,
        })),
        ...parsed.briefList.map((s) => ({
          signal_id: s.signal_id,
          rank: s.rank,
          section: "brief" as const,
        })),
      ],
      themes: parsed.themes,
      generated_by: "llm-router-v2.1",
      prompt_version: PROMPT_VERSION,
      prompt_hash: hashPrompt(DAILY_DIGEST_PROMPT),
      generation_time_ms: generationTime,
      content_markdown: markdown,
      content_length: markdown.length,
      created_at: new Date().toISOString(),
    };

    // Store in DIGEST_HISTORY
    if (env.DIGEST_HISTORY) {
      await env.DIGEST_HISTORY.put(
        `digest:daily:${dateStr}`,
        JSON.stringify(record),
        { expirationTtl: 60 * 60 * 24 * 365 } // 1 year TTL
      );
      console.log(`[DailyDigest] Stored digest record for ${dateStr}`);
    }

    return { markdown, messages, record };
  } catch (error) {
    // LLM failed, fallback to simple template
    console.error(`[DailyDigest] LLM failed, using simple template:`, error);
    const markdown = generateSimpleMarkdown(signals, dateStr, dayOfWeek);
    const generationTime = Date.now() - startTime;

    const digestId = `daily_${dateStr}`;
    const record: DigestRecord = {
      digest_id: digestId,
      type: "daily",
      date: dateStr,
      signals: signals.map((s, i) => ({
        signal_id: s.id,
        rank: i + 1,
        section: "full" as const,
      })),
      themes: [],
      generated_by: "simple_template_fallback",
      prompt_version: PROMPT_VERSION,
      prompt_hash: "none",
      generation_time_ms: generationTime,
      content_markdown: markdown,
      content_length: markdown.length,
      created_at: new Date().toISOString(),
    };

    if (env.DIGEST_HISTORY) {
      await env.DIGEST_HISTORY.put(
        `digest:daily:${dateStr}`,
        JSON.stringify(record),
        { expirationTtl: 60 * 60 * 24 * 365 }
      );
    }

    return { markdown, messages: [markdown], record };
  }
}

/**
 * Generate today's digest
 */
export async function generateTodayDigest(env: Env): Promise<{
  markdown: string;
  messages: string[];
  record: DigestRecord | null;
}> {
  return generateDailyDigest(new Date(), env);
}

/**
 * Get stored digest by date
 */
export async function getStoredDailyDigest(
  date: string,
  env: Env
): Promise<DigestRecord | null> {
  if (!env.DIGEST_HISTORY) {
    return null;
  }

  const data = await env.DIGEST_HISTORY.get(`digest:daily:${date}`);
  return data ? JSON.parse(data) : null;
}
