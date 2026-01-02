# GEO OS — Replay & Regression Gate

This directory contains deterministic test cases for the GEO OS decision pipeline.

## Purpose

Ensure decision behavior is:
- Deterministic: same input → same decision
- Auditable: all changes require version bumps
- Governed: no silent behavior changes

## Directory Structure

```
replays/geo-os/
├── README.md
└── cases/
    ├── case-001.input.json
    ├── case-001.expected.json
    ├── case-002.input.json
    └── case-002.expected.json
```

## Running Tests

```bash
node tools/geo_os_replay_runner.js replays/geo-os/cases
```

## CI Integration

The `domain-replay-gate.yml` workflow runs these tests on every PR.
Failures block merge.

## Updating Decisions

If you need to change decision behavior:

1. **Update the Agent code** (signal, rule, or verdict)
2. **Bump the version** in the Decision Contract
3. **Update expected outputs** with new behavior
4. **Document the change** in an ADR

❌ Silent behavior changes are not allowed.
