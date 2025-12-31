# LiYe AI · Personal Operating System

> **让盲目自信在结构上不可能发生。**

[![Version](https://img.shields.io/badge/version-6.0.0-blue.svg)](https://github.com/liyecom/liye-ai)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)

LiYe OS 是一个 **AI-native 个人操作系统**，为 Claude Code 提供领域知识和推理框架。

---

## 核心理念

**世界模型不告诉你该做什么，它确保你无法忽视世界实际的样子。**

| 传统 AI 助手 | LiYe OS |
|-------------|---------|
| "这个股票会涨" | "当前流动性紧张，预期已饱和" |
| 直接给建议 | 暴露因果链和假设 |
| 隐藏不确定性 | 明确说明"这不告诉你什么" |

---

## 使用方式

**在 Claude Code 中直接说：**

```
分析ASIN：B08SVXGTRT
分析Google公司的财报
研究这个医学论文的方法论
```

Claude Code 自动：
1. 读取 CLAUDE.md 识别任务类型
2. 加载对应的 Pack（operations / research / infrastructure）
3. 应用相关的 Agents 和 Skills
4. 执行任务

**就这么简单。不需要额外命令。**

---

## 架构

```
liye_os/
├── CLAUDE.md              # 启动配置（Claude Code 读取）
├── .claude/packs/         # 领域知识包
│   ├── operations.md      # Amazon/跨境/电商
│   ├── research.md        # 医疗/研究
│   └── infrastructure.md  # 架构/配置
│
├── src/kernel/            # 世界模型内核
│   ├── t1/                # T1 推理内核
│   ├── t2/                # T2 世界状态
│   └── t3/                # T3 世界动态
│
├── Agents/                # Agent 定义
│   ├── core/              # 核心代理
│   └── amazon-growth/     # 领域代理
│
├── Skills/                # 方法论与 SOP
│   └── 12 个领域模块
│
└── docs/                  # 文档
```

---

## 世界模型内核

三层认知流水线，**不预测、不推荐、不优化**：

| 层 | 问题 | 输出 |
|----|------|------|
| T1 | 压力下哪里会失败？ | 因果链、假设暴露 |
| T2 | 当前危险状态？ | 5维坐标（流动性/相关性/预期/杠杆/不确定性） |
| T3 | 状态如何演变？ | 形态描述（加速/放大/相变） |

**约束**：每个输出必须包含"这不告诉你什么..."

---

## 领域系统

| 领域 | Pack | 触发词 |
|------|------|--------|
| Amazon Growth OS | operations.md | amazon, asin, ppc, listing |
| Investment OS | research.md | 财报, 股票, 投资 |
| Medical OS | research.md | 医疗, 治疗, 临床 |

---

## 开发

```bash
# 克隆仓库
git clone https://github.com/liyecom/liye-ai.git
cd liye-ai

# 架构检查
node .claude/scripts/guardrail.mjs
```

---

## 版本

| 版本 | 日期 | 重点 |
|------|------|------|
| 6.0.0 | 2025-12-31 | 移除 CLI，Claude Code 原生 |
| 5.1.0 | 2025-12-31 | World Model Stack (T2/T3) |
| 5.0.0 | 2025-12-27 | Multi-Broker 架构 |

---

## 许可证

[Apache License 2.0](LICENSE)

---

*LiYe AI - 让盲目自信在结构上不可能发生*
