# Week 3 Governance Runbook: Tier / Drift / Kill Switch

**Version**: 1.0.0
**SSOT**: docs/runbooks/week3-tier-drift-kill.md
**Last Updated**: 2026-02-19

## 概述

Week 3 实现了 LiYe OS 的 3 层执行治理闭环：
- **Execution Tiers**: observe → recommend → execute_limited
- **Drift Monitor**: 连续失败检测 + 自动降级
- **Kill Switch**: 紧急阻断 + 审计

所有组件遵循 **fail-closed** 原则：配置缺失或错误时阻断而非放行。

## 核心组件

### 1. Execution Tiers 配置

**文件**: `.claude/config/execution_tiers.yaml`

```yaml
tiers:
  observe:       # 只读、检测
  recommend:     # 生成提案
  execute_limited:  # 受控写入（必须 require_approval: true）
```

**验证**:
```bash
node _meta/contracts/scripts/validate-execution-tiers.mjs
```

### 2. Tier Manager

**文件**: `src/governance/learning/tier_manager.mjs`

**功能**:
- 评估 policies 的三信号（exec/operator/business）
- 检查晋升条件（min_runs, success_rate 等）
- 物理移动文件：sandbox → candidate → production

> ⚠️ SUPERSEDED (ADR-Learning-Stack-Generations §D-A2/§D-A6): tier_manager 不再是 policy promotion 权威。
> 下方 live 命令执行**破坏性** artifact 移动且**无** `policy_lifecycle_event` 审计。生产环境**禁运**；
> GHL（ADR-GHL 2b/2c）是唯一 policy-lifecycle 权威。dry-run 仅供历史诊断。

**运行**:
```bash
# Dry-run（仅评估，不执行）
node src/governance/learning/tier_manager.mjs --dry-run

# ⚠ SUPERSEDED — 破坏性且无 lifecycle 审计；生产禁运（§D-A2/§D-A6）
node src/governance/learning/tier_manager.mjs
```

**输出 Facts**: `state/memory/facts/fact_tier_decisions.jsonl`

### 3. Drift Enforcement（drift_monitor 已退役）

**文件**: `src/governance/learning/drift_enforcement.mjs`（只读 enforcement 库，无 CLI）

> ⚠️ **RETIRED (EVO-D / ADR-Learning-Stack-Generations §D-11)**：`drift_monitor.mjs` 已**物理退役**。
> 其唯一 live enforcement 读 `isDriftBlocked()`（§D-A3 保留）已**逐字节抽取**为 `drift_enforcement.mjs`；
> 主动降级/quarantine 面（§D-A2 superseded）随文件删除退役，概念价值见
> `.planning/agentic-evolution/EVO-C-stack-reconciliation/GHL-BACKLOG.md`（C-1/C-2），归 GHL 2c 重生。
>
> **AC-04（EVO-B DEFER → EVO-D 落地）**：本节原 live 命令 `node .../drift_monitor.mjs [--dry-run]` 已**弃用**——文件不复存在。

**当前 enforcement 形态**：
- `isDriftBlocked(policyId)` 经 `execution_gate` preflight 触发（仅当 policyId 非空 ∧ actionType=WRITE_LIMITED）。
- 三分支：`policy_in_quarantine` / `recent_drift_triggered`（<24h）/ `{blocked:false}`。
- **休眠语义**：每次 WRITE_LIMITED preflight 真被执行（live edge），但写侧已随 §D-A2 退役 → 当前数据下恒 `{blocked:false}`（dormant effect）。非「活跃 24h freeze enforcement」。
- 无独立 CLI / dry-run 入口；覆盖见 `tests/governance/test_drift_enforcement.mjs`。

**读取 Facts**（若存在）: `state/memory/facts/fact_drift_events.jsonl`（写侧重生归 GHL 2c）

### 4. Kill Switch

**文件**: `src/governance/learning/kill_switch.mjs`

**优先级链**:
```
ENV (LIYE_KILL_SWITCH) > state file > default (false)
```

**运行**:
```bash
# 查看状态
node src/governance/learning/kill_switch.mjs

# 检查并返回退出码
node src/governance/learning/kill_switch.mjs --check

# 手动启用
node src/governance/learning/kill_switch.mjs --enable --reason "紧急维护"

# 手动禁用
node src/governance/learning/kill_switch.mjs --disable --reason "恢复正常"
```

**输出 Facts**: `state/memory/facts/fact_kill_switch_events.jsonl`

### 5. Execution Gate

**文件**: `src/governance/learning/execution_gate.mjs`

**功能**: Preflight 检查入口，整合 tier/drift/kill 检查

**运行**:
```bash
# 检查特定动作
node src/governance/learning/execution_gate.mjs --action READ_ONLY --tier observe
node src/governance/learning/execution_gate.mjs --action WRITE_LIMITED --tier execute_limited --policy POLICY_ID
```

**检查顺序**:
1. Config 加载（fail-closed）
2. Kill Switch（ENV > state > default）
3. Tier 权限（动作是否在允许列表）
4. require_approval（WRITE_LIMITED 必须）
5. Drift 检查（policy 是否被阻断）

## 目录结构

```
.claude/config/
└── execution_tiers.yaml          # Tier 配置

src/governance/learning/
├── tier_manager.mjs              # 晋升管理
├── drift_enforcement.mjs         # drift freeze 只读 enforcement (isDriftBlocked, §D-A3/D-11)
├── kill_switch.mjs               # 紧急阻断
└── execution_gate.mjs            # Preflight 入口

state/memory/learned/policies/
├── sandbox/                      # observe 阶段
├── candidate/                    # recommend 阶段
├── production/                   # execute_limited 阶段
├── disabled/                     # 漂移禁用
└── quarantine/                   # 紧急隔离

state/memory/facts/
├── fact_tier_decisions.jsonl     # 晋升决策
├── fact_drift_events.jsonl       # 漂移事件
├── fact_kill_switch_events.jsonl # Kill switch 事件
└── fact_execution_gate.jsonl     # Gate 决策
```

## 测试

**测试文件**: `tests/governance/test_week3_tier_drift_kill.mjs`

**运行测试**:
```bash
node tests/governance/test_week3_tier_drift_kill.mjs
```

**覆盖场景**:
1. ✅ Validator 缺字段 → fail-closed
2. ✅ require_approval != true → fail-closed
3. ✅ Kill switch 激活 → 阻断 WRITE_LIMITED
4. ✅ Tier manager 决策 deterministic
5. ✅ 满足晋升条件 → promotion
6. ✅ 不满足条件 → 不晋升 + 原因
7. ✅ 连续失败 → drift triggered
8. ✅ 单次失败 → 不触发 drift

## CI 集成

**Workflow**: `.github/workflows/execution-tiers-gate.yml`

**Jobs**:
1. `validate-execution-tiers`: 校验配置
2. `governance-tests`: 运行测试
3. `integration-check`: 集成检查

## 故障排查

### 错误 1: Config not found
```
Config error: config_not_found
```
**原因**: `.claude/config/execution_tiers.yaml` 不存在
**处理**: 创建配置文件或从模板复制

### 错误 2: SAFETY VIOLATION
```
SAFETY VIOLATION: execute_limited.require_approval must be true
```
**原因**: 安全基线被破坏
**处理**: 修复配置，设置 `require_approval: true`

### 错误 3: Unknown tier
```
Unknown tier: xxx
```
**原因**: 请求的 tier 不在配置中
**处理**: 检查 tier 名称是否正确

### 错误 4: Action not allowed
```
Action "WRITE_LIMITED" not allowed in tier "observe"
```
**原因**: 当前 tier 不允许该动作
**处理**: 晋升 policy 到更高 tier，或更改请求的动作

### 错误 5: Drift blocked
```
Drift blocked: consecutive_failures(3) >= threshold(3)
```
**原因**: Policy 触发漂移检测
**处理**: 调查失败原因，修复后手动恢复

## 紧急操作

### 启用 Kill Switch（全局阻断 WRITE_LIMITED）
```bash
# 方式 1: 环境变量（最高优先级）
export LIYE_KILL_SWITCH=true

# 方式 2: CLI
node src/governance/learning/kill_switch.mjs --enable --reason "紧急情况"
```

### 手动隔离 Policy
```bash
# 移动到 quarantine
mv state/memory/learned/policies/production/POLICY_ID.yaml \
   state/memory/learned/policies/quarantine/POLICY_ID.yaml
```

### 恢复被隔离的 Policy
```bash
# 移回 candidate（需要重新验证）
mv state/memory/learned/policies/quarantine/POLICY_ID.yaml \
   state/memory/learned/policies/candidate/POLICY_ID.yaml
```

## 安全约束

1. **fail-closed**: 所有配置/解析错误 → 阻断
2. **append-only facts**: 所有决策记录到 JSONL
3. **deterministic**: 相同输入 → 相同输出（可 replay）
4. **require_approval**: execute_limited 必须人工批准
5. **audit trail**: 每个 gate 决策都有 trace

## 相关文档

- [北极星架构方案](../../.claude/plans/eager-crunching-sunset.md)
- [Contracts v1 Freeze Runbook](./contracts-v1-freeze.md)
- [Learned Bundle v0 Runbook](./learned-bundle-v0.md)
