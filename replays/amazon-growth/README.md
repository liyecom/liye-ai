# Amazon Growth OS — Replay & Regression

This directory contains deterministic replay cases for Amazon Growth OS.

## Rules

- Same input must produce the same decisions
- Any change in decisions requires:
  - Version bump
  - Updated expected output
  - Explicit documentation in PR description

**Silent behavior changes are forbidden.**

## Directory Structure

```
replays/amazon-growth/
├── cases/
│   ├── case-001.input.json     # Input data for case
│   ├── case-001.expected.json  # Expected decisions
│   └── ...
└── README.md
```

## Running Replay Tests

```bash
node scripts/replay_runner.js replays/amazon-growth/cases
```

## Comparison Rules

The replay runner only compares stable fields:
- `decision_id`
- `domain`
- `severity`
- `version`

It does NOT compare:
- `confidence` (may vary with model tuning)
- `timestamp` (non-deterministic)
- `evidence` (implementation detail)

## Adding New Cases

1. Create `case-XXX.input.json` with metrics and thresholds
2. Calculate expected decisions manually
3. Create `case-XXX.expected.json` with decision_id, domain, severity, version
4. Run replay tests to verify

## Updating Decisions

If decision behavior must change:

1. Bump the decision version (e.g., `v1.0` → `v1.1`)
2. Update all affected `expected.json` files
3. Document the behavior change in PR description
4. CI will fail until expected outputs match actual outputs

## CI Integration

The `domain-replay-gate.yml` workflow runs on every PR and push.
Any mismatch will block the merge.
