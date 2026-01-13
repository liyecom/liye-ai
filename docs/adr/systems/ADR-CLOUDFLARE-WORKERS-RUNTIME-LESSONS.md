# ADR: Cloudflare Workers Runtime Lessons

**ADR ID**: ADR-CLOUDFLARE-WORKERS-RUNTIME-LESSONS
**Status**: Accepted
**Scope**: Systems / Cloudflare Workers
**Related System**: Information Radar v2.4
**Date**: 2026-01-13

---

## 1. 背景（Context）

在 Information Radar v2.4 的实际运行过程中，系统部署在 Cloudflare Workers 环境，并通过 Cron Triggers 定时执行推送与聚合任务。

在连续真实运行中，系统暴露出多类**非代码层面的偏差**，包括时间显示错误、资源冲突、顺序错乱、Secrets 丢失以及 LLM 行为异常。这些问题并非单点 bug，而是源于**对 Cloudflare Workers 运行语义、工具隐式行为以及用户感知模型的系统性误判**。

本 ADR 用于记录这些认知修正，并冻结为长期有效的工程规则。

---

## 2. 问题与根因分析（Root Cause Analysis）

### 2.1 时区陷阱（Timezone Gotcha）

**问题**
Cron 在 UTC 时间运行（如 UTC 23:00），直接使用 `new Date()` 或 `toISOString()` 会生成 UTC 日期。
当用户位于 UTC+8（北京时间）时，用户感知的日期与系统生成日期出现偏差。

**根因**

* 默认假设系统时间即用户时间
* 未显式定义"面向用户时间"的时区策略

---

### 2.2 并行执行的顺序错觉（Parallelism vs User Perceived Order）

**问题**
使用 `Promise.all` 并行推送多条消息，实际到达顺序随机，破坏用户对"分页 / 连续消息"的理解。

**根因**

* 将"执行完成顺序"误认为"用户感知顺序"
* 忽视消息系统的异步投递特性

---

### 2.3 Cloudflare Workers 重命名语义误判

**问题**
修改 `wrangler.toml` 中的 `name` 并部署，Cloudflare 并不会重命名 Worker，而是创建一个新的 Worker。

**后果**

* 新旧 Worker 并存
* Cron Trigger 数量超限
* 旧 Worker 仍在运行，产生冲突行为

**根因**

* 错误假设云资源支持"原地重命名"
* 未意识到 Worker 的 identity 是实例级，而非名称级

---

### 2.4 Secrets 与 Worker 生命周期绑定

**问题**
删除 Worker 后重新部署，原有 Secrets 全部丢失。

**根因**

* Secrets 实际绑定在 Worker 实例上
* 重建等价于新实例，Secrets 不会继承

---

### 2.5 LLM Prompt 中的动态数据污染

**问题**
System Prompt 中包含示例日期（如 `"date": "2026-01-10 (周五)"`），LLM 在生成结果时直接复制示例，而非生成当前日期。

**根因**

* LLM 强烈倾向复制示例结构
* 动态数据被放置在 System Prompt，且未显式强调"仅示例"

---

### 2.6 CLI 工具的隐式上下文风险

**问题**
执行 `wrangler delete information-os`，实际删除的却是另一个 Worker（information-radar）。

**根因**

* Wrangler 默认读取当前目录下的 `wrangler.toml`
* CLI 参数与当前目录上下文叠加，行为并非纯显式

---

## 3. 核心教训（Key Lessons）

1. **时间不是中立的**
   系统时间 ≠ 用户时间，任何面向用户的时间必须显式声明时区。

2. **并行不是免费的**
   当内容存在用户感知顺序时，必须牺牲性能换取确定性。

3. **云资源没有"改名"这一概念**
   重命名在云环境中通常意味着"删除旧实例 + 创建新实例"。

4. **Secrets 属于实例，而非配置文件**
   Worker 生命周期变化必然导致 Secrets 重配置。

5. **LLM 会优先复制示例，而不是"理解意图"**
   示例 ≠ 规则，动态数据必须由 User Prompt 显式注入。

6. **CLI 工具存在危险的默认行为**
   任何 delete / destroy 类操作，都必须假设存在隐式上下文。

---

## 4. 决策与规则（Decisions & Rules）

### 4.1 时区显式原则（Timezone Explicitness Principle）

> 所有面向用户的时间展示，必须显式指定目标时区。
> 禁止依赖 `new Date()` 或系统默认时区。

---

### 4.2 顺序性原则（User-Perceived Order Principle）

> 用户感知为"有序"的内容（消息序列、分页结果、步骤流），
> 必须使用串行执行，不得依赖并行执行的隐式顺序。

---

### 4.3 资源生命周期原则（Resource Lifecycle Principle）

> 云资源的"重命名"不等价于原地修改，
> 通常等价于删除旧实例并创建新实例，
> 所有关联资源（Secrets、Bindings、Triggers）需重新配置。

---

### 4.4 Secrets 管理规则

* Secrets 与 Worker 实例绑定
* 删除 / 重建 Worker 后，必须重新配置 Secrets
* 所有必需 Secrets 必须记录在 `.env.example` 或文档中

---

### 4.5 LLM 动态数据注入规则

* 示例数据仅用于结构说明
* 所有动态值（日期、时间、环境变量）必须通过 User Prompt 显式传入
* 必须明确告知 LLM：示例不可复用

---

### 4.6 CLI 危险操作约束

* delete / destroy 操作前，必须确认目标资源
* 避免在包含配置文件的目录中执行破坏性命令
* 必须优先使用显式参数（如 `--name`）

---

## 5. 后续行动（Follow-ups）

- [ ] 将稳定规则下沉为 `.claude/packs/cloudflare.md`
- [ ] 为 Systems 层部署引入标准化检查清单
- [ ] 评估是否可将部分规则升级为自动化 Gate / Guard
- [ ] 在相关 Agent 中注入这些运行时约束

---

**Decision Summary**
本 ADR 冻结了 Cloudflare Workers 在实际运行中的关键认知修正，
所有后续 Systems 设计与部署必须遵循上述规则。
