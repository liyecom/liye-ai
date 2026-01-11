/**
 * Push Registry
 * 身份注册表管理
 *
 * 功能:
 * - 成员增减
 * - 分组推送 (core 优先)
 * - 灰度与紧急降噪
 *
 * 存储: Cloudflare KV (PUSH_REGISTRY)
 */

import type { PushEnv, PushRegistry, MemberGroup } from "./types";

const REGISTRY_KEY = "push_registry";

/**
 * 默认注册表结构
 */
const DEFAULT_REGISTRY: PushRegistry = {
  wechat_test: {
    core: [],
    extended: [],
    inactive: [],
  },
  wecom_bot: {
    webhook_url: "",
  },
  pushplus: {
    tokens: [],
  },
};

/**
 * 获取完整注册表
 */
export async function getRegistry(env: PushEnv): Promise<PushRegistry> {
  const cached = await env.PUSH_REGISTRY.get<PushRegistry>(REGISTRY_KEY, "json");
  return cached || DEFAULT_REGISTRY;
}

/**
 * 更新注册表
 */
export async function updateRegistry(
  env: PushEnv,
  registry: PushRegistry
): Promise<void> {
  await env.PUSH_REGISTRY.put(REGISTRY_KEY, JSON.stringify(registry));
}

/**
 * 获取微信测试号 OpenID 列表
 */
export async function getWechatOpenIds(
  env: PushEnv,
  group: MemberGroup = "all"
): Promise<string[]> {
  const registry = await getRegistry(env);
  const wechat = registry.wechat_test;

  if (!wechat) {
    return [];
  }

  switch (group) {
    case "core":
      return wechat.core;
    case "extended":
      return [...wechat.core, ...wechat.extended];
    case "all":
    default:
      return [...wechat.core, ...wechat.extended];
  }
}

/**
 * 添加微信成员
 */
export async function addWechatMember(
  env: PushEnv,
  openId: string,
  group: "core" | "extended" = "extended"
): Promise<void> {
  const registry = await getRegistry(env);

  if (!registry.wechat_test) {
    registry.wechat_test = { core: [], extended: [], inactive: [] };
  }

  // 检查是否已存在
  const allIds = [
    ...registry.wechat_test.core,
    ...registry.wechat_test.extended,
    ...registry.wechat_test.inactive,
  ];

  if (allIds.includes(openId)) {
    // 如果在 inactive 中，移动到目标组
    registry.wechat_test.inactive = registry.wechat_test.inactive.filter(
      (id) => id !== openId
    );
  }

  if (!registry.wechat_test[group].includes(openId)) {
    registry.wechat_test[group].push(openId);
  }

  await updateRegistry(env, registry);
}

/**
 * 移除微信成员 (移到 inactive)
 */
export async function removeWechatMember(
  env: PushEnv,
  openId: string
): Promise<void> {
  const registry = await getRegistry(env);

  if (!registry.wechat_test) {
    return;
  }

  registry.wechat_test.core = registry.wechat_test.core.filter(
    (id) => id !== openId
  );
  registry.wechat_test.extended = registry.wechat_test.extended.filter(
    (id) => id !== openId
  );

  if (!registry.wechat_test.inactive.includes(openId)) {
    registry.wechat_test.inactive.push(openId);
  }

  await updateRegistry(env, registry);
}

/**
 * 获取企业微信 Webhook URL
 */
export async function getWecomWebhookUrl(env: PushEnv): Promise<string | null> {
  // 优先从环境变量读取
  if (env.WECOM_WEBHOOK_URL) {
    return env.WECOM_WEBHOOK_URL;
  }

  // 从注册表读取
  const registry = await getRegistry(env);
  return registry.wecom_bot?.webhook_url || null;
}

/**
 * 获取 PushPlus Tokens
 */
export async function getPushPlusTokens(env: PushEnv): Promise<string[]> {
  // 优先从环境变量读取
  if (env.PUSHPLUS_TOKEN) {
    return [env.PUSHPLUS_TOKEN];
  }

  // 从注册表读取
  const registry = await getRegistry(env);
  return registry.pushplus?.tokens || [];
}

/**
 * 初始化注册表 (首次部署时使用)
 */
export async function initializeRegistry(
  env: PushEnv,
  initialData?: Partial<PushRegistry>
): Promise<void> {
  const registry = { ...DEFAULT_REGISTRY, ...initialData };
  await updateRegistry(env, registry);
}
