# 🎯 Projects Engine - 项目执行引擎

**作用**: 编排多个Skills协同完成复杂项目

**当前活跃项目**: 0
**已完成项目**: 0
**最后更新**: 2025-12-07

---

## 📁 目录结构

```
Projects_Engine/
├── active/                # 进行中项目
│   ├── project_001/
│   │   ├── README.md      # 项目简介
│   │   ├── brief.md       # 项目简报（核心文档）
│   │   ├── execution/     # 执行记录
│   │   │   ├── week1.md
│   │   │   ├── week2.md
│   │   │   └── ...
│   │   └── deliverables/  # 交付物
│   │       ├── report.md
│   │       ├── analysis.md
│   │       └── ...
│   └── ...
│
├── completed/             # 已完成项目
│   └── ...
│
└── templates/             # 项目模板
    ├── research_project/
    ├── development_project/
    ├── content_project/
    └── analysis_project/
```

---

## 🚀 启动新项目

### Step 1: 创建项目目录

```bash
cd Projects_Engine/active/
mkdir [project_name]
cd [project_name]
```

### Step 2: 复制模板

```bash
# 选择合适的模板
cp -r ../../templates/[template_type]/* ./

# 或手工创建
touch README.md brief.md
mkdir execution deliverables
```

### Step 3: 填写Project Brief

使用下面的标准格式填写 `brief.md`

---

## 📋 Project Brief 标准格式

```markdown
# Project: [项目名称]

**Project ID**: P-YYYYMMDD-[序号]
**Status**: 🔄 Active / ✅ Completed / ⏸️ Paused / ❌ Cancelled
**Priority**: 🔴 High / 🟡 Medium / 🟢 Low
**Start Date**: YYYY-MM-DD
**Target Completion**: YYYY-MM-DD
**Actual Completion**: YYYY-MM-DD (if completed)
**Owner**: [负责人]

---

## 1. Objective

**Primary Goal**:
[1-2句话描述项目的核心目标]

**Success Criteria**:
- [ ] [可衡量的成功标准1]
- [ ] [可衡量的成功标准2]
- [ ] [可衡量的成功标准3]

**Expected Impact**:
[这个项目完成后的预期影响]

---

## 2. Background & Context

**Why this project?**
[为什么要做这个项目？问题背景是什么？]

**Related to** (PARA integration):
- Area: `../../20 Areas/[领域].md` (长期目标)
- Previous Projects: `../../10 Projects/[相关项目].md`

---

## 3. Skills Required

| Skill | Domain | Purpose | Status |
|-------|--------|---------|--------|
| [Skill 1] | [Domain] | [用途] | ✅ Ready / 🔄 Creating |
| [Skill 2] | [Domain] | [用途] | ✅ Ready |
| [Skill 3] | [Domain] | [用途] | ✅ Ready |

**Skills Pipeline**:
```
[Skill 1] → [Output 1]
    ↓
[Skill 2] (uses Output 1) → [Output 2]
    ↓
[Skill 3] (uses Output 2) → [Final Deliverable]
```

**Missing Skills** (需要创建):
- [ ] [Skill名称] - [简述功能]

---

## 4. Deliverables

### Primary Deliverables
- [ ] **[交付物1名称]**
  - Format: [格式，如PDF报告/代码/视频]
  - Spec: [规格说明]
  - Due: YYYY-MM-DD

- [ ] **[交付物2名称]**
  - Format: [格式]
  - Spec: [规格]
  - Due: YYYY-MM-DD

### Secondary Deliverables
- [ ] [可选交付物]

---

## 5. Timeline & Milestones

### Phase 1: [阶段1名称] (Week 1-2)
**Goal**: [阶段目标]

**Tasks**:
- [ ] Task 1.1: [任务描述]
- [ ] Task 1.2: [任务描述]
- [ ] Task 1.3: [任务描述]

**Milestone**: [里程碑]

### Phase 2: [阶段2名称] (Week 3-4)
**Goal**: [阶段目标]
...

### Phase 3: [阶段3名称] (Week 5-6)
**Goal**: [阶段目标]
...

---

## 6. Resources & Constraints

### Resources
**From PARA**:
- Knowledge: `../../30 Resources/[资源].md`
- Data: `../../20 Areas/[数据].md`

**External**:
- [外部资源1]
- [外部资源2]

### Constraints
- **Time**: [时间限制]
- **Budget**: [预算限制]
- **Quality**: [质量要求]
- **Scope**: [范围限制]

---

## 7. Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| [风险1] | High/Med/Low | High/Med/Low | [应对措施] |
| [风险2] | High/Med/Low | High/Med/Low | [应对措施] |

---

## 8. Artifacts Generated

**During Execution**:
- [Artifact 1链接] - Created YYYY-MM-DD
- [Artifact 2链接] - Created YYYY-MM-DD

**Archived at**:
- `../../Artifacts_Vault/by_project/[project_name]/`

---

## 9. Learnings & Evolution

**Key Learnings**:
- [学到的东西1]
- [学到的东西2]

**Skills Improved**:
- [Skill 1] → v1.x (improved [aspect])
- [Skill 2] → v1.x (improved [aspect])

**New Skills Created**:
- [新创建的Skill] - [原因]

---

## 10. Status Updates

### [Date] - [Status]
- **Progress**: [进度描述]
- **Completed**: [完成的事项]
- **Next Steps**: [下一步计划]
- **Blockers**: [遇到的阻碍]

### [Date] - [Status]
...
```

---

## 🔄 项目生命周期

```
[Idea / Need]
    ↓
[Project Initiation]
    - 创建Project目录
    - 填写brief.md
    - 识别所需Skills
    ↓
[Planning]
    - 分解Tasks
    - 安排Timeline
    - 准备Resources
    ↓
[Execution]
    - 调用Skills执行
    - 产生Artifacts
    - 记录进展（execution/*.md）
    ↓
[Review & Completion]
    - 交付Deliverables
    - 总结Learnings
    - 反馈到Skills（Evolution）
    ↓
[Archive]
    - 移动到completed/
    - Artifacts归档到Vault
    - 更新PARA (10 Projects/)
```

---

## 📊 项目类型与模板

### 1. Research Project（研究项目）

**特点**: 以知识发现为目标，产出研究报告

**典型Skills**:
- Literature Review Specialist
- Medical Research Analyst
- Data Analyst

**Deliverables**:
- Research Report
- Evidence Summary
- Recommendations

**模板**: `templates/research_project/`

---

### 2. Development Project（开发项目）

**特点**: 构建产品或系统，产出代码/软件

**典型Skills**:
- Full-Stack Developer
- System Architect
- DevOps Engineer

**Deliverables**:
- Working Code
- Documentation
- Deployment Guide

**模板**: `templates/development_project/`

---

### 3. Content Project（内容项目）

**特点**: 创作内容，产出文章/视频/课程

**典型Skills**:
- Content Creator
- Storyteller
- Design Thinker

**Deliverables**:
- Published Content
- Media Files
- Distribution Plan

**模板**: `templates/content_project/`

---

### 4. Analysis Project（分析项目）

**特点**: 分析数据或战略，产出洞察和建议

**典型Skills**:
- Strategic Analyst
- Data Analyst
- Decision Framework Designer

**Deliverables**:
- Analysis Report
- Recommendations
- Decision Framework

**模板**: `templates/analysis_project/`

---

## 🎯 与PARA的集成

### Projects Engine → PARA

**同步到10 Projects/**:
```markdown
# 10 Projects/AI操作系统.md

## 子项目（LiYe OS Projects_Engine）

### P-20251210-001: Medical Research System
- **状态**: 🔄 Active
- **进度**: 60%
- **详情**: [Project Brief](../LiYe_OS/Projects_Engine/active/medical_research_system/brief.md)
- **Artifacts**: [查看](../LiYe_OS/Artifacts_Vault/by_project/medical_research_system/)
```

### PARA → Projects Engine

**从PARA获取输入**:
- `20 Areas/` - 长期目标驱动项目
- `30 Resources/` - 知识资产支撑
- `00 Inbox/` - 临时想法转化为项目

---

## 📈 项目监控

### 活跃项目仪表盘

```bash
# 列出所有活跃项目
ls -d Projects_Engine/active/*/

# 检查项目状态（需要解析brief.md）
grep "Status:" Projects_Engine/active/*/brief.md

# 即将截止的项目
grep "Target Completion:" Projects_Engine/active/*/brief.md | \
  awk -F': ' '$2 < "'$(date -v+7d +%Y-%m-%d)'"'
```

### 项目进度追踪

**每周review**:
1. 更新execution/weekN.md
2. 更新brief.md的Status Updates
3. 检查是否on track
4. 调整Timeline（如需要）

**每月review**:
1. 评估整体进度
2. 识别blockers
3. 决定是否需要调整scope

---

## 💡 最佳实践

### 1. 明确目标

- ✅ Objective要SMART（Specific, Measurable, Achievable, Relevant, Time-bound）
- ✅ Success Criteria要可验证
- ❌ 避免模糊目标（"提升能力"）

### 2. 合理规划

- ✅ 分阶段执行（Phase 1, 2, 3...）
- ✅ 每个Phase有明确Milestone
- ✅ 预留buffer时间（20-30%）
- ❌ 避免过度乐观估算

### 3. 技能组合

- ✅ 识别所有必需Skills
- ✅ 缺失Skills要么创建，要么调整scope
- ✅ Skills之间的依赖关系要清晰
- ❌ 不要中途发现缺少关键Skill

### 4. 及时记录

- ✅ 每周更新execution log
- ✅ 重要决策记录在brief.md
- ✅ Artifacts及时归档
- ❌ 不要等到项目结束再整理

### 5. 进化反馈

- ✅ 项目完成后总结Learnings
- ✅ 将insights反馈到Skills
- ✅ 更新Skill的methods/templates
- ✅ 考虑创建新Skills

---

## 🎓 示例项目

### 示例1: Medical Research Project

**Project**: HER2+ Breast Cancer Treatment Decision Support

**Skills Used**:
- Medical Research Analyst
- Decision Framework Designer
- Content Creator (for visualization)

**Timeline**: 2 weeks

**Deliverables**:
- Treatment Comparison Report
- Decision Framework
- Patient Education Materials

**Outcome**:
- 3 Artifacts生成
- Medical Research Analyst v1.0 → v1.1 (improved brain mets analysis)
- 新Template: brain_mets_specific_template.md

---

### 示例2: Content Creation Project

**Project**: Personal Branding Content Series

**Skills Used**:
- Content Creator
- Storyteller
- Marketing Strategist

**Timeline**: 4 weeks

**Deliverables**:
- 10 blog posts
- 5 short videos
- Social media content calendar

**Outcome**:
- 15 Artifacts生成
- Content Creator v1.0 → v1.1 (added video script template)
- 新Skill创建: Social Media Manager

---

## 📞 维护与支持

- **维护者**: LiYe OS Projects Engine
- **更新周期**: 持续更新
- **模板贡献**: 欢迎提交新的项目模板

---

*"Projects are where Skills come alive and evolve."*

**— Projects Engine**
