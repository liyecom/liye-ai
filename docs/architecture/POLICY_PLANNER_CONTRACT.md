# Policy → Planner Contract

> **Status**: Frozen (v1.0)
> **Phase**: P3.2 Runtime Policy
> **Last Updated**: 2026-01-02

This document defines the minimal contract between the Runtime Policy Engine and any downstream Planner/Agent. The contract is append-only and backward compatible.

## Contract Overview

```
┌─────────────────────┐         ┌─────────────────────┐
│   Runtime Policy    │         │      Planner        │
│      Engine         │         │      (Future)       │
│                     │         │                     │
│  - Adjudicates      │  JSON   │  - Consumes         │
│  - Does NOT plan    │ ──────► │  - May replan       │
│  - Does NOT retry   │         │  - Respects hard    │
└─────────────────────┘         └─────────────────────┘
```

## DecisionContract Schema

```json
{
  "result": "ALLOW" | "DENY",
  "reason": "string",
  "suggestion": "string | null",
  "alternative": "object | null",
  "severity": "hard" | "soft"
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `result` | `"ALLOW"` \| `"DENY"` | Yes | The policy evaluation outcome |
| `reason` | `string` | Yes | Policy ID + human-readable explanation |
| `suggestion` | `string` \| `null` | No | Non-executable replan hint (natural language) |
| `alternative` | `object` \| `null` | No | Structured constraint hint (not a patch) |
| `severity` | `"hard"` \| `"soft"` | Yes | Replan requirement signal |

### Severity Semantics

| Severity | Condition | Planner Behavior |
|----------|-----------|------------------|
| `hard` | All `DENY` decisions | **MUST** replan or abort |
| `soft` | All `ALLOW` decisions | **MAY** optimize (optional) |

## Contract Rules

### 1. Runtime Policy Responsibilities

- **Output only**: Runtime Policy only produces `DecisionContract`
- **No execution**: Policy Engine does not execute, retry, or modify actions
- **No planning**: Policy Engine does not generate alternative action sequences
- **Deterministic**: Same input → same output (no side effects)

### 2. Planner Responsibilities (Future)

- **Must respect `severity=hard`**: A `DENY` with `hard` severity is a mandatory signal
- **May ignore `severity=soft`**: An `ALLOW` with `soft` is informational only
- **Must not treat `suggestion` as instruction**: Suggestions are hints, not commands
- **Must not apply `alternative` as patch**: Alternatives are constraints, not diffs

### 3. Boundary Invariants

- `suggestion` is never executable code
- `alternative` describes constraints, not solutions
- The contract is append-only (new fields may be added, existing fields never removed)
- Backward compatibility is guaranteed

## Contract Examples

### Example 1: DENY with Hard Severity

```json
{
  "result": "DENY",
  "reason": "POL_001_branch_scope: Deny direct push to main",
  "suggestion": "Create a feature/* branch and open a PR",
  "alternative": {
    "target_pattern": "refs/heads/feature/*"
  },
  "severity": "hard"
}
```

**Planner interpretation**: MUST NOT proceed with `refs/heads/main`. SHOULD consider `feature/*` branch.

### Example 2: DENY (Tool Not Allowed)

```json
{
  "result": "DENY",
  "reason": "POL_004_tool_allowlist: Deny execution of tools not in the allowlist",
  "suggestion": "Use an allowed tool or request approval",
  "alternative": {
    "allowed_tools": ["read", "write", "edit", "glob", "grep", "bash"]
  },
  "severity": "hard"
}
```

**Planner interpretation**: MUST NOT execute the unauthorized tool. SHOULD select from `allowed_tools`.

### Example 3: ALLOW with Soft Severity

```json
{
  "result": "ALLOW",
  "reason": "All policies passed",
  "suggestion": null,
  "alternative": null,
  "severity": "soft"
}
```

**Planner interpretation**: MAY proceed. No mandatory constraints.

### Example 4: DENY (Fail-Close)

```json
{
  "result": "DENY",
  "reason": "POL_006_fail_close: Fail-close triggered",
  "suggestion": "Action denied due to system safety fallback",
  "alternative": null,
  "severity": "hard"
}
```

**Planner interpretation**: MUST abort. System is in fail-safe mode.

## Implementation Notes

### Current State (P3.2)

- Contract is **defined only**, not consumed
- No Planner implementation exists
- Policy Engine outputs contract-compliant JSON
- All DENY → `severity=hard`
- All ALLOW → `severity=soft`

### Future State (P4+)

- Planner will consume DecisionContract
- Replan logic will respect severity
- Contract may be extended (append-only)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-02 | Initial contract definition (frozen) |

---

**Key Invariant**:

> "Runtime Policy does not plan, execute, or retry. It only adjudicates."
