# liye_os/.claude/skills/ — Registry + L3 pointers (NOT the skill root)

> ⚠️ **This directory is NOT where liye_os platform skills live.**
> It is **not** swept by `sfc_sweep`. Do not put SFC `SKILL.md` skills here.

## What this directory actually holds

| Item | Purpose |
|------|---------|
| `index.yaml` | The **unified skill registry** — namespaces (`liye-os` / `amazon` / `external`), roots, discovery, resolution priority. Machine SSOT. |
| `github-scout.md` | A flat **L3 pointer doc** for the `tools/github-scout/` **Tool** — tells Claude *when/how* to invoke the executable. Manually loaded, not auto-discovered. |
| `liye-agent.md` | Flat L3 advisory for working with LiYe agents. |
| `memory/` | Session memory scaffolding. |

## Where real skills live

| You want… | Go to |
|-----------|-------|
| A **platform (cross-domain) SFC skill** | `liye_os/Skills/<domain>/<category>/<name>/SKILL.md` (namespace `liye-os`, swept by `sfc_sweep`) |
| A **domain-specific skill** (e.g. Amazon) | that domain repo's own `.claude/skills/` (e.g. `amazon-growth-engine/.claude/skills/`, namespace `amazon`) |
| An **executable Tool** (API client, state machine) | `liye_os/tools/<name>/` (+ optionally a 1-page L3 pointer *here*) |
| A **third-party plugin skill** | `~/.claude/skills/` (namespace `external`, read-only) |

## The mental model (1 line)

> 可执行确定性核进 `tools/`；Claude 工作流进 `Skills/`（跨域）或域 repo `.claude/skills/`（域专属）；
> 跨域归 liye_os，域专属归域 repo；外部第三方只读归 `~/.claude/skills`。

## Authoritative docs

- **Placement policy (decision tree + namespaces + promotion rules):**
  `_meta/governance/SKILL_PLACEMENT.md`
- **Skill Constitution (frozen behavioral rules):** `_meta/governance/SKILL_CONSTITUTION_v0.1.md`
- **Registry (machine SSOT):** `.claude/skills/index.yaml`

## Adding a flat L3 pointer here (the only thing that belongs in this dir)

Only when you add a **Tool** under `tools/` and want a short "when/how to invoke" doc for Claude.
Keep it thin — the method and rules live in the Tool's own `declaration.yaml` + L1 methodology,
never here. Example: `github-scout.md` points at `tools/github-scout/` and its L1 SSOT.
