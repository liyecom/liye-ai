# Dify + LiYe Governed Tool Call 集成指南 v1

## 概述

本文档指导你在 Dify 中集成 LiYe Governance Kernel，实现：

- **可审计**：每次工具调用产出 trace_id + 证据包
- **可解释**：BLOCK/ALLOW 决策有人类可读原因
- **可回放**：证据包可重放验证

架构：
```
Dify Workflow → Custom Tool → HTTP Gateway → LiYe Governance Kernel
                                    │
                                    ▼
                            .liye/traces/
                            ├── events.ndjson
                            ├── verdict.json
                            ├── verdict.md
                            └── replay.json
```

---

## 快速开始

### 1. 启动 Gateway

```bash
cd ~/github/liye_os

# 确保 Node.js 20+
node --version

# 启动服务（默认端口 3210）
node examples/dify/governed-tool-call-gateway/server.mjs

# 或自定义端口
PORT=8080 node examples/dify/governed-tool-call-gateway/server.mjs
```

看到以下输出表示成功：
```
╔═══════════════════════════════════════════════════════════════╗
║  Governed Tool Call Gateway for Dify                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoint: http://localhost:3210/v1/governed_tool_call        ║
║  Health:   http://localhost:3210/health                       ║
╚═══════════════════════════════════════════════════════════════╝
```

### 2. 验证 Gateway

```bash
# 健康检查
curl http://localhost:3210/health

# ALLOW case（安全读取）
curl -X POST http://localhost:3210/v1/governed_tool_call \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Search knowledge base",
    "proposed_actions": [{"action_type": "read", "tool": "semantic_search", "arguments": {"query": "test"}}]
  }'

# BLOCK case（危险删除）
curl -X POST http://localhost:3210/v1/governed_tool_call \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Delete system files",
    "proposed_actions": [{"action_type": "delete", "tool": "rm_rf", "arguments": {"path": "/etc"}}]
  }'
```

---

## Dify 集成步骤

### Step 1: 导入 Custom Tool

1. 登录 Dify → **Tools** → **Custom**
2. 点击 **Create Custom Tool**
3. 选择 **Import from OpenAPI/Swagger**
4. 粘贴 `examples/dify/governed-tool-call-gateway/openapi.yaml` 内容

或者直接使用 URL（如果你部署了公网）：
```
http://your-server:3210/v1/governed_tool_call
```

### Step 2: 配置 Server URL

在 Dify Custom Tool 配置中，设置 Server URL：
- 本地开发：`http://localhost:3210`
- 生产环境：`https://your-gateway-domain.com`

### Step 3: 测试 Tool

在 Dify 中测试 `governedToolCall` 工具：

**输入参数：**
```json
{
  "task": "Search for product optimization tips",
  "proposed_actions": [
    {
      "action_type": "read",
      "tool": "semantic_search",
      "arguments": {
        "query": "ACOS optimization"
      }
    }
  ]
}
```

**预期输出：**
```json
{
  "ok": true,
  "decision": "ALLOW",
  "trace_id": "trace-xxx",
  "verdict_summary": "Action approved: no risks detected."
}
```

---

## Demo Workflow

### Demo 1: ALLOW Case（知识库查询）

创建一个 Workflow，包含：

1. **Start** → 用户输入 query
2. **governedToolCall** → 调用治理工具
   ```yaml
   task: "Query knowledge base: {{query}}"
   proposed_actions:
     - action_type: read
       tool: semantic_search
       arguments:
         query: "{{query}}"
   ```
3. **If/Else** → 检查 `decision == "ALLOW"`
4. **LLM** → 基于结果生成回复
5. **End** → 返回结果 + trace_id

**用户体验：**
```
用户: 如何优化 ACOS?
Bot: [执行 governed tool call]
     Decision: ALLOW
     Trace: trace-1706097600-abc123
     结果: ACOS 优化策略包括...
```

### Demo 2: BLOCK Case（危险操作拦截）

创建另一个 Workflow，演示 BLOCK：

1. **Start** → 用户输入危险请求
2. **governedToolCall** → 调用治理工具
   ```yaml
   task: "User wants to: {{request}}"
   proposed_actions:
     - action_type: delete
       tool: filesystem_delete
       arguments:
         path: "{{target_path}}"
   ```
3. **If/Else** → 检查 `decision == "BLOCK"`
4. **LLM** → 解释为什么被拦截
5. **End** → 返回拦截原因 + trace_id

**用户体验：**
```
用户: 删除 /etc/passwd
Bot: [执行 governed tool call]
     Decision: BLOCK
     Trace: trace-1706097600-def456
     原因: 操作被拦截 - 尝试删除系统文件是高风险行为
```

---

## 查看证据包

每次调用都会在 `.liye/traces/` 生成证据包：

```bash
# 查看最新 trace
ls -lt .liye/traces/ | head -5

# 查看特定 trace
cat .liye/traces/trace-xxx/verdict.md

# 查看事件链
cat .liye/traces/trace-xxx/events.ndjson

# 查看回放结果
cat .liye/traces/trace-xxx/replay.json
```

证据包结构：
```
.liye/traces/trace-xxx/
├── events.ndjson   # 追加写事件链（带哈希）
├── verdict.json    # 机器可读判定
├── verdict.md      # 人类可读判定
└── replay.json     # 重放验证结果
```

---

## 决策语义

| Decision | 含义 | 工具执行 |
|----------|------|----------|
| ALLOW | 安全，无风险 | ✓ 可执行 |
| DEGRADE | 有风险，谨慎执行 | ✓ 可执行 |
| BLOCK | 高风险 | ✗ 拒绝执行 |
| UNKNOWN | 无法评估 | ✗ 拒绝执行 (Fail Closed) |

**Fail Closed 原则**：治理系统错误/超时 → UNKNOWN → 不执行工具

---

## 故障排除

### "Connection refused"

确保 Gateway 正在运行：
```bash
curl http://localhost:3210/health
```

### "Governance error"

检查 Node.js 版本：
```bash
node --version  # 应该是 20+
```

### 没有生成 traces

检查目录权限：
```bash
mkdir -p .liye/traces
ls -la .liye/traces/
```

---

## 版本历史

- v1.0.0 (2026-01-24): 初始版本，实现 HTTP Gateway + OpenAPI Schema
