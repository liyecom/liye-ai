# Architecture Contract

> **Purpose**: Define stability boundaries so downstream adopters know what they can depend on.

---

## Why This Matters

When you copy or depend on any part of LiYe OS, you need to know:
- What will **never break** (Frozen)
- What will remain **backward compatible** (Stable)
- What **may change without notice** (Experimental)

The Architecture Contract is the source of truth for these boundaries.

---

## Read the Contract

**Canonical location**: [`docs/architecture/ARCHITECTURE_CONTRACT.md`](../architecture/ARCHITECTURE_CONTRACT.md)

---

## Quick Reference

| Level | Meaning | Change Policy |
|-------|---------|---------------|
| **Frozen** | Constitutional, immutable | 30-day notice, requires RFC |
| **Stable** | Backward compatible | 14-day notice, migration guide |
| **Experimental** | May change anytime | No notice required |

---

## If You're Copying This

Copy the contract template, not the content. Your stability boundaries will differ from ours.

Key pattern: Define **what** is frozen/stable/experimental, not **how long** they've existed.

---

## Next Steps

- [Governance Gates](./GOVERNANCE_GATES.md) — CI enforcement for stability contracts
- [Blueprint Map](./BLUEPRINT_MAP.md) — Directory structure you can replicate
- [Back to README](../../README.md)
