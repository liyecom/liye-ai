# Audit Regression Gate

> **Purpose**: Automated CI enforcement for multi-domain memory governance
> **Policy Reference**: `docs/architecture/DOMAIN_CONFLICT_POLICY.md`

---

## Overview

The Audit Regression Gate is a CI workflow that automatically runs domain governance verification scripts on every PR and push to `main`. It ensures that changes to glossaries, domain mappings, and memory scripts don't break the multi-domain governance rules established in D1-D3.

---

## Triggers

| Event | Condition | Behavior |
|-------|-----------|----------|
| `pull_request` | Target: `main`, `release/*` | Runs on relevant path changes |
| `push` | Branch: `main` | Always runs (steady-state check) |
| `workflow_dispatch` | Manual | Run all audits regardless of paths |

### Path Filters (PR only)

The gate runs when these paths change:
- `knowledge/glossary/**` - Glossary definitions
- `.claude/config/domain-mapping.yaml` - Domain routing
- `.claude/scripts/memory_*.mjs` - MaaP scripts
- `tools/audit/**` - Audit scripts themselves
- `docs/architecture/DOMAIN_CONFLICT_POLICY.md` - Conflict policy
- `docs/architecture/MEMORY_*.md` - Memory governance docs

---

## Audit Tests

### D1: Geo-SEO Domain Verification

**Script**: `tools/audit/verify_geo_seo_domain.sh`

Validates:
- Geo-SEO glossary exists with ≥25 terms
- Domain mapping configured correctly
- Domain detection works for geo-seo queries
- Memory brief generated with correct content
- Memory diff generated

### D2: Multi-Domain Boundary Verification

**Script**: `tools/audit/verify_multidomain_boundary.sh`

Validates:
- Cross-domain queries route correctly
- Negative keywords exclude domains
- Citation format matches Output Contract
- Conflict policy enforced

### D3: Ambiguity Mode Verification

**Script**: `tools/audit/verify_multidomain_ambiguity.sh`

Validates:
- `conf_diff < 0.10` triggers Ambiguity Mode
- Domain Ambiguity Note generated
- Cross-domain citations use `source_domain` annotation

---

## Local Reproduction

Run the same checks locally before pushing:

```bash
# All three in sequence
bash tools/audit/verify_geo_seo_domain.sh
bash tools/audit/verify_multidomain_boundary.sh
bash tools/audit/verify_multidomain_ambiguity.sh
```

Or run individually:

```bash
# D1 only
bash tools/audit/verify_geo_seo_domain.sh

# D2 only
bash tools/audit/verify_multidomain_boundary.sh

# D3 only
bash tools/audit/verify_multidomain_ambiguity.sh
```

---

## Artifacts

The CI workflow uploads these artifacts for debugging:

| Artifact | Contents | Retention |
|----------|----------|-----------|
| `audit-logs` | D1/D2/D3 script stdout/stderr | 14 days |
| `audit-reports` | `docs/reports/*.md` | 14 days |
| `memory-diffs` | `memory/diff/*.md` | 14 days |

---

## Gate Behavior

### Pass Conditions

All three audit scripts must pass:
- No `FAIL` or `✗` markers in logs
- Exit code 0 from each script

### Failure Behavior

If any audit fails:
1. Gate blocks PR merge
2. Summary shows which test failed
3. Artifacts uploaded for debugging
4. Local reproduction commands provided

---

## Relationship to Other Gates

| Gate | Purpose | Scope |
|------|---------|-------|
| `memory-governance-gate` | Version bumps, docs updates | Glossary changes |
| `audit-regression-gate` | Runtime behavior verification | D2/D3 regressions |
| `architecture-gate` | Constitution compliance | Structural changes |

Both `memory-governance-gate` and `audit-regression-gate` must pass for PR merge.

---

## Troubleshooting

### "Node not found"

The workflow uses `actions/setup-node@v4` with Node 20. If scripts fail on node:

```bash
# Check local node version
node --version  # Should be 18+
```

### "Script not executable"

The workflow runs `chmod +x tools/audit/*.sh`. If running locally:

```bash
chmod +x tools/audit/*.sh
```

### "Domain detection wrong"

Check domain-mapping.yaml keywords match your query terms:

```bash
cat .claude/config/domain-mapping.yaml | grep -A20 "id: geo-seo"
```

---

**Version**: 1.0
**Created**: 2026-01-01
**Author**: Claude + LiYe
