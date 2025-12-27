# 🎯 Skill创建模板

本目录包含创建新Skill所需的所有模板文件。

---

## 📋 使用流程

### Step 1: 复制模板

```bash
# 复制整个模板目录
cp -r /Users/liye/websites/liye.com/LiYe_OS/_meta/skill_template \
      /Users/liye/websites/liye.com/LiYe_OS/Skills/[Domain]/[Your_Skill_Name]/

# 示例：创建Content Creator Skill
cp -r _meta/skill_template \
      Skills/03_Creative_Production/Content_Creator/
```

### Step 2: 重命名和填写

1. **skill_definition.md** - 填写完整10模块定义
2. **README.md** - 编写使用指南
3. **methods.md** - 详细方法论（可选但推荐）
4. **evolution_log.md** - 初始化进化日志
5. **templates/** - 创建至少3个实用模板

### Step 3: 验证完整性

使用检查清单确认：

- [ ] 10模块全部完成
- [ ] README清晰易懂
- [ ] 至少3个templates
- [ ] evolution_log已初始化
- [ ] 首次实战验证通过

---

## 📁 模板文件说明

### skill_definition.md
**作用**: Skill的核心定义文档
**大小**: 20-30KB
**内容**: 完整10模块

### README.md
**作用**: 快速上手指南
**大小**: 10-20KB
**内容**: 简介、使用示例、FAQ

### methods.md
**作用**: 详细方法论
**大小**: 50-100KB
**内容**: SOP详解、故障排除、质量保证

### evolution_log.md
**作用**: 进化记录
**大小**: 初始10KB，随时间增长
**内容**: 版本历史、Artifacts反馈、改进记录

### templates/
**作用**: 输出模板库
**数量**: 至少3个
**格式**: Markdown模板，可直接复制使用

---

## 🎨 10模块填写指南

### Module 01: Skill Identity
**必需内容**:
- Skill名称（中英文）
- 核心使命（1-2句话）
- 适用场景（3-5个具体场景）
- 不适用场景（边界说明）

**填写示例**:
```markdown
## 🔹01. Skill Identity

**Skill Name**: Content Creator / 内容创作者

**Core Mission**:
帮助用户创作高质量、有影响力的多媒体内容，涵盖文字、视频、播客等形式，
通过结构化的创作流程和工具，提升内容的传播力和价值。

**Applicable Scenarios**:
1. 撰写技术博客文章
2. 制作教学视频
3. 设计信息图表
4. 创作播客节目
5. 社交媒体内容策划

**NOT Applicable**:
- 纯粹的文学创作（小说、诗歌等）
- 专业级影视制作
- 学术论文写作（应使用Academic Writer Skill）
```

### Module 02: Capability Model
**必需内容**:
- 4-6个子能力分解
- 每个子能力包含2-4个具体技能点
- 使用表格或层次结构展示

**示例**:
```markdown
## 🔹02. Capability Model

### Key Competencies

#### A. Ideation & Planning（构思策划）
- 创意生成方法（头脑风暴、思维导图）
- 受众分析（目标读者画像）
- 内容策略（主题规划、发布节奏）

#### B. Content Creation（内容创作）
- 写作技巧（结构、叙事、修辞）
- 视觉设计（排版、配色、图表）
- 多媒体制作（视频编辑、音频处理）

#### C. Optimization（优化提升）
- SEO优化（关键词、可读性）
- A/B测试（标题、封面测试）
- 数据分析（阅读量、完成率）

#### D. Distribution（分发传播）
- 平台策略（选择合适渠道）
- 社交媒体推广
- 社区互动（评论管理、社群运营）
```

### Module 03: Mental Models
**必需内容**:
- 2-4个核心思维框架
- 每个框架包含：名称、原理、应用示例
- 可视化图示（推荐）

**示例**:
```markdown
## 🔹03. Mental Models / Principles

### Core Thinking Frameworks

#### 1. The Hook-Content-CTA Framework（钩子-内容-行动框架）

**原理**:
优秀内容的三段式结构：
- Hook（钩子）: 前3秒抓住注意力
- Content（内容）: 提供价值
- CTA（行动召唤）: 引导下一步行动

**可视化**:
```
[Hook] → 吸引 → [Content] → 价值 → [CTA] → 转化
   ↓              ↓                    ↓
 标题/封面       干货/故事          订阅/分享/购买
```

**应用示例**:
- Hook: "99%的人不知道的写作技巧"
- Content: 讲解SCQA结构化写作法
- CTA: "关注我获取完整写作模板"
```

### Module 04: Methods & SOPs
**必需内容**:
- 完整SOP，3-5个Phase
- 每个Phase包含具体步骤
- 估算时间
- 示例

**示例**:
```markdown
## 🔹04. Methods & SOPs

### Standard Operating Procedure: Content Creation

#### Phase 1: Ideation & Research（构思与研究）
**时间**: 1-2小时

**Step 1.1**: 选题头脑风暴
- 使用思维导图工具（如MindNode）
- 列出10个候选主题
- 评估：受众需求 × 自己专长 × 市场空白

**Step 1.2**: 竞品分析
- 搜索同类内容（Google, YouTube, 小红书）
- 分析Top 10内容的特点
- 识别差异化角度

**Step 1.3**: 资料收集
- 收集数据、案例、引用
- 整理到参考文献库

#### Phase 2: Outlining（大纲）
**时间**: 30分钟 - 1小时
...
```

### Module 05-10: 类似填写

---

## 🎯 质量标准

### 必需达标

- [ ] **完整性**: 10模块全部填写
- [ ] **可用性**: 有人能基于文档独立使用Skill
- [ ] **示例**: 每个模块至少1个示例
- [ ] **模板**: 至少3个实用模板
- [ ] **首次验证**: 至少1个真实Artifact

### 推荐达标

- [ ] **详细方法**: methods.md >50KB
- [ ] **可视化**: 包含流程图、框架图
- [ ] **故障排除**: methods.md有Troubleshooting章节
- [ ] **视频**: 录制Skill使用演示

---

## 💡 常见问题

**Q: Skill和普通文档的区别？**
A: Skill是**可执行的能力系统**，不是静态文档。必须包含方法论（How）、工具（With What）和自进化机制（How to Improve）。

**Q: 10模块都是必需的吗？**
A: 是的。10模块标准确保Skill的完整性和可复用性。缺少任何模块都会影响使用体验。

**Q: 如何确定Skill边界？**
A:
- 太宽：一个Skill包含多个不相关能力 → 拆分为多个Skills
- 太窄：一个Skill只能用于极少数场景 → 考虑并入更大的Skill

**Q: 必须有methods.md吗？**
A: 不是必需，但强烈推荐。对于复杂Skill（如Medical Research Analyst），methods.md提供详细操作指南，大幅提升可用性。

**Q: templates/必须有几个？**
A: 至少3个。templates是Skill价值的核心体现，直接降低使用门槛。

---

## 📚 参考资源

- [Medical Research Analyst](../../Skills/05_Medical_Intelligence/Medical_Research_Analyst/) - 完整Skill示范
- [架构设计文档](../../架构设计.md) - Skill设计原理
- [LiYe OS README](../../README.md) - 系统总览

---

**创建你的第一个Skill，开启能力复利之旅！**
