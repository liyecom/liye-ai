# github-scout — L1 Methodology

The **knowledge layer (Brain)** for GitHub prior-art reconnaissance. This directory
defines *what* the scout knows and *how* it should reason; the executable tool lives
separately at `tools/github-scout/` (Hands) and the Claude-facing instruction at
`.claude/skills/github-scout.md` (L3).

> Authorized by `_meta/adr/ADR-GitHub-Prior-Art-Scout.md` (blocking-first, Phase 0).

## Contents

| File | Role | Status |
|------|------|--------|
| `skill_definition.md` | the methodology: identity, license-gated inspect method, taxonomy, governance | Full |
| `license_policy.yaml` | **machine-readable SSOT**: license tier → inspect ceiling → allowed recommendation | Full · loaded at runtime by `scout.py` |
| `methods.md` | detailed procedures / playbooks | Stub (Phase 0 — filled as practice accrues) |
| `evolution_log.md` | learning log | Stub (no history yet) |
| `templates/report_output.example.json` | example of the advisory report shape | Reference |

## The one thing to know

`license_policy.yaml` is the **single source of truth** for the safety-critical
mapping. The prose in `skill_definition.md` is *about* it; `scout.py` *loads* it and
never hardcodes tiers; `test_scout.py` loads it live and fails on drift. Edit the
policy here — never in code (SKILL_CONSTITUTION §3, no reverse dependency).

## How it's used

```bash
python3 tools/github-scout/scout.py report --idea "your idea in a sentence"
```

Output is **advisory only**. Any reuse outcome enters the harvest-ADR / Reference
Declaration ceremony (SYSTEMS.md Fork 纪律).
