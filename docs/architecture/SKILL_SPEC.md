# SKILL_SPEC · Skill 工程级规范
Skill Engineering Specification (v5.0)

> **Version**: 5.0
> **Status**: FROZEN
> **Date**: 2025-12-27

---

## §0 定义声明（冻结）

**Skill = 可复用、可组合、可执行的能力单元（WHAT）**

Skill 不是：
- 角色（Agent）
- 方法论（Methodology）
- 工作流（Workflow）
- 运行时（Runtime）

Skill 只回答一个问题：

> **"系统能做什么？"**

---

## §1 Skill 的职责边界

### Skill 可以做的
- 接收输入
- 执行单一或组合能力
- 返回结构化输出

### Skill 不可以做的
- 定义角色或人格
- 控制流程阶段（Workflow / Phase）
- 执行跨 Domain 的业务编排
- 修改 Runtime / Method 规则

---

## §2 Skill 的工程分类（冻结）

### 2.1 Atomic Skill（原子技能）

**定义**
Atomic Skill 是 **不可再拆分的最小能力单元**。

- 单一职责
- 无内部流程分支
- 可被多个 Agent / Composite Skill 复用

**位置**
```text
src/skill/atomic/
src/domain/<domain>/skills/atomic/
```

**示例**
- `market_research`
- `keyword_clustering`
- `sentiment_analysis`

### 2.2 Composite Skill（组合技能）

**定义**
Composite Skill 是由 **多个 Atomic Skill 组合而成的能力链**。

- 本身不实现底层能力
- 只负责编排与组合
- 可被 Agent 直接使用

**位置**
```text
src/skill/composite/
src/domain/<domain>/skills/composite/
```

**示例**
- `market_intelligence_report`
- `listing_optimization_pipeline`

---

## §3 Atomic Skill 工程结构（冻结）

```text
market_research/
├── index.ts          # Skill 实现（必须）
├── spec.yaml         # Skill 接口定义（必须）
└── README.md         # 可选说明
```

**spec.yaml（必需）**
```yaml
id: market_research
type: atomic
domain: global | <domain-name>

input:
  type: object
  properties:
    seed_keywords:
      type: array
      items: { type: string }
  required: [seed_keywords]

output:
  type: object
  properties:
    insights:
      type: array
      items: { type: string }
```

---

## §4 Composite Skill 工程结构（冻结）

```text
market_intelligence_report/
├── index.ts
├── spec.yaml
└── compose.yaml
```

**compose.yaml（必需）**
```yaml
id: market_intelligence_report
type: composite
skills:
  - market_research
  - competitor_analysis
  - trend_detection

mapping:
  market_research.insights -> report.market
```

**规则**：
- Composite Skill 不得实现 Atomic 逻辑
- 只能组合已注册 Skill

---

## §5 Skill 注册与加载规则

- 所有 Skill 必须注册到 **Skill Registry**
- Agent / Runtime 只能通过 Registry 调用 Skill
- 禁止直接 import 未注册 Skill

---

## §6 Skill 与 Agent 的关系（冻结）

- Skill 定义能力
- Agent 选择并调用 Skill
- Skill 不感知 Agent 的存在

```text
Agent  →  Skill
Skill  ✕  Agent
```

---

## §7 禁止模式（红线）

| 违规模式 | 说明 |
|----------|------|
| ❌ Skill 内定义 Persona | Persona 属于 Agent |
| ❌ Skill 内定义 Workflow / Phase | Workflow 属于 Method |
| ❌ Composite Skill 内实现 Atomic 逻辑 | Composite 只编排 |
| ❌ Skill 跨 Domain 强依赖 | 每个 Skill 归属唯一 Domain |
| ❌ Skill 直接调用 Runtime Executor | Skill 不感知 Runtime |

---

## §8 校验规则（供工具使用）

一个合法 Skill 必须满足：

- [ ] 有唯一 `id`
- [ ] `spec.yaml` 定义完整 I/O
- [ ] Atomic / Composite 类型明确
- [ ] Composite Skill 仅组合，不实现
- [ ] 不触碰红线规则

---

## §9 裁决顺序

当 Skill 定义产生争议时：

1. `NAMING.md`
2. **`SKILL_SPEC.md`**
3. `AGENT_SPEC.md`
4. `ARCHITECTURE.md`

---

## §10 冻结声明

自本文件生效起：
- 新增 / 修改 Skill 必须符合本规范
- 违反规范的 Skill 视为架构违规
- 本文件修改需单独 PR，并注明原因

---

**This document is FROZEN as of v5.0 (2025-12-27).**
