# AGENT_SPEC · Agent 工程级规范
Agent Engineering Specification (v5.0)

> **Version**: 5.0
> **Status**: FROZEN
> **Date**: 2025-12-27

---

## §0 定义声明（冻结）

**Agent = Persona（WHO） + Skill Set（WHAT） + Runtime Shell（HOW）**

Agent 是一个 **可执行的角色实例**，
不是方法论、不是能力集合、不是流程定义。

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   WHO       │ + │   WHAT      │ + │   HOW       │
│  Persona    │   │  Skills     │   │  Runtime    │
│  (Method)   │   │  (Skill)    │   │  (Executor) │
└─────────────┘   └─────────────┘   └─────────────┘
```

---

## §1 Agent 的工程职责边界

### Agent 可以做的
- 选择并组合 Skill
- 以 Persona 方式与用户/系统交互
- 在 Runtime 中被调度与执行

### Agent 不可以做的
- 定义 Skill 的实现
- 定义 Workflow / Phase
- 修改 Method / Skill / Runtime 的规则

---

## §2 Agent 文件位置（冻结）

```text
Agents/
src/domain/<domain-name>/agents/
```

- 每个 Agent 必须归属 **一个 Domain**
- 不允许"全局 Agent"

---

## §3 Agent YAML 总体结构（冻结）

```yaml
agent:
  id: <string>
  name: <string>
  version: <semver>
  domain: <domain-name>

persona:
  role: <string>
  goal: <string>
  backstory: <string>
  communication_style: <string>

skills:
  atomic:
    - <skill_id>
  composite:
    - <skill_id>

runtime:
  process: sequential | hierarchical | parallel
  memory: true | false
  delegation: true | false
  max_iterations: <number>

liyedata:
  workflow_stage: <string>
  acceptance_criteria:
    - metric: <string>
      threshold: <number>
  guardrails:
    max_change_magnitude: <number>
    require_review: true | false

evolution:
  enabled: true | false
```

---

## §4 Agent Core 字段规范

### 4.1 agent（必填）

| 字段 | 含义 | 规则 |
|------|------|------|
| id | Agent 唯一 ID | kebab-case，全局唯一 |
| name | 展示名 | 可读，不用于引用 |
| version | 版本 | semver |
| domain | 所属领域 | 必须存在于 src/domain |

### 4.2 persona（必填，Method 层）

- **来源**：`src/method/personas/`
- **职责**：定义 角色、目标、沟通方式
- **禁止**：
  - 技能实现
  - 流程控制

### 4.3 skills（必填，Skill 层）

- `atomic`：原子技能（单一能力）
- `composite`：组合技能（技能链）
- **规则**：
  - Skill 必须存在于 `src/skill/` 或 `src/domain/*/skills/`
  - Agent 只能 **使用** Skill，不得定义 Skill

### 4.4 runtime（必填，Runtime 层）

| 字段 | 含义 |
|------|------|
| process | 执行模式 |
| memory | 是否启用上下文记忆 |
| delegation | 是否允许委派 |
| max_iterations | 最大执行轮数 |

- **规则**：
  - Runtime 只负责 **执行策略**
  - 不包含业务判断

---

## §5 LiYe 扩展字段（liyedata）

`liyedata` 用于 **业务约束与验收标准**，不是执行逻辑。

**允许**：
- `workflow_stage`（阶段标识）
- `acceptance_criteria`（验收指标）
- `guardrails`（风险护栏）

**禁止**：
- 出现执行逻辑
- 覆盖上层规则

---

## §6 Evolution（进化配置）

```yaml
evolution:
  enabled: true | false
```

- **决策权**：Method
- **执行权**：Runtime
- **Agent 仅能开启或关闭**

---

## §7 禁止模式（红线）

| 违规模式 | 说明 |
|----------|------|
| ❌ Agent 内实现 Skill | Skill 应在 src/skill/ 定义 |
| ❌ Agent 内定义 Workflow | Workflow 属于 Method 层 |
| ❌ Persona 中出现执行逻辑 | Persona 只声明角色 |
| ❌ Agent 跨 Domain 引用 Skill | 每个 Agent 归属唯一 Domain |
| ❌ Agent 覆盖 Runtime / Method 规则 | Agent 是使用者，不是定义者 |

---

## §8 校验规则（供工具使用）

一个合法 Agent 必须满足：

- [ ] Persona 存在且只声明角色
- [ ] Skill 均可解析
- [ ] Runtime 参数完整
- [ ] Domain 唯一归属
- [ ] 无红线违规

---

## §9 裁决顺序

当 Agent 定义出现争议时：

1. `NAMING.md`
2. **`AGENT_SPEC.md`**
3. `SKILL_SPEC.md`
4. `ARCHITECTURE.md`

---

## §10 冻结声明

自本文件生效起：
- 新增 / 修改 Agent 必须符合本规范
- 不符合规范的 Agent 视为架构违规
- 本文件修改需单独 PR，并说明原因

---

**This document is FROZEN as of v5.0 (2025-12-27).**
