# LiYe OS · Default Skill Policy

> **These are defaults, not hard requirements.**
> Skills and Workflows may override these policies with documented justification.

**Status:** Active
**Effective Date:** 2026-01-16
**Governance:** `_meta/governance/SKILL_CONSTITUTION_v0.1.md` (parent)
**Enforcement:** Guardrail WARNING only (non-blocking)
**New Skills:** Follow `_meta/skill-factory/SKILL_FACTORY_CONTRACT_v0.1.md`

---

## Relationship to Constitution

```
Constitution (immutable)  →  defines MUST/MUST NOT
    ↓
Policy (this file)        →  defines SHOULD/SHOULD NOT (overridable)
    ↓
Playbook (SKILL.md)       →  defines HOW (implementation)
```

**Key Difference:**
- Constitution violations → **HARD BLOCK**
- Policy deviations → **WARNING** (log but allow)

---

## Default Policies (8)

### Policy 1: Test Before Code (TDD)

**Statement:** Write failing tests before implementing functionality.

**applies_to:** New feature development, bug fixes with reproducible test cases

**can_override:** Yes

**typical_override_reason:**
- Exploratory prototyping where requirements are unknown
- One-off scripts not intended for reuse
- UI-only changes without business logic

**Source:** superpowers/test-driven-development

---

### Policy 2: Skill Check Before Action

**Statement:** Before taking any action, check if a relevant skill exists and invoke it.

**applies_to:** Any task that might match a skill's trigger conditions

**can_override:** Yes

**typical_override_reason:**
- Simple queries with no action component
- Pure information retrieval tasks
- Emergency situations requiring immediate action

**Source:** superpowers/using-superpowers

---

### Policy 3: Baseline Test Before Skill Creation

**Statement:** Before creating a new skill, verify current baseline works without it.

**applies_to:** Creating new skills, significantly modifying existing skills

**can_override:** Yes

**typical_override_reason:**
- Documenting existing implicit workflows (formalization, not new capability)
- Skill consolidation (merging multiple skills)

**Source:** superpowers/writing-skills

---

### Policy 4: Extract Full Plan Before Execution

**Statement:** Read and internalize the complete plan before starting any implementation step.

**applies_to:** Multi-step implementation tasks with written plans

**can_override:** Yes

**typical_override_reason:**
- Single-step tasks with clear scope
- Exploratory work without predefined plans
- Plans known to be incomplete (iterative discovery)

**Source:** superpowers/executing-plans

---

### Policy 5: One Question at a Time

**Statement:** Ask only one clarifying question per interaction; wait for answer before next.

**applies_to:** Requirements gathering, design exploration, ambiguous tasks

**can_override:** Yes

**typical_override_reason:**
- Urgent situations requiring rapid information gathering
- Batch questions on unrelated topics
- Checklist-style confirmations (yes/no for multiple items)

**Source:** superpowers/brainstorming

---

### Policy 6: Two-Stage Review Order

**Statement:** First review structural issues, then code quality; never mix in same pass.

**applies_to:** Code reviews, PR reviews, architecture assessments

**can_override:** Yes

**typical_override_reason:**
- Trivial changes where both levels are obvious
- Time-boxed reviews with limited scope
- Pair programming (real-time feedback)

**Source:** superpowers/subagent-driven-development

---

### Policy 7: Two-Step Creation Flow

**Statement:** First generate ideas/content, then refine; never try to perfect on first pass.

**applies_to:** Creative tasks, content generation, design work

**can_override:** Yes

**typical_override_reason:**
- Mechanical tasks with clear specifications
- Templated outputs with no creative component
- Time-critical deliverables (ship now, refine later)

**Source:** superpowers/canvas-design

---

### Policy 8: Description Only Triggers

**Statement:** Skill descriptions should only specify trigger conditions, not implementation details.

**applies_to:** Writing skill definitions, documenting trigger conditions

**can_override:** Yes

**typical_override_reason:**
- Internal documentation not used for skill routing
- Composite skills requiring brief implementation hints
- Skills with unusual trigger patterns needing clarification

**Source:** superpowers/writing-skills

---

## Override Protocol

To override a policy in a specific Skill:

1. **Document in SKILL.md:**
   ```yaml
   ---
   policy_overrides:
     - policy: "Test Before Code"
       reason: "Exploratory prototyping skill - requirements discovered during execution"
   ---
   ```

2. **Guardrail behavior:**
   - Policy override is logged (for audit)
   - No block or warning for documented overrides
   - Undocumented deviations trigger WARNING

---

## Promotion Path

A Policy may be promoted to Constitutional Rule when:
1. Evidence from >=2 additional ecosystems is documented
2. No significant override patterns suggest the rule is too restrictive
3. Formal proposal submitted via `_meta/governance/CONSTITUTION_AMENDMENT_PROPOSAL.md`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | 2026-01-16 | Initial release - 8 policies promoted from skill-guidelines.md |
