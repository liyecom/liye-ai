# GitHub Prior-Art Scout

Advisory skill for checking **prior art on GitHub** before building a new capability.
Invokes the read-only Hands tool `tools/github-scout/scout.py` and interprets its
report under LiYe governance.

> ⚠️ **Discoverability**: this is a flat, **manually-loaded** advisory doc (like
> `liye-agent.md`). It is NOT auto-discovered — `.claude/skills/index.yaml` sweeps
> `Skills/` (capital) only. Load it on demand.
>
> ⚠️ **Authority**: the method and the license rules are NOT defined here. They live
> in the L1 methodology (SKILL_CONSTITUTION §3 — no reverse dependency). This file
> only tells Claude *when* and *how* to invoke, and points to L1.

## Siblings & boundary (prior-art has three steps — don't confuse them)

| Step |载体 | Form | 干什么 |
|------|------|------|--------|
| **DISCOVER** unknown repos | **this** (`tools/github-scout/` + this L3) | Tool | 给 idea → 搜候选 + license 卡关（advisory） |
| **RESEARCH** a known repo | [`github-digest`](../../Skills/01_Research_Intelligence/prior-art/github-digest/) | Skill | 给一个**已知** repo → 读懂 → 判断对 LiYe 进化有没有用（verdict） |
| **INGEST** a chosen repo | `tools/source-intake/` | Tool | 确定要拉进来 → pin + 审计 → 治理 artifact |

Use **this** only to *find* candidates. If the user already has a specific repo URL and asks
"研究一下它 / 对 LiYe 有没有帮助", that is **`github-digest`**, not scout. Placement rationale
(Tool vs Skill, platform vs domain): `_meta/governance/SKILL_PLACEMENT.md`.

## When to Use

- The user floats a new capability/idea and asks "has someone built this?" / "should
  we fork or reimplement?" / "search GitHub for prior art."
- Before a harvest-ADR / Reference Declaration, to assemble candidates.

## Read First (L1 — the actual method, the SSOT)

- `docs/methodology/01_Research_Intelligence/github-scout/skill_definition.md` — identity, the license-gated inspect method, the 4-leaf taxonomy, governance hooks.
- `docs/methodology/01_Research_Intelligence/github-scout/license_policy.yaml` — the machine-readable tier → ceiling → recommendation SSOT.
- `_meta/adr/ADR-GitHub-Prior-Art-Scout.md` — the authorizing ADR and invariants I1–I3.

## How to Invoke

```bash
# from repo root — unauthenticated public read by default
python3 tools/github-scout/scout.py report --idea "the idea in one sentence" --json
```

- Phrase the idea with **2–3 strong nouns** (GitHub search ANDs terms).
- Read the report's `notices` first (weak query / empty recall are flagged).
- `report` is the only Phase 0 subcommand; others exit 3.

## How to Read the Result (do not over-claim)

- The report is **advisory**. Never present it as a decision.
- `needs-human-review` means **the human decides** — scout never concludes semantic
  behavior-fit. Surface the candidate, its license tier, and the sub_reason; ask.
- `skip` on `unknown` / `strong_copyleft` is **fail-closed and correct** — do not
  propose reading or vendoring that source.
- Always relay the `recall_notice` and that transitive licenses are unscanned.

## Hard Boundaries (never do these on the user's behalf from a scout result)

- No fork / clone / vendor / PR / Codebase-Registry write — surface, don't act.
- Any reuse outcome goes through the harvest-ADR / Reference Declaration ceremony
  (SYSTEMS.md Fork 纪律). A `reference-only` result = a read-only reference satellite,
  not a runtime dependency.
