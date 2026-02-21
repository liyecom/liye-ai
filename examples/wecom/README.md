# 企业微信自建应用适配器

企业微信双向交互 Thin-Agent，基于 Cloudflare Workers 部署。

## 架构

```
企业微信 ──POST(加密)──▶ CF Worker (Thin Adapter) ──POST──▶ LiYe OS Gateway ──▶ AGE
    ▲                      │                                   │
    │                      │ 仅做: 验签/解密/标准化/幂等/投递    │
    │                      │ 不做: 意图检测/策略决策             │
    │                      ▼                                   │
    └──────── markdown ◀── 异步推送结果 ◀─────────────────────────┘
```

**Thin-Agent 原则**：
- 适配器只做：verify → decrypt → standardize → forward → render
- 适配器不做：intent detection, tool selection, decision logic
- 所有决策逻辑在 LiYe OS Gateway

## P0 门槛

### P0-1: 幂等（双层保障）
- **Worker KV (第一道闸)**：基于稳定字段生成 `dedupeKey`
- **Gateway (权威)**：以 `idempotency_key` 做权威判定

### P0-2: 异步执行预算
- 20 秒硬门槛
- 超时发送 pending 卡片（带 trace_id + 回查指令）

### P0-3: S2S 鉴权
- HMAC-SHA256 签名
- Nonce 防重放（KV 存储 5 分钟）

### P0-4: URL 验证
- GET 请求返回纯明文 echostr
- Content-Type: text/plain（不能 JSON 包装）

## 目录结构

```
examples/wecom/
├── src/
│   ├── index.ts                 # Worker 入口
│   ├── crypto/
│   │   ├── aes.ts               # AES-256-CBC 加解密
│   │   └── signature.ts         # SHA1/SHA256/HMAC 签名
│   ├── handlers/
│   │   └── event_handler.ts     # Thin 事件处理
│   ├── client/
│   │   ├── token_manager.ts     # AccessToken 管理
│   │   └── message_sender.ts    # 消息发送
│   └── cards/
│       ├── verdict_card.ts      # 决策卡片渲染
│       └── pending_card.ts      # Pending/Error 卡片
├── wrangler.toml                # CF Workers 配置
└── README.md
```

## 部署步骤

### 1. 创建企业微信自建应用

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/frame)
2. 应用管理 → 自建 → 创建应用
3. 记录以下信息：
   - **CorpID**：企业信息 → 企业ID
   - **AgentID**：应用详情页
   - **Secret**：应用详情页 → 查看

### 2. 配置消息接收

1. 应用详情 → 开发者接口 → 消息接收
2. 设置 URL：`https://your-worker.your-domain.workers.dev`
3. 生成 Token 和 EncodingAESKey
4. **先完成步骤 3-4 再点验证**

### 3. 创建 KV Namespaces

```bash
cd examples/wecom

# 创建 KV 命名空间
wrangler kv:namespace create "TOKEN_CACHE"
wrangler kv:namespace create "IDEMPOTENT_KV"
wrangler kv:namespace create "NONCE_KV"

# 更新 wrangler.toml 中的 KV ID
```

### 4. 配置 Secrets

```bash
# 企业微信配置
wrangler secret put WECOM_CORPID
wrangler secret put WECOM_AGENT_ID
wrangler secret put WECOM_SECRET
wrangler secret put WECOM_TOKEN
wrangler secret put WECOM_ENCODING_AES_KEY

# LiYe OS 集成
wrangler secret put LIYE_GATEWAY_URL
wrangler secret put LIYE_HMAC_SECRET
```

### 5. 部署

```bash
# 部署 Worker
wrangler deploy

# 查看日志
wrangler tail
```

### 6. 验证 URL

回到企业微信管理后台，点击验证 URL。

## 验证清单

### Milestone A: 接入成功

- [ ] URL 验证通过（企业微信显示绿色勾）
- [ ] 私聊能收到 markdown 回执
- [ ] 群聊能收到 markdown 回执
- [ ] dedupeKey 稳定（不依赖 Encrypt.slice）
- [ ] 重复消息被幂等处理

### Milestone B: 治理闭环

- [ ] trace_id 端到端可追踪
- [ ] Nonce 重放被拒绝（Gateway 返回 401）
- [ ] pending 卡片可回查

### Milestone C: 可靠交付

- [ ] 超时收到 pending 卡片
- [ ] 日志无敏感信息（用户 ID 脱敏）

## 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `WECOM_CORPID` | 企业 ID | `ww1234567890` |
| `WECOM_AGENT_ID` | 应用 ID | `1000002` |
| `WECOM_SECRET` | 应用 Secret | `xxx` |
| `WECOM_TOKEN` | 消息加解密 Token | `xxx` |
| `WECOM_ENCODING_AES_KEY` | 消息加解密 Key | 43 字符 |
| `LIYE_GATEWAY_URL` | Gateway URL | `https://gateway.example.com` |
| `LIYE_HMAC_SECRET` | S2S 签名密钥 | `xxx` |

## 消息格式

### 用户发送消息
```
查看最近7天的广告表现
```

### 收到决策卡片
```markdown
## ✅ LiYe Verdict · ALLOW

**摘要**：已通过治理检查，可继续执行下一步。

---
**Trace ID**：`trace-1234567890-abcd1234`
**来源**：`amazon-growth-engine`
**策略版本**：`phase1-v1.0.0`

---
*Thin-Agent: 企微侧仅转发与展示*
```

### 超时收到 Pending 卡片
```markdown
## ⏳ 已接收，处理中

**Trace ID**：`trace-1234567890-abcd1234`

---
**查询状态**：私聊发送
> /status trace-1234567890-abcd1234

**预计完成**：3-5 分钟

---
*完成后将自动推送结果到本群*
```

## 调试

### 查看 Worker 日志
```bash
wrangler tail
```

### 检查 KV 状态
```bash
# 列出 idempotency keys
wrangler kv:key list --namespace-id=<IDEMPOTENT_KV_ID>

# 查看特定 key
wrangler kv:key get <key> --namespace-id=<IDEMPOTENT_KV_ID>
```

### 手动触发 Token 刷新
```bash
curl https://your-worker.workers.dev/health
```

## 故障排除

### URL 验证失败
1. 检查 Token 和 EncodingAESKey 是否正确
2. 确认 Worker 已部署并可访问
3. 查看 `wrangler tail` 日志

### 消息收不到回复
1. 检查 LIYE_GATEWAY_URL 是否可达
2. 查看 Gateway 日志
3. 检查 HMAC_SECRET 是否一致

### 重复消息
1. 检查 IDEMPOTENT_KV 是否正确配置
2. 查看 KV 中的 status
3. 如果需要重试，可手动删除 KV 条目

## 参考文档

- [企业微信开发文档](https://developer.work.weixin.qq.com/document/path/90232)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [LiYe OS Gateway](../../src/gateway/README.md)

## License

MIT
