---
# SFC v0.1 Required Frontmatter (see: _meta/skill-factory/SKILL_FACTORY_CONTRACT_v0.1.md)
name: "[skill-name]"
description: "[只写什么时候用，不写流程摘要]"
status: "active"                    # active | frozen | deprecated | archived
skeleton: "workflow"                # workflow | task | reference | capabilities
version: "1.0.0"
owner: "human"                      # cc | skill-forge | marketplace | human
scope:
  includes: ["..."]
  excludes: ["..."]
triggers:
  commands: ["/..."]
  patterns: ["..."]
inputs:
  required: ["..."]
  optional: ["..."]
outputs:
  artifacts: ["..."]
failure_modes:
  - symptom: "..."
    recovery: "..."
verification:
  evidence_required: true
  how_to_verify: ["..."]
governance:
  constitution: "_meta/governance/SKILL_CONSTITUTION_v0.1.md"
  policy: "_meta/policies/DEFAULT_SKILL_POLICY.md"
---

# 🎯 [Skill Name] Skill

**Version**: v1.0
**Created**: YYYY-MM-DD
**Domain**: [Domain Number]_[Domain Name]
**Status**: ✅ Active

---

## 🔹01. Skill Identity

**Skill Name**: [English Name] / [中文名称]

**Core Mission**:
[1-2句话描述这个Skill的核心使命]

**Key Value Proposition**:
- [价值点1]
- [价值点2]
- [价值点3]

**Applicable Scenarios**:
1. [具体场景1]
2. [具体场景2]
3. [具体场景3]
4. [具体场景4]
5. [具体场景5]

**NOT Applicable**:
- [不适用场景1 - 说明边界]
- [不适用场景2]

---

## 🔹02. Capability Model

### Key Competencies

#### A. [能力维度A]（[English Name]）
- [子技能A1]
- [子技能A2]
- [子技能A3]

#### B. [能力维度B]
- [子技能B1]
- [子技能B2]
- [子技能B3]

#### C. [能力维度C]
- [子技能C1]
- [子技能C2]
- [子技能C3]

#### D. [能力维度D]
- [子技能D1]
- [子技能D2]
- [子技能D3]

### Capability Matrix

| Level | Capability A | Capability B | Capability C | Capability D |
|-------|-------------|-------------|-------------|-------------|
| **Beginner** | [描述] | [描述] | [描述] | [描述] |
| **Intermediate** | [描述] | [描述] | [描述] | [描述] |
| **Advanced** | [描述] | [描述] | [描述] | [描述] |
| **Expert** | [描述] | [描述] | [描述] | [描述] |

---

## 🔹03. Mental Models / Principles

### Core Thinking Frameworks

#### 1. [Framework Name 1]（[框架名称1]）

**Concept**:
[框架的核心概念]

**Visual**:
```
[用ASCII art或文字描述框架结构]
```

**Application**:
[如何应用这个框架]

**Example**:
[具体示例]

#### 2. [Framework Name 2]

**Concept**:
...

#### 3. [Framework Name 3]

**Concept**:
...

### Core Principles

1. **[Principle 1]**: [描述]
2. **[Principle 2]**: [描述]
3. **[Principle 3]**: [描述]

---

## 🔹04. Methods & SOPs

### Standard Operating Procedure: [Skill核心流程名称]

#### Phase 1: [阶段1名称]
**Duration**: [预计时间]

**Step 1.1**: [步骤名称]
- [具体操作1]
- [具体操作2]
- [具体操作3]

**Step 1.2**: [步骤名称]
- [具体操作]

**Step 1.3**: [步骤名称]
- [具体操作]

**Output**: [这个阶段的产出]

#### Phase 2: [阶段2名称]
**Duration**: [预计时间]

**Step 2.1**: [步骤名称]
...

#### Phase 3: [阶段3名称]
...

#### Phase 4: [阶段4名称]
...

#### Phase 5: [阶段5名称]
...

### Alternative Methods

**Method 2: [备选方法名称]**
- When to use: [适用场景]
- Steps: [简要步骤]

**Method 3: [备选方法名称]**
- When to use: [适用场景]
- Steps: [简要步骤]

---

## 🔹05. Execution Protocols

### Pre-Execution Checklist

**环境准备**:
- [ ] [检查项1]
- [ ] [检查项2]
- [ ] [检查项3]

**必需信息**:
- [ ] [必需信息1]
- [ ] [必需信息2]
- [ ] [必需信息3]

**工具就绪**:
- [ ] [工具1]可用
- [ ] [工具2]可用
- [ ] [工具3]可用

### Decision Logic

**Decision Point 1: [决策点名称]**
```
IF [条件A]:
    → [执行路径A]
ELSE IF [条件B]:
    → [执行路径B]
ELSE:
    → [默认路径]
```

**Decision Point 2: [决策点名称]**
```
...
```

### Quality Standards

**输出必须满足**:
- [ ] [质量标准1]
- [ ] [质量标准2]
- [ ] [质量标准3]

**验收标准**:
- [标准1]: [具体指标]
- [标准2]: [具体指标]
- [标准3]: [具体指标]

---

## 🔹06. Output Structure

### Template 1: [模板1名称]

**Purpose**: [用途]

**Applicable Scenarios**: [适用场景]

**Structure**:
```markdown
# [Title]

## Section 1
...

## Section 2
...

## Section 3
...
```

**Example**: 见 `templates/template_1.md`

### Template 2: [模板2名称]

**Purpose**: [用途]
...

### Template 3: [模板3名称]

**Purpose**: [用途]
...

---

## 🔹07. Templates & Prompts

### Default Activation Prompt

```markdown
**Role**: You are a [Skill Name]

**Task**: [具体任务描述]

**Context**: [背景信息]

**Requirements**:
1. [要求1]
2. [要求2]
3. [要求3]
4. [要求4]
5. [要求5]

**Output Format**: [使用Template X]

**Quality Standards**: [质量要求]
```

### Quick Start Template

**For [常见场景]**:
```
[提示词模板]
```

### Advanced Prompt

**For [复杂场景]**:
```
[提示词模板]
```

---

## 🔹08. Tools Access / Knowledge Assets

### Required Tools

| Tool | Purpose | Source | Alternative |
|------|---------|--------|-------------|
| [Tool 1] | [用途] | [链接/来源] | [备选] |
| [Tool 2] | [用途] | [链接/来源] | [备选] |
| [Tool 3] | [用途] | [链接/来源] | [备选] |

### Knowledge Assets

**From PARA System**:
- [资源1路径]: `../../20 Areas/[file].md`
- [资源2路径]: `../../30 Resources/[file].md`

**External Resources**:
- [资源1名称]: [链接]
- [资源2名称]: [链接]
- [资源3名称]: [链接]

### LiYe OS Integration Points

**Input from**:
- [其他Skill或PARA资源]

**Output to**:
- `artifacts/[skill_name]/` - 所有产出
- [其他集成点]

---

## 🔹09. Evaluation & Scoring

### Output Quality Metrics

#### Dimension 1: [维度1名称] - Weight [权重]%

**Scoring Criteria**:
- **90-100分**: [描述]
- **75-89分**: [描述]
- **60-74分**: [描述]
- **<60分**: [描述]

#### Dimension 2: [维度2名称] - Weight [权重]%

**Scoring Criteria**:
...

#### Dimension 3: [维度3名称] - Weight [权重]%

**Scoring Criteria**:
...

#### Dimension 4: [维度4名称] - Weight [权重]%

**Scoring Criteria**:
...

#### Dimension 5: [维度5名称] - Weight [权重]%

**Scoring Criteria**:
...

### Passing Standards

**Minimum Total Score**: ≥ [分数]/100

**Critical Dimensions** (必须达标):
- [维度X]: ≥ [分数]
- [维度Y]: ≥ [分数]

### Self-Assessment Checklist

- [ ] [检查项1]
- [ ] [检查项2]
- [ ] [检查项3]
- [ ] [检查项4]
- [ ] [检查项5]

---

## 🔹10. Feedback / Evolution Loop

### Artifacts Feedback Mechanism

#### Step 1: Artifacts Categorization
- 归档到 `Artifacts_Vault/by_skill/[Skill_Name]/`
- 标记tags: `[tag1, tag2, tag3]`
- 记录元数据（quality score, 使用的templates等）

#### Step 2: Insight Extraction

**分析维度**:
- [ ] 执行过程中的痛点
- [ ] 方法论的有效性
- [ ] 模板的适用性
- [ ] 新的模式识别

**输出**: Insights List

#### Step 3: Methods Update

**更新 methods.md**:
- 优化SOP步骤
- 增加故障排除
- 更新时间估算
- 添加新示例

#### Step 4: Template Enrichment

**优化现有Templates**:
- 增加字段
- 调整结构
- 增加示例

**创建新Templates** (触发条件):
- 同类场景出现≥3次

#### Step 5: Knowledge Graph Building

**构建实体关系**:
- 实体: [类型1], [类型2], [类型3]
- 关系: [关系1], [关系2], [关系3]

**应用**:
- 快速查找相关Artifacts
- 发现知识空白
- 推荐相关Skills

### Evolution Triggers

| Trigger | Priority | Action |
|---------|----------|--------|
| 新增10个Artifacts | P0 | [自动化行动] |
| Template使用>20次 | P0 | [优化行动] |
| 质量分<75分(5次) | P1 | [审查行动] |
| 用户反馈(≥3次) | P0 | [修复行动] |

### Version History

**Current Version**: v1.0

**Changelog**:
- v1.0 (YYYY-MM-DD): 初始版本

**Next Version Plans**:
- [ ] [计划改进1]
- [ ] [计划改进2]
- [ ] [计划改进3]

---

## 📚 References & Further Reading

1. [Reference 1]
2. [Reference 2]
3. [Reference 3]

---

**Document Information**:
- **Version**: 1.0
- **Created**: YYYY-MM-DD
- **Last Updated**: YYYY-MM-DD
- **Maintained by**: [维护者]
- **Review Cycle**: [审查周期]

---

*This Skill is part of LiYe OS - A self-evolving personal AI capability system.*
