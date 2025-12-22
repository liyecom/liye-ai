# 🧠 LiYe OS - Personal AI Operating System

**版本**: v1.0
**创建时间**: 2025-12-07
**系统状态**: ✅ Active

---

## 🌟 系统愿景

LiYe OS 是一个**自进化的个人 AI 能力操作系统**，将分散的知识、技能和项目整合为一个有机的智能体系。

**核心理念**：
- 🔄 **能力可复用** - Skills作为标准化能力单元，可跨项目调用
- 📈 **自我进化** - Artifacts（项目产出）自动反馈优化 Skills
- 🎯 **结果导向** - 每次执行都让下一次执行更强（复利效应）
- 🧩 **系统整合** - 与PARA知识库深度集成，形成完整生态

---

## 📊 系统架构

```
LiYe_OS/
├── 📚 Skills/                    # 能力库（12大领域）
│   ├── 01_Research_Intelligence/   # 研究能力
│   ├── 02_Analysis_Strategy/       # 分析能力
│   ├── 03_Creative_Production/     # 创作能力
│   ├── 04_Business_Operations/     # 商业运营
│   ├── 05_Medical_Intelligence/    # 医疗智能 ✅
│   ├── 06_Technical_Development/   # 技术开发
│   ├── 07_Data_Science/            # 数据科学
│   ├── 08_Communication/           # 沟通表达
│   ├── 09_Learning_Growth/         # 学习成长
│   ├── 10_Health_Wellness/         # 健康管理
│   ├── 11_Life_Design/             # 人生设计
│   └── 12_Meta_Cognition/          # 元认知
│
├── 🎯 Projects_Engine/          # 项目执行引擎
│   ├── active/                    # 进行中项目
│   ├── completed/                 # 已完成项目
│   └── templates/                 # 项目模板
│
├── 📦 Artifacts_Vault/          # 产出归档库
│   ├── by_skill/                  # 按Skill分类
│   ├── by_project/                # 按Project分类
│   └── knowledge_graph/           # 知识图谱
│
└── 🛠️ _meta/                     # 系统元数据
    ├── common_templates/          # 通用模板
    ├── skill_template/            # Skill创建模板
    └── system_docs/               # 系统文档
```

---

## 🎯 核心概念

### 1. Skills（能力单元）

**定义**: 标准化的能力系统，包含方法论、工具和自进化机制。

**10模块结构**:
1. **Skill Identity** - 能力定位
2. **Capability Model** - 能力模型
3. **Mental Models** - 思维框架
4. **Methods & SOPs** - 方法与流程
5. **Execution Protocols** - 执行协议
6. **Output Structure** - 输出结构
7. **Templates & Prompts** - 模板提示词
8. **Tools Access** - 工具知识资产
9. **Evaluation & Scoring** - 评估打分
10. **Feedback/Evolution Loop** - 反馈进化

**示例**: [Medical Research Analyst](Skills/05_Medical_Intelligence/Medical_Research_Analyst/)

### 2. Projects（项目）

**定义**: 有明确目标和交付物的工作，调用多个Skills协同完成。

**生命周期**:
```
[Project Init] → [Skills Selection] → [Execution] → [Artifacts] → [Feedback to Skills]
```

### 3. Artifacts（产出）

**定义**: 项目执行产生的具体成果（报告、代码、分析等）。

**作用**:
- 📊 记录执行过程和结果
- 🔄 反馈优化Skills（自进化核心）
- 📚 沉淀为知识资产

### 4. Evolution Loop（进化循环）

**机制**:
```
[Execute Skill]
    → [Generate Artifact]
    → [Extract Insights]
    → [Update Skill Methods/Templates]
    → [Next Execution Stronger]
```

**复利公式**: `能力(n+1) = 能力(n) × (1 + 学习率)`

---

## 🏆 12大能力领域

### 🔬 Research & Analysis（研究与分析）

| 领域 | 核心Skills | 状态 |
|------|-----------|------|
| **01 Research Intelligence** | Literature Review, Systematic Research, Knowledge Synthesis | 🔄 规划中 |
| **02 Analysis & Strategy** | Data Analysis, Strategic Thinking, Decision Framework | 🔄 规划中 |

### 🎨 Creative & Production（创作与生产）

| 领域 | 核心Skills | 状态 |
|------|-----------|------|
| **03 Creative Production** | Content Creation, Design Thinking, Storytelling | 🔄 规划中 |

### 💼 Business & Operations（商业与运营）

| 领域 | 核心Skills | 状态 |
|------|-----------|------|
| **04 Business Operations** | Product Management, Marketing, Growth Hacking | 🔄 规划中 |

### 🏥 Medical & Health（医疗与健康）

| 领域 | 核心Skills | 状态 |
|------|-----------|------|
| **05 Medical Intelligence** | Medical Research Analyst ✅, Treatment Planner, Health Data Analyst | ✅ 1个完成 |
| **10 Health & Wellness** | Nutrition Planning, Fitness Design, Sleep Optimization | 🔄 规划中 |

### 💻 Technical & Data（技术与数据）

| 领域 | 核心Skills | 状态 |
|------|-----------|------|
| **06 Technical Development** | Full-Stack Dev, System Architecture, DevOps | 🔄 规划中 |
| **07 Data Science** | Statistical Analysis, ML Engineering, Data Visualization | 🔄 规划中 |

### 🗣️ Communication & Growth（沟通与成长）

| 领域 | 核心Skills | 状态 |
|------|-----------|------|
| **08 Communication** | Writing, Presentation, Negotiation | 🔄 规划中 |
| **09 Learning & Growth** | Skill Acquisition, Knowledge Management, Habit Building | 🔄 规划中 |

### 🎯 Life & Meta（人生与元认知）

| 领域 | 核心Skills | 状态 |
|------|-----------|------|
| **11 Life Design** | Goal Setting, Time Management, Life Strategy | 🔄 规划中 |
| **12 Meta-Cognition** | Thinking About Thinking, Self-Reflection, System Optimization | 🔄 规划中 |

---

## 🚀 快速开始

### 场景1: 使用现有Skill

```markdown
**场景**: 需要评估HER2+乳腺癌的治疗方案

**步骤**:
1. 浏览 Skills/05_Medical_Intelligence/
2. 选择 Medical_Research_Analyst
3. 阅读 README.md 了解使用方法
4. 使用 Templates 中的决策框架
5. 产出存入 Artifacts_Vault/medical_research/
```

### 场景2: 创建新Skill

```markdown
**步骤**:
1. 复制 _meta/skill_template/ 到目标领域
2. 填写10模块定义
3. 创建至少3个templates
4. 设置evolution_log.md
5. 首次使用，记录Artifact
```

### 场景3: 启动新项目

```markdown
**步骤**:
1. 在 Projects_Engine/active/ 创建项目目录
2. 定义项目目标和所需Skills
3. 执行项目，调用相关Skills
4. 产出归档到 Artifacts_Vault/
5. 反馈更新Skills
```

---

## 📈 系统指标

### 当前状态（v1.0）

| 指标 | 数值 | 目标（v2.0） |
|------|------|-------------|
| **Skills总数** | 1 | 12+ |
| **完整Skill数** | 1 (Medical Research Analyst) | 6+ |
| **Projects执行** | 0 | 10+ |
| **Artifacts累积** | 0 | 50+ |
| **进化迭代次数** | 0 | 20+ |

### 质量指标

| 维度 | 标准 | 当前 |
|------|------|------|
| **Skill完整性** | 10/10模块齐全 | ✅ 100% (Medical Research Analyst) |
| **Template覆盖率** | ≥3个templates/skill | ✅ 4个 |
| **Evolution活跃度** | ≥1次更新/月 | 🔄 待启动 |
| **PARA集成度** | 双向引用 | 🔄 规划中 |

---

## 🔄 与PARA知识库的集成

### 集成架构

```
PARA Knowledge Base ←→ LiYe OS
       |                    |
       |                    |
   [Knowledge]        [Capabilities]
       |                    |
       ↓                    ↓
   20 Areas/         Skills/
   30 Resources/     Projects_Engine/
       ↓                    ↓
       └────→ [Synergy] ←───┘
              - Skills调用PARA知识
              - Projects产出存入PARA
              - Artifacts丰富Resources
```

### 集成接口

**LiYe OS → PARA**:
- Skills调用 `20 Areas/健康医疗.md` 获取患者背景
- Skills参考 `30 Resources/技术文档.md` 查找方法
- Projects输出同步到 `10 Projects/`

**PARA → LiYe OS**:
- `10 Projects/` 中的项目调用 Skills 执行
- `20 Areas/` 的长期目标映射到 Skill 能力建设
- `00 Inbox/` 的想法可触发 Skill 创建需求

---

## 🎯 使用原则

### 1. Skill优先原则
- ✅ **Do**: 遇到重复性任务，先创建/完善Skill
- ❌ **Don't**: 每次都临时处理，不沉淀方法论

### 2. 产出归档原则
- ✅ **Do**: 所有项目产出都存入Artifacts_Vault
- ❌ **Don't**: 产出散落各处，无法反馈优化

### 3. 进化优先原则
- ✅ **Do**: 每次执行后，更新Skill的methods/templates
- ❌ **Don't**: 发现问题不记录，下次重复犯错

### 4. 系统思维原则
- ✅ **Do**: 考虑Skill之间的协作和复用
- ❌ **Don't**: 孤立地创建Skill，造成重复建设

---

## 📚 核心文档

### 必读文档
1. [架构设计详解](架构设计.md) - 完整技术架构
2. [Skill创建指南](_meta/skill_template/README.md) - 如何创建新Skill
3. [Medical Research Analyst示例](Skills/05_Medical_Intelligence/Medical_Research_Analyst/) - 标杆Skill

### 参考资源
- [PARA使用指南](../PARA使用指南.md) - PARA方法论
- [整理完成报告](../整理完成报告.md) - PARA系统现状

---

## 🛣️ Roadmap

### v1.0 - 基础架构 ✅ (2025-12-07)
- [x] 创建系统架构
- [x] 完成首个示范Skill (Medical Research Analyst)
- [x] 定义10模块标准
- [x] 设计Evolution Loop机制

### v1.1 - 能力扩展 🔄 (2025-12-31)
- [ ] 创建6个核心Skills（每个领域至少1个）
- [ ] 执行3个示范Projects
- [ ] 积累20+ Artifacts
- [ ] 完成首次Skill进化迭代

### v1.2 - 系统整合 🔄 (2026-01-31)
- [ ] 完成与PARA的深度集成
- [ ] 建立Artifacts知识图谱
- [ ] 开发Skills协作模式
- [ ] 自动化Evolution Loop

### v2.0 - 智能进化 🎯 (2026-03-31)
- [ ] 12个领域全覆盖（每个≥2 Skills）
- [ ] 100+ Artifacts累积
- [ ] AI辅助Skill优化
- [ ] 可视化Dashboard

---

## 💡 设计哲学

### 1. 能力即系统

不是简单的技能清单，而是：
- **系统化方法论** - 每个Skill都有完整SOP
- **标准化接口** - 10模块统一结构，易复用
- **进化机制** - 从Artifacts中自动学习优化

### 2. 产出即资产

每次执行都积累：
- **显性知识** - 报告、分析、代码
- **隐性洞察** - 方法改进、模板优化
- **关系网络** - 知识图谱、引用链接

### 3. 复用即增值

避免重复劳动：
- **Skill复用** - 一次创建，多次调用
- **Template复用** - 标准化输出格式
- **Artifact复用** - 过往产出成为新的输入

### 4. 进化即生命

系统不是静态的：
- **持续改进** - 每次执行后都优化
- **适应性学习** - 从失败和成功中学习
- **涌现能力** - Skills协作产生新能力

---

## 🤝 贡献指南

### 创建新Skill
1. 选择合适的领域目录
2. 复制 `_meta/skill_template/`
3. 完成10模块定义
4. 创建至少3个实用templates
5. 通过首次实战验证

### 更新现有Skill
1. 记录在 `evolution_log.md`
2. 更新 `methods.md` 或 `templates/`
3. 增加版本号
4. 说明改进理由

### 提交Artifact
1. 归档到 `Artifacts_Vault/by_skill/[Skill名]/`
2. 填写Artifact元数据
3. 触发Evolution Loop
4. 更新Skill的evolution_log

---

## 📞 支持与反馈

- **系统维护者**: LiYe OS Evolution Engine
- **当前版本**: v1.0
- **最后更新**: 2025-12-07
- **下次审查**: 2025-12-31

---

## 🎉 开始使用

**推荐首个任务**:
1. ✅ 浏览 [Medical Research Analyst](Skills/05_Medical_Intelligence/Medical_Research_Analyst/README.md)
2. ✅ 理解10模块结构和Evolution Loop
3. ✅ 选择一个你擅长的领域创建第2个Skill
4. 🚀 执行一个真实项目，体验完整流程

**记住**: LiYe OS不是静态的知识库，而是**活的、会成长的能力系统**。每次使用，它都会变得更强。

---

*"The system that learns from itself becomes unstoppable."*

**— LiYe OS v1.0, 2025-12-07**
