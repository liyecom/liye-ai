/**
 * Enterprise WeChat App Channel
 * 企业微信应用推送通道 (V2.0)
 *
 * 特点:
 * - 支持向指定成员推送
 * - 支持 Markdown 格式
 * - 更灵活的消息类型
 *
 * 配置:
 * - WECOM_CORPID: 企业ID
 * - WECOM_AGENT_ID: 应用ID
 * - WECOM_SECRET: 应用Secret
 * - WECOM_APP_TOUSER: 接收用户 (可选, 默认@all)
 */

import type {
  PushChannel,
  PushMessage,
  PushResult,
  PushEnv,
} from "../types";
import { getSourceDisplay, formatScoreStars } from "../formatter";

const WECOM_TOKEN_URL = "https://qyapi.weixin.qq.com/cgi-bin/gettoken";
const WECOM_SEND_URL = "https://qyapi.weixin.qq.com/cgi-bin/message/send";

/**
 * Enterprise WeChat App Environment
 */
interface WecomAppEnv extends PushEnv {
  WECOM_CORPID?: string;
  WECOM_AGENT_ID?: string;
  WECOM_SECRET?: string;
  WECOM_APP_TOUSER?: string;
}

/**
 * Token response from Enterprise WeChat
 */
interface WecomTokenResponse {
  errcode: number;
  errmsg: string;
  access_token?: string;
  expires_in?: number;
}

/**
 * Send response from Enterprise WeChat
 */
interface WecomSendResponse {
  errcode: number;
  errmsg: string;
  msgid?: string;
}

/**
 * Get access token for Enterprise WeChat App
 */
async function getWecomAppAccessToken(env: WecomAppEnv): Promise<string> {
  const corpId = env.WECOM_CORPID;
  const secret = env.WECOM_SECRET;

  if (!corpId || !secret) {
    throw new Error("Missing WECOM_CORPID or WECOM_SECRET");
  }

  // Check cache first
  const cacheKey = `wecom_app_token`;
  const cached = await env.TOKEN_CACHE?.get(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.expiresAt > Date.now()) {
      return parsed.token;
    }
  }

  // Fetch new token
  const url = `${WECOM_TOKEN_URL}?corpid=${corpId}&corpsecret=${secret}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`WeChat API error: ${response.status}`);
  }

  const result = (await response.json()) as WecomTokenResponse;

  if (result.errcode !== 0 || !result.access_token) {
    throw new Error(`WeChat token error: ${result.errcode} - ${result.errmsg}`);
  }

  // Cache token (expires_in is in seconds, cache for 90% of that time)
  const expiresIn = result.expires_in || 7200;
  await env.TOKEN_CACHE?.put(
    cacheKey,
    JSON.stringify({
      token: result.access_token,
      expiresAt: Date.now() + expiresIn * 900, // 90% of expires_in
    }),
    { expirationTtl: expiresIn }
  );

  return result.access_token;
}

/**
 * Format message as Markdown for Enterprise WeChat
 */
function formatMarkdownMessage(message: PushMessage): string {
  // Digest mode: use full markdown content
  if (message.template === "digest" && message.digestContent) {
    // Enterprise WeChat has a 4096 char limit for markdown
    const content = message.digestContent;
    if (content.length > 4000) {
      return content.slice(0, 3900) + "\n\n...(内容已截断，请查看完整版)";
    }
    return content;
  }

  // Single item mode
  if (message.items.length === 1) {
    const item = message.items[0];
    const { emoji, name } = getSourceDisplay(item.source);
    const scoreStars = formatScoreStars(item.value_score);

    return `${emoji} **[${name}] ${item.title}**

${scoreStars} (${item.value_score}/5)

${item.summary_zh}

[查看原文](${item.link})`;
  }

  // Multiple items mode
  const lines: string[] = [];
  lines.push(`📡 **${message.items.length} 条新信息**\n`);

  for (let i = 0; i < Math.min(message.items.length, 5); i++) {
    const item = message.items[i];
    const { emoji } = getSourceDisplay(item.source);
    lines.push(`${i + 1}. ${emoji} [${item.title}](${item.link}) ★${item.value_score}`);
  }

  if (message.items.length > 5) {
    lines.push(`\n...还有 ${message.items.length - 5} 条`);
  }

  return lines.join("\n");
}

/**
 * 企业微信应用 Channel 实现
 */
export const wecomAppChannel: PushChannel = {
  name: "wecom_app",
  priority: 3,

  async send(message: PushMessage, env: PushEnv): Promise<PushResult> {
    const wecomEnv = env as WecomAppEnv;

    try {
      const accessToken = await getWecomAppAccessToken(wecomEnv);
      const agentId = wecomEnv.WECOM_AGENT_ID;
      const toUser = wecomEnv.WECOM_APP_TOUSER || "@all";

      if (!agentId) {
        return {
          success: false,
          channel: this.name,
          sentCount: 0,
          failedCount: 1,
          errors: ["Missing WECOM_AGENT_ID"],
        };
      }

      const markdownContent = formatMarkdownMessage(message);

      const url = `${WECOM_SEND_URL}?access_token=${accessToken}`;
      const body = {
        touser: toUser,
        msgtype: "markdown",
        agentid: parseInt(agentId),
        markdown: {
          content: markdownContent,
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return {
          success: false,
          channel: this.name,
          sentCount: 0,
          failedCount: 1,
          errors: [`HTTP error: ${response.status}`],
        };
      }

      const result = (await response.json()) as WecomSendResponse;

      if (result.errcode !== 0) {
        return {
          success: false,
          channel: this.name,
          sentCount: 0,
          failedCount: 1,
          errors: [`WeChat error: ${result.errcode} - ${result.errmsg}`],
        };
      }

      return {
        success: true,
        channel: this.name,
        sentCount: 1,
        failedCount: 0,
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
    const wecomEnv = env as WecomAppEnv;

    // Check required configuration
    if (!wecomEnv.WECOM_CORPID || !wecomEnv.WECOM_SECRET || !wecomEnv.WECOM_AGENT_ID) {
      return false;
    }

    try {
      // Try to get access token
      await getWecomAppAccessToken(wecomEnv);
      return true;
    } catch {
      return false;
    }
  },
};
