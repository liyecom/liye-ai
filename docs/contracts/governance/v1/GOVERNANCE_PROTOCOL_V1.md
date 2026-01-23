# Governance Protocol v1 (Frozen)

Status: **FROZEN v1**
Scope: GateReport / Contract / TraceEvent / Verdict
Goal: Make blind confidence structurally impossible via auditable evidence chain.

## 1. Design Principles (Non-negotiable)
- **Protocol-first**: Schema frozen before implementation.
- **Evidence-first**: Every run emits trace + verdict + replay.
- **Append-only**: Trace is immutable; hash-chain makes tampering visible.
- **Explainable**: Verdict is human-readable decision semantics.

## 2. Versioning
- Protocol version: `1.0.0`
- Schemas live under: `contracts/governance/v1/`
- Any breaking change => `v2/` (no silent changes)

## 3. Object Overview
### 3.1 GateReport
Purpose: Risk gate output. Must decide: ALLOW/BLOCK/DEGRADE/UNKNOWN.

### 3.2 Contract
Purpose: Machine-enforceable constraints. Deny/Allow/Degrade/Require-evidence rules.

### 3.3 TraceEvent
Purpose: Auditable event stream (append-only NDJSON). Hash-chained.

### 3.4 Verdict
Purpose: Human-readable explanation of decisions and actions.

## 4. Invariants (MUST)
1) Every run MUST emit:
   - trace events (NDJSON)
   - a verdict (Markdown or JSON)
   - replay result (pass/fail + diff)
2) `TraceEvent.hash` MUST chain from `hash_prev`.
3) `GateReport.decision` MUST be one of:
   - ALLOW | BLOCK | DEGRADE | UNKNOWN
4) `Verdict` MUST answer:
   - Why allowed/blocked?
   - What changed?
   - What was blocked?
   - What next?

## 5. Minimal Examples (Non-normative)
(Implementation will provide golden cases and real outputs.)
