# MaaP (Memory as a Product) 深度解析

**文档版本**: 1.0
**生成日期**: 2026-02-02
**适用版本**: LiYe OS v6.3.0
**目标读者**: 开发者/架构师

---

## 目录

1. [概述](#1-概述)
2. [核心理念](#2-核心理念)
3. [架构组件](#3-架构组件)
4. [执行流程](#4-执行流程)
5. [Glossary 系统](#5-glossary-系统)
6. [Domain 检测机制](#6-domain-检测机制)
7. [Drift 漂移检测](#7-drift-漂移检测)
8. [Memory Diff 审计](#8-memory-diff-审计)
9. [Output Contract](#9-output-contract)
10. [CI 门禁集成](#10-ci-门禁集成)
11. [实战示例](#11-实战示例)
12. [故障排除](#12-故障排除)

---

## 1. 概述

### 1.1 什么是 MaaP？

**MaaP** = **M**emory **a**s **a** **P**roduct

MaaP 是 LiYe OS 中的**知识治理架构**，将"记忆"(术语、定义、决策) 作为一等公民产品来管理，而不是散落在代码或文档中的隐式知识。

### 1.2 核心问题：为什么需要 MaaP？

| 问题 | 后果 | MaaP 解决方案 |
|------|------|---------------|
| **术语漂移** | 同一概念在不同文档/时间中定义不一致 | Glossary SSOT + 版本控制 |
| **定义不可追溯** | 决策依据无法审计，出错后难以定位 | 强制引用 (path + term + version) |
| **隐式知识** | 关键业务定义只存在于某些人脑中 | 显式化为 Glossary YAML |
| **多领域冲突** | 同一术语在不同领域含义不同 | Domain Stack + 跨域标记 |

### 1.3 MaaP 定位

```
┌─────────────────────────────────────────────────────────────┐
│                     LiYe OS 架构                            │
├─────────────────────────────────────────────────────────────┤
│  World Model (T1/T2/T3)  │  Policy Engine  │  Audit System │
├─────────────────────────────────────────────────────────────┤
│                     ★ MaaP (Memory as a Product) ★          │
│   - Glossary SSOT   - Domain Detection   - Drift Detection │
├─────────────────────────────────────────────────────────────┤
│              Context Assembler  │  Skills  │  Agents       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 核心理念

### 2.1 三大支柱

| 支柱 | 原则 | 实现 |
|------|------|------|
| **SSOT** | 单一事实来源 | 所有定义来自版本化的 Glossary |
| **Traceability** | 可追溯性 | 每个术语引用包含 `path + term + version` |
| **Auditability** | 可审计性 | 所有内存访问和变更都记录日志 |

### 2.2 核心等式

```
Knowledge = Glossary (SSOT) + ADR (decisions) + Playbook (procedures)
```

**Glossary**: 术语定义 (是什么)
**ADR**: 架构决策记录 (为什么这样做)
**Playbook**: 操作手册 (怎么做)

### 2.3 i18n 策略

```yaml
# 关键规则：English 是 SSOT (推理权威)
# 中文仅作为 display translation

concept:
  definition: "English definition (SSOT - used for reasoning)"
  i18n:
    zh-CN:
      definition: "中文定义 (仅用于展示)"
```

**为什么？**
- 跨语言一致性：避免翻译导致的语义漂移
- AI 推理准确性：LLM 以英文定义为准
- 可审计性：所有决策追溯到同一英文定义

---

## 3. 架构组件

### 3.1 组件总览

```
┌─────────────────────────────────────────────────────────────┐
│                     Session Start                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              memory_bootstrap.mjs                            │
│  - Domain detection (关键词评分)                             │
│  - Glossary loading (加载相关术语)                           │
│  - ADR/Playbook indexing (索引相关决策)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Memory Brief (MaaP Output)                      │
│  .claude/.compiled/memory_brief.md                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Context Assembler                               │
│  Injects Memory Brief after Kernel                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Glossary Drift Detector (P0)                    │
│  - Output 前检查术语是否注册                                  │
│  - 检查引用版本是否一致                                       │
│  - 违规 = 输出阻断                                           │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 关键文件清单

| 组件 | 文件路径 | 作用 |
|------|----------|------|
| **Memory Bootstrap** | `.claude/scripts/memory_bootstrap.mjs` | 会话启动时生成 Memory Brief |
| **Memory Diff** | `.claude/scripts/memory_diff.mjs` | 比较前后 Memory Brief 差异 |
| **Domain Mapping** | `.claude/config/domain-mapping.yaml` | 领域关键词映射配置 |
| **Glossary (General)** | `knowledge/glossary/general.yaml` | 通用术语表 |
| **Glossary (Domain)** | `knowledge/glossary/{domain}.yaml` | 领域特定术语表 |
| **Drift Detector** | `.claude/skills/memory/glossary-drift-detector.md` | 漂移检测技能定义 |
| **Memory Brief** | `.claude/.compiled/memory_brief.md` | 编译输出 (运行时) |
| **Diff Output** | `memory/diff/MEMORY_DIFF_*.md` | 差异报告 |
| **CI Gate** | `.github/workflows/memory-governance-gate.yml` | CI 门禁 |

---

## 4. 执行流程

### 4.1 会话启动流程

```
1. SessionStart Hook 触发
   ↓
2. memory_bootstrap.mjs 执行
   ├── 读取 .claude/config/domain-mapping.yaml
   ├── 解析任务描述 (task)
   ├── 计算各 domain 的 keyword score
   ├── 选择 highest score 的 domain
   ├── 加载该 domain 的 glossary
   ├── 搜索相关 ADR 和 Playbook
   └── 生成 memory_brief.md
   ↓
3. memory_diff.mjs 执行 (可选)
   ├── 比较当前 brief 与上次 brief
   ├── 检测 domain 变化
   ├── 检测 confidence 变化 (>0.2 报警)
   └── 生成 diff 报告
   ↓
4. Context Assembler 注入 Memory Brief
   ↓
5. Claude 开始处理用户请求
   ↓
6. 输出前 Glossary Drift Detector 检查
   ├── 术语是否注册？
   ├── 引用版本是否正确？
   └── 违规 → 阻断输出
```

### 4.2 数据流图

```
                    ┌─────────────────┐
                    │  User Task      │
                    │  "优化 ACoS"    │
                    └────────┬────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Domain Detection                           │
│                                                              │
│  task: "优化 ACoS"                                           │
│  ↓                                                           │
│  Score calculation:                                          │
│  - amazon-advertising: acos(1 hit) × 90(priority) = 90       │
│  - geo: 0 hits × 80 = 0                                      │
│  - medical-research: 0 hits × 70 = 0                         │
│  - general: 0 hits × 10 = 0                                  │
│  ↓                                                           │
│  Winner: amazon-advertising (confidence: 0.70)               │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Glossary Loading                           │
│                                                              │
│  Load: knowledge/glossary/amazon-advertising.yaml            │
│  Terms: ACoS, ROAS, CTR, CPC, ...                            │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Memory Brief Output                        │
│                                                              │
│  ## Domain Detection                                         │
│  - domain: amazon-advertising                                │
│  - confidence: 0.70 (keyword_score(1_hits))                  │
│                                                              │
│  ## Canonical Glossary                                       │
│  | Term | Definition | Formula | Version |                   │
│  | ACoS | Ad Cost of Sales | Spend/Sales×100% | v1.0 |       │
│  | ROAS | Return on Ad Spend | Sales/Spend | v1.0 |          │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Glossary 系统

### 5.1 Glossary 文件结构

```yaml
# knowledge/glossary/{domain}.yaml

# 文件元数据
file_version: 2
domain: amazon-advertising

# 术语定义
concepts:
  - concept_id: AMZ_ACOS          # 唯一标识符 (推荐前缀: {DOMAIN}_)
    version: v1.0                  # 语义版本
    domain: amazon-advertising     # 所属领域
    name: ACoS                     # 显示名称

    # English SSOT (权威定义)
    definition: "Advertising Cost of Sales. The percentage of ad spend relative to attributed sales."
    formula: "Ad Spend ÷ Attributed Sales × 100%"

    # 国际化显示翻译
    i18n:
      zh-CN:
        definition: "广告销售成本。广告支出占归因销售额的百分比。"

    # 别名 (用于匹配)
    aliases:
      en-US:
        - Advertising Cost of Sales
        - ad cost of sales
      zh-CN:
        - 广告销售成本
        - 广告成本占比

    # 相关术语
    related:
      - AMZ_ROAS
      - AMZ_CTR

    # 常见误区
    pitfalls:
      - "ACoS only counts sales within attribution window (7 days)"
      - "ACoS ≠ profit margin"

    updated_at: "2026-01-01"
```

### 5.2 版本控制策略

| 变更类型 | 版本跳跃 | 示例 |
|----------|----------|------|
| Typo 修复 | Patch (x.x.1) | "Advertizing" → "Advertising" |
| 澄清说明 | Minor (x.1.0) | 添加示例到定义 |
| 公式变更 | Major (1.0.0) | 计算方法改变 |
| 新增术语 | Minor (x.1.0) | 添加新概念 |
| 移除术语 | Major (1.0.0) | 废弃概念 |

### 5.3 concept_id 命名规范

```
{DOMAIN_PREFIX}_{CONCEPT_NAME}

示例:
- AMZ_ACOS       (Amazon 领域的 ACoS)
- GEN_SSOT       (通用领域的 SSOT)
- GEO_LOCAL_PACK (Geo-SEO 领域的 Local Pack)
- MED_BIOMARKER  (Medical 领域的 Biomarker)
```

### 5.4 引用格式

| 格式 | 示例 |
|------|------|
| **标准引用** | `(ref: knowledge/glossary/amazon-advertising.yaml#AMZ_ACOS@v1.0)` |
| **简写引用** | `[[AMZ_ACOS@v1.0]]` |
| **内联引用** | `ACoS (ref: AMZ_ACOS@v1.0)` |
| **跨域引用** | `(ref: knowledge/glossary/fintech.yaml#FIN_CAC@v1.0 [cross-domain])` |

---

## 6. Domain 检测机制

### 6.1 配置结构

```yaml
# .claude/config/domain-mapping.yaml

version: 1
domains:
  - id: amazon-advertising
    priority: 90                    # 权重 (越高优先级越高)
    alias_weight: 0.6               # 别名权重 (相对于 core)

    core_keywords:                  # 核心关键词 (权重 1.0)
      - amazon
      - asin
      - ppc
      - acos
      - roas
      - listing

    alias_keywords: []              # 别名关键词 (权重 0.6)

    negative_keywords:              # 负向关键词 (命中则排除)
      - geo-seo
      - local pack

    glossary: knowledge/glossary/amazon-advertising.yaml
    adrs_glob: docs/adr/amazon-advertising/**/*.md
    playbooks_glob: playbooks/amazon-advertising/**/*.md
```

### 6.2 评分算法

```javascript
// 评分公式
function scoreDomain(task, cwd, domain) {
  const text = `${task}\n${cwd}`.toLowerCase();

  // 计算命中
  let coreHits = 0;    // 核心关键词命中
  let aliasHits = 0;   // 别名关键词命中
  let negHits = 0;     // 负向关键词命中

  // 加权计算
  const aliasWeight = domain.alias_weight ?? 0.6;
  const weightedHits = coreHits + aliasHits * aliasWeight;

  // 负向关键词排除
  const effectiveWeighted = negHits > 0 ? 0 : weightedHits;

  // 最终得分 = 加权命中 × 100 + priority (tiebreaker)
  return effectiveWeighted * 100 + domain.priority;
}
```

### 6.3 Confidence 计算

| 命中数 | Confidence |
|--------|------------|
| 1-2 hits | 0.70 |
| 3 hits | 0.75 |
| 4-5 hits | 0.85 |
| ≥6 hits | 0.95 |

### 6.4 Track 绑定覆盖

当存在 active track 时，domain 从 track 强制加载：

```javascript
if (activeTrack) {
  domain = activeTrack.domain;
  confidence = 1.0;  // Track 绑定是权威的
  reason = `track_bound(${activeTrack.track_id})`;
}
```

---

## 7. Drift 漂移检测

### 7.1 什么是 Drift？

**Glossary Drift** = 输出中使用了未注册的术语，或引用了错误版本的术语

### 7.2 检测规则

| 规则 | 检测内容 | 违规动作 |
|------|----------|----------|
| **UNREGISTERED_TERM** | 术语未在 glossary 中注册 | 阻断 + 建议添加 |
| **MISSING_CITATION** | 领域术语缺少引用 | 阻断 + 要求引用 |
| **VERSION_MISMATCH** | 引用版本 ≠ 当前版本 | 阻断 + 要求更新 |

### 7.3 检测模式

```yaml
# .claude/config/memory-governance.yaml
glossary_drift:
  enabled: true
  strictness: strict  # strict | warn | off

  # strict: 任何违规都阻断输出
  # warn: 记录警告但允许输出
  # off: 禁用检测
```

### 7.4 排除规则

Drift 检测跳过以下内容：
- 代码块 (` ``` `)
- 引用文本 (`>`)
- 标准编程术语 (API, URL, HTTP, JSON)
- 常见英语词汇

### 7.5 违规处理流程

```
┌─────────────────┐
│ Drift Detected  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Output Blocked  │
└────────┬────────┘
         │
    ┌────┴────────────┐
    │                 │
    ▼                 ▼
┌─────────┐    ┌──────────────┐
│ 选项 A:  │    │ 选项 B:       │
│ 添加到   │    │ 使用已注册    │
│ Glossary │    │ 同义词        │
└─────────┘    └──────────────┘
```

### 7.6 错误格式示例

```
=====================================
GLOSSARY DRIFT DETECTED - OUTPUT BLOCKED
=====================================

Term: ACoAS
Reason: UNREGISTERED_TERM
Location: Line 42, "The ACoAS metric shows..."

Action Required:
  Option A: Add term to glossary
    Path: knowledge/glossary/amazon-advertising.yaml
    Template:
      - concept_id: AMZ_ACOAS
        term: ACoAS
        definition: "..."
        formula: "..."
        version: "v1.0"

  Option B: Use registered synonym
    Similar terms in glossary:
      - AMZ_ACOS (knowledge/glossary/amazon-advertising.yaml#AMZ_ACOS@v1.0)

=====================================
```

---

## 8. Memory Diff 审计

### 8.1 目的

追踪会话间的认知变化，用于：
- **可审计性**: 谁在什么时候改了什么
- **回归检测**: 发现意外的变化
- **Domain confidence 监控**: 检测路由准确性下降

### 8.2 Diff 输出格式

**位置**: `memory/diff/MEMORY_DIFF_<timestamp>.md`

```markdown
# Memory Brief Diff Report

> Generated: 2026-02-02T12:00:00Z
> Previous: 2026-02-01T18:30:00Z
> Current: 2026-02-02T12:00:00Z

## Status: CHANGES DETECTED

### Domain Change

| From | To |
|------|-----|
| geo-seo | amazon-advertising |

### Confidence Change ⚠️ WARNING

| From | To | Delta |
|------|-----|-------|
| 0.85 | 0.55 | ↓ 0.30 |

> **WARNING**: Confidence changed by more than 0.2. Review domain detection logic.

### Terms Added (+3)

- `AMZ_ROAS`
- `AMZ_CTR`
- `AMZ_CPC`

### Terms Removed (-1)

- `GEO_LOCAL_PACK`

---

## Summary

| Metric | Value |
|--------|-------|
| Domain Changed | Yes |
| Confidence Warning | ⚠️ Yes |
| Terms Added | 3 |
| Terms Removed | 1 |
| Terms Modified | 0 |
```

### 8.3 警告阈值

| 指标 | 阈值 | 动作 |
|------|------|------|
| Domain confidence 变化 | > 0.2 | WARNING (非阻断) |
| 新增未注册术语 | > 5 | WARNING |
| 版本不匹配 | > 0 | ERROR (阻断) |

---

## 9. Output Contract

### 9.1 强制规则

所有输出必须遵循：

1. **定义/指标/决策** 输出必须引用：
   - Glossary: `path + concept_id + version`
   - ADR/Playbook: `file path + section`

2. **缺失 SSOT** 时：
   - 不猜测，提议补丁 (建议添加到 Glossary)

3. **Pre-Action Memory Check**：
   - 做决策前验证知识库

4. **不使用旧 concept_id**：
   - 如果存在 redirect，使用规范 ID (如 `AMZ_ACOS` 而不是 `acos`)

### 9.2 Contract 示例

```markdown
## Output Contract (MUST FOLLOW)

1. Any **definition/metric/decision** output MUST cite:
   - glossary: `path + concept_id + version`
   - ADR/playbook: `file path + section`

2. Do NOT use legacy concept_id if a redirect exists; use canonical id.

3. If **SSOT missing**, propose a patch (glossary/ADR) instead of guessing.

4. Use **Pre-Action Memory Check** before making decisions.
```

---

## 10. CI 门禁集成

### 10.1 触发条件

`.github/workflows/memory-governance-gate.yml` 在以下文件变更时触发：

```yaml
paths:
  - 'knowledge/glossary/**/*.yaml'
  - '.claude/scripts/memory_*.mjs'
  - '.claude/skills/memory/**'
  - 'src/memory/**'
  - 'docs/architecture/MEMORY_*.md'
```

### 10.2 门禁规则

| 规则 | 变更类型 | 强制执行 |
|------|----------|----------|
| **版本 bump 必须** | Glossary 文件变更 | FAIL if missing |
| **文档更新** | MaaP 脚本变更 | FAIL if missing |
| **Review 必须** | Output Contract 变更 | FAIL without approval |

### 10.3 版本 Bump 检查

```bash
# CI 自动检查
OLD_VERSION=$(git show base:$file | grep "version:")
NEW_VERSION=$(grep "version:" $file)

if [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
  echo "❌ FAIL: version not bumped"
  exit 1
fi
```

---

## 11. 实战示例

### 11.1 添加新术语

**场景**: 需要在 Amazon 领域添加 "ACoAS" 术语

**步骤**:

1. **编辑 Glossary 文件**:
```yaml
# knowledge/glossary/amazon-advertising.yaml

concepts:
  # ... 现有术语 ...

  - concept_id: AMZ_ACOAS
    version: v1.0
    domain: amazon-advertising
    name: ACoAS

    definition: "Advertising Cost of Acquisition Sales. Similar to ACoS but uses attributed conversions instead of revenue."
    formula: "Ad Spend ÷ Attributed Conversions"

    i18n:
      zh-CN:
        definition: "广告获客成本。与 ACoS 类似，但使用归因转化数而非收入。"

    aliases:
      en-US:
        - Advertising Cost of Acquisition Sales
      zh-CN:
        - 广告获客成本

    related:
      - AMZ_ACOS
      - AMZ_ROAS

    updated_at: "2026-02-02"
```

2. **更新文件版本** (changelog):
```yaml
changelog:
  - version: v1.1
    date: "2026-02-02"
    changes:
      - "Added AMZ_ACOAS concept"
    author: "Your Name"
```

3. **验证并提交**:
```bash
# 运行本地验证
node .claude/scripts/validate_glossary.mjs

# 提交 (CI 会自动检查版本 bump)
git add knowledge/glossary/amazon-advertising.yaml
git commit -m "feat(glossary): add AMZ_ACOAS concept"
```

### 11.2 使用术语 (带引用)

**输入**: "请解释 ACoS 是什么"

**正确输出**:

```markdown
**ACoS** (ref: knowledge/glossary/amazon-advertising.yaml#AMZ_ACOS@v1.0) 是
Advertising Cost of Sales 的缩写，表示广告支出占归因销售额的百分比。

**计算公式**: Ad Spend ÷ Attributed Sales × 100%

例如，如果广告花费 $100，带来 $500 的销售，则 ACoS = 100/500 × 100% = 20%。

---
Glossary ref: [[AMZ_ACOS@v1.0]]
```

### 11.3 跨域引用

**场景**: 在 Amazon 广告分析中引用金融术语 "CAC"

**正确引用**:

```markdown
当比较 Amazon 广告的 **ACoS** (ref: AMZ_ACOS@v1.0) 与传统营销的
**CAC** (ref: knowledge/glossary/fintech.yaml#FIN_CAC@v1.0 [cross-domain]) 时，
需要注意两者的计算口径不同。

- ACoS 基于广告销售归因
- CAC 基于所有营销渠道的获客成本

[cross-domain] 标记表明 CAC 来自非主域 (fintech) 的定义。
```

---

## 12. 故障排除

### 12.1 常见问题

#### Q1: Drift Detected - UNREGISTERED_TERM

**错误**:
```
GLOSSARY DRIFT DETECTED
Term: TACOS
Reason: UNREGISTERED_TERM
```

**解决方案**:
1. 检查是否拼写错误
2. 如果是新术语，添加到 Glossary
3. 如果是别名，检查 `aliases` 字段

#### Q2: Version Mismatch

**错误**:
```
VERSION_MISMATCH
Expected: v2.0
Found: v1.0
```

**解决方案**:
1. 更新引用版本: `(ref: ...#AMZ_ACOS@v2.0)`
2. 或者检查 Glossary 是否被意外回滚

#### Q3: CI Gate Failed - Version Not Bumped

**错误**:
```
❌ FAIL: knowledge/glossary/amazon-advertising.yaml - version not bumped
```

**解决方案**:
```yaml
# 更新 changelog 添加版本记录
changelog:
  - version: v1.2   # 新版本号
    date: "2026-02-02"
    changes:
      - "Your changes here"
```

#### Q4: Domain Detection 不准确

**症状**: 任务 "优化 Amazon 广告" 被检测为 "geo-seo"

**解决方案**:
1. 检查 `domain-mapping.yaml` 关键词配置
2. 添加更多核心关键词
3. 添加负向关键词排除干扰
4. 调整 priority 权重

### 12.2 调试命令

```bash
# 手动运行 Memory Bootstrap (查看检测结果)
node .claude/scripts/memory_bootstrap.mjs "你的任务描述"

# 查看生成的 Memory Brief
cat .claude/.compiled/memory_brief.md

# 运行 Memory Diff
node .claude/scripts/memory_diff.mjs

# 验证 Glossary 格式
node .claude/scripts/validate_glossary.mjs

# 检查 concept_id 前缀
node .claude/scripts/validate_concept_prefix.mjs
```

### 12.3 日志位置

| 日志 | 位置 |
|------|------|
| Memory Brief | `.claude/.compiled/memory_brief.md` |
| Memory History | `.claude/.compiled/memory_history/` |
| Diff Reports | `memory/diff/MEMORY_DIFF_*.md` |
| Drift Audit | `data/traces/glossary-drift/*.json` |

---

## 附录 A: 快速参考卡

### 文件位置

```
.claude/
├── config/domain-mapping.yaml     # Domain 配置
├── scripts/
│   ├── memory_bootstrap.mjs       # 启动脚本
│   └── memory_diff.mjs            # Diff 脚本
├── skills/memory/
│   ├── glossary-drift-detector.md # Drift 检测
│   ├── glossary-updater.md        # Glossary 更新
│   └── correction-detector.md     # 修正检测
└── .compiled/
    ├── memory_brief.md            # 当前 Brief
    └── memory_history/            # 历史 Brief

knowledge/
└── glossary/
    ├── _schema.yaml               # Schema 定义
    ├── general.yaml               # 通用术语
    ├── amazon-advertising.yaml    # Amazon 术语
    ├── geo-seo.yaml               # Geo-SEO 术语
    └── medical-research.yaml      # Medical 术语
```

### 引用格式速查

```
标准:    (ref: knowledge/glossary/amazon.yaml#AMZ_ACOS@v1.0)
简写:    [[AMZ_ACOS@v1.0]]
内联:    ACoS (ref: AMZ_ACOS@v1.0)
跨域:    (ref: path#term@ver [cross-domain])
```

### 版本 Bump 规则

```
Typo → Patch (x.x.1)
Clarify → Minor (x.1.0)
Formula → Major (1.0.0)
New Term → Minor (x.1.0)
Remove → Major (1.0.0)
```

---

## 附录 B: 相关文档

- [MEMORY_GOVERNANCE.md](./architecture/MEMORY_GOVERNANCE.md) - 完整治理文档
- [MULTI_DOMAIN_MEMORY.md](./architecture/MULTI_DOMAIN_MEMORY.md) - 多域架构
- [ARCHITECTURE_CONSTITUTION.md](../_meta/docs/ARCHITECTURE_CONSTITUTION.md) - 架构宪法
- [Glossary Schema](../knowledge/glossary/_schema.yaml) - Glossary YAML Schema

---

**文档版本**: 1.0
**最后更新**: 2026-02-02
**字数**: ~4,500 中文字符
