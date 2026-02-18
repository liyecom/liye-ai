# Heartbeat 点火 Runbook

## 概述

Heartbeat Learning 系统采用**双开关治理**：
- **A（ENV）= 点火按钮**：临时开启/关闭（灰度/应急/短时验证）
- **B（state/config）= 长期默认策略**：仓库内可见、可审计

**优先级**：`LIYE_KILL_SWITCH` > `ENV` > `state/config` > `default(false)`

**合并即安全**：默认静默（disabled），只有明确点火才跑。

---

## 1. 默认静默（B）

长期默认策略保存在 `state/runtime/proactive/heartbeat_learning_state.json`：

```json
{
  "enabled": false,
  "notify_policy": "bundle_or_error",
  "cooldown_minutes": 30
}
```

**修改方式**：直接编辑文件并提交到仓库。

---

## 2. 临时点火（A）

### 2.1 Stage A：静默灰度（不通知）

```bash
export LIYE_HEARTBEAT_ENABLED=true
export LIYE_HEARTBEAT_NOTIFY_POLICY=off
export LIYE_HEARTBEAT_COOLDOWN_MINUTES=30

node .claude/scripts/learning/heartbeat_runner.mjs --json
```

- 学习流水线正常运行
- 不发送任何通知
- 适用于首次验证

### 2.2 Stage B：条件通知（bundle 变化或错误）

```bash
export LIYE_HEARTBEAT_ENABLED=true
export LIYE_HEARTBEAT_NOTIFY_POLICY=bundle_or_error

node .claude/scripts/learning/heartbeat_runner.mjs --json
```

- 仅在 bundle 变化或发生错误时通知
- 适用于日常运行

### 2.3 Stage C：全量通知

```bash
export LIYE_HEARTBEAT_ENABLED=true
export LIYE_HEARTBEAT_NOTIFY_POLICY=always

node .claude/scripts/learning/heartbeat_runner.mjs --json
```

- 每次运行都通知
- 适用于调试或密切监控

---

## 3. 紧急熄火（Kill Switch）

**最高优先级**，立即停止所有 Heartbeat 执行。

### 3.1 通过 ENV（推荐）

```bash
export LIYE_KILL_SWITCH=1
node .claude/scripts/learning/heartbeat_runner.mjs --json
```

### 3.2 通过 state 文件

编辑 `state/runtime/proactive/kill_switch.json`：

```json
{
  "learning_heartbeat": false
}
```

- `learning_heartbeat: false` = 禁用
- `learning_heartbeat: true` = 启用

---

## 4. ENV 变量参考

| 变量 | 类型 | 有效值 | 说明 |
|------|------|--------|------|
| `LIYE_HEARTBEAT_ENABLED` | boolean | `true\|false\|1\|0\|yes\|no\|on\|off` | 点火开关 |
| `LIYE_HEARTBEAT_NOTIFY_POLICY` | enum | `off\|bundle_or_error\|always` | 通知策略 |
| `LIYE_HEARTBEAT_COOLDOWN_MINUTES` | number | `1-1440` | 冷却时间（分钟） |
| `LIYE_KILL_SWITCH` | boolean | `true\|1\|yes\|on` | 紧急熄火 |

**Fail-closed**：非法 ENV 值 → 强制 SKIP + 记录 facts。

---

## 5. 审计与可观测性

所有开关决策自动记录到 `state/memory/facts/fact_run_outcomes.jsonl`：

```json
{
  "event_type": "heartbeat_switch_resolved",
  "timestamp": "2026-02-11T...",
  "effective": {
    "enabled": true,
    "notify_policy": "bundle_or_error",
    "cooldown_minutes": 30
  },
  "source": {
    "enabled": "env",
    "notify_policy": "default",
    "cooldown_minutes": "state"
  },
  "kill_switch": { "active": false, "source": "none" },
  "config_errors": [],
  "action": "RUN"
}
```

---

## 6. 推荐灰度策略

```
Week 1: Stage A（notify off）
  - 验证学习流水线正常运行
  - 检查 bundle 生成是否正确

Week 2: Stage B（bundle_or_error）
  - 开始接收关键通知
  - 监控误报率

Week 3+: 提交 state 变更
  - 将 enabled=true 提交到仓库
  - 长期稳定运行
```

---

## 7. 故障排查

### Q: 为什么 Heartbeat 没有运行？

检查返回结果中的 `skip_reason`：

| skip_reason | 原因 | 解决方案 |
|-------------|------|----------|
| `kill_switch` | Kill switch 激活 | 关闭 `LIYE_KILL_SWITCH` 或修改 state |
| `disabled` | enabled=false | 设置 `LIYE_HEARTBEAT_ENABLED=true` |
| `config_error_fail_closed` | ENV 值非法 | 检查 ENV 格式 |
| `cooldown` | 冷却期内 | 等待或调整 `LIYE_HEARTBEAT_COOLDOWN_MINUTES` |
| `no_new_runs` | 无新 runs | 正常情况 |

### Q: 如何查看历史决策？

```bash
grep "heartbeat_switch_resolved" state/memory/facts/fact_run_outcomes.jsonl | tail -10 | jq
```

---

## 8. 版本信息

- Heartbeat Runner: v2.0.0
- 双开关治理: 2026-02-11
- Runbook 版本: 1.0.0
