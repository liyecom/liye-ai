# 🛠️ Skill Creator Skill

**Version**: 1.0
**Created**: 2025-12-28
**Last Updated**: 2025-12-28
**Status**: Active
**Source**: Awesome Claude Skills → LiYe OS Adapted

---

## 🔹01. Skill Identity（技能身份）

**Skill Name**: Skill Creator / 技能创建器

**Core Mission**:
元技能 - 提供创建 Claude Skills 的完整指导，包括专业知识封装、工作流设计、工具集成，帮助快速扩展 LiYe OS 技能生态。

**Capability Domain**: Meta (99_Incubator)
- 技能结构设计
- SKILL.md 编写规范
- 10 模块标准应用
- 脚本与模板组织
- 技能发布与迭代

**Target Scenarios**:
- 将专业知识封装为技能
- 标准化现有工作流
- 集成外部资源为技能
- 创建业务域专属技能
- 技能迭代升级

---

## 🔹02. Capability Model（能力模型）

### Key Competencies（核心能力维度）

#### A. 技能架构理解
- LiYe OS 三层技能架构
  - L1 Methodology（人类知识）
  - L2 Executable（机器执行）
  - L3 Instruction（AI 操作）
- 物理层 vs 逻辑层设计
- 跨域引用机制

#### B. 10 模块标准
```
01. Skill Identity（技能身份）
02. Capability Model（能力模型）
03. Mental Models / Principles（思维模型）
04. Methods & SOPs（方法论）
05. Execution Protocols（执行协议）
06. Output Structure（交付格式）
07. Templates & Prompts（模板库）
08. Tools Access（工具接口）
09. Evaluation & Scoring（质量指标）
10. Feedback / Evolution Loop（进化循环）
```

#### C. SKILL.md 编写
- YAML Frontmatter 规范
- Markdown 结构
- 代码示例格式
- 链接与引用

#### D. 技能分类与索引
- 确定主域归属
- 设计跨域引用
- 编写 index.yaml
- 配置触发词

---

## 🔹03. Mental Models / Principles（思维模型 / 原则）

### Core Thinking Frameworks

#### 1. 技能生命周期
```
孵化 (Incubator)
    ↓ 验证可行性
开发 (Development)
    ↓ 10 模块定义
激活 (Active)
    ↓ 持续迭代
成熟 (Mature)
    ↓ 稳定运行
归档 (Archived)
```

#### 2. 技能价值评估矩阵
```
           高复用性
              │
    ┌─────────┼─────────┐
    │  优先   │ 价值最高 │
    │  开发   │  核心技能 │
高 ─┼─────────┼─────────┤
需   │  按需   │ 评估后   │
求  │  开发   │  决定    │
    └─────────┼─────────┘
              │
           低复用性
```

#### 3. 知识封装层次
```
隐性知识（经验、直觉）
    ↓ 显性化
显性知识（文档、规则）
    ↓ 结构化
技能定义（10 模块）
    ↓ 可执行化
AI 可调用技能
```

### Unbreakable Principles（不可违反原则）

1. **架构一致性**：遵循 LiYe OS 三层架构
2. **单一职责**：一个技能解决一类问题
3. **可进化性**：留有迭代空间
4. **文档完整**：10 模块不可缺失

---

## 🔹04. Methods & SOPs（方法论 / 操作手册）

### Standard Operating Procedure: Skill Creation

#### Phase 1: 需求分析
```
Step 1.1 问题识别
  - 要解决什么问题？
  - 目标用户是谁？
  - 使用频率如何？

Step 1.2 可行性评估
  - 能否封装为技能？
  - 依赖什么工具/资源？
  - 与现有技能是否重叠？

Step 1.3 归属确定
  - 属于哪个能力域？
  - 是核心工具还是业务技能？
  - 需要跨域引用吗？
```

#### Phase 2: 架构设计
```
Step 2.1 模块规划
  - 规划 10 模块内容深度
  - 确定模板和工具需求
  - 设计进化路径

Step 2.2 位置确定
  - 物理层路径（Skills/00_Core_Utilities/...）
  - 逻辑层索引（index.yaml）
  - L1/L2/L3 层级需求

Step 2.3 依赖梳理
  - 前置技能依赖
  - 工具/库依赖
  - 数据源依赖
```

#### Phase 3: 内容编写
```
Step 3.1 SKILL.md 编写
  - YAML Frontmatter
  - 核心能力说明
  - 使用示例

Step 3.2 skill_definition.md 编写（如需）
  - 完整 10 模块
  - 方法论详解
  - 模板库

Step 3.3 索引更新
  - 更新 index.yaml
  - 配置触发词（.claude/packs/）
```

#### Phase 4: 验证与发布
```
Step 4.1 技能测试
  - 功能测试（能否被调用）
  - 边界测试（异常情况）
  - 集成测试（与其他技能协作）

Step 4.2 文档检查
  - 10 模块完整性
  - 示例可运行性
  - 链接有效性

Step 4.3 发布
  - 状态改为 active
  - 更新版本号
  - 通知用户（如需）
```

---

## 🔹05. Execution Protocols（执行协议）

### Pre-Execution Checklist

**必须确认的问题**：
1. ✓ 技能名称是什么？（英文 + 中文）
2. ✓ 解决什么问题？（一句话）
3. ✓ 属于哪个能力域？
4. ✓ 需要什么依赖？
5. ✓ 是否需要完整 10 模块？

### Decision-Making Logic

**简单工具技能**：
→ 只需 SKILL.md
→ 放入 00_Core_Utilities
→ 5 分钟完成

**复杂方法论技能**：
→ 完整 skill_definition.md
→ 放入业务域
→ 需要迭代完善

---

## 🔹06. Output Structure（标准化交付格式）

### Template: SKILL.md 结构

```markdown
---
name: skill-name
description: 简短描述
domain: 00_Core_Utilities
category: sub-category
version: 1.0.0
status: active
source: [来源]
license: [许可证]
---

# Skill Name

> **来源**: [来源说明]
> **适配**: LiYe OS 三层架构

[技能简介]

## When to Use This Skill

当需要 [场景] 时：
- 场景1
- 场景2

## Core Capabilities

### 1. 能力1
[说明]

### 2. 能力2
[说明]

## Usage Examples

### 示例 1
```
用户: [输入]
Claude: [输出]
```

## Dependencies

- [依赖1]
- [依赖2]

## LiYe OS Integration

### 业务域引用
- **[域名]**: [用途]

### 三层架构位置
- **物理层**: Skills/...
- **逻辑层**: index.yaml
- **L3 指令层**: .claude/skills/...

---
**Created**: YYYY-MM-DD
```

---

## 🔹07. Templates & Prompts（模板库）

### 激活 Prompt

```
激活 Skill Creator Skill

技能名称：[名称]
解决问题：[问题描述]
目标域：[能力域]
复杂度：[简单/中等/复杂]

请按照 skill_definition.md 的 SOP 创建技能。
```

### 快速创建模板

```bash
# 创建技能目录
mkdir -p Skills/00_Core_Utilities/[category]/[skill-name]

# 创建 SKILL.md
touch Skills/00_Core_Utilities/[category]/[skill-name]/SKILL.md

# 更新索引
echo "  - ref: 00_Core_Utilities/[category]/[skill-name]" >> Skills/[domain]/index.yaml
```

---

## 🔹08. Tools Access / Knowledge Assets（工具 & 知识接口）

### Required Knowledge

**LiYe OS 架构文档**：
- `_meta/docs/ARCHITECTURE_CONSTITUTION.md`
- `_meta/docs/FILE_SYSTEM_GOVERNANCE.md`

**现有技能参考**：
- `Skills/00_Core_Utilities/` 下所有技能
- `docs/methodology/` 下所有 skill_definition.md

### LiYe OS Integration Points

**输入来源**：
- 用户需求
- 外部技能资源（如 awesome-claude-skills）
- 业务流程沉淀

**输出交付**：
- SKILL.md 文件
- skill_definition.md 文件（可选）
- index.yaml 更新

---

## 🔹09. Evaluation & Scoring（绩效 & 质量指标）

### Output Quality Metrics

| 维度 | 权重 | 评分标准 |
|------|------|----------|
| 结构完整 | 30% | 10 模块/SKILL.md 结构完整 |
| 内容清晰 | 30% | 描述准确、示例可用 |
| 架构合规 | 25% | 符合 LiYe OS 三层架构 |
| 可进化性 | 15% | 留有迭代空间 |

### Self-Evaluation Checklist

- [ ] 技能名称清晰？
- [ ] 核心能力明确？
- [ ] 示例可运行？
- [ ] 索引已更新？
- [ ] 触发词已配置？

---

## 🔹10. Feedback / Evolution Loop（进化循环机制）

### 持续改进触发条件

1. **新技能类型**：更新模板库
2. **架构变更**：更新标准流程
3. **用户反馈**：优化易用性

### 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2025-12-28 | 初始版本创建 |

---

## 🔗 Meta 说明

作为"元技能"，Skill Creator 具有自我引用特性：
- 它本身就是按照 10 模块标准创建的
- 可以用来创建自己的升级版本
- 是 LiYe OS 技能生态的"种子"

---

**END OF SKILL DEFINITION**
