<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a>
</p>

# LiYe OS

> **面向 Claude Code / AI 协作开发的「治理与架构参考实现」**
>
> 让 AI 的输出变成可审计、可回放、可控演进的工程系统。

[![Version](https://img.shields.io/badge/version-6.3.0-blue.svg)](https://github.com/liyecom/liye_os)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)
[![Stability](https://img.shields.io/badge/stability-contract-orange.svg)](docs/architecture/ARCHITECTURE_CONTRACT.md)

---

## 它是什么

LiYe OS 是用于构建 AI 协作工程系统的**参考实现**，包含：

- **世界模型门禁（World Model Gate）**：执行前强制风险分析（T1/T2/T3 认知流水线）
- **架构契约（Architecture Contract）**：定义 Frozen/Stable/Experimental 边界
- **回放与审计（Replay & Audit）**：每个决策都可追溯、可复现

**核心哲学**：「让盲目自信在结构上不可能发生」

---

## 适合谁

**适合使用 LiYe OS 的人：**
- 想构建带治理能力的个人 AI 操作系统
- 想理解 Claude Code + 架构治理最佳实践
- 想复用 World Model Gate 设计模式到自己的系统

**不适合使用 LiYe OS 的人：**
- 想要开箱即用的 AI 工具（这是参考实现，不是产品）
- 不想理解架构就直接跑
- 期望有 GUI 界面

---

## 采用路径

根据你的需求选择路径：

### 路径 1：抄结构（Blueprint）

**目标**：复用目录结构和架构模式

```
从这里开始：
├── _meta/docs/ARCHITECTURE_CONSTITUTION.md  # 设计原则
├── docs/architecture/                        # 架构决策
└── .github/workflows/*gate*                  # CI 治理门禁
```

### 路径 2：接治理（Governance Stack）

**目标**：把 CI 门禁和契约集成到你的项目

```
从这里开始：
├── .github/workflows/architecture-gate.yml   # 架构强制检查
├── .github/workflows/constitution-*-gate.yml # 宪法检查
└── docs/architecture/ARCHITECTURE_CONTRACT.md # 稳定性契约
```

### 路径 3：跑闭环（Minimal Runtime）

**目标**：用 Claude Code 实际运行 LiYe OS

```bash
# 克隆仓库
git clone https://github.com/liyecom/liye_os.git
cd liye_os

# 检查架构合规性
node .claude/scripts/guardrail.mjs

# 为任务生成上下文
node .claude/scripts/assembler.mjs --task "分析 ASIN B08SVXGTRT"

# 用 Claude Code - 直接自然语言对话：
# "分析 ASIN B08SVXGTRT"
# Claude Code 读取 CLAUDE.md 并自动加载相关上下文
```

---

## 稳定性契约

LiYe OS 维护清晰的稳定性边界。详见 [ARCHITECTURE_CONTRACT.md](docs/architecture/ARCHITECTURE_CONTRACT.md)。

| 级别 | 含义 | 示例 |
|------|------|------|
| **Frozen** | 不可变，宪法级 | `_meta/governance/`、`*gate*` 工作流 |
| **Stable** | 向后兼容 | `docs/architecture/`、`src/kernel/` 接口 |
| **Experimental** | 可能变更 | `Agents/`、`Crews/`、`src/kernel/` 内部实现 |

---

## 架构概览

```
liye_os/
├── CLAUDE.md                 # 上下文编译器入口（Claude Code 读取）
├── .claude/packs/            # 领域知识包（按需加载）
│
├── src/kernel/               # 世界模型内核（T1/T2/T3）
│   ├── t1/                   # 因果推理
│   ├── t2/                   # 状态评估
│   └── t3/                   # 动态预测
│
├── _meta/governance/         # 治理规则（Frozen）
├── .github/workflows/        # CI 门禁（Frozen: *gate*，Stable: 其他）
│
├── Agents/                   # Agent 定义（Experimental）
├── Skills/                   # 方法论与 SOP
└── docs/architecture/        # 架构文档（Stable）
```

---

## 世界模型门禁

核心创新：**无风险分析，不执行。**

| 层 | 问题 | 输出 |
|----|------|------|
| T1 | 压力下哪里会失败？ | 因果链、假设暴露 |
| T2 | 当前危险状态？ | 5 维坐标（流动性/相关性/预期/杠杆/不确定性） |
| T3 | 状态将如何演变？ | 形态描述（加速/放大/相变） |

**约束**：每个输出必须包含「这不告诉你什么...」

---

## 给采用者

如果你正在使用 LiYe OS 作为参考或依赖：

1. **登记** 在 [ADOPTERS.md](ADOPTERS.md)（公开或匿名）
2. **关注** 破坏性变更通知
3. **查阅** [稳定性契约](docs/architecture/ARCHITECTURE_CONTRACT.md) 再决定依赖哪些组件

---

## 版本历史

| 版本 | 日期 | 重点 |
|------|------|------|
| 6.3.0 | 2026-01-02 | 稳定性契约、采用者登记 |
| 6.2.0 | 2026-01-01 | Phase 5.4 回放与回归门禁 |
| 6.0.0 | 2025-12-31 | Claude Code 原生，移除 CLI |

---

## 许可证

[Apache License 2.0](LICENSE)

---

## 品牌说明

| 场景 | 名称 | 说明 |
|------|------|------|
| 对外传播 | LiYe AI | 更易记忆 |
| 技术文档 | LiYe OS | 保持严谨 |
| GitHub 仓库 | liye_os | 不变 |

---

*LiYe OS - 让盲目自信在结构上不可能发生*
