# Context Pack: Research (Medical Research/Multi-Agent)

**Loading Conditions:** Load when tasks involve medical, treatment plans, medications, clinical trial interpretation, evidence-based medicine, CrewAI multi-agent orchestration, PDF literature, or paper analysis.

## Skills (from Awesome Claude Skills)

### pdf - PDF Literature Analysis
**Location:** `Skills/00_Core_Utilities/document-processing/pdf/`
**Reference:** `Skills/05_Medical_Intelligence/index.yaml`

Comprehensive PDF toolkit supporting:
- Text and table extraction
- Metadata reading
- PDF merge and split
- Annotation adding
- Form processing

**Typical Use Cases:**
- Medical literature analysis
- Clinical guideline reading
- Research paper analysis
- Drug label extraction

---

## Medical Research Analyst (Evidence-Based Analysis)

**Location:** `Skills/05_Medical_Intelligence/Medical_Research_Analyst/`

**Core Method:** Systematic evidence-based analysis based on PICO framework

### PICO Framework

| Element | Meaning | Example |
|---------|---------|---------|
| **P** (Population) | Patient group | "Late-stage NSCLC patients, EGFR mutation positive" |
| **I** (Intervention) | Intervention measure | "Osimertinib" |
| **C** (Comparison) | Control measure | "Standard chemotherapy (Pemetrexed + Carboplatin)" |
| **O** (Outcome) | Outcome indicators | "Progression-free survival (PFS), Overall survival (OS), Adverse events" |

### Standard Process

```
1. PICO Extraction
   ↓
2. Systematic Search (PubMed, Cochrane, Clinical Trial Databases)
   ↓
3. Evidence Grading (GRADE)
   ↓
4. Effect Comparison (Efficacy vs Safety)
   ↓
5. Uncertainty Annotation
   ↓
6. Output: Treatment Decision Analysis Report (with citations)
```

### GRADE Evidence Grading

| Level | Meaning | Typical Sources |
|-------|---------|-----------------|
| **High** | Very confident true effect is close to estimated effect | Multiple high-quality RCTs with consistent conclusions |
| **Moderate** | Moderate confidence in estimated effect | RCTs with minor limitations OR strong evidence from observational studies |
| **Low** | Limited confidence in estimated effect | RCTs with serious limitations OR observational studies |
| **Very Low** | Almost no confidence in estimated effect | Expert opinion, case reports |

### Output Template

```markdown
## Treatment Decision Analysis Report

### Research Question (PICO)
- P: [Patient group]
- I: [Intervention]
- C: [Comparison]
- O: [Outcomes]

### Evidence Summary
| Study | Design | Sample Size | PFS | OS | Adverse Events | GRADE |
|-------|--------|-------------|-----|----|-----------------| ------|
| XXX et al. 2023 | RCT | 500 | 18.9m | 38.6m | Grade 3-4 30% | High |
| ... | ... | ... | ... | ... | ... | ... |

### Efficacy Comparison
- **Progression-free Survival (PFS)**: I vs C = 18.9 months vs 10.2 months (HR=0.46, p<0.001)
- **Overall Survival (OS)**: I vs C = 38.6 months vs 31.8 months (HR=0.80, p=0.046)
- **Objective Response Rate (ORR)**: I 80% vs C 76%

### Safety Comparison
- **Grade 3-4 Adverse Events**: I 30% vs C 47%
- **Common Adverse Events**: I: diarrhea, rash; C: myelosuppression, alopecia

### Uncertainties
- [ ] Long-term survival data (>5 years) insufficient
- [ ] Subgroup analysis (e.g., brain metastasis patients) limited sample size
- [ ] Real-world data may differ from RCT

### Recommendation
Based on **high-quality evidence**, for [P], recommend [I] over [C].
Note: [specific risks/limitations].

### References
1. [citation format]
2. ...
```

## CrewAI / Multi-Agent Framework

**Location:** `Skills/06_Technical_Development/CrewAI_Multi_Agent_Framework/`

**Use Cases:** Decomposing complex tasks into multi-role pipelines (Research → Analysis → Writing → QC)

### Core Concepts

```python
# Define Roles (Agent)
researcher = Agent(
    role="Medical Researcher",
    goal="Systematically search and summarize high-quality evidence",
    backstory="Researcher focused on evidence-based medicine",
    tools=[pubmed_search, cochrane_search]
)

analyst = Agent(
    role="Clinical Analyst",
    goal="Compare efficacy and safety, perform GRADE grading",
    backstory="Clinical pharmacy expert",
    tools=[grade_tool, meta_analysis_tool]
)

writer = Agent(
    role="Medical Writer",
    goal="Generate clear, accurate analysis reports",
    backstory="Medical literature writing expert",
    tools=[markdown_generator]
)

reviewer = Agent(
    role="Quality Reviewer",
    goal="Check report accuracy and completeness",
    backstory="Quality control expert",
    tools=[fact_checker, citation_validator]
)

# Define Tasks
task1 = Task(
    description="Search all high-quality evidence about [PICO]",
    agent=researcher,
    expected_output="Evidence list (JSON)"
)

task2 = Task(
    description="Analyze evidence quality and perform GRADE grading",
    agent=analyst,
    expected_output="Evidence grading table (Markdown)"
)

task3 = Task(
    description="Write treatment decision analysis report",
    agent=writer,
    expected_output="Complete report (Markdown)"
)

task4 = Task(
    description="QC report accuracy",
    agent=reviewer,
    expected_output="QC passed OR revision suggestions"
)

# Orchestrate Process (Crew)
crew = Crew(
    agents=[researcher, analyst, writer, reviewer],
    tasks=[task1, task2, task3, task4],
    process=Process.sequential  # Sequential execution
)

result = crew.kickoff()
```

### Input/Output Contracts (Critical!)

**Principle:** Explicitly define input and output formats for each Agent, avoid "black box" passing

```python
# Bad example (vague)
task = Task(description="Analyze data", agent=analyst)

# Good example (explicit contract)
task = Task(
    description="""
    Input: Evidence list JSON (format see templates/evidence_schema.json)
    Process: GRADE grade each piece of evidence
    Output: Markdown table, columns: Study, Design, Sample Size, Outcome, GRADE
    """,
    agent=analyst,
    expected_output="Markdown table"
)
```

### Artifact Traceability

**All Agent outputs must be archived:**

```
Artifacts_Vault/by_project/{project_name}/
├── crew_log.json           # Crew execution log
├── agent_outputs/
│   ├── researcher.json     # Search results
│   ├── analyst.md          # Analysis results
│   ├── writer.md           # Report draft
│   └── reviewer.md         # QC feedback
└── final_report.md         # Final deliverable
```

### Common Patterns

| Pattern | Use Case | Agent Composition |
|---------|----------|-------------------|
| **Research Pipeline** | Literature review, evidence analysis | Researcher → Analyst → Writer → Reviewer |
| **Content Production** | Article writing, report generation | Researcher → Outliner → Writer → Editor |
| **Decision Support** | Multi-dimensional comparison, strategy selection | DataCollector → Analyzer → Strategist → Validator |
| **Quality Assurance** | Complex task QC | Executor → Checker → Fixer → FinalReviewer |

## Multi-Model Collaboration (Extended)

**Claude + Gemini + GPT Division of Labor:**

| Model | Strengths | Typical Tasks |
|-------|-----------|---------------|
| **Claude** | Orchestration, file operations, quality gates | Crew orchestration, result archiving, final QC |
| **Gemini** | Large context, batch processing | Literature summary (100+ papers), large-scale data analysis |
| **GPT-4** | Structured output, tool calling | API calls, data extraction, format conversion |

**Collaboration Principles:**
1. Claude serves as "commander" role, don't let Claude do repetitive batch work
2. Large context tasks go to Gemini (e.g., processing 50 papers at once)
3. Use GPT-4 when precise format output needed (e.g., strict JSON schema matching)

## Research Resource Library

**External Databases:**
- PubMed: https://pubmed.ncbi.nlm.nih.gov/
- Cochrane Library: https://www.cochranelibrary.com/
- ClinicalTrials.gov: https://clinicaltrials.gov/
- UpToDate: https://www.uptodate.com/

**Internal Knowledge Base:**
- `Skills/05_Medical_Intelligence/Medical_Research_Analyst/knowledge_base/`
- Common disease treatment plans
- Drug interaction database
- Clinical guideline summary

---

**Char Count:** ~5,200 / 15,000 ✅

<!-- i18n: Chinese display version at i18n/display/zh-CN/packs/research.md -->
