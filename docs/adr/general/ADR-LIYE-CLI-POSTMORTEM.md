# ADR: LiYe CLI 复盘 (Postmortem)

- decision_id: ADR-0003
- domain: general
- status: accepted
- tags: [cli, postmortem, architecture]

**状态**: Accepted
**日期**: 2026-01-01
**决策者**: LiYe
**参考**: CLI Manager (solhun.com)

## 背景

LiYe CLI (v5.0 - v5.2) 作为 LiYe OS 的命令行入口，经历了多次迭代后在 v6.0.0 被完全删除。同期，CLI Manager 产品成功上线并商业化，实现了类似的"多 AI CLI 管理"愿景。

本文档记录复盘分析，为未来类似决策提供参考。

## 产品对比

| 维度 | CLI Manager (成功) | LiYe CLI (放弃) |
|------|-------------------|-----------------|
| **核心定位** | Dashboard / Orchestrator | Context Compiler / Executor |
| **与底层关系** | 管理层（不侵入） | 包装层（侵入执行） |
| **解决的问题** | 多 Agent 切换混乱 | 上下文加载繁琐 |
| **技术复杂度** | 低（UI + 进程管理） | 高（NLP + 路由 + 编译） |
| **商业模式** | $29 终身买断 | 内部工具，无商业化 |
| **安装方式** | .dmg 拖拽安装 | npm install + 配置 |

## 根因分析

### 1. 定位错误（核心问题）

LiYe CLI 试图成为"上下文编译器"，在 Claude Code 执行之前插入一个预处理层。

**问题**：
- 用户不关心"上下文编译"，只关心"完成任务"
- Claude Code 已经自动读取 CLAUDE.md，LiYe CLI 的预处理价值存疑
- "编译器"是工具链概念，不是用户界面概念

**CLI Manager 的正确做法**：
- 定位为 "Dashboard"（仪表盘），用户秒懂
- 不做任何 AI 调用，只做 UI 展示和进程切换
- 解决的问题极度具体："我要在多个 CLI 窗口间切换"

### 2. 架构层次错误

```
正确模型（CLI Manager）：        错误模型（LiYe CLI）：
┌─────────────────────┐         ┌─────────────────────┐
│   Meta Layer (UI)   │         │   Claude Code       │
├─────────────────────┤         ├─────────────────────┤
│   Claude/Codex/etc  │         │   LiYe CLI (中间层)  │ ← 不应存在
├─────────────────────┤         ├─────────────────────┤
│   OS / Shell        │         │   OS / Shell        │
└─────────────────────┘         └─────────────────────┘
```

**原则**：当底层工具足够强大时，**在上方加伞，不在中间插层**。

### 3. router.js 的灾难性决策

router.js 试图调用 `claude` CLI 执行任务，导致：
- 循环依赖：liye CLI 依赖 claude CLI
- 错误传播：信息经过转译丢失
- 版本耦合：claude CLI 升级可能导致 liye 崩溃

**CLI Manager 的正确做法**：只启动进程，不代理调用。

### 4. 产品化缺失

| 问题 | LiYe CLI | CLI Manager |
|------|----------|-------------|
| 商业约束 | 无（内部工具） | $29 定价约束功能膨胀 |
| 安装摩擦 | 高（npm + 配置） | 低（.dmg 拖拽） |
| 功能冻结 | 从未达到 | 已上线销售 |
| 用户验证 | 无 | 有付费用户 |

## 核心教训

1. **不要在强大系统前面加层** - 底层够强时，在上方加伞
2. **定位要极度清晰** - "Dashboard" 人人懂，"Context Compiler" 需要解释
3. **商业约束是好事** - 价格逼迫保持简单
4. **安装摩擦决定生死** - .dmg 拖拽 vs npm install + 配置
5. **功能冻结才能交付** - 探索可以，但要有收敛点
6. **解决真实问题** - "切换窗口"是真痛点，"上下文编译"是自造问题

## 决策

v6.0.0 删除 LiYe CLI，拥抱 Claude Code Native 路线是**正确的战略撤退**。

当前方向：
- Skills / Hooks / Packs 系统深耕
- 不再尝试在 Claude Code 前面加中间层
- 如需管理层能力，考虑纯 UI Dashboard（不侵入执行流）

## 未来可选方案

### 方案 A：纯 UI 管理层

如果重做，做类似 CLI Manager 的东西：
- 只显示和切换 AI CLI sessions
- 不做上下文编译、域路由、Agent 验证
- Electron/Tauri 桌面应用，.dmg 分发

### 方案 B：继续 Claude Code Native

当前路线，不做 CLI：
- .claude/ 的 skills 和 hooks
- CLAUDE.md 智能路由
- Pack 自动加载系统
- 零安装摩擦，深度集成

## 参考资料

- CLI Manager: https://www.solhun.com/
- Memory Records: #4933, #4946, #4950, #4981, #5008
- v6.0.0 Release: 删除 cli/ 目录，简化 package.json

---

**Version**: 1.0
**Author**: LiYe OS Team
**Review Date**: 2026-01-01
