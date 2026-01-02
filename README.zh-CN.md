<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a>
</p>

# LiYe OS

**LiYe OS 是 AI 原生的治理内核 + 架构参考实现**：用于构建可靠的 AI 协作 / 智能体系统，使其 **可审计、可回放、可控演进**。

## 它是什么
- "如何安全构建 AI 系统"的**参考实现**（Gates / Contracts / Replay / Drift-guard）
- 可嵌入到你现有仓库的**治理栈**，防止 silent break / silent relax
- 面向人类 + 智能体协作的**编排模式**（可选层，不是唯一价值）

## 适合谁 / 不适合谁
**适合：**
- 需要治理与验证能力的工程团队/个人 OS builder
- 想复用成熟模式（门禁、契约、回放、漂移检测）的架构师
- 使用 Claude Code / agentic workflow 的开发者

**不适合：**
- 想要开箱即用 GUI 应用的人
- 不愿理解架构/治理、只想"直接跑起来"的用户

## 采用路径（选一条就行）
1) **抄结构（Blueprint）**：复刻目录结构 + 治理文档作为架构基线  
2) **接治理（Governance Stack）**：把 CI gates / contracts 引入你现有 repo  
3) **跑闭环（Minimal Runtime）**：按 Quick Start 跑通最小可审计闭环

## 稳定性与契约（先读这个）
- 架构契约：`docs/architecture/ARCHITECTURE_CONTRACT.md`

> 中文版会逐步补齐。英文 README 为默认权威版本。
