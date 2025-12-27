# EVOLUTION_PROTOCOL · 进化协议
Evolution Protocol Specification (v5.0)

> **Version**: 5.0
> **Status**: FROZEN
> **Date**: 2025-12-27

---

## §0 定义声明（冻结）

**Evolution = 系统从执行结果中学习、记录、并在未来被安全复用的机制。**

Evolution 不是：
- 即时反馈
- 即兴优化
- Agent 自我修改

Evolution 必须是：
- 可追溯
- 可回放
- 可关闭
- 可审计

---

## §1 三权分离原则（宪法级）

Evolution 严格实行 **三权分离**：

| 权限 | 所属层 | 职责 |
|------|--------|------|
| 决策权 | Method | 定义"学什么、怎么判断" |
| 执行权 | Runtime | 记录、存储、回放 |
| 配置权 | Domain | 启用 / 禁用 |

**任何单一层不得同时拥有两种权力。**

---

## §2 Evolution 的决策权（Method 层）

### 2.1 学习信号白名单（冻结）

Method 层定义 **允许被学习的信号类型**：

```yaml
learn_from:
  - agent_execution_logs        # Agent 执行日志
  - workflow_completion_rate    # 工作流完成率
  - acceptance_criteria_result  # 验收指标达成情况
  - user_feedback_signal        # 用户反馈（显式）
  - proven_pattern_success      # 已验证模式成功率
```

**禁止**：
- 临时上下文
- 未验证的中间推理
- 单次失败样本

### 2.2 判断规则（声明式）

Method 层只声明规则，不执行：

```yaml
decision_rules:
  min_sample_size: 5
  confidence_threshold: 0.8
  decay_window: 30d
```

---

## §3 Evolution 的执行权（Runtime 层）

### 3.1 存储规范（冻结）

```yaml
storage:
  location: .liye/evolution/
  format: jsonl
  retention: 90d
```

**规则**：
- 只追加（append-only）
- 不覆盖历史
- 支持回放与审计

### 3.2 回放机制（冻结）

```yaml
replay:
  trigger:
    - workflow_init
    - agent_start
  mechanism: pattern_match
  fallback: default_behavior
```

**说明**：
- 回放仅作为 **建议信号**
- 不得强制覆盖当前决策

---

## §4 Domain 的配置权（严格限制）

Domain 只能进行 **布尔配置**：

```yaml
evolution:
  enabled: true | false
```

**Domain 禁止**：
- 修改学习信号
- 修改判断规则
- 修改存储结构

---

## §5 与 Agent / Skill 的边界

### Agent
- 不能决定是否学习
- 不能修改 Evolution 规则
- 只能被动提供执行结果

### Skill
- 不感知 Evolution 的存在
- 不参与学习或回放决策

---

## §6 禁止模式（红线）

| 违规模式 | 说明 |
|----------|------|
| ❌ Agent 自我修改行为 | Agent 不能改变自身规则 |
| ❌ Runtime 发明学习规则 | Runtime 只执行，不决策 |
| ❌ Domain 改写 Method 决策 | Domain 只能开关 |
| ❌ Evolution 覆盖实时执行 | Evolution 是建议，不是命令 |
| ❌ Evolution 黑箱不可追溯 | 必须可审计 |

---

## §7 校验规则（供工具使用）

Evolution 系统必须满足：

- [ ] 三权分离明确
- [ ] 信号来源在白名单内
- [ ] 存储 append-only
- [ ] 回放为建议而非强制
- [ ] 可完全关闭

---

## §8 裁决顺序

当 Evolution 行为产生争议时：

1. `NAMING.md`
2. **`EVOLUTION_PROTOCOL.md`**
3. `ARCHITECTURE.md`

---

## §9 冻结声明

自本协议生效起：
- Evolution 行为必须遵循本协议
- 不符合协议的学习视为架构违规
- 本文件修改需单独 PR，并明确动机

---

**This document is FROZEN as of v5.0 (2025-12-27).**
