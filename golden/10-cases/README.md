# Golden Test Cases v1

10 reference cases for Governance Kernel v1 validation.

## Running Cases

```bash
# Run all cases
node .claude/scripts/run_golden_all.mjs

# Run single case
node .claude/scripts/run_golden_case.mjs golden/10-cases/01_allow_happy_path
```

## Case Summary

| ID | Case | Gate | Enforce | Capability |
|----|------|------|---------|------------|
| 01 | allow_happy_path | ALLOW | ALLOW | Safe read-only operations |
| 02 | unknown_no_actions | UNKNOWN | ALLOW | Missing proposed_actions |
| 03 | block_dangerous_delete | DEGRADE | ALLOW | Dangerous delete pattern |
| 04 | block_overwrite_file | DEGRADE | ALLOW | Dangerous overwrite pattern |
| 05 | degrade_external_tool | UNKNOWN | ALLOW | External tool without evidence |
| 06 | contract_deny_write_path | ALLOW | BLOCK | Contract DENY rule |
| 07 | contract_allow_specific_tool | ALLOW | ALLOW | Contract ALLOW rule |
| 08 | require_evidence_then_unknown | ALLOW | UNKNOWN | Contract REQUIRE_EVIDENCE |
| 09 | inconsistent_plan | DEGRADE | ALLOW | Delete + Update conflict |
| 10 | block_high_risk_send_email | UNKNOWN | ALLOW | Send email risk |

## Capability Coverage

| Capability | Cases |
|------------|-------|
| Gate ALLOW | 01, 06, 07, 08 |
| Gate DEGRADE | 03, 04, 09 |
| Gate UNKNOWN | 02, 05, 10 |
| Contract DENY | 06 |
| Contract ALLOW | 07 |
| Contract REQUIRE_EVIDENCE | 08 |
| Dangerous action detection | 03, 04, 09, 10 |
| Missing evidence | 05, 08 |

## Evidence Pack Structure

Each case generates:

```
output/latest/
├── events.ndjson   # Hash-chained audit events
├── verdict.json    # Machine-readable verdict
├── verdict.md      # Human-readable verdict
├── replay.json     # Replay verification result
└── diff.json       # Drift detection
```

## Assertion Format

Each case has `expected.json`:

```json
{
  "gate": {
    "decision": "ALLOW|BLOCK|DEGRADE|UNKNOWN"
  },
  "enforce": {
    "decision_summary": "ALLOW|BLOCK|DEGRADE|UNKNOWN",
    "blocked_rule_ids": ["rule-id-if-blocked"]
  }
}
```

## Adding New Cases

1. Create directory: `golden/10-cases/<id>_<slug>/`
2. Add `input.json` (task + context + proposed_actions)
3. Add `contract.json` (optional)
4. Add `expected.json` (gate + enforce assertions)
5. Run: `node .claude/scripts/run_golden_case.mjs <case_dir>`
