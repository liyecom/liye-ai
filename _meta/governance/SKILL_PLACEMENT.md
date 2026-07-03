# LiYe OS · Skill & Tool Placement Policy

**Status:** Active (Policy tier — overridable with justification, not frozen)
**Effective:** 2026-07-03
**Enforcement:** WARNING (advisory). This is a **Policy**, not the frozen Constitution.
See `SKILL_CONSTITUTION_v0.1.md` for the tier model (Constitution = HARD BLOCK, Policy = WARNING).
**Namespace SSOT:** `.claude/skills/index.yaml` (the machine-readable registry) is authoritative
for namespace → root → discovery. This doc is the human-readable *why* and the decision tree.

---

## One-line rule

> 可执行确定性核进 `tools/`；Claude 工作流进 `Skills/`（跨域）或域 repo `.claude/skills/`（域专属）；
> 跨域归 liye_os，域专属归域 repo；外部第三方只读归 `~/.claude/skills`。

Everything below just makes that rule unambiguous.

---

## Why this exists

Two **orthogonal** axes were being conflated, which made placements *look* inconsistent when
they were actually correct:

- **Axis A — FORM**: is it a *Tool* (deterministic executable) or a *Skill* (Claude workflow)?
- **Axis B — SCOPE**: is it *platform / cross-domain* or *domain-specific* or *external*?

`github-scout` (Tool) and `github-digest` (Skill) sit in different places **because they are
different forms**, not because placement is ad-hoc. This policy pins both axes down.

---

## Axis A — FORM: Tool vs Skill

| | **Hands Tool** | **Skill** |
|---|---|---|
| Litmus | Has a **deterministic executable core** — `.py`/`.mjs` that hits an API, runs a state machine, parses/computes | A **knowledge / workflow / judgment recipe** with no deterministic core (may *orchestrate* tools/subagents) |
| Physical home | `<owner-repo>/tools/<name>/` | `Skills/<domain>/…` (liye_os) or `<domain-repo>/.claude/skills/<name>/` |
| Extras | BGHS `declaration.yaml`; optional 1-page L3 pointer in `.claude/skills/<name>.md` telling Claude *when/how* to invoke | SFC-format `SKILL.md` (frontmatter + body), swept into a namespace |
| Examples | `github-scout` (license-gated GitHub client), `source-intake` (URL→artifact rail) | `github-digest`, `skill-creator`, `asin-growth` |

**Litmus test:** *Is there deterministic code that does the work?* → Tool. *Is the capability
"read + judge + orchestrate" with no deterministic core?* → Skill.

**Composition:** Skills **orchestrate** Tools. A Skill may shell out to a Tool for the
deterministic part (e.g. `github-digest` could call `github-scout` for license gating). That two
forms coexist for one problem area (prior-art) is by design, not duplication.

---

## Axis B — SCOPE: Platform vs Domain vs External

| Scope | Owned by | Home | Namespace |
|---|---|---|---|
| **Platform / cross-domain** | liye_os (Layer 0) | `liye_os/Skills/<domain>/` (skills) · `liye_os/tools/` (tools) | `liye-os` |
| **Domain-specific** | the domain engine/product repo (Layer 2/3) | `<domain-repo>/.claude/skills/<name>/` (skills) · `<domain-repo>/tools/` (tools) | `amazon` (and future peer repos) |
| **External / third-party** | not ours | `~/.claude/skills/` (read-only) | `external` |

**Litmus test:** *Does this capability belong to one domain engine, or is it usable across the
whole ecosystem?* Ecosystem-general → liye_os. Tied to one domain → that domain's **own repo**,
co-located with the engine it serves.

---

## The placement decision tree

Run any new capability through this; it yields exactly one home:

```
① Third-party / not authored by us?
      → external:  ~/.claude/skills/            (read-only, lock+drift)

② Has a deterministic executable core (API / state machine / parser / compute)?
      → it is a TOOL:  <owner-repo>/tools/<name>/
        + BGHS declaration.yaml
        + optional 1-page L3 pointer in .claude/skills/<name>.md

③ Otherwise it is a SKILL (knowledge / workflow / judgment):
      ├─ cross-domain / platform-general?  → liye_os/Skills/<domain>/<category>/<name>/   (SFC)
      └─ specific to one domain engine?     → <domain-repo>/.claude/skills/<name>/         (SFC)
```

---

## Namespaces (mirror of `.claude/skills/index.yaml`)

| Namespace | Root | Discovery | Mutability | Holds |
|---|---|---|---|---|
| `liye-os` (highest priority) | `liye_os/Skills/<domain>/` | `sfc_sweep` | internal, patchable, **must be SFC-compliant** | platform SFC skills |
| `amazon` | `amazon-growth-engine/.claude/skills/` | `sfc_sweep_multi` | local patchable, vendored read-only | AGE domain skills |
| `external` | `~/.claude/skills/` | `lockfile+drift` | **read-only** | third-party plugin skills |

Resolution priority: `liye-os` > `amazon` > `external`.

> **Note on `liye_os/.claude/skills/`**: this directory is **NOT** an SFC skill root. It holds
> the registry (`index.yaml`), flat **L3 pointer docs** for Tools (e.g. `github-scout.md`), and
> `memory/`. It is *not* swept by `sfc_sweep`. Real platform skills live in `Skills/` (capital S).
> See `.claude/skills/README.md`.

---

## Current-state mapping (verifies the policy is self-consistent)

| Capability | Form | Scope | Home | ✓ |
|---|---|---|---|---|
| `github-scout` | Tool | platform | `liye_os/tools/github-scout/` + L3 `.claude/skills/github-scout.md` | ✅ |
| `source-intake` | Tool | platform | `liye_os/tools/source-intake/` | ✅ |
| `github-digest` | **Skill** | platform | `liye_os/Skills/01_Research_Intelligence/prior-art/github-digest/` | ✅ |
| `skill-creator`, `prompt-engineering`, `document-processing/*` | Skill | platform | `liye_os/Skills/00_Core_Utilities/…` | ✅ |
| `asin-growth`, `ads-governance`, `marketplace-growth`, `product-selection` | Skill | AGE domain | `amazon-growth-engine/.claude/skills/…` | ✅ |
| `age-md2html` | Skill (+CLI) | AGE domain | `amazon-growth-engine/.claude/skills/age-md2html/` | ✅ |

Everything is currently placed correctly. The confusion was the absence of this single table, plus
doc-rot in `.claude/skills/README.md` (now corrected).

---

## Promotion rules

There are **two** kinds of promotion. Do not confuse them.

### 1. Maturity promotion (within a namespace)

New platform skills incubate in `Skills/99_Incubator/`, then graduate to a formal domain once
they are: (a) validated on real cases, (b) SFC-lint clean, (c) reviewed. Update the domain
`index.yaml` on graduation. (A skill may skip incubation if it is already validated — e.g.
`github-digest` was proven on 3 real repos before landing in `01_Research_Intelligence`.)

### 2. Mechanism ascension (cross-layer abstraction) — **generic mechanisms rise, domain workflows do NOT move**

When a **domain** skill contains a *generic mechanism* that is valuable ecosystem-wide, promote
the **mechanism** up into liye_os L1 methodology / a platform contract — **but leave the skill
body in the domain repo.**

> **Worked example:** `asin-growth`'s `compile → execute → receipt → verdict` control loop is a
> generic governed-execution mechanism. That *pattern* may be abstracted into a liye_os
> methodology/contract (so `chaming`, `silkbay`, etc. can reuse it). But `asin-growth` **stays in
> AGE** — it is an Amazon single-ASIN workflow, not a platform capability.

**Anti-rule (hard):** **Never platformize a domain skill's body.** Do not move `asin-growth` (or
any domain workflow) into `liye_os/Skills/`. Domain workflows belong to their engine's repo.
Only the *reusable mechanism* ascends; the *domain workflow* does not relocate.

---

## Cross-references

- `Skills/01_Research_Intelligence/prior-art/github-digest/` — the KNOWN-repo research Skill
- `tools/github-scout/` (+ `.claude/skills/github-scout.md`) — the DISCOVER-unknown-repos Tool
- `tools/source-intake/` — the INGEST-a-chosen-repo Tool
- `docs/methodology/01_Research_Intelligence/recon-log/` — recon-log methodology + scout/source-intake boundary
- `_meta/governance/SKILL_CONSTITUTION_v0.1.md` — the frozen behavioral Constitution (tier model)
- `.claude/skills/index.yaml` — namespace registry (machine SSOT)

---
**Version**: 1.0.0 | **Tier**: Policy (overridable) | **Created**: 2026-07-03
