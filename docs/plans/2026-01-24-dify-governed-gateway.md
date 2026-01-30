# P1: Dify Governed Tool Call Gateway 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让普通用户在 Dify "点点点"就能跑出 trace_id，并能解释为什么 BLOCK/ALLOW

**Architecture:** HTTP Gateway 暴露单一 endpoint，调用 LiYe Governance Kernel，返回带 trace_id 的决策结果

**Tech Stack:** Node.js (native http), ES Modules, LiYe Governance Kernel

---

## Task 1: 创建目录结构

**Files:**
- Create: `examples/dify/governed-tool-call-gateway/` (目录)

**Step 1: 创建目录**
```bash
mkdir -p examples/dify/governed-tool-call-gateway
```

**Step 2: 确认目录存在**
```bash
ls -la examples/dify/
```

**Step 3: Commit**
```bash
git add examples/dify/
git commit -m "chore: scaffold dify gateway directory"
```

---

## Task 2: 实现 HTTP Gateway (server.mjs)

**Files:**
- Create: `examples/dify/governed-tool-call-gateway/server.mjs`

**Step 1: 编写 server.mjs**

核心逻辑：
1. 启动 HTTP 服务，监听 POST /v1/governed_tool_call
2. 解析 JSON body: `{task, context, proposed_actions}`
3. 调用 `runGovernanceCycle` (从 src/governance/index.mjs)
4. 返回统一格式:
```json
{
  "ok": true/false,
  "result": {},
  "decision": "ALLOW|DEGRADE|BLOCK|UNKNOWN",
  "trace_id": "trace-xxx",
  "evidence_path": ".liye/traces/trace-xxx/",
  "verdict_summary": "人类可读的决策原因"
}
```

**Step 2: 验证语法**
```bash
node --check examples/dify/governed-tool-call-gateway/server.mjs
```
Expected: 无输出（语法正确）

**Step 3: 本地测试启动**
```bash
node examples/dify/governed-tool-call-gateway/server.mjs &
curl -X POST http://localhost:3210/v1/governed_tool_call \
  -H "Content-Type: application/json" \
  -d '{"task":"test","proposed_actions":[{"action_type":"read","tool":"test"}]}'
```
Expected: 返回 JSON with trace_id

---

## Task 3: 创建 OpenAPI Schema (openapi.yaml)

**Files:**
- Create: `examples/dify/governed-tool-call-gateway/openapi.yaml`

**Step 1: 编写 OpenAPI 3.0 规范**

必须包含：
- POST /v1/governed_tool_call
- 请求体 schema
- 响应体 schema
- 服务器 URL（可配置）

**Step 2: 验证 YAML 语法**
```bash
node -e "const yaml = require('yaml'); console.log(JSON.stringify(yaml.parse(require('fs').readFileSync('examples/dify/governed-tool-call-gateway/openapi.yaml', 'utf8')), null, 2))"
```

---

## Task 4: 编写 Dify 样板文档

**Files:**
- Create: `docs/integrations/DIFY_GOVERNED_DEMO_V1.md`

**内容必须包含：**

1. 启动 gateway
2. Dify → Tools → Custom → Import via OpenAPI
3. 两条 workflow demo:
   - ALLOW demo: semantic_search → 返回结果 + trace_id
   - BLOCK demo: send_email/delete → 被 BLOCK + trace_id

---

## Task 5: 验证 DoD

**Step 1: 启动 Gateway**
```bash
node examples/dify/governed-tool-call-gateway/server.mjs
```

**Step 2: ALLOW case 测试**
```bash
curl -X POST http://localhost:3210/v1/governed_tool_call \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Search knowledge base",
    "proposed_actions": [{"action_type": "read", "tool": "semantic_search", "arguments": {"query": "test"}}]
  }'
```
Expected: `"decision": "ALLOW"`, `"trace_id": "trace-xxx"`

**Step 3: BLOCK case 测试**
```bash
curl -X POST http://localhost:3210/v1/governed_tool_call \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Delete system files",
    "proposed_actions": [{"action_type": "delete", "tool": "rm_rf", "arguments": {"path": "/etc"}}]
  }'
```
Expected: `"decision": "BLOCK"`, 有 `verdict_summary` 解释原因

**Step 4: 验证证据包**
```bash
ls -la .liye/traces/
```
Expected: 有新生成的 trace 目录

---

## DoD Checklist

- [ ] Gateway 能启动，监听 3210 端口
- [ ] POST /v1/governed_tool_call 正常工作
- [ ] ALLOW case 返回 trace_id + replay PASS
- [ ] BLOCK case 返回 trace_id + 人类可读原因
- [ ] .liye/traces/ 有证据包
- [ ] OpenAPI schema 可导入 Dify
- [ ] 文档清晰可执行
