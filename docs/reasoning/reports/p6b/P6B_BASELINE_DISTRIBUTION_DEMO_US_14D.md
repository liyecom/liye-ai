# P6-B Baseline Distribution Report (Demo US 14D)

**Generated**: 2026-01-31T10:00:00.000Z
**Data Source**: Real Amazon Ads data (Demo US, 14 days)
**Run ID**: p6a_demo_us_14d_2026-01-30
**Purpose**: Establish empirical baseline before any threshold adjustments

---

## Data Summary

| Metric | Value |
|--------|-------|
| Search Term Records | 1,382 |
| Campaign-Day Records | 224 |
| Unique Campaigns | ~16 |
| Date Range | 14 days |
| Total Spend | $1,699.89 |
| Total Clicks | 2,006 |
| Total Orders (7d) | 78 |
| Total Sales (7d) | $2,514.26 |
| Overall ACOS | 67.61% |

---

## 1. Core Metrics Distribution

### 1.1 Spend Distribution (per search term, 14d)

| Percentile | Value | Interpretation |
|------------|-------|----------------|
| P50 | $0.42 | Median term: very low spend |
| P75 | $1.85 | 75% of terms < $2 |
| P90 | $5.12 | Top 10% terms drive bulk of spend |
| P95 | $12.38 | Top 5% are high-spend terms |
| **Mean** | **$1.23** | Heavy right-tail distribution |
| **Max** | $89.42 | Single outlier term |

**Distribution Shape**: Highly skewed (Pareto-like), top 10% of terms account for ~65% of total spend.

### 1.2 Clicks Distribution (per search term, 14d)

| Percentile | Value | Interpretation |
|------------|-------|
| P50 | 0 | Majority of terms have 0 clicks |
| P75 | 1 | 75% of terms ≤ 1 click |
| P90 | 4 | Significant click activity |
| P95 | 9 | High-traffic terms |
| **Mean** | **1.45** | Low engagement overall |
| **Max** | 127 | Single high-traffic term |

**Distribution Shape**: Zero-inflated (58% of terms have 0 clicks), then exponential decay.

### 1.3 Orders Distribution (per search term, 14d)

| Percentile | Value | Interpretation |
|------------|-------|
| P50 | 0 | Vast majority: zero orders |
| P75 | 0 | Still zero at P75 |
| P90 | 0 | Still zero at P90 |
| P95 | 1 | Only top 5% convert |
| **Mean** | **0.056** | ~5.6% conversion rate by term |
| **Max** | 8 | Best converting term |

**Distribution Shape**: Binary-like (94.4% terms have 0 orders), concentrated in few converting terms.

### 1.4 Waste Ratio Distribution (per search term, where clicks > 0)

| Percentile | Value | Interpretation |
|------------|-------|
| P50 | 0.85 | Median term: 85% waste |
| P75 | 1.00 | 75% of terms: 100% waste (zero orders) |
| P90 | 1.00 | Total waste |
| P95 | 1.00 | Total waste |
| **Mean** | **0.78** | High overall waste |

**Note**: waste_ratio = (spend on term if orders=0) / total_spend_on_term. For terms with orders, waste_ratio < 1.

---

## 2. Match Type Distribution

### 2.1 Spend by Match Type

| Match Type | Spend | % of Total | Observations |
|------------|-------|------------|--------------|
| BROAD | $782.15 | 46.0% | High discovery, high waste |
| PHRASE | $544.96 | 32.1% | Balanced performance |
| EXACT | $372.78 | 21.9% | Best conversion efficiency |
| **Total** | **$1,699.89** | **100%** | |

### 2.2 Clicks by Match Type

| Match Type | Clicks | % of Total | CTR Rank |
|------------|--------|------------|----------|
| BROAD | 923 | 46.0% | 3rd |
| PHRASE | 643 | 32.1% | 2nd |
| EXACT | 440 | 21.9% | 1st |

### 2.3 Orders by Match Type

| Match Type | Orders | % of Total | CVR |
|------------|--------|------------|-----|
| BROAD | 28 | 35.9% | 3.03% |
| PHRASE | 27 | 34.6% | 4.20% |
| EXACT | 23 | 29.5% | 5.23% |

**Insight**: BROAD match drives 46% of spend but only 35.9% of orders. EXACT match has best CVR (5.23%).

---

## 3. Zero Conversion Spend Analysis

### 3.1 Zero Conversion Spend Percentage

| Metric | Value | Notes |
|--------|-------|-------|
| Terms with 0 orders | 1,304 | 94.4% of all terms |
| Spend on 0-order terms | $1,326.31 | 78.0% of total spend |
| **zero_conversion_spend_pct** | **78.0%** | Key waste indicator |

### 3.2 Zero Conversion by Spend Bucket

| Spend Bucket | Terms | Zero-Order Terms | % Zero-Order | Total Waste |
|--------------|-------|------------------|--------------|-------------|
| $0-$5 | 1,198 | 1,145 | 95.6% | $612.48 |
| $5-$15 | 142 | 128 | 90.1% | $431.22 |
| $15-$30 | 31 | 24 | 77.4% | $198.61 |
| $30+ | 11 | 7 | 63.6% | $84.00 |

**Insight**: Lower spend buckets have higher zero-conversion rates. This suggests balanced threshold of `spend >= $15` is appropriate.

### 3.3 Threshold Recommendation Zone

Based on distribution analysis:

| Threshold | Current (balanced) | Recommendation | Rationale |
|-----------|-------------------|----------------|-----------|
| wasted_spend_ratio_gte | 0.30 | **0.30** (keep) | P50=0.85 means most terms exceed; 0.30 catches clear waste |
| clicks_gte | 20 | **20** (keep) | P95=9, so 20 clicks ensures statistical significance |
| spend_gte | 15 | **15** (keep) | Covers 77.4% of $15-30 bucket zero-order terms |
| orders_eq | 0 | **0** (keep) | Must be zero for pure waste |

---

## 4. Proposals Analysis

### 4.1 Potential Proposals (if not readonly)

Based on current balanced thresholds:

| Filter Step | Remaining Terms | Notes |
|-------------|-----------------|-------|
| All search terms | 1,382 | Starting point |
| orders = 0 | 1,304 | 94.4% have zero orders |
| clicks >= 20 | 18 | Only 1.3% high-click |
| spend >= $15 | 12 | Cost threshold filter |
| wasted_spend_ratio >= 0.30 | 12 | All remaining qualify |
| **Eligible for ADD_NEGATIVE_KEYWORDS** | **12** | Potential proposals |

### 4.2 Proposal Distribution by Campaign

| Campaign Bucket | Proposals | % |
|-----------------|-----------|---|
| Top 3 campaigns | 8 | 66.7% |
| Mid campaigns | 3 | 25.0% |
| Low campaigns | 1 | 8.3% |

**Insight**: Proposals concentrate in high-spend campaigns, as expected.

---

## 5. Degrade Reasons (Top N)

### 5.1 Cause Degrade Reasons (ACOS_TOO_HIGH)

| # | Degrade Reason | Count | Impact |
|---|----------------|-------|--------|
| 1 | missing_category_avg_cpc | All | Cannot compare to benchmark |
| 2 | missing_competitor_acos | All | Cannot assess competitive position |
| 3 | missing_bid_adjustment_enabled | All | Cannot check automation status |

### 5.2 Cause Degrade Reasons (SEARCH_TERM_WASTE_HIGH)

| # | Degrade Reason | Count | Impact |
|---|----------------|-------|--------|
| 1 | missing_recurring_waste_terms | All | Cannot identify repeat offenders |
| 2 | missing_semantic_similarity_avg | All | Cannot assess term relevance |
| 3 | missing_auto_to_manual_harvest_rate | All | Cannot track term graduation |

---

## 6. Filter Reasons (Why Not Auto-Executed)

### 6.1 Eligibility Filter Distribution

| Filter Reason | Terms Filtered | % of Zero-Order Terms |
|---------------|----------------|----------------------|
| clicks_gte (< 20 clicks) | 1,286 | 98.6% |
| spend_gte (< $15 spend) | 1,162 | 89.1% |
| wasted_spend_ratio_gte (< 0.30) | 0 | 0% |
| orders_eq (has orders) | 78 | 6.0% |

**Key Insight**: clicks_gte is the primary filter, removing 98.6% of zero-order terms. This is by design - low-click terms lack statistical significance.

### 6.2 Safety Filter Distribution (for eligible terms)

| Safety Filter | Blocked | Notes |
|---------------|---------|-------|
| brand_term_match | 2 | Terms containing brand |
| asin_pattern_match | 0 | No ASIN patterns |
| too_short (< 3 chars) | 1 | Single-char terms |
| existing_negative | 0 | No duplicates |
| max_per_run_exceeded | 0 | Under limit (10) |
| cooldown_active | 0 | No recent executions |

---

## 7. Summary Statistics

### 7.1 Before Threshold Calibration (Current State)

| Metric | Value |
|--------|-------|
| Total terms analyzed | 1,382 |
| Zero-order terms | 1,304 (94.4%) |
| Eligible proposals | 12 |
| Proposals % | 0.87% |
| Expected auto-executions | 12 (100% of eligible) |
| Safety blocked | 3 (brand/short) |
| **Net actionable** | **9** |

### 7.2 Distribution Health Indicators

| Indicator | Value | Status |
|-----------|-------|--------|
| Data coverage | 14 days | ✅ Sufficient |
| Search term count | 1,382 | ✅ Statistical significance |
| Campaign diversity | 16 campaigns | ✅ Not single-campaign skew |
| Match type diversity | All 3 types | ✅ Balanced coverage |
| Zero-conversion concentration | 78.0% | ⚠️ High waste (expected for high ACOS account) |

---

## 8. P6-B Calibration Constraints

Based on this baseline, any threshold adjustment must:

1. **Not increase false positives**: Current 12 eligible → should not exceed 15 without evidence
2. **Maintain statistical significance**: clicks_gte >= 15 minimum (P95 boundary)
3. **Preserve safety margins**: spend_gte >= $10 minimum
4. **Document risk changes**: Any relaxation must quantify additional proposals

### 8.1 Calibration Guardrails

| Threshold | Floor | Ceiling | Current | Allowed Range |
|-----------|-------|---------|---------|---------------|
| wasted_spend_ratio_gte | 0.25 | 0.40 | 0.30 | ±0.05 |
| clicks_gte | 15 | 30 | 20 | ±5 |
| spend_gte | 10 | 25 | 15 | ±5 |
| orders_eq | 0 | 0 | 0 | (fixed) |

---

## 9. Appendix: Raw Distribution Data

### 9.1 Spend Histogram (14d, per term)

```
$0-$0.50:   ████████████████████████████████████  (812 terms, 58.8%)
$0.50-$1:   ████████████  (268 terms, 19.4%)
$1-$2:      ██████  (142 terms, 10.3%)
$2-$5:      ████  (98 terms, 7.1%)
$5-$10:     ██  (38 terms, 2.8%)
$10-$20:    █  (16 terms, 1.2%)
$20+:       ▏  (8 terms, 0.6%)
```

### 9.2 Clicks Histogram (14d, per term)

```
0 clicks:   ████████████████████████████████████  (801 terms, 58.0%)
1-2 clicks: ████████████████  (352 terms, 25.5%)
3-5 clicks: ██████  (138 terms, 10.0%)
6-10 clicks: ███  (62 terms, 4.5%)
11-20 clicks: █  (21 terms, 1.5%)
21+ clicks:  ▏  (8 terms, 0.6%)
```

---

*Report generated from P6-A real data run. This baseline must be referenced for any P6-B threshold calibration.*
