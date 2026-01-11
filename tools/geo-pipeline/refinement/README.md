# GEO OS Refinement Pipeline

T2 → T1 知识单元精炼管道，通过 TRUTH_DELTA_GATE 实现质量控制。

## 架构概述

```
T2 Raw Data → Chunking → LLM Delta Generation → TRUTH_DELTA_GATE → T1 Units
                                                       │
                                                       ├─ PASS → T1 Export
                                                       └─ FAIL → Retain in T2
```

## 模块说明

| 模块 | 职责 |
|------|------|
| `pipeline.py` | T2 加载、分块、候选生成 |
| `truth_delta_gate.py` | 宪法级验证门 |
| `truth_delta_generator.py` | LLM 辅助生成 (非自动填充) |
| `run_refinement.py` | 完整管道执行入口 |

## 使用方法

```bash
# 完整运行
python run_refinement.py --all

# 指定来源
python run_refinement.py --sources helium10,reddit_fba

# 测试运行 (限制数量)
python run_refinement.py --sources helium10 --limit 50
```

---

## TRUTH_DELTA_GATE – Frozen Contract

> **Status**: FROZEN
> **Type**: Anti-Noise Constitutional Gate
> **Amendment Process**: Required for any modification

### 设计意图

TRUTH_DELTA_GATE 的存在目的是 **拒绝内容**，而非批准内容。

T1 被设计为稀缺资源。低通过率是 **预期行为**，而非缺陷。

### 核心原则

| 原则 | 说明 |
|------|------|
| **T1 稀缺性** | T1 不是知识库，是推理燃料 |
| **机制优先** | 每个 T1 单元必须包含可验证的机制/因果关系 |
| **数量敌人** | 在 T1 中，数量是质量的敌人 |

### 预期指标

| 指标 | 预期值 | 说明 |
|------|--------|------|
| 通过率 | 20-40% | 低通过率是正常的 |
| NO_MECHANISM | 40-60% | 大多数内容不含机制 |
| GATE_FAILED | 5-15% | LLM 生成的 delta 仍可能被拒绝 |

### 禁止修改 (Constitutional Violation)

以下修改类型被明确禁止，任何实现都将被视为宪法违规：

```
❌ 自动补全 truth_delta
   - 当 LLM 返回 NO_MECHANISM 时不得使用 fallback 值
   - 不得基于内容摘要自动生成 delta

❌ 基于相似度放行
   - 不得使用 embedding 距离作为通过条件
   - 不得基于"与已通过单元相似"而放行

❌ 为提高通过率而弱化条件
   - 不得降低字符阈值
   - 不得移除 VAGUE_PATTERNS 或 BOILERPLATE_PATTERNS
   - 不得将 MECHANISM_INDICATORS 设为可选
   - 不得添加"软通过"或"条件通过"逻辑

❌ 来源特权
   - 不得为特定来源添加"例外"逻辑
   - 所有来源必须通过相同的验证规则
```

### 修改流程

如需修改 TRUTH_DELTA_GATE 行为，**必须**遵循以下流程：

1. **宪法审查**
   - 更新 `docs/architecture/T1_CANONICAL_DEFINITION.md`
   - 说明为何当前定义需要修改

2. **修正案申请**
   - 在 `docs/architecture/AMENDMENTS.md` 记录修改提案
   - 包含：修改理由、预期影响、回滚方案

3. **显式批准**
   - 获得架构决策的显式批准
   - 不得基于"提高效率"或"增加产出"批准

4. **实施与监控**
   - 修改后监控通过率变化
   - 如通过率显著上升，视为潜在违规

### 参考文档

- `docs/architecture/T1_CANONICAL_DEFINITION.md` - T1 规范定义
- `docs/architecture/T1_CONSUMPTION_RULES.md` - T1 消费规则
- `docs/architecture/TRUTH_SOURCE_TIERS.md` - 真相源层级模型
- `config.yaml` § tier_guard - 执行时层级守卫配置

---

## T1 Consumption Rules

> **T1 is not an answer source. It is a reasoning substrate.**

导出的 T1 单元受严格消费规则约束：

### 授权消费者

| Consumer | 说明 |
|----------|------|
| Analyst Agent | 作为分析推理输入 |
| Strategy Agent | 作为策略制定依据 |
| OS-level Reasoning Modules | 作为系统推理基础 |

### 禁止用法

| 用法 | 原因 |
|------|------|
| ❌ 人类直接阅读当教程 | T1 是原子化机制，不是可读教程 |
| ❌ 内容生成直接复用 | 丢失推理过程，将燃料当产品 |
| ❌ RAG 直接返回原文 | 必须经过推理综合 |

### 使用规范

```
T1 Unit → Agent Reasoning → Synthesized Output → User
           ↑                      ↑
        必须经过推理           不是直接复制
```

详见: `docs/architecture/T1_CONSUMPTION_RULES.md`

---

## 输出路径

| 类型 | 路径 |
|------|------|
| T1 候选 | `~/data/T1_candidates/{source}_candidates.json` |
| 验证通过 | `~/data/exports/T1_refined/t1_units_{timestamp}.json` |
| 验证失败 | `~/data/T1_candidates/rejected.json` |

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-12-30 | 初始实现，GATE 冻结 |
