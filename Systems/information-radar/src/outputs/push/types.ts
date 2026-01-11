/**
 * Information Radar Push Subsystem - Type Definitions
 * Version: 1.0
 *
 * 核心原则: 测试号只是默认实现之一，不是系统前提
 */

import type { Signal } from "../../types";

/**
 * Push Channel 统一接口
 * 所有推送通道必须实现此接口
 */
export interface PushChannel {
  /** 通道名称 */
  name: string;

  /** 通道优先级 (越小越优先) */
  priority: number;

  /** 发送消息 */
  send(message: PushMessage, env: PushEnv): Promise<PushResult>;

  /** 健康检查 */
  healthCheck(env: PushEnv): Promise<boolean>;
}

/**
 * 推送消息结构
 */
export interface PushMessage {
  /** 消息标题 */
  title: string;

  /** 信号列表 */
  items: Signal[];

  /** 模板类型 */
  template: "single" | "digest";

  /** 原文链接 (单条时使用) */
  url?: string;

  /** V2.0: Digest markdown content (digest 模式使用) */
  digestContent?: string;
}

/**
 * 推送结果
 */
export interface PushResult {
  success: boolean;
  channel: string;
  sentCount: number;
  failedCount: number;
  errors?: string[];
}

/**
 * 身份注册表结构
 */
export interface PushRegistry {
  /** 微信测试号配置 */
  wechat_test?: {
    /** 核心成员 (优先推送) */
    core: string[];
    /** 扩展成员 */
    extended: string[];
    /** 已停用成员 */
    inactive: string[];
  };

  /** 企业微信机器人配置 */
  wecom_bot?: {
    /** Webhook URL */
    webhook_url: string;
  };

  /** PushPlus 配置 */
  pushplus?: {
    /** Token 列表 */
    tokens: string[];
  };
}

/**
 * 成员分组
 */
export type MemberGroup = "core" | "extended" | "all";

/**
 * Token 缓存结构
 */
export interface TokenCache {
  token: string;
  expiresAt: number;
}

/**
 * Push 环境变量
 */
export interface PushEnv {
  // KV Namespaces
  PUSH_REGISTRY: KVNamespace;
  TOKEN_CACHE: KVNamespace;

  // 微信测试号配置
  WECHAT_APPID?: string;
  WECHAT_SECRET?: string;
  WECHAT_TEMPLATE_ID?: string;

  // 企业微信机器人 (备用)
  WECOM_WEBHOOK_URL?: string;

  // PushPlus (冷备)
  PUSHPLUS_TOKEN?: string;

  // 通道优先级配置
  PUSH_CHANNEL_PRIORITY?: string; // "wechat_test,wecom_bot,pushplus"
}

/**
 * 微信 API 响应
 */
export interface WechatTokenResponse {
  access_token: string;
  expires_in: number;
  errcode?: number;
  errmsg?: string;
}

export interface WechatSendResponse {
  errcode: number;
  errmsg: string;
  msgid?: number;
}

/**
 * 企业微信 Webhook 响应
 */
export interface WecomWebhookResponse {
  errcode: number;
  errmsg: string;
}
