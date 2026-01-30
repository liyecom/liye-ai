# Skill Guidelines (Reference Rules)

> **MIGRATED** — These guidelines have been promoted to `_meta/policies/DEFAULT_SKILL_POLICY.md`.
> This file is retained for historical reference and as source documentation.
> For authoritative policy definitions, see the Policy file.

**Status:** Archived (superseded by Policy layer)
**Migrated To:** `_meta/policies/DEFAULT_SKILL_POLICY.md`
**Source:** Skill Archaeology - rules with single-ecosystem evidence
**Relationship:** Historical source for Policy layer

---

## Purpose

These guidelines represent proven patterns from specific ecosystems but lack cross-ecosystem validation required for Constitutional status. They were **recommended practices** that have now been formalized as the Default Skill Policy.

**Promotion Path:** A guideline may be promoted to Constitutional Rule when evidence from >=2 additional ecosystems is documented.

---

## Guidelines (8)

### 1. Test Before Code (TDD)

**Pattern:** Write failing tests before implementing functionality.

**Source:** superpowers/test-driven-development

**Rationale:** RED-GREEN-REFACTOR cycle catches regressions early and documents expected behavior.

**When to Apply:** New feature development, bug fixes with reproducible test cases.

**When to Skip:** Exploratory prototyping, one-off scripts, UI-only changes.

---

### 2. Skill Check Before Action

**Pattern:** Before taking any action, check if a relevant skill exists and invoke it.

**Source:** superpowers/using-superpowers

**Rationale:** Skills encode proven workflows; skipping them risks reinventing wheels or missing best practices.

**When to Apply:** Any task that might match a skill's trigger conditions.

**When to Skip:** Simple queries, pure information retrieval without action.

---

### 3. Baseline Test Before Skill Creation

**Pattern:** Before creating a new skill, verify current baseline works without it.

**Source:** superpowers/writing-skills

**Rationale:** Ensures skill adds value over status quo; prevents unnecessary complexity.

**When to Apply:** Creating new skills or significantly modifying existing ones.

**When to Skip:** Documenting existing implicit workflows.

---

### 4. Extract Full Plan Before Execution

**Pattern:** Read and internalize the complete plan before starting any implementation step.

**Source:** superpowers/executing-plans

**Rationale:** Prevents context loss mid-execution; enables better sequencing decisions.

**When to Apply:** Multi-step implementation tasks with written plans.

**When to Skip:** Single-step tasks, exploratory work without plans.

---

### 5. One Question at a Time

**Pattern:** Ask only one clarifying question per interaction; wait for answer before next.

**Source:** superpowers/brainstorming

**Rationale:** Reduces cognitive load; gets more thoughtful answers; prevents question fatigue.

**When to Apply:** Requirements gathering, design exploration, ambiguous tasks.

**When to Skip:** Urgent situations requiring rapid information gathering.

---

### 6. Two-Stage Review Order

**Pattern:** First review structural issues, then code quality; never mix.

**Source:** superpowers/subagent-driven-development

**Rationale:** Structural issues may invalidate code-level feedback; separation improves efficiency.

**When to Apply:** Code reviews, PR reviews, architecture assessments.

**When to Skip:** Trivial changes where both levels are obvious.

---

### 7. Two-Step Creation Flow

**Pattern:** First generate ideas/content, then refine; never try to perfect on first pass.

**Source:** superpowers/canvas-design

**Rationale:** Separating ideation from refinement improves both; premature optimization blocks creativity.

**When to Apply:** Creative tasks, content generation, design work.

**When to Skip:** Mechanical tasks with clear specifications.

---

### 8. Description Only Triggers

**Pattern:** Skill descriptions should only specify trigger conditions, not implementation details.

**Source:** superpowers/writing-skills

**Rationale:** Keeps skill discovery fast; implementation belongs in SKILL.md body.

**When to Apply:** Writing skill definitions, documenting trigger conditions.

**When to Skip:** Internal documentation not used for skill routing.

---

## Removed Patterns (Not Guidelines)

The following patterns were identified during Skill Archaeology but deemed too domain-specific for even guideline status:

| Pattern | Reason for Removal |
|---------|-------------------|
| Tool type check before operation | Document processing specific |
| Refinement over addition | Canvas-design workflow specific |
| Auto-cleanup temporary materials | Skill-forge implementation detail |
| Location must ask user | Skill-forge UX decision |
| No parallel dispatch | Subagent architecture constraint |
| Fixed skill priority order | Superpowers orchestration detail |

These patterns remain valid within their original contexts but should not be generalized.

---

## Contributing

To propose a new guideline or promote an existing one:

1. Document the pattern with source evidence
2. Identify potential cross-ecosystem applications
3. Submit PR with evidence from attempted cross-ecosystem validation
4. If >=2 ecosystems show success, propose Constitutional promotion

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | 2026-01-16 | Initial release - 8 guidelines from Skill Archaeology |
