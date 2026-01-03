# LiYe OS 记忆防遗忘系统设计 v1.0

**问题陈述**：Claude 在新会话中会"遗忘"之前讨论过的概念和决策，导致用户需要反复教授同样的内容。

**设计目标**：建立一套机制，确保关键知识在会话间持久化并自动加载。

---

## 一、问题根源分析

### 1.1 现状诊断

| 组件 | 现状 | 问题 |
|------|------|------|
| **claude-mem** | ✅ 正在工作，记录 observations | 被动存储，不主动检索 |
| **session-start hook** | ✅ 提供 recent context 索引 | 只有索引，不含知识内容 |
| **CLAUDE.md** | ✅ 作为系统提示词 | 不含领域知识和术语定义 |
| **Packs** | ✅ 按领域加载详细规则 | 只有方法论，缺少术语表 |

### 1.2 遗忘的具体表现

**案例：ACoAS/ASoAS 概念**
1. 2025-12-31 用户纠正：ROI/ROAS 概念错误
2. 2025-12-31 用户补充：应使用 ACoAS/ASoAS（来自卖家精灵）
3. 2026-01-01 新会话：我完全不记得这些概念

**根因链**：
```
新会话启动
  ↓
CLAUDE.md 加载（无领域知识）
  ↓
recent context 只有索引（~35k tokens 用于 50 条记录）
  ↓
索引中未主动提取概念定义
  ↓
需要用户重新教授
```

### 1.3 现有记忆证据

claude-mem 确实记录了关键信息：

```yaml
# Observation #5232 (2026-01-01)
title: "Enhanced Advertising Metrics Framework with Four Core KPIs"
facts:
  - "ACoS (Advertising Cost of Sales) measures ad efficiency"
  - "ROAS (Return on Ad Spend) represents advertising return multiplier"
  - "ACoAS measures total advertising cost as percentage of total sales"
  - "ASoAS measures advertising dependency as percentage of ad sales to total"
```

**问题**：这些知识被记录了，但下一个会话不会自动检索它。

---

## 二、解决方案架构

### 2.1 三层记忆防护机制

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 1: 规范术语表                        │
│         持久化的、结构化的概念定义（人工审核）                   │
│         路径: knowledge/glossary/*.yaml                      │
├─────────────────────────────────────────────────────────────┤
│                    Layer 2: 智能会话启动                      │
│         根据工作上下文自动加载相关知识                          │
│         增强 session-start hook                              │
├─────────────────────────────────────────────────────────────┤
│                    Layer 3: 执行前记忆检查                     │
│         在做决策前主动搜索历史记录                              │
│         claude-mem 主动检索                                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 各层详细设计

#### Layer 1: 规范术语表（Canonical Glossary）

**目的**：将讨论中纠正的概念固化为持久化的规范定义。

**结构**：
```
knowledge/
└── glossary/
    ├── amazon-advertising.yaml    # ACoS, ROAS, ACoAS, ASoAS
    ├── ppc-concepts.yaml          # CPC, CVR, CTR, Bid
    ├── keyword-management.yaml    # TES, 5级分层
    └── _meta.yaml                 # 术语表元数据
```

**单个术语定义示例**：
```yaml
# knowledge/glossary/amazon-advertising.yaml
glossary:
  - term: "ACoS"
    full_name: "Advertising Cost of Sales"
    definition: "广告花费占广告销售额的百分比"
    formula: "广告花费 ÷ 广告销售额 × 100%"
    example: "$10 广告花费 / $100 广告销售 = 10% ACoS"
    category: "广告内部效率"
    source: "Amazon Advertising"
    verified_at: "2026-01-01"

  - term: "ACoAS"
    full_name: "Advertising Cost of All Sales"
    definition: "广告花费占总销售额（含自然+广告）的百分比"
    formula: "广告花费 ÷ 总销售额 × 100%"
    example: "$10 广告花费 / $200 总销售 = 5% ACoAS"
    category: "整体运营指标"
    source: "卖家精灵/赛狐工具"
    verified_at: "2026-01-01"
    notes: "等同于 TACoS (Total Advertising Cost of Sales)"
```

**触发更新流程**：
```
用户纠正概念
  ↓
Claude 承认错误
  ↓
Claude 提议更新术语表
  ↓
用户确认
  ↓
写入 knowledge/glossary/*.yaml
  ↓
下次会话自动加载
```

#### Layer 2: 智能会话启动（Context-Aware Session Start）

**目的**：根据工作目录/项目类型自动加载相关知识。

**增强 session-start.ts**：
```typescript
// 新增：根据工作目录判断领域
function detectDomain(cwd: string): string {
  if (cwd.includes('amazon-runtime') || cwd.includes('amazon-growth')) {
    return 'amazon-advertising';
  }
  if (cwd.includes('Medical') || cwd.includes('medical')) {
    return 'medical-research';
  }
  return 'general';
}

// 新增：加载领域相关术语表
async function loadDomainGlossary(domain: string): Promise<string> {
  const glossaryPath = `knowledge/glossary/${domain}.yaml`;
  if (await exists(glossaryPath)) {
    return await readFile(glossaryPath, 'utf-8');
  }
  return '';
}

// 新增：从 claude-mem 检索相关决策
async function fetchRecentDecisions(domain: string, limit: number = 5) {
  // 调用 mem-search 获取该领域的最近决策
  return await memSearch({
    query: domain,
    obs_type: 'decision',
    limit: limit,
    project: 'liye_os'
  });
}
```

**session-start 输出增强**：
```
[SessionStart] Session session-xxx initialized
[SessionStart] Domain detected: amazon-advertising
[SessionStart] Loaded glossary: 12 terms (ACoS, ROAS, ACoAS, ASoAS, ...)
[SessionStart] Recent decisions:
  - #5232: Enhanced Advertising Metrics Framework
  - #5218: ROI/ROAS Concept Correction
```

#### Layer 3: 执行前记忆检查（Pre-Action Memory Check）

**目的**：在做重要决策前，主动搜索是否有相关历史。

**行为规则**（添加到 CLAUDE.md 或 Packs）：
```markdown
## 记忆检查规则

在以下情况下，必须先搜索 claude-mem：

1. **概念定义**：当涉及专业术语定义时
   - 搜索: `mem-search query="[术语] 定义 公式"`
   - 目的: 确保使用已验证的定义

2. **决策制定**：当做类似决策时
   - 搜索: `mem-search obs_type="decision" query="[相关话题]"`
   - 目的: 复用历史决策逻辑

3. **用户纠正后**：当用户纠正概念时
   - 搜索: 确认这是否是之前讨论过的
   - 动作: 更新术语表，避免再次犯错

4. **知识输出前**：当输出知识性内容时
   - 搜索: 确认是否有已验证的信息
   - 目的: 避免输出过时或错误信息
```

---

## 三、实施计划

### Phase 1: 基础设施（立即执行）

**任务 1.1: 创建术语表结构**
```bash
mkdir -p ~/github/liye_os/knowledge/glossary
```

**任务 1.2: 创建首个术语表（亚马逊广告）**
```yaml
# ~/github/liye_os/knowledge/glossary/amazon-advertising.yaml
# 包含: ACoS, ROAS, ACoAS, ASoAS, CPC, CVR, CTR
```

**任务 1.3: 更新 operations.md**
- 添加术语表引用
- 添加记忆检查规则

### Phase 2: 会话启动增强

**任务 2.1: 增强 session-start.ts**
- 添加领域检测逻辑
- 添加术语表加载
- 添加 recent decisions 检索

**任务 2.2: 更新 session-start hook 输出**
- 在会话开始时显示加载的术语
- 显示相关的历史决策摘要

### Phase 3: 行为规则固化

**任务 3.1: 更新 CLAUDE.md**
- 添加"记忆检查规则"段落
- 明确何时必须搜索 claude-mem

**任务 3.2: 创建知识更新 SOP**
- 当用户纠正概念时的标准流程
- 术语表更新的审批流程

---

## 四、验收标准

### 4.1 功能验收

| 场景 | 预期行为 | 验证方法 |
|------|----------|----------|
| 新会话启动 | 自动加载领域术语表 | 检查 session-start 输出 |
| 提到 ACoAS | 正确定义，引用术语表 | 人工验证定义正确性 |
| 用户纠正概念 | 触发术语表更新流程 | 检查 glossary 文件变化 |
| 做广告决策前 | 主动搜索相关历史 | 检查 mem-search 调用 |

### 4.2 质量指标

- **遗忘率**：同一概念需要重复教授的次数 → 目标: 0
- **术语准确率**：术语定义的正确率 → 目标: 100%
- **检索覆盖率**：决策前搜索历史的比例 → 目标: >80%

---

## 五、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 术语表过大 | 启动变慢 | 按领域拆分，只加载相关的 |
| 搜索结果不相关 | 浪费 token | 优化搜索策略，使用 obs_type 过滤 |
| 术语定义冲突 | 概念混乱 | 人工审核，版本控制 |
| Hook 执行失败 | 回退到无记忆 | 错误处理，降级策略 |

---

## 六、长期演进

### 6.1 自动知识提取

未来可以：
- 使用 LLM 自动从对话中提取新术语
- 自动识别"用户纠正"事件
- 自动生成术语表更新建议

### 6.2 语义记忆索引

未来可以：
- 使用向量嵌入提升搜索相关性
- 构建概念之间的关联图谱
- 支持"类似概念"推荐

### 6.3 跨项目知识迁移

未来可以：
- 将术语表作为 skill 发布
- 支持团队共享知识库
- 支持版本化和回滚

---

**Version**: 1.0
**Created**: 2026-01-01
**Author**: Claude + LiYe 专家组
**Status**: 待实施
