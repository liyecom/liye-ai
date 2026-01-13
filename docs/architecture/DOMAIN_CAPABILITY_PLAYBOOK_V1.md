# Domain Capability Playbook v1

**Status**: Active | Authoritative
**Version**: v1.0
**Based On**: Amazon Growth Engine, Geo Pipeline
**Last Updated**: 2026-01-02

---

## 1. Playbook Definition

This Playbook describes **how to bring a new Domain into Phase 5 capability state**.

This is an **operations manual**, not a design document. It does not discuss *whether* to enter Phase 5—only *how* to enter. Every new Domain in LiYe OS must execute this Playbook to achieve replicable, auditable decision capabilities.

**What This Playbook Is**:
- A factory manual for Domain capability construction
- A checklist-driven execution guide
- The authoritative standard for Phase 5 compliance

**What This Playbook Is Not**:
- A design rationale document (see Phase 5 Architecture Acceptance Report)
- A product requirements document
- A feature specification

**Intended Audience**:
- Architecture leads initiating new Domains
- Engineers implementing Phase 5 artifacts
- Reviewers validating Phase 5 compliance

---

## 2. Capability Lifecycle Overview

A Domain moves from inception to Phase 5 capability through the following lifecycle:

**Stage 0: Domain Scope Definition**

Before any Phase 5 work begins, the Domain scope must be explicitly bounded. This includes: the problem space the Domain addresses, the decision categories it will govern, and the boundaries with adjacent Domains. No Phase 5 work begins until scope is frozen.

**Stage 1: Phase 5.1 — Decision Inventory**

The Domain's decision surface is frozen. Every decision the Domain can produce is enumerated by ID. No decision exists outside this inventory.

**Stage 2: Phase 5.2 — Decision Schema & Contracts**

Each decision in the inventory receives a semantic contract. The contract defines what the decision means, what actions it implies, and what evidence supports it. All contracts bind to the shared Decision Schema.

**Stage 3: Phase 5.3 — Constrained Agent Pipeline**

The mechanical execution layer is built. Signal Agents compute metrics. Rule Agents apply thresholds. Verdict Agents emit schema-validated decisions. No reasoning, interpretation, or improvisation is permitted.

**Stage 4: Phase 5.4 — Replay & Regression Gate**

Deterministic test cases are created. CI gates enforce behavioral consistency. Silent changes are structurally impossible.

**Stage 5: Phase 5 Acceptance**

Architecture review confirms all phases are complete. The Domain is declared Phase 5 compliant and can enter production governance.

**Critical Understanding**: Phase 5 is the minimum standard for Domain capability replication. A Domain that has not completed Phase 5 is not ready for production governance.

---

## 3. Phase 5.1 — Decision Inventory Playbook

### Purpose

Freeze the decision surface before any implementation work begins.

### Inputs

- Domain problem space definition
- Business requirements for decision categories
- Stakeholder alignment on scope boundaries

### Outputs

- `docs/domain/<domain>/DECISIONS.md` — Canonical decision inventory

### Allowed Content

- Decision IDs (SCREAMING_SNAKE_CASE format)
- Category groupings
- Brief decision descriptions (one sentence per decision)

### Forbidden Content

- ❌ Rules or thresholds
- ❌ Reasoning or rationale
- ❌ Optimization suggestions
- ❌ Implementation notes
- ❌ Evidence field definitions
- ❌ Agent logic

### Acceptance Checklist

- [ ] All decision IDs use SCREAMING_SNAKE_CASE format
- [ ] Decision IDs are grouped by category
- [ ] No two decision IDs have overlapping semantics
- [ ] Inventory covers the complete problem space
- [ ] Document is reviewed and approved by architecture lead
- [ ] Inventory is committed and treated as frozen after merge

### Exit Criteria

Phase 5.1 is complete when the decision inventory is merged to main and no further additions are planned. Modifications after freeze require ADR approval.

---

## 4. Phase 5.2 — Decision Schema & Contracts Playbook

### Purpose

Make every decision machine-verifiable and human-readable.

### Critical Distinction

| Artifact | Ownership | Modifiability |
|----------|-----------|---------------|
| **Decision Schema** | Global (LiYe OS) | Frozen. Never copy, never modify. |
| **Decision Contracts** | Domain-specific | Domain team owns. Must follow schema. |

The Decision Schema (`verdicts/schema/decision.schema.json`) is shared across all Domains. It defines structural validity. No Domain may create a custom schema.

Decision Contracts are Domain-private. Each Domain creates its own contracts in `verdicts/<domain>/contracts.yaml`.

### Inputs

- Completed Phase 5.1 inventory
- Domain expertise for semantic definitions

### Outputs

- `verdicts/<domain>/contracts.yaml` — Semantic contracts for all decisions
- `verdicts/<domain>/README.md` — Contract documentation

### Contract Writing Rules

Each contract must include:

- **version**: Semantic version (e.g., `v1.0`)
- **severity**: Impact level (`info`, `warning`, `critical`)
- **meaning**: What the decision signifies
- **what_it_means**: Plain language explanation
- **typical_actions**: What response is expected
- **evidence_fields**: What data supports the decision

### Common Errors to Avoid

- Writing contracts that explain *how* the decision was made (contracts explain *what* the decision means)
- Including thresholds or rules in contracts (those belong in agents)
- Using vague language that cannot be verified
- Copying contracts between Domains without semantic review
- Defining evidence fields that cannot be populated by signals

### Acceptance Checklist

- [ ] Every decision in Phase 5.1 inventory has a contract
- [ ] Schema validation is enforced at runtime (ajv or equivalent)
- [ ] Contracts explain decisions, not reasoning
- [ ] Evidence fields are concrete and measurable
- [ ] Version is set for each contract
- [ ] README documents the contract structure

### Exit Criteria

Phase 5.2 is complete when all decisions have contracts, schema validation is integrated, and the contract set is merged to main.

---

## 5. Phase 5.3 — Constrained Agent Pipeline Playbook

### Purpose

Build agents that execute the decision pipeline mechanically, without reasoning or improvisation.

### The Three Agent Types

**Signal Agent**

- **Responsibility**: Compute numerical metrics from raw input
- **Permitted Output**: Numbers, booleans, structured data
- **Forbidden Behavior**: Judgment, interpretation, natural language output, decision-making

**Rule Agent**

- **Responsibility**: Apply thresholds to signals, produce boolean triggers
- **Permitted Output**: Boolean values indicating which rules fired
- **Forbidden Behavior**: Verdict emission, reasoning, threshold modification, adaptive behavior

**Verdict Agent**

- **Responsibility**: Emit schema-validated decisions for triggered rules
- **Permitted Output**: Decisions that pass JSON Schema validation
- **Forbidden Behavior**: Reasoning, interpretation, signal computation, rule evaluation

### Pipeline Flow

Input → Signal Agent → Rule Agent → Verdict Agent → Output

Each agent receives only the output of its predecessor. No agent may access raw input except Signal Agent. No agent may skip stages.

### Inputs

- Phase 5.2 contracts
- Domain-specific signal definitions
- Threshold specifications

### Outputs

- `Agents/<domain>/signal_agent.js` — Signal computation
- `Agents/<domain>/rule_agent.js` — Rule evaluation
- `Agents/<domain>/verdict_agent.js` — Verdict emission
- `Agents/<domain>/README.md` — Agent documentation

### Forbidden Behaviors (All Agents)

- ❌ LLM calls within the decision pipeline
- ❌ Non-deterministic operations (random, time-based logic beyond timestamps)
- ❌ Cross-domain agent imports
- ❌ Natural language decision output
- ❌ Adaptive or learning behavior
- ❌ "Smart" fallbacks
- ❌ Implicit reasoning
- ❌ Threshold modification at runtime

### Acceptance Checklist

- [ ] Signal Agent outputs only numerical metrics
- [ ] Rule Agent outputs only boolean triggers
- [ ] Verdict Agent outputs only schema-validated decisions
- [ ] Same input produces same output (determinism verified)
- [ ] No LLM calls in pipeline
- [ ] No cross-domain dependencies
- [ ] All agents documented

### Implicit Intelligence Test

Before completing Phase 5.3, verify the pipeline contains no "hidden intelligence":

- Can you explain every output purely from signals and thresholds?
- If you removed all explanation text, would the decision still be derived identically?
- Is there any path through the code that depends on interpretation?

If any answer is "no" or "uncertain," the pipeline is not constrained.

### Exit Criteria

Phase 5.3 is complete when all three agents are implemented, determinism is verified, and no implicit intelligence remains.

---

## 6. Phase 5.4 — Replay & Regression Playbook

### Purpose

Enforce behavioral consistency through deterministic testing. Make silent changes structurally impossible.

### Core Principle

**Replay is not a test; it is the execution of governance.**

Replay testing is not quality assurance. It is the enforcement mechanism that prevents behavioral drift. If replay fails, governance has failed.

### Inputs

- Completed Phase 5.3 agent pipeline
- Representative input scenarios

### Outputs

- `replays/<domain>/cases/*.input.json` — Test inputs
- `replays/<domain>/cases/*.expected.json` — Expected outputs
- `tools/<domain>_replay_runner.js` — Domain replay runner
- `.github/workflows/domain-replay-gate.yml` — CI enforcement (or update existing)

### Replay Case Structure

Each case consists of:

- **Input file**: Raw data representing a scenario
- **Expected file**: The decisions the pipeline must produce

### Stable vs. Unstable Fields

Replay compares **stable fields only**:

| Field | Compared? | Reason |
|-------|-----------|--------|
| `decision_id` | ✅ Yes | Identity must be deterministic |
| `domain` | ✅ Yes | Domain must be correct |
| `severity` | ✅ Yes | Impact level must be consistent |
| `version` | ✅ Yes | Contract version must match |
| `confidence` | ❌ No | May vary with implementation |
| `timestamp` | ❌ No | Runtime-dependent |
| `evidence` | ❌ No | May include runtime-variant data |

### CI Gate Requirements

The CI gate must:

- Run on every PR and push to main
- Execute all domain replay tests
- Block merge on any failure
- Not be bypassable without explicit admin override

### Updating Expected Outputs

When decision behavior must change:

1. Update agent code (signal, rule, or verdict)
2. Bump the contract version
3. Update expected outputs to match new behavior
4. Document the change in an ADR
5. Merge only after all replays pass

Updating expected outputs without a version bump is forbidden.

### Acceptance Checklist

- [ ] At least 2 replay cases exist
- [ ] Replay runner compares stable fields only
- [ ] CI gate is configured and active
- [ ] Merge is blocked on replay failure
- [ ] Process for updating expected outputs is documented

### Exit Criteria

Phase 5.4 is complete when replay tests exist, CI gates are active, and the Domain cannot merge behavioral changes without explicit version updates.

---

## 7. Cross-Domain Consistency Rules

### What Must Be Consistent Across All Domains

| Artifact | Consistency Requirement |
|----------|------------------------|
| Phase structure | 5.1 → 5.2 → 5.3 → 5.4 lifecycle is mandatory |
| Decision Schema | All Domains use `verdicts/schema/decision.schema.json` |
| Replay mechanism | Stable field comparison, CI gate enforcement |
| Agent pipeline | Signal → Rule → Verdict structure |
| Contract format | YAML with required fields (version, severity, meaning, etc.) |
| Naming conventions | SCREAMING_SNAKE_CASE for decision IDs |

### What Must Be Different Across Domains

| Artifact | Domain-Specific Requirement |
|----------|----------------------------|
| Decision IDs | Each Domain defines its own decision vocabulary |
| Signals | Domain-specific metrics based on problem space |
| Thresholds | Domain-specific rules based on business logic |
| Evidence fields | Domain-specific data structures |
| Contracts | Domain-specific semantic definitions |

### Sharing Rule

Domains share **governance structure**, not **business semantics**.

A Domain may not import another Domain's decisions, signals, or contracts. Cross-domain decision-making requires explicit integration points defined outside Phase 5.

---

## 8. Explicit Anti-Patterns

The following behaviors violate Phase 5 principles and must be rejected during review:

### Anti-Pattern 1: Writing Rules in Phase 5.1

Phase 5.1 is decision inventory only. Rules, thresholds, or any decision logic appearing in DECISIONS.md is a violation. Inventory defines *what* decisions exist, not *when* they fire.

### Anti-Pattern 2: Explaining Reasoning in Contracts

Contracts define what a decision *means*, not how it was *derived*. If a contract says "because the BSR dropped below threshold," it has leaked rule logic into the contract layer. Contracts explain semantics, not causation.

### Anti-Pattern 3: Using Prompts to Generate Decisions

LLM calls within the decision pipeline violate determinism. If a decision can change based on prompt variation, model update, or temperature setting, it is not a Phase 5 decision. Decisions must be mechanically derived from signals and rules.

### Anti-Pattern 4: Modifying Expected Outputs Without Version Bump

Changing replay expected outputs without updating the contract version is a silent behavior change. This defeats the purpose of replay governance. Every behavioral change requires an explicit version increment.

### Anti-Pattern 5: Bypassing CI Gate

Merging with failing replays, disabling the replay gate, or using admin override for convenience destroys governance integrity. CI gates are constitutional enforcement, not optional checks.

### Anti-Pattern 6: Treating Phase 5 as a Feature

Phase 5 is a governance stage, not a feature module. It is not "Phase 5 capability" that gets "enabled." It is the minimum standard for auditable, replicable decision systems. Domains that treat Phase 5 as optional are not production-ready.

### Anti-Pattern 7: Cross-Domain Decision Import

Importing decisions from another Domain creates coupling that violates isolation. Each Domain must define its complete decision surface independently. Cross-domain coordination requires explicit integration contracts, not shared decision IDs.

### Anti-Pattern 8: Adding Explanation as Reasoning

Agents may include `explanation` fields for human consumption. But if the explanation is used to derive the decision (rather than label it after the fact), the agent is reasoning. Explanations are post-hoc; decisions are mechanical.

---

## 9. How to Use This Playbook

### New Domain Startup Procedure

1. **Scope Definition**: Define Domain boundaries, problem space, and decision categories
2. **Phase 5.1 Execution**: Create decision inventory following Section 3
3. **Phase 5.2 Execution**: Create contracts following Section 4
4. **Phase 5.3 Execution**: Build agent pipeline following Section 5
5. **Phase 5.4 Execution**: Create replay tests following Section 6
6. **Architecture Review**: Submit for Phase 5 acceptance review
7. **Merge to Main**: Only after acceptance is granted

### Who Can Execute

| Role | Phase 5 Responsibilities |
|------|-------------------------|
| Domain Lead | Owns Phase 5.1 inventory, approves contracts |
| Domain Engineer | Implements 5.2–5.4 artifacts |
| Architecture Lead | Reviews and accepts Phase 5 compliance |
| CI System | Enforces replay gates |

### When Architecture Acceptance Is Required

Architecture acceptance review is mandatory before a Domain can:

- Merge Phase 5.4 to main
- Claim Phase 5 compliance
- Enter production governance

### Playbook v1.0 Applicability

This Playbook applies to all Domains targeting Phase 5 capability. It is based on the implementation patterns validated by Amazon Growth Engine and Geo Pipeline. Future Domains must follow this Playbook without modification unless a formal ADR approves changes.

---

## 10. Status & Versioning

### Document Status

| Attribute | Value |
|-----------|-------|
| **Version** | v1.0 |
| **Status** | Active |
| **Authority** | Authoritative |
| **Based On** | Amazon Growth Engine, Geo Pipeline |
| **Effective Date** | 2026-01-02 |

### Validation Basis

This Playbook is derived from the successful Phase 5 implementations in:

- **Amazon Growth Engine**: 45+ decisions, full contract coverage, deterministic replay
- **Geo Pipeline**: 85 decisions, 45 contracts, CI-enforced governance

Both Domains have passed Phase 5 architecture acceptance and serve as the reference implementations for this Playbook.

### Modification Policy

This Playbook is frozen at v1.0. Modifications require:

- Architecture Decision Record (ADR) with rationale
- Review by architecture lead
- Explicit version bump (v1.1, v2.0, etc.)
- Update to this document's Status section

Informal modifications, local overrides, or "temporary exceptions" are not permitted. The Playbook is authoritative or it is not a Playbook.

### Compatibility

This Playbook is compatible with:

- Phase 5 Architecture Acceptance Report (no conflicts)
- LiYe OS Architecture Constitution
- Domain Replay Gate CI workflows

---

**Document Maintainers**: LiYe OS Architecture Team
**Next Review**: Upon v1.1 proposal or new Domain acceptance
