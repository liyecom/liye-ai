# LiYe AI · Personal Operating System

> **让盲目自信在结构上不可能发生。**

[![Version](https://img.shields.io/badge/version-5.1.0-blue.svg)](https://github.com/liyecom/liye-ai)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

LiYe OS 是一个 **AI-native 个人操作系统**，专为协调智能代理和升级人机协作而设计。

**它是什么**：生产级基础设施，不是产品演示。

**核心能力**：
- 世界模型推理（描述现实，不做预测）
- 多智能体编排（Agent + Crew + Skills）
- 多 Broker 路由（自动选择最优模型）
- Mission 任务系统（结构化执行 + 审计追踪）

---

## 为什么需要 LiYe OS？

| 传统 AI 助手 | LiYe OS |
|-------------|---------|
| "这个股票会涨" | "当前流动性紧张，预期已饱和" |
| 直接给建议 | 暴露因果链和假设 |
| 隐藏不确定性 | 明确说明"这不告诉你什么" |
| 单一模型 | 智能路由到最优模型 |

**核心理念**：世界模型不告诉你该做什么，它确保你无法忽视世界实际的样子。

---

## 功能特性

### 世界模型推理
三层内核流水线（T1 → T2 → T3），通过结构性约束防止盲目自信。
> 详见 [World Model 文档](docs/kernel/)

### 多智能体编排
YAML 声明式定义，三部曲公式：`Agent = Persona + Skills + Runtime`
> 详见 [Agent 规范](docs/architecture/)

### 多 Broker 路由
智能任务路由（Codex / Claude / Gemini / Antigravity），配置驱动。
> 详见 [Broker 配置](config/brokers.yaml)

### Mission Pack 系统
结构化任务执行，内置审批、预算和审计。
> 详见 [Mission 文档](docs/mission/)

### 多领域验证
| 领域 | 状态 | 说明 |
|------|------|------|
| Amazon Growth OS | 生产 | 电商优化 |
| Investment OS | 验证 | 投资分析 |
| Medical OS | 实验 | 高风险推理 |

---

## 快速开始

### 安装

```bash
git clone https://github.com/liyecom/liye-ai.git
cd liye-ai && npm install && npm link
```

### 使用

```bash
liye 分析这段代码的性能问题
liye 分析ASIN：B08SVXGTRT
liye 搜索亚马逊关键词趋势
```

就这么简单。系统自动处理意图识别、Agent 选择和模型路由。

### 环境要求

- Node.js >= 18.0.0
- `ANTHROPIC_API_KEY` 环境变量

---

## 架构概览

```
liye_os/
├── src/
│   ├── kernel/                 # 世界模型内核栈
│   │   ├── t1/                 # T1 推理内核 (v2.0.0)
│   │   ├── t2/                 # T2 世界状态内核 (v1.0.0)
│   │   ├── t3/                 # T3 世界动态内核 (v1.0.0)
│   │   ├── WORLD_MODEL_PIPELINE.yaml
│   │   └── GOVERNANCE_RULES.yaml
│   │
│   ├── domain/                 # 领域实现
│   │   ├── amazon-growth/      # 电商优化系统
│   │   ├── investment-os/      # 投资分析系统
│   │   ├── medical-os/         # 医疗推理系统
│   │   └── geo-os/             # 地理知识系统
│   │
│   ├── mission/                # Mission Pack 管理
│   ├── brokers/                # Broker 实现
│   └── runtime/                # 执行引擎
│
├── Agents/                     # Agent 定义 (YAML)
│   ├── core/                   # 核心代理
│   └── amazon-growth/          # 领域代理
│
├── Skills/                     # 方法论与 SOP
│   ├── 00_Core_Utilities/
│   ├── 01_Research_Intelligence/
│   └── ...                     # 12 个方法论领域
│
├── cli/                        # 命令行接口
├── config/                     # 配置文件
│   ├── brokers.yaml            # Broker 路由配置
│   └── policy.yaml             # 安全策略配置
│
├── docs/                       # 文档
└── traces/                     # 执行追踪与遥测
```

---

## 世界模型内核

三层认知基础设施，**不预测、不推荐、不优化**：

| 层 | 问题 | 输出 |
|----|------|------|
| T1 | 压力下哪里会失败？ | 因果链、假设暴露 |
| T2 | 当前危险状态？ | 5维坐标（流动性/相关性/预期/杠杆/不确定性） |
| T3 | 状态如何演变？ | 形态描述（加速/放大/相变） |

**约束**：每个输出必须包含"这不告诉你什么..."

> 技术细节：[src/kernel/](src/kernel/) | [治理规则](src/kernel/GOVERNANCE_RULES.yaml)

---

## 使用方式

**自然语言交互**（推荐）：

```bash
liye 分析这段代码的性能问题
liye 分析ASIN：B08SVXGTRT
liye 分析 indoor door mat 这个关键词
liye 搜索亚马逊关键词趋势
```

系统自动识别意图 → 选择合适的 Agent → 路由到最优模型 → 返回结果

**开发者命令**（高级）：

```bash
liye --help                       # 查看所有命令
liye broker list                  # 查看模型路由
liye agent list                   # 查看可用代理
liye cost report                  # 成本报告
```

> Mission 管理等底层命令见 [开发者文档](docs/cli.md)

---

## 配置

两个核心配置文件：

| 文件 | 用途 |
|------|------|
| `config/brokers.yaml` | Broker 路由（哪个任务用哪个模型） |
| `config/policy.yaml` | 安全策略（审批、沙箱、预算） |

示例路由：
```yaml
routes:
  ask:      { broker: codex,      model: gpt-5.2-thinking }
  build:    { broker: claude,     model: claude-sonnet-4 }
  research: { broker: antigravity, approval: manual }
```

---

## 治理框架

| 层级 | 约束 | 执行 |
|------|------|------|
| 内核 | 不预测/不推荐/不优化 | CI Gate |
| 领域 | 领域禁止（如医疗不诊断） | 文档 |
| Mission | 预算/审批/沙箱 | policy.yaml |

> 详见 [治理文档](docs/CONSTITUTION.md)

---

## Agent 系统

**三部曲公式**：`Agent = Persona + Skills + Runtime`

```
Agents/
├── core/              # 核心代理（orchestrator, researcher）
└── amazon-growth/     # 领域代理（keyword-architect, listing-optimizer）
```

> 详见 [Agent 规范](Agents/_template.yaml)

---

## 开发

```bash
liye agent validate <path>        # 验证 Agent
liye skill validate <path>        # 验证 Skill
npm test                          # 运行测试
node .claude/scripts/guardrail.mjs # 架构合规检查
```

---

## 版本

| 版本 | 日期 | 重点 |
|------|------|------|
| 5.1.0 | 2025-12-31 | World Model Stack (T2/T3) |
| 5.0.0 | 2025-12-27 | Multi-Broker 架构 |
| 4.0.0 | 2025-12-20 | Mission Pack 系统 |

---

## 贡献

1. Fork → 创建分支 → 提交 → PR
2. 所有 PR 必须通过治理 CI Gates

---

## 许可证

[Apache License 2.0](LICENSE)

---

*LiYe AI - 让盲目自信在结构上不可能发生*
