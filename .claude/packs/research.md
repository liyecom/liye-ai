# Context Pack: Research（医疗研究/多智能体）

**加载条件：** 涉及医疗、治疗方案、药物、临床试验解读、循证医学、CrewAI 多智能体编排、PDF文献、论文解析时加载。

## 新增技能（来自 Awesome Claude Skills）

### pdf - PDF 文献解析
**位置：** `Skills/00_Core_Utilities/document-processing/pdf/`
**引用：** `Skills/05_Medical_Intelligence/index.yaml`

PDF 综合操作工具，支持：
- 文本与表格提取
- 元数据读取
- PDF 合并与拆分
- 注释添加
- 表单处理

**典型使用场景：**
- 医学文献解析
- 临床指南阅读
- 研究论文分析
- 药物说明书提取

---

## Medical Research Analyst（循证医学分析）

**位置：** `Skills/05_Medical_Intelligence/Medical_Research_Analyst/`

**核心方法：** 基于 PICO 框架的系统性循证分析

### PICO 框架

| 要素 | 含义 | 示例 |
|-----|------|------|
| **P** (Population) | 患者群体 | "晚期非小细胞肺癌患者，EGFR突变阳性" |
| **I** (Intervention) | 干预措施 | "奥希替尼（Osimertinib）" |
| **C** (Comparison) | 对照措施 | "标准化疗（培美曲塞+卡铂）" |
| **O** (Outcome) | 结局指标 | "无进展生存期（PFS）、总生存期（OS）、不良反应" |

### 标准流程

```
1. PICO 提炼
   ↓
2. 系统检索（PubMed, Cochrane, 临床试验数据库）
   ↓
3. 证据分级（GRADE）
   ↓
4. 效果对比（疗效 vs 安全性）
   ↓
5. 不确定性标注
   ↓
6. 输出：治疗决策分析报告（带引用）
```

### GRADE 证据分级

| 等级 | 含义 | 典型来源 |
|-----|------|---------|
| **高** | 非常确信真实效果接近估计效果 | 多个高质量 RCT 一致结论 |
| **中** | 中等确信估计效果 | RCT 有轻微局限性 OR 观察性研究强证据 |
| **低** | 对估计效果的确信有限 | RCT 有严重局限性 OR 观察性研究 |
| **极低** | 对估计效果几乎没有确信 | 专家意见、病例报告 |

### 输出模板

```markdown
## 治疗决策分析报告

### 研究问题（PICO）
- P: [患者群体]
- I: [干预措施]
- C: [对照措施]
- O: [结局指标]

### 证据汇总
| 研究 | 设计 | 样本量 | PFS | OS | 不良反应 | GRADE |
|-----|------|--------|-----|----|---------| ------|
| XXX et al. 2023 | RCT | 500 | 18.9m | 38.6m | 3-4级30% | 高 |
| ... | ... | ... | ... | ... | ... | ... |

### 疗效对比
- **无进展生存期（PFS）**: I组 vs C组 = 18.9个月 vs 10.2个月（HR=0.46, p<0.001）
- **总生存期（OS）**: I组 vs C组 = 38.6个月 vs 31.8个月（HR=0.80, p=0.046）
- **客观缓解率（ORR）**: I组 80% vs C组 76%

### 安全性对比
- **3-4级不良反应**: I组 30% vs C组 47%
- **常见不良反应**: I组腹泻、皮疹；C组骨髓抑制、脱发

### 不确定性
- [ ] 长期生存数据（>5年）尚不充分
- [ ] 亚组分析（如脑转移患者）样本量有限
- [ ] 真实世界数据与 RCT 可能存在差异

### 推荐意见
基于 **高质量证据**，对于 [P]，推荐 [I] 优于 [C]。
但需注意 [特定风险/局限性]。

### 参考文献
1. [引用格式]
2. ...
```

## CrewAI / 多智能体框架

**位置：** `Skills/06_Technical_Development/CrewAI_Multi_Agent_Framework/`

**适用场景：** 复杂任务拆解成多角色流水线（研究→分析→写作→质检）

### 核心概念

```python
# 定义角色（Agent）
researcher = Agent(
    role="Medical Researcher",
    goal="系统检索和汇总高质量证据",
    backstory="专注循证医学的研究员",
    tools=[pubmed_search, cochrane_search]
)

analyst = Agent(
    role="Clinical Analyst",
    goal="对比疗效和安全性，进行 GRADE 分级",
    backstory="临床药学专家",
    tools=[grade_tool, meta_analysis_tool]
)

writer = Agent(
    role="Medical Writer",
    goal="生成清晰、准确的分析报告",
    backstory="医学文献撰写专家",
    tools=[markdown_generator]
)

reviewer = Agent(
    role="Quality Reviewer",
    goal="检查报告的准确性和完整性",
    backstory="质控专家",
    tools=[fact_checker, citation_validator]
)

# 定义任务（Task）
task1 = Task(
    description="检索关于[PICO]的所有高质量证据",
    agent=researcher,
    expected_output="证据清单（JSON）"
)

task2 = Task(
    description="分析证据质量并进行 GRADE 分级",
    agent=analyst,
    expected_output="证据分级表（Markdown）"
)

task3 = Task(
    description="撰写治疗决策分析报告",
    agent=writer,
    expected_output="完整报告（Markdown）"
)

task4 = Task(
    description="质检报告的准确性",
    agent=reviewer,
    expected_output="质检通过 OR 修改建议"
)

# 编排流程（Crew）
crew = Crew(
    agents=[researcher, analyst, writer, reviewer],
    tasks=[task1, task2, task3, task4],
    process=Process.sequential  # 顺序执行
)

result = crew.kickoff()
```

### 输入输出契约（关键！）

**原则：** 明确每个 Agent 的输入格式和输出格式，避免"黑盒"传递

```python
# 不好的例子（模糊）
task = Task(description="分析数据", agent=analyst)

# 好的例子（明确契约）
task = Task(
    description="""
    输入：证据清单 JSON（格式见 templates/evidence_schema.json）
    处理：对每条证据进行 GRADE 分级
    输出：Markdown 表格，列：研究、设计、样本量、结局、GRADE
    """,
    agent=analyst,
    expected_output="Markdown 表格"
)
```

### 产物可追溯

**所有 Agent 输出必须归档：**

```
Artifacts_Vault/by_project/{project_name}/
├── crew_log.json           # Crew 执行日志
├── agent_outputs/
│   ├── researcher.json     # 检索结果
│   ├── analyst.md          # 分析结果
│   ├── writer.md           # 报告初稿
│   └── reviewer.md         # 质检意见
└── final_report.md         # 最终交付物
```

### 常见模式

| 模式 | 适用场景 | Agent 组合 |
|-----|---------|-----------|
| **研究流水线** | 文献综述、循证分析 | Researcher → Analyst → Writer → Reviewer |
| **内容生产** | 文章撰写、报告生成 | Researcher → Outliner → Writer → Editor |
| **决策支持** | 多维度对比、策略选择 | DataCollector → Analyzer → Strategist → Validator |
| **质量保证** | 复杂任务质检 | Executor → Checker → Fixer → FinalReviewer |

## 多模型协作（扩展）

**Claude + Gemini + GPT 分工：**

| 模型 | 擅长领域 | 典型任务 |
|-----|---------|---------|
| **Claude** | 编排、文件操作、质量门禁 | Crew 编排、结果归档、最终质检 |
| **Gemini** | 大上下文、批量处理 | 文献摘要（100+篇）、大规模数据分析 |
| **GPT-4** | 结构化输出、工具调用 | API 调用、数据提取、格式转换 |

**协作原则：**
1. Claude 负责"指挥官"角色，不要让 Claude 做重复性批量工作
2. 大上下文任务交给 Gemini（如一次性处理50篇文献）
3. 需要精确格式输出时用 GPT-4（如 JSON schema 严格匹配）

## 研究资源库

**外部数据库：**
- PubMed: https://pubmed.ncbi.nlm.nih.gov/
- Cochrane Library: https://www.cochranelibrary.com/
- ClinicalTrials.gov: https://clinicaltrials.gov/
- UpToDate: https://www.uptodate.com/

**内部知识库：**
- `Skills/05_Medical_Intelligence/Medical_Research_Analyst/knowledge_base/`
- 常见疾病治疗方案
- 药物相互作用数据库
- 临床指南汇总

---

**Char Count:** ~5,200 / 15,000 ✅
