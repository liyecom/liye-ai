# Dify 整合进度交接文档

**文档版本**: 1.0
**生成日期**: 2026-02-02
**适用版本**: LiYe OS v6.3.0
**目的**: Dify 整合进度交接与开发指南

---

## 目录

1. [整合概述](#1-整合概述)
2. [架构设计](#2-架构设计)
3. [当前进度](#3-当前进度)
4. [核心组件详解](#4-核心组件详解)
5. [API 规范](#5-api-规范)
6. [飞书整合](#6-飞书整合)
7. [开发与测试](#7-开发与测试)
8. [部署指南](#8-部署指南)
9. [待完成工作](#9-待完成工作)
10. [故障排除](#10-故障排除)

---

## 1. 整合概述

### 1.1 整合目标

让普通用户在 Dify 平台"点点点"就能:
- 执行受治理的工具调用
- 获得 `trace_id` 用于审计追踪
- 理解为什么操作被 BLOCK/ALLOW

### 1.2 核心价值

| 特性 | 说明 |
|------|------|
| **可审计** | 每次工具调用产出 `trace_id` + 证据包 |
| **可解释** | BLOCK/ALLOW 决策有人类可读原因 |
| **可回放** | 证据包可重放验证 (确定性) |
| **可追溯** | 完整事件链 (events.ndjson) |

### 1.3 整合范围

```
┌─────────────────────────────────────────────────────────────┐
│                       Dify Cloud                             │
│                    (用户 Workflow)                           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP POST
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Governed Tool Call Gateway                      │
│           (examples/dify/governed-tool-call-gateway/)        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ /v1/governed│  │ /v1/feishu/ │  │ /trace/:id/:file    │  │
│  │ _tool_call  │  │ events      │  │ (证据文件访问)       │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
│         │                │                                   │
│         ▼                ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              LiYe Governance Kernel                  │    │
│  │           (src/governance/index.mjs)                 │    │
│  │                                                      │    │
│  │  Gate → Verdict → Replay → Evidence Package          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    .liye/traces/                             │
│  ├── events.ndjson   (追加写事件链)                          │
│  ├── verdict.json    (机器可读判定)                          │
│  ├── verdict.md      (人类可读判定)                          │
│  ├── replay.json     (回放验证结果)                          │
│  ├── action_plan.json (执行计划)                             │
│  ├── execution_result.json (执行结果)                        │
│  └── rollback_plan.json (回滚计划)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 架构设计

### 2.1 技术栈

| 层级 | 技术 |
|------|------|
| Gateway Server | Node.js (native http), ES Modules |
| Governance Kernel | JavaScript (ESM) |
| Trace Storage | NDJSON files (append-only) |
| API Spec | OpenAPI 3.0.3 |
| 隧道 | Cloudflare Tunnel (Named/Quick) |

### 2.2 决策语义

| Decision | 含义 | 工具执行 | HTTP Status |
|----------|------|----------|-------------|
| **ALLOW** | 安全，无风险 | ✓ 可执行 | 200 |
| **DEGRADE** | 有风险，谨慎执行 | ✓ 可执行 | 200 |
| **BLOCK** | 高风险 | ✗ 拒绝执行 | 200 |
| **UNKNOWN** | 无法评估 | ✗ 拒绝执行 | 500 |
| **PENDING** | 异步操作进行中 | ⏳ 等待 | 200 |

**Fail Closed 原则**: 治理系统错误/超时 → UNKNOWN → 不执行工具

### 2.3 安全机制

#### 2.3.1 API Key 认证

```javascript
// 环境变量
LIYE_API_KEY="your-secret-key"
LIYE_API_KEY_REQUIRED="1"  // 默认: 必须

// 请求头
X-LIYE-API-KEY: your-secret-key
// 或
Authorization: Bearer your-secret-key
```

#### 2.3.2 Write Gate (写入门控)

```javascript
// 环境变量 (默认: 禁用)
WRITE_ENABLED="0"  // 0=禁用写入, 1=启用写入

// 写入类型检测
const WRITE_ACTIONS = ['write', 'delete', 'execute', 'send'];
```

当 `WRITE_ENABLED=0` 时:
- 写入类型的 action 会被标记 `dry_run_only: true`
- decision 会从 ALLOW 降级为 DEGRADE
- 响应包含 `write_gate_reason: "WRITE_ENABLED=0"`

#### 2.3.3 四钥匙 ALL-of 门控 (P6-C)

**所有四个环境变量必须同时满足才能执行真实写入:**

| Key | 环境变量 | 必须值 | 所有者 |
|-----|----------|--------|--------|
| 1 | `ADS_OAUTH_MODE` | `write` | AGE |
| 2 | `DENY_READONLY_ENV` | `false` | LiYe |
| 3 | `ALLOW_LIVE_WRITES` | `true` | LiYe |
| 4 | `WRITE_ENABLED` | `1` | LiYe |

---

## 3. 当前进度

### 3.1 Phase 里程碑

| Phase | 时间 | 内容 | 状态 |
|-------|------|------|------|
| **Phase 1** | 2026-01-24 | 基础 Gateway + OpenAPI | ✅ 完成 |
| **Week 2** | 2026-01-25 | 飞书 Thin-Agent 事件处理 | ✅ 完成 |
| **Week 3** | 2026-01-26 | Evidence Package + 静态文件服务 | ✅ 完成 |
| **Week 4** | 2026-01-27 | Approval Shell + Write Gate | ✅ 完成 |
| **Week 5** | 2026-01-28 | Dry-run 执行 + 结果文件 | ✅ 完成 |
| **Phase 2 W1** | 2026-01-31 | Real Write Gray Launch + Rollback | ✅ 完成 |
| **P6-C** | 2026-02-01 | 四钥匙门控 + 监督写入实验 | ✅ 完成 |

### 3.2 已实现功能

#### Gateway Endpoints

| Endpoint | 方法 | 功能 | Week |
|----------|------|------|------|
| `/v1/governed_tool_call` | POST | 治理工具调用 | Week 1 |
| `/v1/feishu/events` | POST | 飞书事件 Webhook | Week 2 |
| `/v1/feishu/actions` | POST | 飞书动作回调 | Week 3 |
| `/trace/:id/:file` | GET | 证据文件静态服务 | Week 3 |
| `/health` | GET | 健康检查 | Week 1 |

#### 支持的证据文件

```javascript
const ALLOWED_EVIDENCE_FILES = [
  'evidence_package.md',
  'dry_run_plan.md',
  'verdict.md',
  'verdict.json',
  'replay.json',
  'action_plan.md',       // Week 4
  'action_plan.json',     // Week 4
  'approval.json',        // Week 4
  'execution_result.md',  // Week 5
  'execution_result.json', // Week 5
  'rollback_plan.md',     // Phase 2 Week 1
  'rollback_plan.json'    // Phase 2 Week 1
];
```

#### AGE MCP 工具白名单

```javascript
const AGE_MCP_TOOLS = [
  'amazon://strategy/campaign-audit',
  'amazon://strategy/keyword-list',
  'amazon://strategy/keyword-performance',
  'amazon://strategy/wasted-spend-detect',
  'amazon://execution/dry-run'
];
```

### 3.3 已支持的 Contracts

| Contract | 版本 | 用途 |
|----------|------|------|
| `GOV_TOOL_CALL_REQUEST_V1` | 1.0 | 请求 Schema |
| `GOV_TOOL_CALL_RESPONSE_V1` | 1.0 | 响应 Schema |
| `TRACE_REQUIRED_FIELDS_V1` | 1.0 | Trace 必需字段 |
| `ACTION_PLAN_V1` | 1.0 | 执行计划 Schema |
| `APPROVAL_STATE_V1` | 1.0 | 审批状态 Schema |
| `EXECUTION_RESULT_V1` | 1.0 | 执行结果 Schema |

---

## 4. 核心组件详解

### 4.1 文件结构

```
examples/dify/governed-tool-call-gateway/
├── server.mjs           # 主服务器 (610 行)
├── openapi.yaml         # OpenAPI 3.0.3 规范
├── README.md            # 快速入门
├── .env                 # 环境配置 (本地)
└── .liye/traces/        # 证据包存储
    └── trace-xxx/
        ├── events.ndjson
        ├── verdict.json
        ├── verdict.md
        └── replay.json
```

### 4.2 server.mjs 核心逻辑

#### 4.2.1 请求处理流程

```javascript
async function handleGovernedToolCall(req, res) {
  // 1. CORS 头设置
  // 2. API Key 验证
  // 3. 解析请求体 {task, context, proposed_actions}
  // 4. Write Gate 检查
  // 5. AGE MCP 路由 (如果工具在白名单)
  // 6. 运行治理周期 (runGovernanceCycle)
  // 7. 生成响应 (Contract-compliant)
  // 8. 写入 gateway.response 事件
}
```

#### 4.2.2 AGE MCP 路由

```javascript
async function routeToAgeMcp(tool, args, traceId) {
  const url = `${AGE_MCP_CONFIG.base_url}/v1/tools/call`;
  // POST 到 AGE MCP 服务器
  // 超时: 5000ms
  // 失败: 返回 mock fallback (DEGRADE, 不是 BLOCK)
}
```

#### 4.2.3 Mock Fallback 响应

当 AGE MCP 不可用时，返回 mock 响应而不是阻断:

```javascript
function createMockFallbackResponse(tool, args, traceId, error) {
  return {
    origin: 'liye_os.mock',
    origin_proof: false,
    phase0_only: true,
    mock_used: true,
    fallback_reason: error,
    result: { /* simulated data */ },
    GUARANTEE: {
      no_real_write: true,
      mock_used: true,
      fallback_active: true
    }
  };
}
```

### 4.3 Governance Kernel 集成

```javascript
// 加载治理内核
const { runGovernanceCycle } = await import(
  join(GOVERNANCE_ROOT, 'index.mjs')
);

// 运行治理周期
const result = await runGovernanceCycle({
  task,
  context: {
    ...context,
    age_results: ageResults,
    mock_used: mockUsed,
    tenant_id: tenantId
  },
  proposed_actions: gatedActions
}, {
  baseDir: TRACE_BASE_DIR
});
```

---

## 5. API 规范

### 5.1 请求格式

```yaml
POST /v1/governed_tool_call
Content-Type: application/json
X-LIYE-API-KEY: your-api-key

{
  "task": "Search knowledge base for product info",
  "context": {},
  "proposed_actions": [
    {
      "action_type": "read",
      "tool": "semantic_search",
      "arguments": {
        "query": "ACOS optimization"
      }
    }
  ],
  "tenant_id": "optional-tenant"
}
```

### 5.2 响应格式

**成功 (ALLOW/DEGRADE):**
```json
{
  "ok": true,
  "result": {
    "message": "Action approved for execution",
    "age_results": [...]
  },
  "decision": "ALLOW",
  "origin": "amazon-growth-engine",
  "origin_proof": true,
  "mock_used": false,
  "policy_version": "phase1-v1.0.0",
  "trace_id": "trace-1706097600-abc123",
  "evidence_path": ".liye/traces/trace-1706097600-abc123/",
  "verdict_summary": "Action approved: no risks detected.",
  "replay_status": "PASS",
  "write_enabled": false,
  "write_calls_attempted": 0
}
```

**阻断 (BLOCK):**
```json
{
  "ok": false,
  "error": "Action blocked: dangerous_action",
  "decision": "BLOCK",
  "origin": "liye_os.mock",
  "origin_proof": false,
  "mock_used": true,
  "policy_version": "phase1-v1.0.0",
  "trace_id": "trace-1706097600-def456",
  "evidence_path": ".liye/traces/trace-1706097600-def456/",
  "verdict_summary": "Action blocked: dangerous_action. Attempting to delete system file",
  "replay_status": "PASS"
}
```

### 5.3 Action Types

| Type | 风险级别 | 说明 |
|------|----------|------|
| `read` | 最安全 | 查询/搜索操作 |
| `write` | 中等 | 创建/更新操作 |
| `delete` | 危险 | 删除操作 |
| `send` | 中等 | 外部通信 (邮件/通知) |
| `execute` | 通用 | 通用执行 |

---

## 6. 飞书整合

### 6.1 文件结构

```
examples/feishu/
├── feishu_adapter.mjs       # 事件适配器
├── feishu_actions.mjs       # 动作处理器
├── feishu_client.mjs        # 飞书 API 客户端
├── approvers.json           # 审批人配置
├── tenant_map.json          # 租户映射
├── write_scope_allowlist.json # 写入白名单
├── cards/
│   ├── verdict_card_v1.json     # 卡片模板
│   └── render_verdict_card.mjs  # 卡片渲染
└── fixtures/
    ├── event_message.json       # 消息事件示例
    ├── action_approve.json      # 审批动作示例
    ├── action_reject.json       # 拒绝动作示例
    └── ...
```

### 6.2 飞书 Thin-Agent 流程

```
┌─────────────────┐
│   飞书用户       │
│   @Bot 消息     │
└────────┬────────┘
         │ Webhook
         ▼
┌─────────────────────────────────────────────────────────────┐
│  /v1/feishu/events (feishu_adapter.mjs)                     │
│  1. 验证签名                                                 │
│  2. 解析消息内容                                             │
│  3. 调用 /v1/governed_tool_call                             │
│  4. 渲染 Verdict Card                                       │
│  5. 发送交互式卡片到飞书                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  飞书交互式卡片                                              │
│  [审批] [拒绝] [Dry-Run] [查看证据]                          │
└─────────────────────────┬───────────────────────────────────┘
                          │ 用户点击按钮
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  /v1/feishu/actions (feishu_actions.mjs)                    │
│  处理: approve / reject / execute_dry_run / generate_rollback│
└─────────────────────────────────────────────────────────────┘
```

### 6.3 支持的飞书动作

| 动作 | 说明 | 文件 |
|------|------|------|
| `approve` | 审批通过 | `action_approve.json` |
| `reject` | 拒绝 | `action_reject.json` |
| `execute_dry_run` | 执行 Dry-Run | `action_execute_dry_run.json` |
| `execute_real` | 执行真实写入 | `action_execute_real.json` |
| `generate_rollback` | 生成回滚计划 | `action_generate_rollback.json` |
| `submit_approval` | 提交审批申请 | `action_submit_approval.json` |

---

## 7. 开发与测试

### 7.1 本地开发

```bash
# 进入项目目录
cd ~/github/liye_os

# 启动 Gateway (默认端口 3210)
node examples/dify/governed-tool-call-gateway/server.mjs

# 自定义端口
PORT=8080 node examples/dify/governed-tool-call-gateway/server.mjs

# 启用 API Key
LIYE_API_KEY="test-key" node examples/dify/governed-tool-call-gateway/server.mjs
```

### 7.2 测试命令

```bash
# 健康检查
curl http://localhost:3210/health

# ALLOW case (安全读取)
curl -X POST http://localhost:3210/v1/governed_tool_call \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Search knowledge base",
    "proposed_actions": [
      {"action_type": "read", "tool": "semantic_search", "arguments": {"query": "test"}}
    ]
  }'

# BLOCK case (危险删除)
curl -X POST http://localhost:3210/v1/governed_tool_call \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Delete system files",
    "proposed_actions": [
      {"action_type": "delete", "tool": "rm_rf", "arguments": {"path": "/etc"}}
    ]
  }'

# 带 API Key
curl -X POST http://localhost:3210/v1/governed_tool_call \
  -H "Content-Type: application/json" \
  -H "X-LIYE-API-KEY: your-key" \
  -d '{"task": "test", "proposed_actions": [{"action_type": "read", "tool": "test"}]}'
```

### 7.3 查看证据包

```bash
# 查看最新 traces
ls -lt examples/dify/governed-tool-call-gateway/.liye/traces/ | head -5

# 查看特定 trace
cat examples/dify/governed-tool-call-gateway/.liye/traces/trace-xxx/verdict.md

# 查看事件链
cat examples/dify/governed-tool-call-gateway/.liye/traces/trace-xxx/events.ndjson

# 通过 API 访问
curl http://localhost:3210/trace/trace-xxx/verdict.md
```

### 7.4 一键验证脚本

```bash
# 验证 Gateway 就绪状态
./.claude/scripts/check_gateway_ready.sh

# 复制 OpenAPI 到剪贴板
./.claude/scripts/print_openapi.sh --copy
```

---

## 8. 部署指南

### 8.1 生产环境配置

**永久公网地址**: `https://gateway.liye.ai`

通过 Cloudflare Named Tunnel 提供，配置:
```yaml
tunnel_type: cloudflared_named
tunnel_id: 840d7f6f-a439-4c7c-b40f-85e6f6cd08b3
public_url: https://gateway.liye.ai
api_key_required: true
```

### 8.2 启动命令

```bash
# 生产环境 (后台运行)
LIYE_API_KEY="your-secret-key" \
  node examples/dify/governed-tool-call-gateway/server.mjs &

cloudflared tunnel run &

# 开发环境 (Quick Tunnel)
node examples/dify/governed-tool-call-gateway/server.mjs
cloudflared tunnel --url http://localhost:3210
```

### 8.3 Dify 导入步骤

1. 登录 [Dify Cloud](https://cloud.dify.ai)
2. 进入 **Tools** → **Custom**
3. 点击 **Create Custom Tool**
4. 选择 **Import from OpenAPI/Swagger**
5. 粘贴 `openapi.yaml` 内容
6. 设置 **Server URL**: `https://gateway.liye.ai`
7. 配置 **Authorization**:
   - Type: Header
   - Auth Type: Custom
   - Key: `X-LIYE-API-KEY`
   - Value: 你的 API Key
8. 点击 **Save**

---

## 9. 待完成工作

### 9.1 短期 (1-2 周)

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | AGE MCP 服务器稳定性 | 减少 mock fallback 频率 |
| P1 | 飞书 Bot 公开部署 | 需要 Lark 开发者账号 |
| P1 | Trace 存储优化 | 考虑 SQLite/PostgreSQL |

### 9.2 中期 (1-2 月)

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P1 | 多租户隔离 | 基于 tenant_id 的 trace 隔离 |
| P2 | Webhook 重试机制 | 飞书事件丢失恢复 |
| P2 | 监控 Dashboard | Grafana + Prometheus |

### 9.3 长期 (3+ 月)

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P2 | Dify Plugin SDK | 原生 Dify 插件 (而非 Custom Tool) |
| P3 | 多 LLM 后端支持 | OpenAI / Anthropic / 本地模型 |
| P3 | 审批流工作流化 | 可配置的审批链 |

---

## 10. 故障排除

### 10.1 常见问题

#### Q1: "Connection refused"

**原因**: Gateway 未运行

**解决**:
```bash
node examples/dify/governed-tool-call-gateway/server.mjs
```

#### Q2: "Unauthorized: Invalid or missing API key"

**原因**: API Key 不匹配或缺失

**解决**:
1. 检查环境变量 `LIYE_API_KEY`
2. 检查请求头 `X-LIYE-API-KEY`
3. 或禁用 API Key: `LIYE_API_KEY_REQUIRED=0`

#### Q3: decision 为 DEGRADE 而非 ALLOW

**可能原因**:
1. AGE MCP 不可用 (mock_used=true)
2. WRITE_ENABLED=0 且有写入操作
3. 检测到轻微风险

**检查**:
```bash
# 查看响应中的 fallback_reason 和 write_gate_reason
```

#### Q4: 没有生成 traces

**原因**: 目录权限问题

**解决**:
```bash
mkdir -p examples/dify/governed-tool-call-gateway/.liye/traces
chmod 755 examples/dify/governed-tool-call-gateway/.liye/traces
```

#### Q5: 隧道 URL 变化

**原因**: Quick Tunnel 每次重启生成新 URL

**解决**:
1. 使用 Named Tunnel (生产)
2. 或在 Dify 中更新 Server URL

### 10.2 调试日志

Gateway 启动时会显示:
```
╔═══════════════════════════════════════════════════════════════╗
║  Governed Tool Call Gateway (Phase 2 Week1)                   ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoint: http://localhost:3210/v1/governed_tool_call        ║
║  Policy:   phase1-v1.0.0                                      ║
║  WRITE_ENABLED: OFF (Safe)                                    ║
╚═══════════════════════════════════════════════════════════════╝
```

运行时日志:
```
[AGE MCP] Failed: ECONNREFUSED
[Trace] Written verdict to .liye/traces/trace-xxx/verdict.json
[LiveRunSpec] Created spec at .liye/traces/trace-xxx/live_run_spec.json
```

---

## 附录 A: 关键文件清单

| 文件 | 用途 |
|------|------|
| `examples/dify/governed-tool-call-gateway/server.mjs` | 主服务器 |
| `examples/dify/governed-tool-call-gateway/openapi.yaml` | API 规范 |
| `docs/integrations/DIFY_GOVERNED_DEMO_V1.md` | 集成指南 |
| `docs/integrations/DIFY_IMPORT_ONE_PAGER_V1.md` | 快速导入 |
| `docs/plans/2026-01-24-dify-governed-gateway.md` | 实现计划 |
| `docs/plans/2026-01-31-p6c-supervised-write-experiment.md` | P6-C 计划 |
| `examples/feishu/feishu_adapter.mjs` | 飞书事件适配器 |
| `examples/feishu/feishu_actions.mjs` | 飞书动作处理器 |

---

## 附录 B: 相关文档

- [DIFY_GOVERNED_DEMO_V1.md](./integrations/DIFY_GOVERNED_DEMO_V1.md) - 完整集成指南
- [DIFY_IMPORT_ONE_PAGER_V1.md](./integrations/DIFY_IMPORT_ONE_PAGER_V1.md) - 5分钟快速导入
- [FEISHU_BOT_ONE_PAGER_V1.md](./integrations/FEISHU_BOT_ONE_PAGER_V1.md) - 飞书 Bot 指南
- [P6C_HUMAN_APPROVAL_SOP.md](./sops/P6C_HUMAN_APPROVAL_SOP.md) - 人工审批 SOP

---

**文档版本**: 1.0
**最后更新**: 2026-02-02
**字数**: ~3,500 中文字符
