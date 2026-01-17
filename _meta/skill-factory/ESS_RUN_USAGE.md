# ESS Runner (v0.1) Usage

This is a script-only MVP: **ESS → script execution → report + trace**.

## Run SFC Sweep via ESS

```bash
node .claude/scripts/ess_run.mjs liye-os:sfc-sweep --root .
```

## Run SFC Lint via ESS

```bash
node .claude/scripts/ess_run.mjs liye-os:sfc-lint --skill_dir Skills/00_Core_Utilities/meta/skill-creator
```

## Where outputs go

- **Report**: `docs/reports/ess/.../*.md`
- **Trace**: `traces/ESS-TRACE-*.yaml`

This aligns with Constitution rule: **Evidence Before Claims**.
