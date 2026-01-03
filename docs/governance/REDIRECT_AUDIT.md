# Redirect Usage Audit
> Generated: 2026-01-01T08:18:34.968Z
> Source: state/memory/id_redirects.yaml

## Summary
- Redirect entries: **7**
- Purpose: detect remaining legacy concept_id references in repo

## SSOT-Field Legacy References (high-signal)
- Remaining IDs with SSOT-field hits: **3** / 7

| legacy_id | mapped_to | hit_count |
|---|---:|---:|
| acos | AMZ_ACOS | 2 |
| acoas | AMZ_ACOAS | 2 |
| cvr | AMZ_CVR | 1 |

### acos → AMZ_ACOS (hits=2)
Samples (top 20):

- ./docs/architecture/MEMORY_GOVERNANCE.md:100:  - concept_id: acos
- ./.claude/skills/memory/correction-detector.md:45:concept_id: acos

### acoas → AMZ_ACOAS (hits=2)
Samples (top 20):

- ./docs/governance/REDIRECT_AUDIT.md:48:- ./.claude/skills/memory/glossary-drift-detector.md:103:      - concept_id: acoas
- ./.claude/skills/memory/glossary-drift-detector.md:103:      - concept_id: acoas

### cvr → AMZ_CVR (hits=1)
Samples (top 20):

- ./docs/governance/REDIRECT_AUDIT.md:34:- ./knowledge/glossary/geo-seo.yaml:651:  - concept_id: cvr

## Token Occurrences in SSOT Docs (low-signal)
These may include variable names, prose, or routing keywords. They do NOT imply concept_id misuse.

| legacy_id | mapped_to | token_hits |
|---|---:|---:|
| cvr | AMZ_CVR | 26 |
| acos | AMZ_ACOS | 19 |
| ctr | AMZ_CTR | 14 |
| acoas | AMZ_ACOAS | 13 |
| asoas | AMZ_ASOAS | 8 |
| roas | AMZ_ROAS | 3 |
| cpc | AMZ_CPC | 0 |
