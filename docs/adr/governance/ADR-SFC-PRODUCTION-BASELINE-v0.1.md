# ADR-0006: Skill Factory Contract (SFC) Production Baseline v0.1

- decision_id: ADR-0006
- domain: governance
- status: accepted
- created: 2026-01-16
- tags: [sfc, governance, skills, baseline, skill-factory]
- owners: LiYe OS Governance
- scope: All SKILL.md in repo + external skills when mounted

## Context
LiYe OS skill ecosystem grew from multiple sources:
- external marketplace skills
- skill-forge generated skills
- internally generated skills

This caused inconsistent metadata and made governance impossible at scale.

## Decision
Adopt **Skill Factory Contract (SFC) v0.1** as the production contract for SKILL.md.

- SFC defines the minimum executable structure for skills (frontmatter required keys)
- Constitution remains hard rules; Policy remains overridable defaults
- SFC lint + sweep are the operational tools to enforce governance readiness

## Baseline Metrics
At baseline lock time:
- PASS: 17
- With Debt: 0
- Top Debt: none

## Tooling
- .claude/scripts/sfc_lint.mjs (warning-only)
- .claude/scripts/sfc_sweep.mjs (repo scan + report)
- .claude/scripts/sfc_patch_missing_keys.mjs (migration tool)

## Consequences
- New skills must ship with SFC frontmatter completeness
- Debt regression must be detectable via CI
- External skills are treated as dependencies (audited, locked, not migrated into repo)
