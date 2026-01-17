# Blueprint Map

> **Purpose**: Reference directory structure you can replicate for AI-collaborative projects.

---

## Why Structure Matters

AI agents work better with predictable, well-organized codebases. This structure emerged from building LiYe OS with Claude Code.

---

## Minimal Blueprint

If you're copying just the structure, start here:

```text
your-project/
CLAUDE.md                              # AI context entry point
.claude/
  packs/                               # Domain knowledge (on-demand)
  scripts/                             # Tooling (guardrail, assembler)
_meta/
  docs/                                # Architecture documentation
  governance/                          # Governance rules (Frozen)
docs/
  architecture/                        # Architecture decisions (Stable)
.github/
  workflows/                           # CI gates
```

---

## Full Structure Reference

**Canonical documentation**: [`_meta/docs/ARCHITECTURE_CONSTITUTION.md`](../../_meta/docs/ARCHITECTURE_CONSTITUTION.md)

**Directory structure spec**: [`docs/architecture/DIRECTORY_STRUCTURE.md`](../architecture/DIRECTORY_STRUCTURE.md)

---

## Copy vs Adopt vs Run

| Approach | What You Take | Maintenance Burden |
|----------|---------------|-------------------|
| **Copy** | Structure only | You maintain everything |
| **Adopt** | Structure + governance | You track upstream changes |
| **Run** | Full system | You run LiYe OS directly |

Most users should **copy** the structure and customize for their needs.

---

## Key Patterns

1. **CLAUDE.md as entry point** — AI reads this first, loads context on demand
2. **Packs for domain knowledge** — Keep CLAUDE.md small, defer details to packs
3. **Frozen/Stable/Experimental tiers** — Not all code is equal; label stability
4. **Gates in CI** — Make constraints enforceable, not just documented

---

## Next Steps

- [Architecture Contract](./ARCHITECTURE_CONTRACT.md) — Stability boundaries
- [Governance Gates](./GOVERNANCE_GATES.md) — CI enforcement
- [Back to README](../../README.md)
