# Cost Meter Runbook

**SSOT**: `.claude/scripts/proactive/cost_meter.mjs`

## Overview

Cost Meter 是 Heartbeat Learning Pipeline 的成本计量和预算闸门模块。

**架构原则**：
- **LiYe OS = Control Plane**：成本计量、预算闸门、审计都在 OS
- **fail-closed**：配置/ENV 非法 → SKIP + 记录 facts
- **append-only**：facts 永远追加，SKIP 路径也必须写审计事实

## P0：默认禁用（合并即安全）

默认情况下，cost meter 是禁用的（`enabled_default: false`）。这意味着：
- Heartbeat 正常运行，不受预算限制
- 仍然会记录 `cost_switch_resolved` 事实到审计日志
- 可以通过 `cost_meter.mjs status` 查看配置状态

## P1：点火开启预算闸门

### 1. 通过 ENV 启用

```bash
# 启用 cost meter
export LIYE_COST_METER_ENABLED=true

# 可选：调整每日预算
export LIYE_COST_DAILY_BUDGET_UNITS=200

# 可选：设置超限行为
# skip_notify_only = 学习继续，通知抑制
# skip_all = 整轮 SKIP
export LIYE_COST_DENY_ACTION=skip_notify_only

# 运行 heartbeat
node .claude/scripts/learning/heartbeat_runner.mjs
```

### 2. 通过配置文件启用

编辑 `state/runtime/proactive/cost_meter.json`:

```json
{
  "enabled_default": true,
  "daily_budget_units": 200,
  "deny_action": "skip_notify_only",
  ...
}
```

## 成本权重

| 组件 | 权重 | 说明 |
|------|------|------|
| `notifier` | 5 | 高权重：噪声=人力成本 |
| `bundle_build` | 3 | 构建频率高会吃资源 |
| `learning_pipeline` | 2 | 避免频繁扫全量 |
| `validate_bundle` | 2 | 校验成本 |
| `business_probe` | 2 | 探测频繁会变"后台骚扰" |
| `discover_runs` | 1 | 轻量 |
| `operator_callback` | 1 | 主要是 IO 追加 |

**一次完整 Heartbeat 运行的预计成本**：13 units
（discover=1 + pipeline=2 + bundle=3 + validate=2 + notifier=5）

## 状态查询

```bash
# 查看当前状态
node .claude/scripts/proactive/cost_meter.mjs status

# 预检查预算
node .claude/scripts/proactive/cost_meter.mjs check
```

## 事件类型

| 事件 | 说明 |
|------|------|
| `cost_switch_resolved` | 开关解析结果（每次运行必记） |
| `cost_event_recorded` | 成本事件记录（每个步骤） |
| `cost_budget_exceeded` | 预算超限 |
| `cost_meter_skipped` | 计量被跳过（禁用或错误） |
| `cost_config_error` | 配置错误（fail-closed） |

## 审计文件

- **配置**: `state/runtime/proactive/cost_meter.json`
- **状态**: `state/runtime/proactive/cost_meter_state.json`
- **事实**: `data/facts/fact_cost_events.jsonl`（append-only）

## 故障排查

### 1. Heartbeat 被 cost_budget_exceeded 阻止

检查当日已用预算：
```bash
node .claude/scripts/proactive/cost_meter.mjs status | jq '.state.daily_used_units'
```

临时提高预算：
```bash
LIYE_COST_DAILY_BUDGET_UNITS=500 node .claude/scripts/learning/heartbeat_runner.mjs
```

### 2. 配置错误导致 fail-closed

检查 facts 中的 `cost_config_error` 事件：
```bash
grep cost_config_error data/facts/fact_cost_events.jsonl | tail -5
```

### 3. Kill Switch 激活

检查 kill switch 状态：
```bash
node .claude/scripts/proactive/cost_meter.mjs status | jq '.switch.kill_switch'
```

激活 kill switch：
```bash
export LIYE_COST_KILL_SWITCH=true
```

## ENV 变量汇总

| 变量 | 类型 | 说明 |
|------|------|------|
| `LIYE_COST_METER_ENABLED` | boolean | 启用/禁用 cost meter |
| `LIYE_COST_DAILY_BUDGET_UNITS` | number | 每日预算（1-10000） |
| `LIYE_COST_DENY_ACTION` | enum | `skip_all` / `skip_notify_only` |
| `LIYE_COST_NOTIFY_POLICY` | enum | `off` / `bundle_or_error` / `always` |
| `LIYE_COST_KILL_SWITCH` | boolean | 紧急关闭 cost meter |

**优先级**：`kill_switch > ENV > config > default`

## 验证

```bash
# 校验配置和事实
node _meta/contracts/scripts/validate-cost-meter.mjs
```
