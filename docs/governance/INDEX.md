# Governance Index

> LiYe OS Governance Structure and Classification

## Classification Legend

| Type | Meaning | Modification Policy |
|------|---------|---------------------|
| **IMMUTABLE** | Core governance controls | Requires governance-team + admin override |
| **REQUIRED** | Must exist for repo compliance | PRs blocked if missing or broken |
| **REFERENCE** | Documentation and guides | Normal PR process |

---

## Governance Files

### IMMUTABLE (Core Controls)

These files form the governance baseline. Changes require explicit governance-team approval.

| File | Purpose | Protected By |
|------|---------|--------------|
| `.github/CODEOWNERS` | Define code ownership and required reviewers | Branch Protection |
| `.github/workflows/architecture-gate.yml` | Enforce architectural boundaries | CODEOWNERS |
| `.github/workflows/constitution-bmad-boundary-gate.yml` | Prevent BMAD leakage into runtime | CODEOWNERS |
| `.github/workflows/layer-dependency-gate.yml` | Enforce layer dependencies | CODEOWNERS |
| `.github/workflows/constitution-external-tools-gate.yml` | Control external tool usage | CODEOWNERS |

### REQUIRED (Compliance Gates)

These files must exist and pass for repository compliance.

| File | Purpose | Enforcement |
|------|---------|-------------|
| `.github/workflows/ci.yml` | Core CI pipeline | Required status check |
| `.github/workflows/governance-file-change-gate.yml` | Notify on governance changes | CODEOWNERS |
| `.github/workflows/governance-audit.yml` | Weekly audit report | Scheduled |
| `.github/workflows/pr-rate-limiter-gate.yml` | PR velocity monitoring | Observation only |
| `CLAUDE.md` | AI assistant instructions | CODEOWNERS |

### REFERENCE (Documentation)

These files provide guidance but do not enforce policy.

| File | Purpose |
|------|---------|
| `docs/governance/INDEX.md` | This file - governance structure overview |
| `docs/governance/PUBLIC_BOUNDARY.md` | Public boundary policy - what is/isn't in public repo |
| `docs/governance/ALIAS_KEYWORDS_REPORT.md` | Keyword alias audit |
| `docs/governance/PREFIX_DEBT_REPORT.md` | Prefix debt tracking |
| `docs/governance/REDIRECT_AUDIT.md` | Redirect usage audit |
| `docs/runbook/DOMAIN_MIGRATION_PLAYBOOK.md` | Domain migration SOP for private extraction |
| `docs/architecture/*.md` | Architecture decision records |

---

## Governance Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **P0** | Hard locks (Branch Protection, CODEOWNERS, Gates) | BASELINE LOCKED |
| **P1** | Observability & Audit | In Progress |
| **P2** | Governance Automation | Planned |
| **P3** | Runtime Policy Enforcement | Planned |

---

## Branch Protection Rules

The `main` branch has the following protections:

- Require pull request before merging
- Require 1 approving review
- Require status checks to pass
- Require branches to be up to date
- Do not allow bypassing the above settings

---

## CODEOWNERS Structure

```
.github/workflows/**   @liyecom/governance-team
.github/CODEOWNERS     @liyecom/governance-team
docs/governance/**     @liyecom/governance-team
docs/architecture/**   @liyecom/governance-team
CLAUDE.md              @liyecom/governance-team
```

---

## Repo Template Checklist

When creating a new repository from this template:

1. [ ] Copy `.github/CODEOWNERS`
2. [ ] Copy all `.github/workflows/*.yml`
3. [ ] Configure Branch Protection on `main`
4. [ ] Create `@org/governance-team` team
5. [ ] Run `governance-audit.yml` to verify setup
6. [ ] Copy `docs/governance/INDEX.md`

---

## Version

- **Governance Baseline**: P0 (2026-01-01)
- **Current Phase**: P1 (Observability)
- **Last Updated**: 2026-01-01
