# LiYe OS · External Tools Usage Policy

**外部工具使用政策（强制执行版）**

> **Version**: 1.0
> **Date**: 2025-12-27
> **Status**: Active
> **Enforcement**: CI Gate + Manual Review

---

## 0. 政策目的（Purpose）

LiYe OS 是一个 **AI 原生的个人操作系统**，而非某个工具的集合体。
本政策用于明确：

> **LiYe OS 与所有外部工具之间的使用边界、责任划分与禁止行为。**

目标只有一个：

**防止外部工具侵蚀 LiYe OS 的核心架构与长期演进能力。**

---

## 1. 外部工具的定义（Definition）

在 LiYe OS 体系中，**外部工具**指：

* 不存在于 `github/liye_os` 仓库内的任何系统
* 由第三方维护或独立发布
* LiYe OS 无法控制其内部演进节奏

包括但不限于：

* CrewAI（Python 包 / CLI）
* Claude Code Skills（如 `/crewai`、`/skill-forge`）
* Anthropic 官方技能库
* 任何 IDE 插件、CLI 工具、云服务

---

## 2. 核心原则（Core Principles）

### Principle 1：**System over Tool**

> 工具可以被替换，系统不能被侵蚀。

外部工具永远是 **可拔插部件**，
LiYe OS 是 **不可被替代的主系统**。

---

### Principle 2：**Execution Must Be Owned**

> 所有"正式执行"必须由 LiYe OS 掌控。

任何绕过 LiYe OS Runtime 的直接执行，
都会破坏上下文一致性与能力演化链路。

---

### Principle 3：**Design =/= Execution**

* 设计阶段：可以使用外部工具
* 执行阶段：必须回到 LiYe OS

---

## 3. CrewAI 使用政策（CrewAI Policy）

### 3.1 允许的使用方式

1. **执行引擎（Execution Engine）**

   * 仅通过 Python venv 调用
   * 作为 Agent 执行器存在
   * 不参与 Method / Skill 定义

2. **实验与验证**

   * 本地试验
   * PoC
   * 学习 CrewAI 能力边界

---

### 3.2 明确禁止的行为

* 将 CrewAI 作为系统架构核心
* 在 Method Layer 中出现 CrewAI 概念
* 在 Skill 定义中绑定 CrewAI 语义
* 直接用 CrewAI CLI 执行"正式生产任务"

---

### 3.3 强制规则（Hard Rule）

> **任何用于正式产出的多智能体执行，
> 必须由 LiYe OS Runtime 或 Domain 层发起。**

CrewAI 只能被 **调用**，不能成为 **入口**。

---

## 4. Claude Code Skills 使用政策

### 4.1 `/crewai` 技能

**定位**：设计顾问 / 教练 / 文档解释器

**允许**：
* 设计 Agent 架构
* 学习 CrewAI 最佳实践
* 生成配置草案（YAML / JSON）

**禁止**：
* 直接驱动生产执行
* 绕过 LiYe OS Runtime 生成最终结果
* 作为系统依赖写入代码仓库

---

### 4.2 `/skill-forge` 技能

**定位**：Skill 生成辅助工具

**允许**：
* 从外部来源生成 Skill 草案
* 组织文档、示例、结构

**禁止**：
* 自动写入 `liye_os` 核心目录
* 未审查即纳入 Skill Registry
* 作为 Skill 执行引擎

> Skill Forge **只能生成候选技能，不能决定系统能力。**

---

## 5. Anthropic 官方技能库政策

### 使用原则

* 仅作为 **通用能力补充**
* 不进入 Method / Runtime 层
* 不影响 Skill 抽象模型

---

## 6. 生产级 vs 实验级（Environment Separation）

| 场景 | 是否允许直接使用外部工具 |
|------|------------------------|
| 学习 / 研究 | YES |
| 设计 / 架构 | YES |
| 实验 / PoC | YES |
| 正式执行 / 产出 | NO（必须走 LiYe OS） |

---

## 7. AI Agent 行为约束（AI Compliance Rule）

任何在 LiYe OS 环境中运行的 AI Agent：

* 不得自行调用外部工具执行正式任务
* 不得绕过 Runtime / Domain 层
* 必须遵守本政策的调用边界

违反视为 **系统级错误行为**。

---

## 8. 演进与审计（Evolution & Audit）

* 所有外部工具的使用路径必须 **可替换**
* LiYe OS 必须始终保留：
  * 无外部工具的最小可运行能力
* 定期审计：
  * 是否存在工具侵蚀架构的迹象

---

## 9. CI 执法（CI Enforcement）

本政策由以下 CI Gate 自动执法：

| CI Gate | 检查内容 | 执法动作 |
|---------|---------|---------|
| `constitution-external-tools-gate.yml` | Method/Skill 层不得包含外部工具引用 | PR FAIL |

See: `.github/workflows/constitution-external-tools-gate.yml`

---

## 10. 终极声明（Final Statement）

> **LiYe OS is the system.
> Tools are optional.
> Control is non-negotiable.**

任何削弱 LiYe OS 控制力的工具使用方式，
即使"更方便"，也必须被拒绝。

---

**"A system that depends on tools will eventually be owned by them."**
— LiYe OS Architecture

---

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Layer boundary rules
- [NON_FORK_STATEMENT.md](./NON_FORK_STATEMENT.md) - Non-fork declaration
- [TRI_FORK_IMPLEMENTATION.md](./TRI_FORK_IMPLEMENTATION.md) - Implementation details
