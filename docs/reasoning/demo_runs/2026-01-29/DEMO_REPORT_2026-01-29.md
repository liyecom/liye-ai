# Reasoning Demo Report

**Generated**: 2026-01-29T15:59:39.707Z
**Profile**: balanced
**Cases**: 12

---

## 1. What It Does

This demo showcases **controlled automation with full auditability**:
- Observations trigger causal explanations
- Explanations produce action proposals
- Proposals are validated against eligibility thresholds and safety limits
- Safe actions execute in dry-run mode (no real writes)
- Every decision is logged with an ActionOutcomeEvent

**Value**: Reduce wasted ad spend automatically while maintaining human oversight and rollback capability.

---

## 2. Inputs

| Parameter | Value |
|-----------|-------|
| Profile | balanced |
| Cases Run | 12 |
| Fixture Source | `tests/fixtures/reasoning/p4/calibration_samples.json` |

### Threshold Configuration (balanced)

| Threshold | Value |
|-----------|-------|
| wasted_spend_ratio_gte | 0.3 |
| clicks_gte | 20 |
| orders_eq | 0 |
| spend_gte | 15 |

---

## 3. Results Table

| Case ID | Expected | Status | Why Not Executed | Before | Final | Rollback | Outcome |
|---------|----------|--------|------------------|--------|-------|----------|---------|
| A1_boundary_eligible | A | 🟢 DRY_RUN | - | 3 | 3 | ✅ | ✅ |
| A2_high_waste | A | 🟢 DRY_RUN | - | 5 | 5 | ✅ | ✅ |
| A3_max_keywords | A | 🟢 DRY_RUN | - | 10 | 10 | ✅ | ✅ |
| A4_cooldown_not_triggered | A | 🟢 DRY_RUN | - | 2 | 2 | ✅ | ✅ |
| B1_spend_below | B | 🟡 SUGGEST_ONLY | Eligibility failed: Threshold not met: spend gte 15 (actual: 10) | 2 | 2 | ❌ | ❌ |
| B2_clicks_below | B | 🟡 SUGGEST_ONLY | Eligibility failed: Threshold not met: clicks gte 20 (actual: 10) | 1 | 1 | ❌ | ❌ |
| B3_has_orders | B | 🟡 SUGGEST_ONLY | Eligibility failed: Threshold not met: orders eq 0 (actual: 2) | 2 | 2 | ❌ | ❌ |
| B4_waste_ratio_below | B | 🟡 SUGGEST_ONLY | Eligibility failed: Threshold not met: wasted_spend_ratio gte 0.3 (actual: 0.2) | 1 | 1 | ❌ | ❌ |
| C1_exceeds_max_keywords | C | ⚪ BLOCKED | Safety violation: Exceeds max_negatives_per_run: 15 > 10 | 15 | 15 | ❌ | ❌ |
| C2_cooldown_active | C | ⚪ BLOCKED | Kill switch disabled | 2 | 2 | ❌ | ❌ |
| C3_all_filtered | C | ⚪ BLOCKED | Safety violation: Term too short: "ab" (min: 3), Brand term detected: "mybrand product", ASIN-like term detected: "B08XYZABC1" | 3 | 0 | ❌ | ❌ |
| C4_non_whitelisted | C | 🔴 DENY_UNSUPPORTED_ACTION | Action not in whitelist | 0 | 0 | ❌ | ✅ |

### Summary by Status

| Status | Count |
|--------|-------|
| DRY_RUN (would auto-execute) | 4 |
| SUGGEST_ONLY (human review) | 4 |
| BLOCKED (safety limit) | 3 |
| DENY (not whitelisted) | 1 |

---

## 4. Deep Dives

### 4.1 Auto/Dry-Run Example: A1_boundary_eligible

**Scenario**: Boundary values - just meets thresholds

**Flow**:
1. **Observation**: `SEARCH_TERM_WASTE_HIGH`
2. **Eligibility Check**: ✅ PASSED
   - Profile: balanced
   
3. **Safety Check**: ✅ PASSED
   
4. **Execution**: `DRY_RUN`
5. **Rollback Payload**: Present (can undo)

**ActionOutcomeEvent**:
```json
{
  "event_id": "aoe_40042d2a",
  "trace_id": "trace-p4-A1",
  "observation_id": "SEARCH_TERM_WASTE_HIGH",
  "action_id": "ADD_NEGATIVE_KEYWORDS",
  "timestamp": "2026-01-29T15:59:39.670Z",
  "success": true,
  "evaluator": "auto",
  "cause_id": "DEMO_CAUSE",
  "actual_outcome": "Action completed",
  "notes": "[DRY RUN] Dry run - simulated success",
  "execution_mode": "dry_run",
  "rule_version": "SEARCH_TERM_WASTE_HIGH.yaml@v0.2",
  "params_summary": {
    "action_id": "ADD_NEGATIVE_KEYWORDS",
    "items_count": 3
  }
}
```

### 4.2 Degrade/Deny Example: B1_spend_below

**Scenario**: Spend below threshold

**Flow**:
1. **Observation**: `SEARCH_TERM_WASTE_HIGH`
2. **Eligibility Check**: ❌ FAILED
   - Profile: balanced
   - Reasons: Threshold not met: spend gte 15 (actual: 10)
3. **Safety Check**: ✅ PASSED
   
4. **Final Status**: `SUGGEST_ONLY`
5. **Why Not Executed**: Eligibility failed: Threshold not met: spend gte 15 (actual: 10)

**Decision Trace**:
- The system correctly identified this case should NOT auto-execute
- Human review is required before taking action
- This prevents false positives and maintains safety

---

## 5. Safety Proof

### ZERO WRITES Guarantee

| Check | Status |
|-------|--------|
| `force_dry_run` | `true` ✅ |
| `writes_attempted` | `0` |
| `writes_blocked_by` | `force_dry_run` |

**Technical Implementation**:
- `FORCE_DRY_RUN = true` is hardcoded in the demo runner
- This cannot be overridden by CLI arguments or environment variables
- Even if the kill switch is enabled, the demo will NOT perform real writes
- All executions produce `DRY_RUN` status instead of `AUTO_EXECUTED`

**Audit Trail**:
- Every execution produces an ActionOutcomeEvent
- Events include trace_id, proposal_id, status, and timestamp
- Rollback payloads are preserved for potential undo operations

---

## 6. Next Steps

### Before Production Deployment

| Requirement | Status | Notes |
|-------------|--------|-------|
| 12+ synthetic samples validated | ✅ | P4 calibration complete |
| Threshold profiles calibrated | ✅ | balanced recommended |
| Kill switch tested | ✅ | P3 drill verified |
| Rollback mechanism tested | ⏳ | Ready for E2E testing |
| Real customer pilot | ⏳ | Select 1-2 low-risk accounts |
| 14-day outcome monitoring | ⏳ | After pilot |

### Expansion Criteria

Before enabling auto-execution for a new customer:
1. Account has >= 30 days of historical data
2. Account has >= $500/month ad spend
3. Customer has acknowledged automation terms
4. Kill switch is tested and operational
5. Rollback procedure is documented and tested

---

## Appendix: Evaluator Report

See linked report: `EVALUATOR_REPORT_2026-01-29.md`

---

*Generated by P5-A Demo Runner v0.1*
*ZERO WRITES GUARANTEED*
