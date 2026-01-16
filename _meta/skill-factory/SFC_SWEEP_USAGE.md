# SFC Sweep Usage

**Purpose:** Batch scan repo skills (SKILL.md) and produce a Top-N "Skill Debt" list for prioritization.

## Run

From repo root:

```bash
node .claude/scripts/sfc_sweep.mjs --root . --limit 20 --out docs/reports/skill-factory/SFC_SWEEP_REPORT.md
```

## What it checks (heuristic, WARNING-only)

- SKILL.md exists
- YAML frontmatter exists
- Required keys present:
  - name, description, skeleton, triggers, inputs, outputs, failure_modes, verification
- skeleton value in:
  - workflow | task | reference | capabilities
- Line count <= 500 (warn if longer)
- verification has evidence_required/how_to_verify (best-effort)

## Output

- Markdown report: `docs/reports/skill-factory/SFC_SWEEP_REPORT.md`
- Console summary with Top N debt items

## How to fix debt

Start from Top 5:

1. Add YAML frontmatter
2. Add missing SFC keys
3. If too long, move sections to `references/`
4. Rerun sweep until debt list shrinks

## Non-goals

- This script does NOT block builds.
- This script does NOT mutate files.
