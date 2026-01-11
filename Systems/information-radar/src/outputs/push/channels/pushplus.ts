/**
 * PushPlus Channel
 * PushPlus 推送通道 (冷备通道)
 *
 * 特点:
 * - 需要实名认证 (3.9-10 CNY)
 * - 稳定可靠
 * - 支持多种消息格式
 *
 * 使用场景: 微信测试号和企微都不可用时的冷备方案
 */

import type {
  PushChannel,
  PushMessage,
  PushResult,
  PushEnv,
} from "../types";
import { getPushPlusTokens } from "../registry";
import { getSourceDisplay, formatScoreStars, getTimestamp } from "../formatter";

const PUSHPLUS_API_URL = "https://www.pushplus.plus/send";

interface PushPlusResponse {
  code: number;
  msg: string;
  data: string;
}

/**
 * Format message as Markdown for PushPlus (with header)
 */
function formatPushPlusMarkdown(message: PushMessage): string {
  const lines: string[] = [];
  const now = getTimestamp();

  lines.push(`## \u{1F4E1} Information OS \u4FE1\u606F\u96F7\u8FBE`);
  lines.push(`*${now}*`);
  lines.push("");

  if (message.template === "single" && message.items.length === 1) {
    const item = message.items[0];
    const { emoji, name } = getSourceDisplay(item.source);
    const scoreStars = formatScoreStars(item.value_score);

    lines.push(`### ${emoji} [${name}] ${item.title}`);
    lines.push("");
    lines.push(`**\u8BC4\u5206**: ${scoreStars} (${item.value_score}/5)`);
    lines.push("");
    lines.push(`**\u6458\u8981**: ${item.summary_zh}`);
    lines.push("");
    lines.push(`[\u67E5\u770B\u539F\u6587](${item.link})`);
  } else {
    lines.push(`\u5171 **${message.items.length}** \u6761\u65B0\u5185\u5BB9:`);
    lines.push("");

    for (const item of message.items.slice(0, 5)) {
      const { emoji, name } = getSourceDisplay(item.source);
      const scoreStars = formatScoreStars(item.value_score);

      lines.push(`### ${emoji} [${name}] ${item.title}`);
      lines.push(`**\u8BC4\u5206**: ${scoreStars} | **\u6458\u8981**: ${item.summary_zh.slice(0, 50)}...`);
      lines.push(`[\u67E5\u770B\u539F\u6587](${item.link})`);
      lines.push("");
    }

    if (message.items.length > 5) {
      lines.push(`*\u8FD8\u6709 ${message.items.length - 5} \u6761\u66F4\u591A\u5185\u5BB9...*`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("*Powered by Information OS*");

  return lines.join("\n");
}

/**
 * 发送消息给单个 token
 */
async function sendToToken(
  token: string,
  title: string,
  content: string
): Promise<boolean> {
  const response = await fetch(PUSHPLUS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      title,
      content,
      template: "markdown",
    }),
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as PushPlusResponse;
  return result.code === 200;
}

/**
 * PushPlus Channel 实现
 */
export const pushPlusChannel: PushChannel = {
  name: "pushplus",
  priority: 3,

  async send(message: PushMessage, env: PushEnv): Promise<PushResult> {
    const errors: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    try {
      const tokens = await getPushPlusTokens(env);

      if (tokens.length === 0) {
        return {
          success: false,
          channel: this.name,
          sentCount: 0,
          failedCount: 0,
          errors: ["No PushPlus tokens configured"],
        };
      }

      const title =
        message.items.length === 1
          ? `📡 ${message.items[0].title.slice(0, 30)}...`
          : `📡 ${message.items.length} 条新信息`;

      const content = formatPushPlusMarkdown(message);

      // 发送给所有 token
      for (const token of tokens) {
        const success = await sendToToken(token, title, content);
        if (success) {
          sentCount++;
        } else {
          failedCount++;
          errors.push(`Failed to send to token ${token.slice(0, 8)}...`);
        }
      }

      return {
        success: sentCount > 0,
        channel: this.name,
        sentCount,
        failedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        channel: this.name,
        sentCount,
        failedCount: failedCount + 1,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  },

  async healthCheck(env: PushEnv): Promise<boolean> {
    const tokens = await getPushPlusTokens(env);
    return tokens.length > 0;
  },
};
