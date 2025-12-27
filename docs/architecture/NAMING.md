# NAMING · 命名规范宪法
LiYe AI Naming Constitution

> **Version**: 5.0
> **Status**: FROZEN
> **Date**: 2025-12-27

## §0 立场声明

命名不是偏好，而是**架构的一部分**。
在 AI-native 系统中，模糊命名将直接导致：
- 语义漂移
- 职责混淆
- 架构不可控演化

本文件用于冻结 LiYe AI / LiYe OS 中所有**高频核心名词**的唯一含义。

---

## §1 品牌与技术命名分层（冻结）

| 名称 | 含义 | 使用场景 | 禁止使用场景 |
|-----|------|----------|--------------|
| **LiYe AI** | 产品 / 品牌名 | README、官网、对外介绍 | 代码命名、内部模块 |
| **LiYe OS** | 技术内核代号 | 架构文档、技术讨论 | 用户文档、营销 |

规则：
- 对外一律使用 **LiYe AI**
- 对内（架构）允许使用 **LiYe OS**
- 不允许混用

---

## §2 CLI 与命令命名（冻结）

| 项 | 规范 |
|----|------|
| npm 包名 | `liye-ai`（主） |
| CLI 主命令 | `liye-ai` |
| 技术别名 | `liye-os`（等效） |
| Chat 会话命令 | `/ly` 前缀 |

示例：
```bash
npx liye-ai agent run market-analyst
```

```
/ly agent market-analyst
```

---

## §3 Skill 相关命名（冻结）

### 3.1 Skill（总称）

- **Skill = 可复用能力单元（WHAT）**
- Skill 不是角色、不是流程、不是方法论。

### 3.2 Methodology Skill

- **含义**：人类可学习的方法论能力
- **位置**：`docs/methodology/`
- **面向**：人类
- **示例**：
  - Market Research Methodology
  - Medical Research Framework
- **禁止**：
  - 在此目录中出现 Prompt / Claude 指令 / 代码

### 3.3 Executable Skill

- **含义**：系统可执行的能力实现
- **位置**：
  - `src/skill/`
  - `src/domain/*/skills/`
- **面向**：运行时 / Agent
- **示例**：
  - `market_research.ts`
  - `competitor_analysis.ts`
- **禁止**：
  - 写教学性方法论
  - 写角色定义

### 3.4 Instruction Skill

- **含义**：LLM 操作适配指令
- **位置**：`.claude/skills/`
- **面向**：Claude / LLM
- **示例**：
  - `market-analyst.md`
- **禁止**：
  - 定义新规则
  - 成为方法论来源

---

## §4 Agent 相关命名（冻结）

### 4.1 Agent

- **Agent = 执行角色（WHO）**
- 由 Persona + Skill Set + Runtime 组成
- Agent 自身不定义能力，只"使用能力"
- **位置**：
  - `Agents/`
  - `src/domain/*/agents/`

### 4.2 Persona

- **Persona = 角色人设声明**
- 定义性格、目标、沟通方式
- 不包含执行逻辑
- **位置**：
  - `src/method/personas/`
- **禁止**：
  - Persona 中出现技能实现或流程控制

---

## §5 Crew / Workflow / Domain（冻结）

### Crew

- **含义**：多个 Agent 的协作编排
- **职责**：定义"谁和谁如何协作"
- 不定义业务实现

### Workflow

- **含义**：阶段化的工作流声明（WHY）
- 属于 Method Layer
- 不执行

### Domain

- **含义**：业务落地场景（WHERE）
- **位置**：`src/domain/<domain-name>/`
- **职责**：组装 Method / Skill / Runtime
- 不修改上层规则

---

## §6 禁止混用清单（红线）

| 错误用法 | 说明 |
|----------|------|
| ❌ Skill ≠ Agent | 技能不是角色 |
| ❌ Agent ≠ Persona | Agent 是组合体，Persona 是声明 |
| ❌ Skill ≠ Workflow | 技能是能力，工作流是流程 |
| ❌ Domain ≠ System | Domain 是业务场景，不是独立系统 |
| ❌ Claude Skill ≠ 方法论 | Claude 指令是实现细节 |

---

## §7 裁决规则

当命名含义发生争议时，裁决顺序如下：

1. **本文件（NAMING.md）**
2. `SKILL_CONSTITUTION.md`
3. `ARCHITECTURE.md`

---

## §8 文件与目录命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| YAML 文件 | `kebab-case.yaml` | `market-analyst.yaml` |
| TypeScript 文件 | `snake_case.ts` | `market_research.ts` |
| 宪法文档 | `UPPER_CASE.md` | `ARCHITECTURE.md` |
| 领域目录 | `kebab-case` | `amazon-growth/` |

---

## §9 废弃名称（禁止使用）

| 废弃 | 替代 |
|------|------|
| `bmad` | `liye` |
| `bmaddata` | `liyedata` |
| `bmad-method` | `liye-ai` |
| `Skills/`（大写） | `docs/methodology/` |
| `Systems/` | `src/domain/` |

---

## §10 冻结声明

自本文件生效起：
- 所有新文件、目录、PR 必须遵循本命名规范
- 不符合规范的命名视为架构违规
- 本文件的修改需单独 PR，并注明动机

---

**This document is FROZEN as of v5.0 (2025-12-27).**
