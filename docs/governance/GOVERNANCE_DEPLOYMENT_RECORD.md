# Governance Deployment Record

> Purpose: a single-page audit trail for the public repository governance baseline.
> Scope: public repository only. Do NOT include any private repository names/URLs.

## Current baseline (What is enforced)
### Main branch protections
- PR required for merge
- At least 1 approval required
- Branch must be up to date before merge
- Required checks must pass
- Bypass is disallowed (when supported by the plan/UI)

### Required checks (snapshot)
- Enforce SSOT Rules (includes governance guards)
- gitleaks scan
- blocklist scan
- Block Amazon Asset Leakage

### Governance guards (executed in CI)
- Public Boundary Guard (validates PUBLIC_BOUNDARY structure)
- Runbook Migration Guard (domain-related changes must reference playbook)
- Governance Index Guard (prevents required governance index entries from being removed)

## Milestones
- Security gates established (secrets + blocklist + asset leak guard)
- Public replay regression established (skeleton-only fixtures, no private dependencies)
- Governance docs added (PUBLIC_BOUNDARY + migration playbook)
- Governance guards integrated into Architecture Hardening Gate
- Required checks configured on `main` and verified end-to-end

## Verification (Evidence)
- Verification PR: #43 (required checks enforcement proof)
- Result:
  - Required checks blocked merge until all checks passed
  - Enforce SSOT Rules job included the 3 governance guards
  - CI suite passed (all checks green) on non-destructive test PR
