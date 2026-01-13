# ADR: Builder-Contract Interface Architecture

```yaml
decision_id: ADR-0005
domain: architecture
status: accepted
created: 2026-01-13
tags: [builder, contract, interface, theme-factory, adapter]
```

## Context

LiYe OS needed a clear separation between:
- **Skills** (translate human intent → contracts)
- **Builders** (consume contracts → produce artifacts)

Without explicit boundaries, builders might bypass contracts and access knowledge directly, breaking the SSOT principle.

## Decision

### 1. Read Interface Frozen Point

Builders read **exactly one source**:
```
tracks/<track_id>/site-design.contract.yaml
```

**Prohibited paths:**
- `knowledge/**` (Skill domain only)
- `_meta/contracts/**` (global templates, Skill domain only)
- `Skills/**` (Skills write contracts, not code)

### 2. Adapter as Single Translation Point

All contract → code translation goes through:
```
builders/adapters/site-design.adapter.ts
```

**Benefits:**
- Contract schema changes → update adapter only
- Type-safe IR for all builders
- Centralized validation

### 3. Builder Does Not Read Knowledge

**Red line:** Builders cannot "fall back" to `knowledge/` when contract is incomplete.

If a builder struggles, the **contract** is wrong—not the builder. Fix the Skill that generated the contract.

### 4. theme-factory First

Chose `theme-factory` as first builder because:
- Minimal scope (CSS vars + Tailwind tokens only)
- No layout decisions
- Pure token translation
- Fast validation cycle

## Consequences

**Positive:**
- Clear data flow: Skill → Contract → Adapter → Builder → Artifact
- Predictable: change contract → artifact changes predictably
- Testable: compliance check validates output against contract

**Negative:**
- Builders cannot "be smart" (intentional)
- More work for Skills to produce complete contracts

## Compliance

Future builders MUST:
1. Use `loadContract()` from adapter (not raw YAML parsing)
2. Never import from `knowledge/`
3. Pass compliance check before merge

---

**Frozen**: 2026-01-13
