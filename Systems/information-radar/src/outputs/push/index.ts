/**
 * Information Radar Push Subsystem
 * Channel Router - 推送通道路由器
 *
 * 功能:
 * - 自动选择可用通道
 * - 故障时自动降级
 * - 消息合并/降噪
 *
 * 优先级: wechat_test (1) → wecom_bot (2) → pushplus (3)
 */

import type { Signal } from "../../types";
import type {
  PushChannel,
  PushMessage,
  PushResult,
  PushEnv,
} from "./types";

import { wechatTestChannel } from "./channels/wechat-test";
import { wecomBotChannel } from "./channels/wecom-bot";
import { wecomAppChannel } from "./channels/wecom-app";
import { pushPlusChannel } from "./channels/pushplus";

// 注册所有可用通道 (按优先级排序)
// V2.0: 新增 wecom_app 通道
const CHANNELS: PushChannel[] = [
  wechatTestChannel,
  wecomBotChannel,
  wecomAppChannel,
  pushPlusChannel,
].sort((a, b) => a.priority - b.priority);

/**
 * 获取通道优先级配置
 */
function getChannelPriority(env: PushEnv): string[] {
  if (env.PUSH_CHANNEL_PRIORITY) {
    return env.PUSH_CHANNEL_PRIORITY.split(",").map((s) => s.trim());
  }
  return CHANNELS.map((c) => c.name);
}

/**
 * 按配置优先级排序通道（不在列表中的通道会被排除）
 */
function sortChannels(env: PushEnv): PushChannel[] {
  const priority = getChannelPriority(env);
  // 只保留在优先级列表中的通道
  return CHANNELS
    .filter((c) => priority.includes(c.name))
    .sort((a, b) => {
      const aIndex = priority.indexOf(a.name);
      const bIndex = priority.indexOf(b.name);
      return aIndex - bIndex;
    });
}

/**
 * 发送消息 (自动选择可用通道，支持降级)
 */
export async function send(
  message: PushMessage,
  env: PushEnv
): Promise<PushResult> {
  const sortedChannels = sortChannels(env);
  const errors: string[] = [];

  for (const channel of sortedChannels) {
    const isHealthy = await channel.healthCheck(env);

    if (!isHealthy) {
      console.log(`[Push] Channel ${channel.name} unhealthy, skipping`);
      errors.push(`${channel.name}: unhealthy`);
      continue;
    }

    console.log(`[Push] Trying channel: ${channel.name}`);
    const result = await channel.send(message, env);

    if (result.success) {
      console.log(
        `[Push] Success via ${channel.name}: ${result.sentCount} sent`
      );
      return result;
    }

    const errorDetail = result.errors?.join(", ") || "unknown error";
    console.log(`[Push] Channel ${channel.name} failed: ${errorDetail}`);
    errors.push(`${channel.name}: ${errorDetail}`);
  }

  // 所有通道都失败
  return {
    success: false,
    channel: "none",
    sentCount: 0,
    failedCount: 1,
    errors: ["All push channels failed", ...errors],
  };
}

/**
 * Push options for digest mode (V2.0)
 */
export interface BatchPushOptions {
  template?: "single" | "digest";
  digestMarkdown?: string;
}

/**
 * 批量推送信号 - 每篇文章单独推送
 *
 * V2.0: 支持 digest 模式，整体推送摘要
 * 策略: 每篇文章独立发送，保留完整摘要和评分
 */
export async function batchPush(
  signals: Signal[],
  env: PushEnv,
  options?: BatchPushOptions
): Promise<PushResult> {
  if (signals.length === 0) {
    return {
      success: true,
      channel: "none",
      sentCount: 0,
      failedCount: 0,
    };
  }

  // V2.0: Digest mode - push as single digest message
  if (options?.template === "digest" && options.digestMarkdown) {
    const message: PushMessage = {
      title: signals[0].title,
      items: signals,
      template: "digest",
      digestContent: options.digestMarkdown,
    };

    return send(message, env);
  }

  let totalSent = 0;
  let totalFailed = 0;
  const errors: string[] = [];
  let lastChannel = "none";

  // 每篇文章单独推送
  for (const signal of signals) {
    const message: PushMessage = {
      title: signal.title,
      items: [signal],
      template: "single",
      url: signal.link,
    };

    const result = await send(message, env);
    lastChannel = result.channel;

    if (result.success) {
      totalSent += result.sentCount;
    } else {
      totalFailed++;
      if (result.errors) {
        errors.push(...result.errors);
      }
    }

    // 避免发送过快，间隔 500ms
    if (signals.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return {
    success: totalSent > 0,
    channel: lastChannel,
    sentCount: totalSent,
    failedCount: totalFailed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * 获取所有可用通道状态
 */
export async function getChannelStatus(
  env: PushEnv
): Promise<{ name: string; priority: number; healthy: boolean }[]> {
  const results = await Promise.all(
    CHANNELS.map(async (channel) => ({
      name: channel.name,
      priority: channel.priority,
      healthy: await channel.healthCheck(env),
    }))
  );
  return results;
}

// 导出类型和子模块
export * from "./types";
export { getRegistry, updateRegistry, initializeRegistry } from "./registry";
export { getWechatAccessToken, clearWechatTokenCache } from "./token-manager";
