# CrewAI + LiYe Governance Kernel Integration v1

## 什么是 Governed Tool Call？

普通 CrewAI Agent 执行工具时：
```
Agent → Tool → Execute → Done
```

问题：
- 没有审计记录
- 危险操作可能被执行
- 无法回放验证

**Governed Tool Call** 在每次工具调用前后加入治理闭环：
```
Agent → Gate → (ALLOW? Execute : BLOCK) → Verdict → Replay → Evidence
```

每次调用产出证据包 `.liye/traces/<trace_id>/`，可审计、可回放、可追责。

---

## 快速开始

### 1. 安装 CrewAI（可选依赖）

```bash
pip install -r src/runtime/requirements.crewai.txt
```

### 2. 启用治理

```bash
export LIYE_GOVERNANCE_ENABLED=1
```

### 3. 使用 GovernedMCPToolProvider

```python
from src.runtime.mcp.registry import MCPRegistry
from src.runtime.mcp.adapters import GovernedMCPToolProvider

# 加载 registry
registry = MCPRegistry.from_config("config/mcp_servers.yaml")

# 创建治理版 provider
provider = GovernedMCPToolProvider(registry)

# 获取工具 - 每次调用都经过治理
tools = provider.get_tools(["qdrant-knowledge"])

# 用于 CrewAI Agent
from crewai import Agent
agent = Agent(role="Researcher", tools=tools, ...)
```

### 4. 运行 Smoke Test

```bash
python3 .claude/scripts/crewai_governance_smoke_test.py
```

### 5. 查看证据包

```bash
ls -la .liye/traces/

# 每个 trace 包含：
#   events.ndjson  - 追加写事件链（带哈希）
#   verdict.json   - 机器可读判定
#   verdict.md     - 人类可读判定
#   replay.json    - 重放验证结果
```

---

## 决策语义

| Decision | 含义 | 工具执行 |
|----------|------|----------|
| ALLOW | 安全，无风险 | ✓ 执行 |
| DEGRADE | 有风险，谨慎执行 | ✓ 执行 |
| BLOCK | 高风险 | ✗ 拒绝 |
| UNKNOWN | 无法评估 | ✗ 拒绝 (Fail Closed) |

**Fail Closed**: 治理错误/超时 → UNKNOWN → 不执行工具

---

## 返回结构

每个工具调用返回统一格式：

```json
{
  "ok": true,
  "result": { ... },
  "trace_id": "trace-xxxx",
  "evidence_path": ".liye/traces/trace-xxxx/",
  "governance": { "decision": "ALLOW" }
}
```

BLOCK/UNKNOWN 时：
```json
{
  "ok": false,
  "error": "Blocked by governance",
  "trace_id": "trace-xxxx",
  "evidence_path": ".liye/traces/trace-xxxx/",
  "governance": { "decision": "BLOCK" }
}
```

---

## Feature Flag

| 环境变量 | 值 | 行为 |
|----------|-----|------|
| `LIYE_GOVERNANCE_ENABLED` | `1` | 使用 GovernedMCPToolProvider |
| `LIYE_GOVERNANCE_ENABLED` | `0` 或不设 | 使用标准 MCPToolProvider |

代码中动态控制：
```python
from src.runtime.mcp.adapters import get_tool_provider

# 自动检测环境变量
provider = get_tool_provider(registry)

# 强制启用治理
provider = get_tool_provider(registry, governed=True)

# 强制禁用治理
provider = get_tool_provider(registry, governed=False)
```

---

## 架构

```
┌────────────────────────────────────────────────────────────┐
│                      CrewAI Agent                          │
│                           │                                │
│                           ▼                                │
│               GovernedMCPToolProvider                      │
│                           │                                │
│          ┌────────────────┼────────────────┐              │
│          ▼                ▼                ▼              │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│    │   Gate   │───▶│  Execute │───▶│ Verdict  │         │
│    │(JS Node) │    │(MCP Tool)│    │(JS Node) │         │
│    └──────────┘    └──────────┘    └──────────┘         │
│          │                               │               │
│          ▼                               ▼               │
│    ┌──────────┐                   ┌──────────┐          │
│    │  BLOCK   │                   │  Replay  │          │
│    │  UNKNOWN │                   │(JS Node) │          │
│    │    ↓     │                   └──────────┘          │
│    │  REJECT  │                         │               │
│    └──────────┘                         ▼               │
│                                   .liye/traces/         │
└────────────────────────────────────────────────────────────┘
```

---

## 故障排除

### "Governance bridge error"

确保 Node.js 20+ 已安装：
```bash
node --version  # 应该是 20+
```

测试 bridge：
```bash
echo '{"task":"test","proposed_actions":[{"action_type":"read"}]}' | node src/runtime/governance/governance_bridge.mjs
```

### "CrewAI not installed"

安装可选依赖：
```bash
pip install crewai==1.7.0
```

### 没有生成 traces

检查目录权限：
```bash
mkdir -p .liye/traces
ls -la .liye/traces/
```

---

## 版本历史

- v1.0.0 (2026-01-24): 初始版本，实现 Gate → Execute → Verdict → Replay
