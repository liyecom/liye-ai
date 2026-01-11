# Context Pack: Operations

**Loading Conditions:** Load when tasks involve domain-specific operations, data analysis, workflow execution, or system operations.

> **Migration Notice:** Domain-specific operational content (Amazon Growth Engine, TES Framework, etc.) has been migrated to private repositories. This pack now demonstrates the framework patterns using generic examples.

---

## Standard Glossary Pattern

**Location:** `knowledge/glossary/<domain>.yaml`

Each domain should define its core metrics in a glossary file. Example structure:

| Field | Description |
|-------|-------------|
| **concept_id** | Unique identifier (snake_case) |
| **display_name** | Human-readable name |
| **formula** | Calculation formula |
| **purpose** | Business purpose |

**Example Usage:**
```yaml
# knowledge/glossary/example-domain.yaml
concepts:
  - concept_id: efficiency_ratio
    display_name: Efficiency Ratio
    formula: output_value / input_cost
    purpose: Measure operational efficiency
```

---

## Memory Check Rules (Anti-Forgetting)

In these situations, **must search claude-mem first**:

1. **Involving technical terms:**
   ```
   mem-search query="[term] definition" project="liye_os"
   ```

2. **Before making decisions:**
   ```
   mem-search obs_type="decision" query="[related topic]" project="liye_os"
   ```

3. **After user corrects a concept:**
   - Confirm if previously discussed
   - Update `knowledge/glossary/*.yaml`

---

## Skills (from Awesome Claude Skills)

### xlsx - Excel Data Analysis
**Location:** `Skills/00_Core_Utilities/document-processing/xlsx/`

Spreadsheet toolkit supporting:
- Read/write .xlsx/.xlsm/.csv/.tsv files
- Formula calculation and preservation
- Charts and data visualization
- Data analysis and transformation

### csv-summarizer - Automatic Data Insights
**Location:** `Skills/00_Core_Utilities/data-analysis/csv-summarizer/`

Automatically analyze CSV files and generate insight reports:
- Automatic data summary
- Statistical analysis and anomaly detection
- Trend identification
- Automatic visualization

---

## Domain System Pattern

Each domain system follows this structure:

**Location:** `src/domain/<domain-name>/`

**Architecture Components:**
- Data Collection: Input data gathering
- Analysis Engine: Domain-specific analysis logic
- Strategy Engine: Decision making and optimization
- Execution System: Action implementation

**Common Entry Points:**
```bash
cd src/domain/<domain-name>

# Run domain workflow
python main.py --mode <mode> --input <input>

# Run analysis
python src/analyzer.py --output reports/
```

**Data Directories:**
- `data/inputs/` - Raw input data
- `data/outputs/` - Analysis results
- `data/databases/` - Local databases

---

## Operations SOP Pattern

### Generic Workflow Checklist

```markdown
- [ ] Input data validation complete
- [ ] Analysis parameters configured
- [ ] Output format specified
- [ ] Quality gates defined
- [ ] Monitoring configured
```

### Optimization Checklist

```markdown
- [ ] Diagnose: Identify bottlenecks
- [ ] Analyze: Root cause analysis
- [ ] Optimize: Implement improvements
- [ ] Validate: Verify results
- [ ] Monitor: Track metrics
```

---

## Evolution / Retrospective

**Principle:** Archive deliverables + Extract insights + Update methods

**Process:**
1. Record each operation to `Artifacts_Vault/by_project/`
2. Monthly retrospective extracts insights
3. Successful cases archived to `templates/`
4. Failure lessons updated to `guardrails.md`

**Example Structure:**
```
Artifacts_Vault/by_project/
└── project_name_q4_2024/
    ├── README.md              # Project overview
    ├── analysis/              # Analysis records
    ├── insights.md            # Key insights
    └── results.csv            # Data results
```

---

## Data Privacy and Security

**Sensitive Data:** Do not commit to Git
- API keys, credentials
- Customer data
- Business-specific configurations

**Recommended:**
- Use `.env` files (gitignored)
- Use `data_external/` symlinks for large data
- Document data handling in domain README
