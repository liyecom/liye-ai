# ADR-0007: GitHub Multi-Account Identity Governance

- decision_id: ADR-0007
- domain: governance
- status: accepted
- created: 2026-02-03
- tags: [github, identity, multi-account, governance, audit]
- owners: LiYe OS Governance
- scope: All GitHub operations across loudmirror and liyecom accounts

## Context

LiYe OS ecosystem operates across two distinct GitHub identities:

| Identity | GitHub Account | Repos | Purpose |
|----------|----------------|-------|---------|
| **Operator/Builder** | `loudmirror` | AGE (private) | Operational tooling |
| **Legal Entity / Product Hub** | `liyecom` | liye-ai (liye_os) | Core platform, governance, IP ownership |

### Problem Discovered

On 2026-02-03, a governance audit revealed:

- **liye_os PRs #84-#93** were created with author `loudmirror` instead of `liyecom`
- **Root Cause**: `gh` CLI active account was set to `loudmirror` when creating PRs in liye_os repo
- **Impact**: Author attribution in GitHub UI shows incorrect identity

### Immutable Constraints

1. **GitHub does not allow modifying PR author after creation**
2. **Rebasing/force-pushing to rewrite history is prohibited** (destroys audit trail)
3. **All code and decisions belong to LiYe OS regardless of author display anomaly**

## Decision

### 1. Accept Historical State (No Rewrite)

PRs #84-#93 in `liyecom/liye-ai` will retain `loudmirror` as displayed author.

**Rationale**:
- Historical integrity > cosmetic correctness
- Legal ownership is determined by repo ownership, not commit author
- Rewriting history would destroy audit trail

### 2. Enforce Future Compliance via Tooling

**Git Identity (repo-scoped)**:
```bash
# liye_os
git config user.name "liyecom"
git config user.email "liyecom@users.noreply.github.com"

# AGE (private repo)
git config user.name "loudmirror"
git config user.email "loudmirror@gmail.com"
```

**gh CLI Aliases (fail-closed)**:
```bash
alias gh-liye='gh auth switch --user liyecom && gh'
alias gh-age='gh auth switch --user loudmirror && gh'
```

### 3. Governance Rule

| Repo | Allowed gh Command | Blocked |
|------|-------------------|---------|
| liye_os | `gh-liye pr create` | `gh pr create` (without switch) |
| AGE (private) | `gh-age pr create` | `gh pr create` (without switch) |

## Consequences

### Positive

- Clear organizational boundary between operator (AGE) and platform (LiYe OS)
- Tooling enforces compliance at creation time
- Audit trail preserved

### Negative

- Historical PRs show incorrect author (accepted as technical debt)
- Requires manual discipline when creating PRs

### Neutral

- This ADR serves as authoritative record for any future audit questions

## Compliance Verification

From **PR #94 onwards** in `liyecom/liye-ai`:
- All PRs MUST show author = `liyecom`
- Any violation indicates tooling bypass and requires investigation

## Declaration

> All code, decisions, and intellectual property in `liyecom/liye-ai` belong to LiYe OS,
> regardless of author display anomalies in PRs #84-#93.
> This ADR is the authoritative governance record.

**Affected PRs (Historical - Accepted)**:
- liyecom/liye-ai #84 through #93 (author displayed as `loudmirror`)

**Clean Slate Begins**:
- liyecom/liye-ai #94+ (author MUST be `liyecom`)
