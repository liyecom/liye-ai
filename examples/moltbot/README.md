# Phase 0 Validation — Moltbot × LiYe OS × Amazon Growth Engine

目标：验证链路可行性与 trace_id 贯通（不引入新服务实体、不做写操作）。

## 架构原则

**单一大脑**: LiYe OS 是唯一决策大脑，Moltbot 作为 Thin-Agent 仅加载并执行 LiYe 下发的路由策略。

```
Moltbot Gateway (Thin-Agent)
        ↓ 加载路由策略
LiYe Governed Tool Call Gateway
        ↓ 治理 + trace_lite
Amazon Growth Engine MCP
```

## 必要前置

- LiYe Governed Tool Call Gateway 已可访问（复用现有 `examples/dify/governed-tool-call-gateway`）
- Amazon Growth Engine MCP 工具已启动/可被 Hub 访问
- Moltbot Gateway 已启动（本地 channel/WS 注入即可，Phase 0 不需要真实 WhatsApp/Telegram）

## 配置

复制 `examples/moltbot/mcp_config.yaml` 到 Moltbot 配置目录，设置：

```bash
export LIYE_GOV_GATEWAY_URL="http://localhost:3210"
```

## 路由策略

参见 `src/runtime/dispatcher/policies/moltbot-routing-v1.yaml`

| 操作类型 | 路由目标 | 治理级别 |
|---------|---------|---------|
| read | liye_executor | trace_lite |
| analyze | liye_executor | t1_t2_t3_check |
| write/delete/send/execute | liye_p3_gate | full_evidence_chain |

## 验收

运行 E2E 验证脚本：

```bash
./examples/moltbot/scripts/validate_e2e.sh
```

### 成功标准

| # | 标准 | 验证方法 |
|---|------|---------|
| 1 | 返回包含 trace_id | 检查响应 JSON |
| 2 | `.liye/traces/<trace_id>/` 写入 events.ndjson | `ls -la .liye/traces/` |
| 3 | 工具调用链路可用 | LiYe Gateway → Amazon MCP 工具响应正常 |

## Phase 0 约束

- 不引入写操作
- 不引入新服务实体
- 仅验证 Moltbot→LiYe Gateway→Amazon MCP 的可行性
- 真正通 WhatsApp/Telegram 放到后续 M1 扩展
