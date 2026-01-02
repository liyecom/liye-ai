# Context Pack: Operations (Amazon/Cross-border/E-commerce)

**Loading Conditions:** Load when tasks involve Amazon/ASIN/Listing/PPC/Keywords/Cross-border e-commerce/Timo/Operations systems/Excel/Spreadsheets/xlsx/csv analysis.

---

## Standard Glossary (Required Reading)

**Location:** `knowledge/glossary/amazon-advertising.yaml`

**Core Four Metrics** (Precise definitions, do not confuse):

| Metric | Formula | Purpose |
|--------|---------|---------|
| **ACoS** | Ad Spend ÷ Ad Sales | Internal ad efficiency |
| **ROAS** | Ad Sales ÷ Ad Spend | Ad return multiple (= 1/ACoS) |
| **ACoAS** | Ad Spend ÷ Total Sales | Ad cost ratio (overall P&L) |
| **ASoAS** | Ad Sales ÷ Total Sales | Ad dependency (lower is healthier) |

**Common Misconceptions:**
- ACoS ≠ ROI (ROI must consider costs)
- ACoAS = TACoS (same concept, different names)
- Low ACoS isn't always good (may indicate under-investment)

**Complete Definitions:** `Read knowledge/glossary/amazon-advertising.yaml`

---

## Memory Check Rules (Anti-Forgetting)

In these situations, **must search claude-mem first**:

1. **Involving technical terms:**
   ```
   mem-search query="[term] definition" project="liye_os"
   ```

2. **Before making advertising decisions:**
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
**Reference:** `Skills/02_Operation_Intelligence/index.yaml`

Spreadsheet toolkit supporting:
- Read/write .xlsx/.xlsm/.csv/.tsv files
- Formula calculation and preservation
- Charts and data visualization
- Data analysis and transformation

**Typical Use Cases:**
- Amazon sales data analysis
- Keyword report processing
- PPC advertising data analysis

### csv-summarizer - Automatic Data Insights
**Location:** `Skills/00_Core_Utilities/data-analysis/csv-summarizer/`
**Reference:** `Skills/02_Operation_Intelligence/index.yaml`

Automatically analyze CSV files and generate insight reports:
- Automatic data summary
- Statistical analysis and anomaly detection
- Trend identification
- Automatic visualization

---

## Amazon Growth OS

**Location:** `Systems/amazon-growth-os/`

**Purpose:** New product launch, existing product optimization, keyword strategy, PPC tiered optimization, competitor and funnel diagnostics

**Architecture Components:**
- Data Collection: Ad reports, BSR, reviews, competitor monitoring
- Analysis Engine: Keyword tiering, traffic funnel, brand health scoring
- Strategy Engine: Bid optimization, budget allocation, A/B testing
- Execution System: Batch operations, automated reports, alert notifications

**Common Entry Points (from repo root):**

```bash
cd Systems/amazon-growth-os

# New Product Launch Mode
./run.sh --mode launch --product "XXX" --market "Amazon US"

# Existing Product Optimization Mode
./run.sh --mode optimize --asin "B0XXXXXXX"

# Keyword Review
python src/keyword_analyzer.py --asin B0XXX --output reports/

# PPC Optimization
python src/bidding/bid_engine.py --campaign-id XXX
```

**Data Directories:**
- `data/inputs/` - Raw data (ad reports, BSR, etc.)
- `data/outputs/` - Analysis results
- `data/databases/` - DuckDB databases
- `uploads/` - Temporary uploads (should be gitignored)

**Environment Configuration:**
```bash
# Copy environment template
cp .env.example .env

# Required variables
AMAZON_API_KEY=...
OPENAI_API_KEY=...
```

## amazon-keyword-analysis (TES Framework)

**Location:** `Skills/02_Operation_Intelligence/amazon-keyword-analysis/`

**Core Methodology:** TES (Test-Nurture-Harvest-Defend-Delete) Keyword Lifecycle Management

### TES Framework Details

| Stage | Goal | Action | Exit Criteria |
|-------|------|--------|---------------|
| **Test** | Validate traffic quality | Broad match, low bid | 7 days with conversion OR 100 impressions no conversion |
| **Nurture** | Improve organic ranking | Phrase/Exact match, increase bid | Organic rank in top 20 OR ACoS >50% |
| **Harvest** | Maximize profit | Lower bid, monitor ACoS | ACoS > target OR organic rank drops below top 30 |
| **Defend** | Maintain ranking | Low bid defense | Competitor threat OR insufficient budget |
| **Delete** | Stop waste | Disable/delete | - |

**Key Principles:**
1. Don't just look at single ACoS - consider keyword "lifetime value"
2. Test phase allows high ACoS (investing in future ranking)
3. Nurture phase focuses on organic ranking improvement speed
4. Harvest phase strictly controls ACoS target
5. Regularly review (monthly) to transition keywords between TES stages

### Common Analysis Dimensions

```python
# Keyword Tiering
- Tier 1: Core converting words (ACoS <30%, weekly conversions >5)
- Tier 2: Potential words (ACoS 30-50%, weekly conversions 1-5)
- Tier 3: Test words (ACoS >50% OR no conversions)

# Traffic Quality Assessment
CTR (Click-through Rate) → CVR (Conversion Rate) → ACoS → Profit Margin

# Competitor Benchmarking
Market Share → Ranking Changes → Traffic Interception
```

## Operations SOP (Standard Operating Procedures)

### New Product Launch Checklist

```markdown
- [ ] Listing optimization complete (title, bullets, A+, video)
- [ ] Keyword library established (50+ core words, 200+ long-tail)
- [ ] Ad structure setup (auto + manual + brand + display)
- [ ] Budget allocation plan (test phase vs growth phase)
- [ ] Competitor monitoring configured (price, ranking, reviews)
- [ ] Data dashboard configured (conversion funnel, health score)
```

### Existing Product Optimization Checklist

```markdown
- [ ] Diagnose: Traffic/Conversion/Profit three funnels
- [ ] Keywords: TES stage review and adjustment
- [ ] Advertising: Bid optimization, negative keywords, budget reallocation
- [ ] Listing: CTR/CVR optimization (images, video, reviews)
- [ ] Inventory: Avoid stockouts, control excess
- [ ] Competitors: Share changes, strategy adjustments
```

## Evolution / Retrospective

**Principle:** Archive deliverables + Extract insights + Update methods (don't put long records back in CLAUDE.md)

**Process:**
1. Record each operations action to `Artifacts_Vault/by_project/`
2. Monthly retrospective extracts insights to `methods.md`
3. Successful cases archived to `templates/`
4. Failure lessons updated to `guardrails.md`

**Example Structure:**
```
Artifacts_Vault/by_project/
└── timo_canada_q4_2024/
    ├── README.md              # Project overview
    ├── listing_optimization/  # Listing optimization records
    ├── ppc_campaigns/         # Ad optimization records
    ├── insights.md            # Key insights
    └── results.csv            # Data results
```

## Data Privacy and Security

**Sensitive Data:** Do not commit to Git
- `.env` - API keys
- `uploads/` - Raw ad reports
- `data/databases/*.duckdb` - Database files
- Any raw files containing ASIN, sales, profit

**Handling Methods:**
1. Explicitly exclude in `.gitignore`
2. Use `data_external/` symlink to external Git storage
3. Anonymize when sharing (replace ASIN, amounts, etc.)

---

**Char Count:** ~4,800 / 15,000 ✅

<!-- i18n: Chinese display version at i18n/display/zh-CN/packs/operations.md -->
