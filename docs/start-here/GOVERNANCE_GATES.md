# Governance Gates

> **Purpose**: CI enforcement layer that makes stability contracts machine-enforceable.

---

## Why Gates, Not Just Docs

Documentation can be ignored. Gates cannot.

LiYe OS uses GitHub Actions workflows to enforce:
- Architecture constraints (no unauthorized changes to frozen paths)
- Constitution compliance (governance rules are respected)
- Breaking change detection (stability contract violations block merge)

---

## Browse the Gates

**Location**: [`.github/workflows/`](../../.github/workflows/)

Key workflow patterns:
- `*-gate.yml` — Enforcement workflows (Frozen tier)
- `ci-*.yml` — Standard CI workflows (Stable tier)

---

## Gate Types

| Gate | Purpose | Enforcement |
|------|---------|-------------|
| `architecture-gate.yml` | Protect frozen paths | Block PRs that modify frozen components |
| `constitution-*-gate.yml` | Enforce governance rules | Validate against constitution |
| `sfc-ci.yml` | Skill Factory compliance | Lint + sweep for skill specs |

---

## If You're Copying This

1. Copy the workflow files to your `.github/workflows/`
2. Adjust the path patterns to match your frozen/stable boundaries
3. Update the constitution references to point to your docs

The pattern matters more than the specifics.

---

## Next Steps

- [Architecture Contract](./ARCHITECTURE_CONTRACT.md) — What the gates protect
- [Blueprint Map](./BLUEPRINT_MAP.md) — Directory structure context
- [Back to README](../../README.md)
