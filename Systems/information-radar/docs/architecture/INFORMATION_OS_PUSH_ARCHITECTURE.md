# Information OS Push Architecture v1.0

## 概述

Information OS Push Subsystem 是一个**可替换、可扩展、可降级、可长期演进**的推送子系统。

> **核心原则**: 测试号只是默认实现之一，不是系统前提。

---

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Information OS Core                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │ HN Source│   │ PH Source│   │ Dedup    │   │ Summarize│    │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘    │
│       └──────────────┴──────────────┴──────────────┘           │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Push Subsystem v1.0                       │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │               Channel Router                        │  │  │
│  │  │  • 自动选择可用通道                                   │  │  │
│  │  │  • 故障时自动降级                                     │  │  │
│  │  │  • 消息合并/降噪                                      │  │  │
│  │  └────────────────────┬───────────────────────────────┘  │  │
│  │                       │                                   │  │
│  │     ┌─────────────────┼─────────────────┐                │  │
│  │     ▼                 ▼                 ▼                │  │
│  │  ┌──────┐         ┌──────┐         ┌──────┐             │  │
│  │  │微信   │         │企微   │         │Push  │             │  │
│  │  │测试号 │         │机器人 │         │Plus  │             │  │
│  │  │(默认) │         │(热备) │         │(冷备) │             │  │
│  │  └──┬───┘         └──┬───┘         └──┬───┘             │  │
│  │     │                │                │                  │  │
│  └─────┼────────────────┼────────────────┼──────────────────┘  │
└────────┼────────────────┼────────────────┼──────────────────────┘
         ▼                ▼                ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │ 个人微信 │      │ 企微群   │      │ 微信    │
    │ (测试号) │      │         │      │ (公众号) │
    └─────────┘      └─────────┘      └─────────┘
```

---

## Channel 抽象层

### 接口定义

```typescript
interface PushChannel {
  name: string;
  priority: number;
  send(message: PushMessage, env: PushEnv): Promise<PushResult>;
  healthCheck(env: PushEnv): Promise<boolean>;
}
```

### 已实现的 Channel

| Channel | 优先级 | 特点 | 配置要求 |
|---------|--------|------|----------|
| `wechat_test` | 1 (默认) | 免费、官方 API、零风险 | WECHAT_APPID, WECHAT_SECRET, WECHAT_TEMPLATE_ID |
| `wecom_bot` | 2 (热备) | 免费、群消息、官方 API | WECOM_WEBHOOK_URL |
| `pushplus` | 3 (冷备) | 需实名、第三方服务 | PUSHPLUS_TOKEN |

### 路由策略

```
1. 按优先级遍历所有 Channel
2. 对每个 Channel 执行 healthCheck()
3. 第一个健康的 Channel 执行 send()
4. 成功则返回，失败则继续下一个
5. 所有 Channel 失败则返回错误
```

---

## 身份注册表

### 存储

使用 Cloudflare KV (`PUSH_REGISTRY`)，**不在 env 中硬编码 openid**。

### 数据结构

```json
{
  "wechat_test": {
    "core": ["openid_a", "openid_b"],
    "extended": ["openid_c"],
    "inactive": ["openid_x"]
  },
  "wecom_bot": {
    "webhook_url": "https://qyapi.weixin.qq.com/..."
  },
  "pushplus": {
    "tokens": ["token_a", "token_b"]
  }
}
```

### 成员分组

| 分组 | 说明 | 使用场景 |
|------|------|----------|
| `core` | 核心成员 | 始终推送 |
| `extended` | 扩展成员 | 正常推送 |
| `inactive` | 已停用 | 不推送 |

---

## Token 生命周期管理

### 缓存策略

```typescript
async function getAccessToken(env) {
  const cached = await env.TOKEN_CACHE.get('wechat_access_token');

  // 5分钟缓冲期，提前刷新
  if (cached && cached.expiresAt > Date.now() + 300000) {
    return cached.token;
  }

  const newToken = await refreshToken(env);
  await env.TOKEN_CACHE.put('wechat_access_token', newToken);
  return newToken.access_token;
}
```

### 优势

- ✅ 避免重复请求
- ✅ 5分钟缓冲期防止边界问题
- ✅ KV 原子操作保证多实例安全

---

## 信息合并/降噪

### 策略

| 条件 | 行为 |
|------|------|
| 单条信号 | `single` 模板，完整展示 |
| 多条信号 (≤5) | `digest` 模板，列表展示 |
| 多条信号 (>5) | `digest` 模板，展示 Top 5 + 计数 |

### 实现

```typescript
async function batchPush(signals, env) {
  const message = {
    title: signals.length === 1
      ? signals[0].title
      : `📡 ${signals.length} 条新信息`,
    items: signals,
    template: signals.length === 1 ? 'single' : 'digest'
  };
  return send(message, env);
}
```

---

## 风险模型

### 测试号风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 微信下线测试号 | 低 | 高 | 30分钟内切换到 wecom_bot |
| API 限流 | 低 | 中 | Token 缓存 + 消息合并 |
| Template 被拒 | 低 | 低 | 使用通用模板 |

### 降级路径

```
wechat_test (不可用)
       ↓ 自动降级
  wecom_bot (不可用)
       ↓ 自动降级
    pushplus
       ↓ 全部失败
    记录日志，返回错误
```

---

## 迁移路径

### 当前状态

```
微信测试号 ──────────────────────────────────▶ 默认
      │
      │ (如测试号不稳定)
      ▼
企业微信群机器人 ────────────────────────────▶ 推荐热备
      │
      │ (如需更多功能)
      ▼
正式服务号 (需企业资质 + ¥300/年) ────────────▶ 长期方案
```

### 迁移步骤

**测试号 → 企微机器人**:
1. 在企微群添加机器人，获取 Webhook URL
2. 设置 `WECOM_WEBHOOK_URL` secret
3. 修改 `PUSH_CHANNEL_PRIORITY=wecom_bot,wechat_test,pushplus`

**企微机器人 → 正式服务号**:
1. 申请微信服务号 (需企业资质)
2. 完成认证 (¥300/年)
3. 创建模板消息
4. 开发新的 Channel 实现
5. 添加到 Router

---

## 文件结构

```
src/outputs/push/
├── index.ts                 # Channel Router
├── types.ts                 # 类型定义
├── token-manager.ts         # Token 生命周期管理
├── registry.ts              # 身份注册表
└── channels/
    ├── wechat-test.ts       # 微信测试号 (默认)
    ├── wecom-bot.ts         # 企微机器人 (热备)
    └── pushplus.ts          # PushPlus (冷备)
```

---

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 + Channel 状态 |
| `/push/status` | GET | 推送通道状态 |
| `/push/test` | POST | 发送测试消息 |
| `/trigger` | POST | 手动触发抓取 |

---

## 验收标准

- [x] 不依赖任何单一推送通道
- [x] 测试号被禁 → 可 30 分钟内切换
- [x] 不需要改业务代码即可换 Channel
- [x] 不存在 env 中硬编码 openid
- [x] token 请求不会因并发放大

---

## P1 部署观察指标

### 核心指标（上线后 24-48 小时）

> **你自己会不会想把通知关掉？**
>
> - ❌ 不想关 → 系统方向对
> - ✅ 想关 → 不是技术问题，是信息设计问题

### 技术指标

| 指标 | 预期值 | 告警阈值 |
|------|--------|----------|
| Channel 健康率 | 100% | < 80% |
| 消息送达率 | > 95% | < 90% |
| Token 刷新频率 | ~12次/天 | > 50次/天 |
| 平均延迟 | < 5s | > 15s |

### Cron 频率治理

| 频率 | 评价 |
|------|------|
| 10 min | 偏激进 |
| **15 min** | 甜点区间 ✅ |
| 30 min | 信息滞后 |

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-01-09 | 初始版本：Channel 抽象、身份注册表、Token 管理、合并降噪 |

---

**声明**: 微信测试号是 P0/P1 默认实现，不是长期稳定承诺，可随时被替换。
