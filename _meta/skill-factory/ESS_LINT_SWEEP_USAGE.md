# ESS Lint / Sweep (v0.1) Usage

## Lint (structure checks, warning-only)
```bash
node .claude/scripts/ess_lint.mjs
```

## Sweep (top debt report)
```bash
node .claude/scripts/ess_sweep.mjs --top 20
```

## Notes

- This is **warning-only**. It is designed to observe and report, not to block production.
- Current ESS Runner supports `execution.type=script` only.
