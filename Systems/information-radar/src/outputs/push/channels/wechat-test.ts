/**
 * WeChat Test Account Channel
 * 微信测试号推送通道 (默认通道)
 *
 * 特点:
 * - 免费、无需认证
 * - 官方沙箱环境，零封号风险
 * - 模板消息 API
 *
 * 注意: 测试号只是默认实现，不是系统前提
 * 迁移路径: 测试号 → 企业微信 → 正式服务号
 */

import type {
  PushChannel,
  PushMessage,
  PushResult,
  PushEnv,
  WechatSendResponse,
} from "../types";
import { getWechatAccessToken } from "../token-manager";
import { getWechatOpenIds } from "../registry";
import { getSourceDisplay, formatScoreStars, getTimestamp } from "../formatter";

const WECHAT_SEND_URL =
  "https://api.weixin.qq.com/cgi-bin/message/template/send";

/**
 * Format message as WeChat template data
 *
 * 模板字段映射:
 * - keyword1 → 标题 (20字符限制)
 * - keyword2 → 摘要 (40字符限制，简短版)
 * - keyword3 → 评分 (评分星星 + 分数)
 * - remark → 详细摘要 (200字符限制)
 */
function formatTemplateData(message: PushMessage) {
  if (message.template === "single" && message.items.length === 1) {
    const item = message.items[0];
    const { emoji, name } = getSourceDisplay(item.source);
    const scoreStars = formatScoreStars(item.value_score);

    // 处理摘要，确保不为空
    const summary = item.summary_zh || "暂无摘要";
    const summaryFull = summary.slice(0, 200);

    // 使用文字评分，避免Unicode星星不显示
    const scoreText = ["", "一星", "二星", "三星", "四星", "五星"][item.value_score] || "三星";

    return {
      first: { value: `${emoji} [${name}] 新内容`, color: "#173177" },
      keyword1: { value: item.title.slice(0, 20), color: "#173177" },
      keyword2: { value: summaryFull, color: "#666666" },  // 完整摘要，让微信自然截断
      keyword3: { value: `${scoreText} (${item.value_score}/5)`, color: "#FF6600" },
      remark: { value: "点击「详情」查看原文", color: "#999999" },
    };
  }

  // Digest mode - show list of items with summary of first item
  const itemList = message.items
    .slice(0, 5)
    .map((item, i) => {
      const { emoji } = getSourceDisplay(item.source);
      return `${i + 1}. ${emoji} ${item.title.slice(0, 25)}`;
    })
    .join("\n");

  // Use first item's summary and average score
  const firstItem = message.items[0];
  const avgScore = Math.round(
    message.items.reduce((sum, item) => sum + item.value_score, 0) / message.items.length
  );
  const scoreStars = formatScoreStars(avgScore as 1 | 2 | 3 | 4 | 5);

  return {
    first: { value: `\u{1F4E1} ${message.items.length} \u6761\u65B0\u4FE1\u606F`, color: "#173177" },
    keyword1: { value: itemList, color: "#173177" },
    keyword2: { value: firstItem?.summary_zh?.slice(0, 80) || "点击查看详情", color: "#666666" },
    keyword3: { value: `${scoreStars} (平均 ${avgScore}/5)`, color: "#FF6600" },
    remark: { value: "\u70B9\u51FB\u67E5\u770B\u8BE6\u60C5 \u2192", color: "#999999" },
  };
}

/**
 * 发送模板消息给单个用户
 */
async function sendToUser(
  accessToken: string,
  openId: string,
  templateId: string,
  message: PushMessage
): Promise<boolean> {
  const url = `${WECHAT_SEND_URL}?access_token=${accessToken}`;

  const body = {
    touser: openId,
    template_id: templateId,
    url: message.url || message.items[0]?.link || "",
    data: formatTemplateData(message),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as WechatSendResponse;
  return result.errcode === 0;
}

/**
 * 微信测试号 Channel 实现
 */
export const wechatTestChannel: PushChannel = {
  name: "wechat_test",
  priority: 1,

  async send(message: PushMessage, env: PushEnv): Promise<PushResult> {
    const errors: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    try {
      // 获取 access_token
      const accessToken = await getWechatAccessToken(env);

      // 获取 openid 列表
      const openIds = await getWechatOpenIds(env, "all");

      if (openIds.length === 0) {
        return {
          success: false,
          channel: this.name,
          sentCount: 0,
          failedCount: 0,
          errors: ["No registered members"],
        };
      }

      const templateId = env.WECHAT_TEMPLATE_ID;
      if (!templateId) {
        return {
          success: false,
          channel: this.name,
          sentCount: 0,
          failedCount: 0,
          errors: ["Missing WECHAT_TEMPLATE_ID"],
        };
      }

      // 发送给所有成员
      for (const openId of openIds) {
        const success = await sendToUser(
          accessToken,
          openId,
          templateId,
          message
        );
        if (success) {
          sentCount++;
        } else {
          failedCount++;
          errors.push(`Failed to send to ${openId.slice(0, 8)}...`);
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
    // 检查必要配置是否存在
    if (!env.WECHAT_APPID || !env.WECHAT_SECRET || !env.WECHAT_TEMPLATE_ID) {
      return false;
    }

    try {
      // 尝试获取 access_token
      await getWechatAccessToken(env);
      return true;
    } catch {
      return false;
    }
  },
};
