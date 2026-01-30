# Reasoning System Documentation

This directory contains documentation and artifacts for the LiYe OS Reasoning System.

## Directory Structure

```
docs/reasoning/
├── README.md              # This file
├── reports/               # Calibration and evaluation reports
│   └── P4_AUTO_ELIGIBILITY_CALIBRATION_*.md
└── demo_runs/             # Demo execution outputs
    └── 2026-01-29/        # Official example (committed)
```

## Demo Usage Guidelines

### Important Safety Notice

**The demo is dry-run only and will NOT write to any advertising accounts.**

| Aspect | Guarantee |
|--------|-----------|
| `force_dry_run` | `true` (hardcoded, cannot be overridden) |
| `writes_attempted` | `0` (verified by tests and CI) |
| Real API calls | None - all data is synthetic |

### Running the Demo

```bash
# Default run (balanced profile, all 12 cases)
pnpm demo:reasoning

# With specific profile
pnpm demo:reasoning --profile=conservative
pnpm demo:reasoning --profile=aggressive

# With specific cases
pnpm demo:reasoning --cases=A1_boundary_eligible,B1_spend_below
```

### Demo Data Source

All demo data comes from **synthetic samples** in:
```
tests/fixtures/reasoning/p4/calibration_samples.json
```

These samples are designed to exercise all code paths:
- **Group A** (4 cases): Should auto-execute (DRY_RUN in demo)
- **Group B** (4 cases): Should degrade to SUGGEST_ONLY
- **Group C** (4 cases): Should block/deny

### Real Account Testing

If you need to test with real advertising accounts, you must follow the proper process:

| Phase | Description | Approval Required |
|-------|-------------|-------------------|
| P5-B | Sandbox Environment | Engineering Lead |
| P6 | Production Pilot | Customer + Legal |

**Never run the demo system against real customer accounts without going through the proper approval process.**

### CI Integration

The demo can be triggered in CI via:
- Manual trigger: `.github/workflows/reasoning-demo.yml`
- PR label: Add `demo` label to any PR

CI artifacts are uploaded and retained for 30 days.

## Related Documentation

- [Ontology Gap Diagnosis Plan](../plans/2026-01-25-ontology-gap-diagnosis.md)
- [ADD_NEGATIVE_KEYWORDS Playbook](../contracts/reasoning/amazon-growth/actions/ADD_NEGATIVE_KEYWORDS.yaml)
- [Execution Flags](../contracts/reasoning/execution_flags.yaml)
