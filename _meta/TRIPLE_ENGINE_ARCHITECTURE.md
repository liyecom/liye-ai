# 🚀 三引擎架构 (Triple Engine Architecture): Claude Code + Antigravity + BMad

**版本**: 1.0
**日期**: 2025-12-13
**状态**: 规划中

---

## 🌟 执行摘要 (Executive Summary)

**三引擎架构**是对之前双引擎模式的进化，引入了 **BMad (Breakthrough Method for Agile Ai Driven Development)** 作为专门的 **方法论引擎**。这构建了一个涵盖战略、流程和执行的完整生态系统。

| 引擎 | 角色 | 比喻 | 核心关注点 |
| :--- | :--- | :--- | :--- |
| **Claude Code** | **架构师** | 大脑 (Brain) 🧠 | 系统设计、知识管理 (PARA)、高层战略、质量把关 |
| **BMad** | **方法论** | 神经系统 (Nervous System) ⚡ | 敏捷工作流、标准化流程、专业Agent角色定义、任务拆解 |
| **Antigravity** | **建造师** | 双手 (Hands) 🛠️ | 快速实现、并行执行、原型开发、批量重构 |

---

## 📖 核心术语与演化策略 (Terminology & Evolution)

为了避免混淆，我们需要明确 **LiYe OS** 与 **LiYe Core**，以及 **Skill** 与 **Agent** 的层级关系：

### 1. 概念分层

*   **LiYe OS (操作系统)**: 指代**整体生态系统** (产品)。
*   **LiYe-Core (核心引擎)**: 指代基于 BMad 改造的，用于运行 Agent 的**代码框架** (工具)。

### 2. Skill vs Agent: 决策矩阵

很多时候您会困惑：*“这个工作流，我该做成一个 Skill 还是一个 Agent？”*

**核心原则**: **Skill 是 Agent 的前身；Agent 是 Skill 的固化。**

| 维度 | **LiYe Skill (能力)** | **LiYe Agent (智能体)** |
| :--- | :--- | :--- |
| **本质** | **文档 & SOP** (说明书) | **代码 & 软件** (机器人) |
| **载体** | Markdown, Templates, Prompts | Python/JS Code, API Tools |
| **灵活性** | 高 (随时改文字) | 低 (需要改代码) |
| **执行者** | 人 + 通用AI (Claude) | 专用程序 (BMad Runtime) |
| **适用阶段** | **探索期** (流程还在变，偶尔用) | **成熟期** (流程已固定，高频用) |

### 3. 未来的构建与进化路径

**Step 1: 孵化 (Skill Phase)**
*   遇到新任务 (如 "Acme 关键词分析")。
*   使用 `liye skill` 创建文档结构。
*   用自然语言写 SOP，人机配合执行。
*   **收益**: 快速建立标准，低成本试错。

**Step 2: 固化 (Agent Phase)**
*   当一个 Skill 变得**非常成熟**且**极高频** (每天都要做，且步骤完全固定)。
*   使用 **BMad Builder** (或 `liye agent` 命令) 将其转化为代码。
*   这个 Agent 会被放入 `LiYe-Core` 的代码库中运行。
*   **收益**: 极致效率，全自动运行，可无人值守。

**结论**:
*   绝大多数工作流 (90%) 应该先做成 **Skill**。
*   只有那 10% 最核心、最繁琐的 Skill，才值得“升级”为 **Agent**。

---

## ⚖️ BMad Fork 可行性与法律策略 (Feasibility & Legal Strategy)

### 部署策略决策 (Deployment Strategy)

针对 **LiYe-Core** 的部署位置，我们推荐 **"开发中心模式 (Development Hub Model)"**。

**关于 "为什么 Claude/Antigravity 在 Home 目录?" 的评估**:
*   **Claude/Antigravity** (`~/.claude`, `~/.antigravity`): 这些是**二进制程序的配置/缓存目录**。它们不是源代码，您不需要修改它们的内部逻辑，只需要修改配置文件。因此它们放在 Home 目录下的隐藏文件夹是标准的 Unix/Linux 惯例。
*   **LiYe-Core (BMad)**: 这是一个**源代码框架**。我们需要频繁修改它的 Prompt、Agent 定义和工作流脚本。因此，它不应该作为一个“已安装的软件”隐藏在 `.folder` 中，而应该作为一个**活跃的开发项目**存在。

**最终目录标准**:

| 组件类型 | 示例 | 推荐位置 | 原因 |
| :--- | :--- | :--- | :--- |
| **闭源二进制/服务** | Claude Code, Antigravity | `~/.claude`, `~/.antigravity` | 仅存储配置和缓存，不修改源码。 |
| **核心源码引擎** | **LiYe-Core** | **`~/github/LiYe-Core`** | 需要频繁迭代开发，版本控制。 |
| **用户数据/知识** | Obsidian, LiYe OS Doc | `~/Documents/liye_workspace` | 数据资产，非代码。 |

**执行方案**:
1.  **Repo 位置**: `~/github/LiYe-Core`
2.  **全局连接**: 使用 `npm link` 将其注册为全局命令 `liye`。
3.  **配置引用**: 在 `LiYe_OS` 的配置中引用 `~/github/LiYe-Core` 的路径。

---

## 🚀 下一步行动

1.  **移动 & 归档**: 将 `DUAL_ENGINE_SUMMARY.md` 移动到 `LiYe_OS/_meta/` 作为历史参考 (已完成)。
2.  **安装/设置 BMad**:
    - 运行 `npx bmad-method install` (如果需要 CLI) 或者手动采用该协议。
    - **建议**: 首先将 BMad 作为一种 **协议 (Protocol/Methodology)** 使用，通过 Antigravity 和 Claude 来执行它。
3.  **试点项目**:不仅挑选一个 "P0" 项目 (例如："LiYe OS CLI") 并使用三引擎工作流来执行它。
