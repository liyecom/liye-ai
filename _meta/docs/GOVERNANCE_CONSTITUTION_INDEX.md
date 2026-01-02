# Governance Constitution Index

> **Status**: Active
> **Scope**: LiYe OS (main branch)
> **Audience**: System Owner / Core Maintainers
> **Purpose**: Enumerate all constitution-level governance mechanisms that are actively enforced.

---

## 1. What This Document Is (and Is Not)

### This document IS:
- A **canonical index** of active governance constraints
- A map of **what is enforced, where, and how**
- A quick reference for reviewers and maintainers

### This document IS NOT:
- A tutorial
- A design rationale deep dive
- A replacement for individual governance documents or CI code

---

## 2. Constitution-Level Invariants

The following invariants define **non-negotiable system truths**.

| Invariant | Description |
|---------|-------------|
| Kernel Integrity | System Kernel (`CLAUDE.md`) must not be polluted by feature or domain logic |
| Truth Source Authority | English is the Single Source of Truth (SSOT); i18n layers must not override meaning |
| Explicit Change Intent | Any constitution-level change must be explicitly declared |
| Human Verifiability | Governance decisions must be reviewable without agent execution |

---

## 3. Active Governance Gates (CI-Enforced)

### 3.1 Kernel Guard

| Item | Value |
|----|----|
| Target | `CLAUDE.md` |
| Enforced By | `.github/workflows/kernel-guard.yml` |
| Trigger | Any PR modifying `CLAUDE.md` targeting `main` |
| Default Behavior | ❌ Block merge |

**Allowed only if one condition is met:**
- PR title starts with `governance:` or `kernel:`
- OR PR has label `kernel-change`

**Invariant Enforced:** Kernel Integrity + Explicit Change Intent

---

### 3.2 i18n Gate (Truth Source Guard)

| Item | Value |
|----|----|
| Target | i18n display layers |
| Enforced By | `.github/workflows/i18n-gate.yml` |
| Trigger | PRs touching i18n display files |
| Default Behavior | ❌ Block merge if SSOT violated |

**Invariant Enforced:** Truth Source Authority

---

## 4. Governance Observability (P1)

| Capability | Status |
|---------|--------|
| Decision Traceability | ✅ Active |
| Audit / Replay | ✅ Active |
| Human-Readable Contract | ✅ Active |
| Silent Drift Prevention | ✅ Active |

**Notes:**
- Governance decisions must produce observable artifacts
- No agent execution is required to validate outcomes

---

## 5. Change Classification (Normative)

All changes to the system implicitly fall into one of the following categories:

| Change Type | Description |
|-----------|-------------|
| Governance | Alters system rules, invariants, or enforcement |
| Infrastructure | Alters tooling without changing rules |
| Feature | Adds or modifies domain functionality |
| Concept | Documents models or ideas (non-executable) |

**Rule:**
Governance changes must never be implicit.

---

## 6. Enforcement Summary

| Layer | Protection Level |
|-----|------------------|
| Kernel (`CLAUDE.md`) | CI-blocking |
| Truth Source (i18n) | CI-blocking |
| Governance Rules | Explicit declaration required |
| Feature Semantics | Governed indirectly |

---

## 7. Reading Order for Maintainers

1. `CLAUDE.md` (Kernel)
2. This document (Constitution Index)
3. `_meta/docs/ARCHITECTURE_CONSTITUTION.md`
4. Individual CI workflows under `.github/workflows/`

---

## 8. Amendments

- This index may be updated **only** when a governance mechanism is added, removed, or materially changed.
- Adding new gates **requires updating this document**.

---

**Last Updated**: 2026-01-02
**Maintainer**: System Owner
