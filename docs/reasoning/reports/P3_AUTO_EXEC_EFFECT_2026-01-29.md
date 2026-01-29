# P3 Auto Execution Effectiveness Report

**Generated**: 2026-01-29T14:00:05.815Z
**Period**: 2026-01-29
**System Version**: reasoning-assets-p3

## Executive Summary

This report analyzes the P3 Safe Auto execution system's behavior during the launch drill.

## Execution Statistics

| Metric | Value |
|--------|-------|
| Total Proposals | 6 |
| Auto Executed | 0 |
| Dry Run | 0 |
| Suggest Only | 4 |
| Blocked | 2 |
| Success Rate | N/A (kill switch OFF) |

## Failure Reason Breakdown

| Reason | Count | % |
|--------|-------|---|
| Kill Switch OFF | 4 | 67% |
| Eligibility Failed | 1 | 17% |
| Safety Limit Exceeded | 1 | 17% |

## Missing Evidence Analysis

The following evidence fields were missing or unavailable, limiting full evaluation:

| Field | Missing Count | Impact |
|-------|---------------|--------|
| conversion_rate | 3 | Cannot assess ROI impact |
| impression_share | 2 | Cannot assess visibility tradeoff |

## Recommendations

1. **Data Collection Priority**: Implement `conversion_rate` tracking for ROI assessment
2. **Kill Switch Policy**: Define criteria for enabling auto execution in production
3. **Safety Margin Review**: Current limits (10/run, 20/day) may be conservative for high-volume campaigns

## Audit Trail

All executions during this period are traceable via:
- `trace_id`: Links to original reasoning request
- `rule_version`: Links to playbook version used
- `evidence_refs`: Links to evidence consumed

---

## P3.1 Patch Addendum (2026-01-29)

### DENY Status Statistics (Patch-1)

| Metric | Value |
|--------|-------|
| DENY_UNSUPPORTED_ACTION | 1 |
| OutcomeEvent for DENY | 1 (success=null) |

**Sample DENY Outcome**:
```
action_id: UNSUPPORTED_ACTION_XYZ
status: DENY_UNSUPPORTED_ACTION
outcome_event.success: null
outcome_event.notes: "Action denied: UNSUPPORTED_ACTION_XYZ not in whitelist [ADD_NEGATIVE_KEYWORDS]"
```

### Candidate Filtering Diagnostics (Patch-2)

| Filter Category | Count | Terms |
|-----------------|-------|-------|
| candidates_before | 6 | (input) |
| filtered_too_short | 1 | "ab" |
| filtered_brand_terms | 1 | "mybrand product" |
| filtered_asin_terms | 1 | "b08xyzabc1" |
| filtered_dedupe | 1 | "existing term" |
| final_candidates | 2 | (output) |

**filter_summary**: `Filtered: too_short=1, brand_terms=1, asin_terms=1, dedupe=1; Final: 2`

### Top "Why Not Executed" Reasons

| Reason | Count | % | Description |
|--------|-------|---|-------------|
| Kill Switch OFF | 4 | 50% | `auto_execution.enabled=false` |
| Eligibility Failed | 1 | 12.5% | Thresholds not met |
| Safety Limit Exceeded | 1 | 12.5% | max_per_run / daily_limit |
| DENY (Not Whitelisted) | 1 | 12.5% | Action not in allow_actions |
| Cooldown Active | 0 | 0% | per_campaign_hours not elapsed |
| BLOCKED (Brand/ASIN) | 1 | 12.5% | Forbidden term detected |

### Observability Improvements

1. **DENY vs SUGGEST_ONLY**: Non-whitelisted actions now return `DENY_UNSUPPORTED_ACTION` with auditable OutcomeEvent
2. **Filtering Breakdown**: Every candidate selection now explains what was filtered and why
3. **Zero-Candidate Explanation**: `filter_summary` field provides human-readable explanation

---
*Report updated by P3.1 Evaluator (Patch-1 + Patch-2)*
