/**
 * Enterprise WeChat Bot Channel
 * 企业微信群机器人推送通道
 *
 * 特点:
 * - 完全免费
 * - 无需认证
 * - 群消息推送
 * - 官方 API，零风险
 * - V2.1: 自动分批发送（4096字节限制）
 */

import type {
  PushChannel,
  PushMessage,
  PushResult,
  PushEnv,
  WecomWebhookResponse,
} from "../types";
import { getWecomWebhookUrl } from "../registry";
import { formatMarkdownMessage } from "../formatter";

const MAX_BYTES = 4000; // WeCom limit is 4096, leave buffer

/**
 * Split content into chunks that fit within byte limit
 */
function splitContentByBytes(content: string, maxBytes: number): string[] {
  const encoder = new TextEncoder();
  const totalBytes = encoder.encode(content).length;

  if (totalBytes <= maxBytes) {
    return [content];
  }

  console.log(`[WecomBot] Content too large (${totalBytes} bytes), splitting...`);

  const chunks: string[] = [];

  // Try to split by section delimiter first
  const sections = content.split(/(?=━━━)/);

  let currentChunk = "";
  let currentBytes = 0;
  let partNum = 1;

  for (const section of sections) {
    const sectionBytes = encoder.encode(section).length;

    // If adding this section would exceed limit, save current chunk and start new one
    if (currentBytes + sectionBytes > maxBytes && currentChunk) {
      chunks.push(currentChunk.trim() + `\n\n📄 (${partNum}/${sections.length > 3 ? '...' : sections.length})`);
      partNum++;
      currentChunk = "";
      currentBytes = 0;
    }

    // If single section is too large, split it further
    if (sectionBytes > maxBytes) {
      // Split by lines
      const lines = section.split("\n");
      for (const line of lines) {
        const lineBytes = encoder.encode(line + "\n").length;

        if (currentBytes + lineBytes > maxBytes && currentChunk) {
          chunks.push(currentChunk.trim() + `\n\n📄 (${partNum}/...)`);
          partNum++;
          currentChunk = "";
          currentBytes = 0;
        }

        currentChunk += line + "\n";
        currentBytes += lineBytes;
      }
    } else {
      currentChunk += section;
      currentBytes += sectionBytes;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  console.log(`[WecomBot] Split into ${chunks.length} chunks`);
  return chunks;
}

/**
 * Send a single message to WeCom webhook
 */
async function sendSingleMessage(
  webhookUrl: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content).length;
  console.log(`[WecomBot] Sending chunk: ${content.length} chars, ${contentBytes} bytes`);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msgtype: "markdown",
      markdown: { content },
    }),
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const result = (await response.json()) as WecomWebhookResponse;

  if (result.errcode !== 0) {
    return { success: false, error: `${result.errcode}: ${result.errmsg}` };
  }

  return { success: true };
}

/**
 * 企业微信群机器人 Channel 实现
 */
export const wecomBotChannel: PushChannel = {
  name: "wecom_bot",
  priority: 2,

  async send(message: PushMessage, env: PushEnv): Promise<PushResult> {
    try {
      const webhookUrl = await getWecomWebhookUrl(env);

      if (!webhookUrl) {
        return {
          success: false,
          channel: this.name,
          sentCount: 0,
          failedCount: 1,
          errors: ["No webhook URL configured"],
        };
      }

      const markdown = formatMarkdownMessage(message);

      // Split content if needed
      const chunks = splitContentByBytes(markdown, MAX_BYTES);

      let sentCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Send each chunk with small delay between them
      for (let i = 0; i < chunks.length; i++) {
        const result = await sendSingleMessage(webhookUrl, chunks[i]);

        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
          if (result.error) {
            errors.push(`Chunk ${i + 1}: ${result.error}`);
          }
        }

        // Small delay between messages to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
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
        sentCount: 0,
        failedCount: 1,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  },

  async healthCheck(env: PushEnv): Promise<boolean> {
    const webhookUrl = await getWecomWebhookUrl(env);
    return !!webhookUrl;
  },
};
