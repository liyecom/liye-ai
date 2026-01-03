# Track Architecture Verdicts

> **Status**: FROZEN (Immutable Principles)
> **Verdict Date**: 2026-01-02
> **Authority**: LiYe (Architecture Owner)
> **Scope**: All Track-related implementations

---

## Preamble

These verdicts are **irreversible architectural decisions** established upon the successful implementation of Domain-Scoped Track (P0-P4). They define the fundamental constraints and boundaries for all future Track-related work in LiYe OS.

**Evidence Chain for Approval**:
- Structure: `tracks/`, schema, workflow, checkpoint complete
- Runtime: `memory_bootstrap` recognizes `active_track`
- Governance: CI aware of Track (warning mode, not blocking)
- Semantic: Glossary verification passed without polluting scoring

---

## Verdict 1: Domain-Scoped Track = Atomic Execution Unit

### Statement

> **Domain-Scoped Track is the minimum atomic unit of execution in LiYe OS.**

### Implications

| Prohibited | Equivalent Violation |
|------------|---------------------|
| ❌ Complex Agent execution without Track | Transaction without BEGIN |
| ❌ Single Track spanning multiple Domains | Foreign key to wrong table |
| ❌ spec/plan without glossary binding | Schema-less data insertion |

### Analogy

```
Track in LiYe OS ≈ Transaction in Database

- Indivisible (atomic)
- Revertible (rollback)
- Bounded (scope)
```

### Anchor Role

Track serves as the anchor point for:
- **Governance**: What rules apply?
- **Billing**: How much was consumed?
- **Audit**: What happened and why?
- **Review**: Was it successful?

---

## Verdict 2: Memory-Track Coupling = Read-Only Binding

### Statement

> **Track reads from Memory; Track does NOT write back to Memory.**

### Current Implementation (Correct)

```
┌─────────────────────────────────────────────────────────────┐
│                      Memory (Truth Engine)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ domain-map  │  │  glossary   │  │ confidence  │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │ READ ONLY                         │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Track (Truth Consumer)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  state.yaml │  │   spec.md   │  │   plan.md   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Boundary Protection

This boundary MUST be maintained to prevent "Context Swamp":

| Allowed | Prohibited |
|---------|-----------|
| ✅ Track reads domain from Memory | ❌ Track modifies domain-mapping |
| ✅ Track uses glossary terms | ❌ Track adds terms to glossary |
| ✅ Track references glossary version | ❌ Track auto-updates glossary |

### Future Exception Path

If Track → Memory write is ever needed:
1. Requires explicit ADR
2. Must go through governance review
3. Cannot bypass glossary versioning

---

## Verdict 3: Checkpoint = Organizational Commitment Point

### Statement

> **Checkpoint is NOT an automation tool; it is an explicit commitment of decision responsibility.**

### Current State (Correct)

| Aspect | Status | Rationale |
|--------|--------|-----------|
| Human approval | ✅ Required | Decision responsibility |
| Structure exists | ✅ Complete | Audit trail |
| Hard enforcement | ❌ Not yet | Organizational readiness |

### Why Warning Mode is Correct Now

Upgrading checkpoint to hard CI gate means:

> "The organization/project is willing to take responsibility for AI decisions."

This is a **P2+ concern**, not P0-P1.

### Upgrade Criteria

Checkpoint becomes blocking ONLY when:

1. **Process Maturity**: Team has completed ≥10 Tracks successfully
2. **Governance Readiness**: VERDICT_FREEZE policy covers Track files
3. **Responsibility Clarity**: Clear owner for checkpoint failures
4. **Rollback Capability**: Proven ability to revert frozen states

---

## Summary Table

| # | Verdict | Core Principle | Enforcement |
|---|---------|----------------|-------------|
| V1 | Atomic Unit | Track = Transaction | Schema validation |
| V2 | Read-Only Binding | Memory → Track (one-way) | Code review |
| V3 | Commitment Point | Human-approved freeze | CI warning → future blocking |

---

## Immutability Declaration

These verdicts are **frozen** as of 2026-01-02.

Modification requires:
1. Explicit ADR with justification
2. Architecture review
3. Update to this document with changelog

---

## References

- Implementation: `docs/architecture/CONDUCTOR_INTEGRATION_PROPOSAL.md`
- Track Schema: `docs/architecture/TRACK_SCHEMA.md`
- First Track: `tracks/amz_optimize_ppc_20260101/`

---

**Verdict Authority**: LiYe
**Implementation**: Claude
**Date**: 2026-01-02
