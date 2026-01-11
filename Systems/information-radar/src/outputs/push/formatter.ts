/**
 * Push Message Formatter
 * Shared formatting utilities for push channels
 */

import type { Signal } from "../../types";
import type { PushMessage } from "./types";

/**
 * Get source display info (emoji and name)
 */
export function getSourceDisplay(source: Signal["source"]): { emoji: string; name: string } {
  if (source === "hacker_news") {
    return { emoji: "\u{1F536}", name: "HN" };
  }
  return { emoji: "\u{1F680}", name: "PH" };
}

/**
 * Format score as star rating
 */
export function formatScoreStars(score: number): string {
  return "\u2605".repeat(score) + "\u2606".repeat(5 - score);
}

/**
 * Get current timestamp in Chinese locale
 */
export function getTimestamp(): string {
  return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

/**
 * Format message as Markdown for WeCom bot channel
 */
export function formatMarkdownMessage(message: PushMessage): string {
  const lines: string[] = [];
  const now = getTimestamp();

  // V2.0: Digest mode - return full content (splitting handled by channel)
  if (message.template === "digest" && message.digestContent) {
    const footer = "\n\n---\n*Powered by Information OS*";
    return message.digestContent + footer;
  }

  if (message.template === "single" && message.items.length === 1) {
    const item = message.items[0];
    const { emoji, name } = getSourceDisplay(item.source);
    const scoreStars = formatScoreStars(item.value_score);

    lines.push(`### ${emoji} [${name}] ${item.title}`);
    lines.push("");
    lines.push(`**评分**: ${scoreStars} (${item.value_score}/5)`);
    lines.push(`**摘要**: ${item.summary_zh}`);
    lines.push("");
    lines.push(`[查看原文](${item.link})`);
  } else {
    lines.push(`### 📡 Information OS 信息雷达`);
    lines.push(`*${now}*`);
    lines.push("");
    lines.push(`共 **${message.items.length}** 条新内容:`);
    lines.push("");

    for (const item of message.items.slice(0, 5)) {
      const { emoji } = getSourceDisplay(item.source);
      lines.push(
        `- ${emoji} [${item.title.slice(0, 40)}...](${item.link}) ★${item.value_score}`
      );
    }

    if (message.items.length > 5) {
      lines.push("");
      lines.push(`*还有 ${message.items.length - 5} 条...*`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("*Powered by Information OS*");

  return lines.join("\n");
}
