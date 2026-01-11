/**
 * Weekly Digest Generator
 * V2.0: Generates weekly tech digest with structured anchors (Patch 2)
 * V2.1: Multi-LLM provider support with automatic fallback
 */

import type { StoredSignal, DigestRecord, Env } from "../types";
import { getSignalsByWeek } from "../storage/signal-store";
import { callLLMSimple } from "../llm";
import {
  WEEKLY_DIGEST_PROMPT,
  WEEKLY_DIGEST_USER_PROMPT,
  formatSignalsForPrompt,
  hashPrompt,
  PROMPT_VERSION,
} from "./prompts";

/**
 * LLM response structure for weekly digest
 */
interface WeeklyDigestLLMResponse {
  title: string;
  weekInfo: string;
  totalCount: number;
  overview: string;
  topSignals: Array<{
    rank: number;
    signal_id: string;
    title: string;
    source: string;
    score: number;
    summary: string;
    link: string;
    dayOfWeek: string;
  }>;
  trendAnalysis: Array<{
    trend: string;
    analysis: string;
  }>;
  otherPicks: Array<{
    rank: number;
    signal_id: string;
    title: string;
    score: number;
  }>;
  weekAhead: string[];
  themes: string[];
}

/**
 * Call LLM API to generate digest (via multi-provider router)
 */
async function callLLMForDigest(
  userPrompt: string,
  systemPrompt: string,
  env: Env
): Promise<string> {
  console.log(`[WeeklyDigest] Calling LLM Router...`);
  console.log(`[WeeklyDigest] Prompt length: system=${systemPrompt.length}, user=${userPrompt.length}`);

  const response = await callLLMSimple(systemPrompt, userPrompt, env, {
    responseFormat: "json",
    timeoutMs: 30000, // 30 seconds for weekly digest (more content)
  });

  if (!response) {
    throw new Error("All LLM providers failed");
  }

  return response;
}

/**
 * Get ISO week number
 */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Format week as YYYY-WXX
 */
function formatWeek(date: Date): string {
  const week = getISOWeek(date);
  return `${date.getFullYear()}-W${week.toString().padStart(2, "0")}`;
}

/**
 * Get week date range string
 */
function getWeekRange(date: Date): string {
  const week = getISOWeek(date);
  const year = date.getFullYear();

  // Calculate Monday of this week
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

  const targetSunday = new Date(targetMonday);
  targetSunday.setUTCDate(targetMonday.getUTCDate() + 6);

  const formatMD = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

  return `${year}年第${week}周 (${formatMD(targetMonday)} - ${formatMD(targetSunday)})`;
}

/**
 * Generate markdown content from LLM response
 */
function generateMarkdown(response: WeeklyDigestLLMResponse): string {
  const lines: string[] = [];

  lines.push(`# ${response.title}`);
  lines.push(`${response.weekInfo} | 本周收录 ${response.totalCount} 条`);
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Overview section
  lines.push("## 【本周概览】");
  lines.push("");
  lines.push(response.overview);
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Top signals section
  lines.push("## 【本周 TOP 10】");
  lines.push("");

  for (const item of response.topSignals) {
    const sourceEmoji = item.source === "hacker_news" ? "🔴" : "🚀";
    const sourceLabel = item.source === "hacker_news" ? "HN" : "PH";
    const stars = "★".repeat(item.score) + "☆".repeat(5 - item.score);

    lines.push(`### ${item.rank}. ${sourceEmoji} [${sourceLabel}] ${item.title} ${stars} (${item.dayOfWeek})`);
    lines.push("");
    lines.push(item.summary);
    lines.push("");
    lines.push(`[查看原文](${item.link})`);
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Trend analysis section
  if (response.trendAnalysis.length > 0) {
    lines.push("## 【趋势深度分析】");
    lines.push("");

    for (let i = 0; i < response.trendAnalysis.length; i++) {
      const trend = response.trendAnalysis[i];
      lines.push(`### ${i + 1}. ${trend.trend}`);
      lines.push("");
      lines.push(trend.analysis);
      lines.push("");
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
  }

  // Other picks section
  if (response.otherPicks.length > 0) {
    lines.push("## 【其他精选】");
    lines.push("");

    for (const item of response.otherPicks) {
      const stars = "★".repeat(item.score);
      lines.push(`- ${item.title} ${stars}`);
    }
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
  }

  // Week ahead section
  if (response.weekAhead.length > 0) {
    lines.push("## 【下周关注】");
    lines.push("");

    for (const item of response.weekAhead) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
  }

  // Themes section
  lines.push("## 【本周关键词】");
  lines.push("");
  lines.push(response.themes.join(" "));
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate weekly digest
 * V2.1: Returns messages array for consistency (weekly uses single message + byte splitting)
 */
export async function generateWeeklyDigest(
  date: Date,
  env: Env
): Promise<{
  markdown: string;
  messages: string[];
  record: DigestRecord | null;
}> {
  const weekStr = formatWeek(date);
  const weekRange = getWeekRange(date);

  // Get signals for the week
  const signals = await getSignalsByWeek(weekStr, env);

  if (signals.length === 0) {
    const emptyMsg = `# Information OS 周报\n${weekRange}\n\n本周暂无新信号收录。`;
    return {
      markdown: emptyMsg,
      messages: [emptyMsg],
      record: null,
    };
  }

  console.log(`[WeeklyDigest] Generating digest for ${weekStr} with ${signals.length} signals`);

  const startTime = Date.now();

  // Prepare user prompt
  const signalsText = formatSignalsForPrompt(
    signals.map((s) => ({
      ...s,
      detected_at: s.detected_at,
    }))
  );

  const userPrompt = WEEKLY_DIGEST_USER_PROMPT
    .replace("{{count}}", String(signals.length))
    .replace("{{signals}}", signalsText);

  // Call LLM
  const llmResponse = await callLLMForDigest(userPrompt, WEEKLY_DIGEST_PROMPT, env);

  // Parse response
  const cleanResponse = llmResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleanResponse) as WeeklyDigestLLMResponse;

  // Generate markdown
  const markdown = generateMarkdown(parsed);

  const generationTime = Date.now() - startTime;

  // Build DigestRecord (Patch 2: Structured Anchors)
  const digestId = `weekly_${weekStr}`;
  const record: DigestRecord = {
    digest_id: digestId,
    type: "weekly",
    date: weekStr,
    signals: [
      ...parsed.topSignals.map((s) => ({
        signal_id: s.signal_id,
        rank: s.rank,
        section: "full" as const,
      })),
      ...parsed.otherPicks.map((s) => ({
        signal_id: s.signal_id,
        rank: s.rank,
        section: "brief" as const,
      })),
    ],
    themes: parsed.themes,
    generated_by: "llm-router-v2.1",
    prompt_version: PROMPT_VERSION,
    prompt_hash: hashPrompt(WEEKLY_DIGEST_PROMPT),
    generation_time_ms: generationTime,
    content_markdown: markdown,
    content_length: markdown.length,
    created_at: new Date().toISOString(),
  };

  // Store in DIGEST_HISTORY
  if (env.DIGEST_HISTORY) {
    await env.DIGEST_HISTORY.put(
      `digest:weekly:${weekStr}`,
      JSON.stringify(record),
      { expirationTtl: 60 * 60 * 24 * 365 } // 1 year TTL
    );
    console.log(`[WeeklyDigest] Stored digest record for ${weekStr}`);
  }

  // V2.1: Weekly digest uses single message (wecom-bot handles byte splitting)
  return { markdown, messages: [markdown], record };
}

/**
 * Generate current week's digest
 */
export async function generateCurrentWeekDigest(env: Env): Promise<{
  markdown: string;
  messages: string[];
  record: DigestRecord | null;
}> {
  return generateWeeklyDigest(new Date(), env);
}

/**
 * Get stored digest by week
 */
export async function getStoredWeeklyDigest(
  week: string,
  env: Env
): Promise<DigestRecord | null> {
  if (!env.DIGEST_HISTORY) {
    return null;
  }

  const data = await env.DIGEST_HISTORY.get(`digest:weekly:${week}`);
  return data ? JSON.parse(data) : null;
}
