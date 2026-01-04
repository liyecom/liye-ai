# Internal Governance Notice (Public Repo)

This document is a lightweight announcement for collaborators and future maintainers.

## What changed
The public repository is now protected by branch rules + required CI checks to prevent:
- accidental disclosure of private/commercial assets
- governance documentation drift
- silent regressions in replay/verification behavior

## Rules of engagement (Main branch)
- Changes must go through a PR
- At least 1 approval is required
- Branch must be up-to-date before merge
- Required checks must pass (no bypass)

## If you modify governance/docs/domains
Expect additional guards to run in CI:
- Public Boundary Guard
- Runbook Migration Guard
- Governance Index Guard

If a guard fails, fix the referenced document rather than bypassing checks.

## Security expectations
- Never commit secrets/tokens/keys
- Never add private domain disclosures (names/URLs) to public docs
- Never reintroduce forbidden commercial assets into this public repository
