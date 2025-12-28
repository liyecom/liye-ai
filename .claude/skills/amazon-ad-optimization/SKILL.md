---
name: amazon-ad-optimization
description: This skill should be used when users need to optimize Amazon advertising campaigns for their ASINs. Provides comprehensive workflows for keyword research, title optimization, ad campaign restructuring, CTR optimization, and data-driven decision making using TES methodology, parent-child ASIN keyword distribution strategy, and 3-3-3 campaign structure. Ideal for diagnosing underperforming campaigns, creating new SP/SBV/SD campaigns, optimizing product titles, and improving advertising metrics.
---

# Amazon广告优化技能

## Overview

To optimize Amazon advertising campaigns through systematic data analysis and strategic execution. This skill guides the complete workflow from Business Report diagnosis to campaign execution and performance monitoring.

## When to Use This Skill

This skill should be triggered when users request:
- "帮我优化Amazon广告活动"
- "分析这个ASIN的广告表现"
- "创建新的SP/SBV广告活动"
- "优化标题和关键词布局"
- "这个产品的CTR太低，怎么办？"
- "我的ACOS太高了，怎么降低？"
- "Business Report数据怎么分析？"
- "如何提高广告转化率？"

## Core Workflow

### Stage 1: Data Diagnosis

**Input Data**:
- Business Report (近30天)
- 现有广告活动数据
- 关键词搜索量数据 (卖家精灵/Helium 10等)

**Execution Steps**:
1. Analyze ASIN session counts and CVR
2. Identify hero products and potential products
3. Calculate TES (Traffic Efficiency Score)
4. Identify traffic gap keywords (high TES but low title density)

**Use Script**:
```bash
# Run TES calculation and keyword analysis
python3 scripts/calculate_tes.py
```

**Output**:
- ASIN performance analysis report
- Top keyword list (sorted by TES)
- Traffic gap keyword list
- Optimization opportunity identification

### Stage 2: Keyword Research

**Execution Steps**:
1. Calculate TES for all keywords
2. Classify keywords (WINNER/POTENTIAL/BROAD)
3. Trademark compliance check
4. Keyword competition analysis

**TES Classification Standards**:
- 🏆 WINNER (TES > 100): Must-have keywords, prioritize placement
- 💎 POTENTIAL (10 ≤ TES ≤ 100): Potential keywords, worth targeting
- 📊 BROAD (TES < 10): Broad terms, use with caution

**Output**:
- Green-light keyword list (approved)
- Red-light keyword list (prohibited, e.g., trademark terms)
- Keyword priority matrix

### Stage 3: Title Optimization

**Methodology**: Fixed Skeleton + One-Child-One-Keyword Strategy

**Execution Steps**:
1. Create parent-child ASIN keyword distribution matrix (use template: `assets/keyword-matrix-template.md`)
2. Design fixed skeleton (shared by all child ASINs)
3. Assign 1 differentiating keyword to each child ASIN
4. Validate compliance using CEO Judgment Method

**CEO Judgment Method**:
- Question: "If I copy this title to all child ASINs, does the logic hold?"
- ✅ Holds → Compliant
- ❌ Doesn't hold → Modify

**Output**:
- Parent-child ASIN keyword distribution matrix
- Complete title template (for each ASIN)
- Compliance validation report

**Reference**: For detailed methodology, see "Fixed Skeleton + One-Child-One-Keyword Strategy" section in `references/methodology.md`

### Stage 4: Ad Campaign Restructuring

**3-3-3 Framework**:
- 3 ad campaigns
- 3 ad groups per campaign
- 3 core keywords per ad group

**Standard Configuration**:

**Campaign 1: Big Keyword Attack** (60% budget)
- Target S-tier keywords with TES>1000
- High bid strategy (+30-50%)
- Hero ASIN

**Campaign 2: Precise Scenarios** (25% budget)
- Target A-tier keywords with TES 300-1000
- Medium bid strategy (±10%)
- Hero + secondary ASINs

**Campaign 3: Long-tail Exploration** (15% budget)
- Automatic Targeting
- Low bid strategy (-20%)
- All ASINs

**Execution Steps**:
1. Pause low-performing campaigns (ACOS>40% and ROI<1)
2. Create 3 new campaigns (per above configuration)
3. Set negative keywords (trademark terms, irrelevant terms)
4. Adjust bidding strategy

**Output**:
- Day 1 execution checklist
- Ad campaign architecture diagram
- Keyword-ASIN assignment table

### Stage 5: CTR Optimization

**CTR Benchmarks** (refer to `references/advertising-types.md`):
- SP (image): 0.5-1.5%
- SBV (video): 2-4%
- SD (image): 0.3-0.8%

**Emergency Plan When CTR < 0.5%**:

**Immediate Actions**:
1. Increase SP bids by 40-50%
2. Create SBV campaign (if video assets available)
3. Optimize main image (use scenario images, comparison images)
4. Adjust budget allocation (SBV 60% + SP 30% + SD 10%)

**Expected Results**:
- SP CTR: 0.47% → 0.8-1.2%
- SBV CTR: 2-3%
- Overall CTR increase by 3-5x

**Output**:
- CTR optimization emergency plan
- Budget reallocation table
- Main image optimization recommendations

### Stage 6: Monitoring & Iteration

**Daily Tracking**:
Use template: `assets/daily-tracking-template.csv`

**Core Metrics**:
- Impressions
- Clicks
- CTR (Click-Through Rate)
- Spend
- CPC (Cost Per Click)
- Orders
- Sales
- CVR (Conversion Rate)
- ACOS (Advertising Cost of Sales)

**Key Review Points**:
- Day 3: First validation, determine if adjustments needed
- Day 7: Week 1 review, assess overall strategy
- Day 14: Two-week review, decide to expand/contract
- Day 30: Final review, summarize lessons learned

**Output**:
- Daily data tracking sheet
- Abnormal metric alerts
- Optimization recommendation report

## Core Methodology Quick Reference

### TES Formula
```
TES = (Monthly Search Volume × Purchase Rate) / (Title Density + 1)
```

### Fixed Skeleton + One-Child-One-Keyword
1. Fixed Skeleton: All child ASINs share core structure
2. One-Child-One-Keyword: Each child ASIN gets only 1 differentiating attribute word
3. CEO Judgment Method: Title interchangeability logic validation

### 3-3-3 Ad Structure
- 3 campaigns: Big Keyword Attack (60%) + Precise Scenarios (25%) + Long-tail Exploration (15%)
- 3 ad groups: Grouped by keyword type/scenario
- 3 core keywords: Each ad group selects 3 high-conversion keywords

### CTR Benchmarks
- SP: 0.5-1.5%
- SBV: 2-4% (video ad CTR is 3-5x that of image ads)
- SD: 0.3-0.8%

## Available Resources

### Scripts (scripts/)
- `calculate_tes.py`: TES calculation and keyword analysis script

### References (references/)
- `advertising-types.md`: Amazon advertising types explained (SP/SB/SD)
- `methodology.md`: Core methodologies (TES, Fixed Skeleton + One-Child-One-Keyword, 3-3-3 Structure, CTR Optimization)

### Templates (assets/)
- `keyword-matrix-template.md`: Parent-child ASIN keyword distribution matrix template
- `daily-tracking-template.csv`: 30-day daily data tracking template

## Usage Examples

### Example 1: Diagnosing Low CTR

**User Request**:
"我的SP广告CTR只有0.47%，视频广告有2.20%，怎么优化？"

**Execution Flow**:
1. Identify issue: SP CTR far below benchmark (0.5-1.5%)
2. Comparative analysis: Video ad CTR is 5x that of image ads
3. Apply solution: CTR Optimization Emergency Plan (Stage 5)
4. Immediate actions:
   - Increase SP bids by 40-50%
   - Create SBV campaign (budget $60)
   - Adjust budget allocation (prioritize SBV)
5. Expected results: SP CTR 0.47% → 0.8-1.2%, SBV CTR 2-3%

### Example 2: Optimizing ASIN Titles

**User Request**:
"帮我优化父子ASIN的标题，避免商标侵权"

**Execution Flow**:
1. Read Business Report, identify hero ASINs
2. Run TES calculation script, get top keywords
3. Trademark compliance check (e.g., avoid "muddy mat")
4. Use `keyword-matrix-template.md` to create distribution matrix
5. Design fixed skeleton + assign 1 differentiating word to each child ASIN
6. Validate with CEO Judgment Method
7. Output complete title templates

### Example 3: Creating 3-3-3 Ad Plan

**User Request**:
"帮我重构广告活动，预算$150/天"

**Execution Flow**:
1. Analyze existing campaign performance (ACOS, ROI)
2. Pause low-performing campaigns
3. Create new campaigns following 3-3-3 structure:
   - Campaign 1: $90 (Big Keyword Attack)
   - Campaign 2: $40 (Precise Scenarios)
   - Campaign 3: $20 (Long-tail Exploration)
4. Assign keywords and ASINs to each campaign
5. Set bidding strategy
6. Start monitoring (use `daily-tracking-template.csv`)

## Important Notes

### Trademark Compliance
- Avoid using trademarked terms in titles and ad keywords
- Example: "muddy mat(s)" is trademarked, prohibited; "for muddy shoes" is adjective form, allowed

### Parent-Child ASIN Variation Rules
- Differentiating words for child ASINs must be "attributes" not "purposes"
- ✅ OK: Absorbent vs Low Profile (attributes)
- ❌ NG: for Kids Room vs for Commercial Use (purposes)

### Ad Type Selection
- Have brand registry + have video assets → Prioritize SBV (highest CTR)
- Functional products (need demonstration) → SBV
- New products/limited budget → SP
- Remarketing/competitor targeting → SD

### Data Monitoring Frequency
- Day 1-3: Check daily, adjust promptly
- Day 4-14: Check every 2-3 days
- Day 15+: Check weekly

## Skill Maintenance

This skill is refined from Timo US doormat optimization case study and applies to most Amazon product advertising optimization scenarios. For category-specific adjustments, modify:
- TES thresholds (current: WINNER>100, POTENTIAL 10-100)
- CTR benchmarks (current: SP 0.5-1.5%, SBV 2-4%)
- ACOS threshold (current: 40%)
- Budget allocation ratios (current: 60% + 25% + 15%)

---

**Skill Version**: v1.0
**Created**: 2025-12-27
**Applicable Scenarios**: Amazon SP/SB/SD advertising optimization
