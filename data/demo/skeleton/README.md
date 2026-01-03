# Skeleton Demo Domain

This is a minimal demo domain for public replay regression testing.

## Purpose

- Provides a non-sensitive, synthetic test case for CI validation
- Demonstrates the replay contract format without real business logic
- Serves as a template for new domain implementations

## Files

- `replay_input.json` - Fixed seed input for deterministic testing
- `baseline/replay_output.json` - Expected output (golden baseline)

## Contract

The replay runner executes with fixed input and compares against baseline:
- Same input (seed 42) must produce same decisions
- Comparison focuses on stable fields: decision_id, domain, severity, action
- Non-deterministic fields (timestamp, confidence) are excluded

## Usage

```bash
node tools/replay_public_regression.mjs \
  --input data/demo/skeleton/replay_input.json \
  --baseline data/demo/skeleton/baseline/replay_output.json
```

## Version

- 1.0.0: Initial skeleton for public replay gate
