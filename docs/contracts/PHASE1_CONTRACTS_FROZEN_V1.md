# Phase 1 Contracts Frozen v1

## Version Information

| Field | Value |
|-------|-------|
| Version | 1.0.0 |
| Frozen At | 2026-01-30 |
| Status | FROZEN |
| Breaking Changes | Require v2 with v1 compatibility period |

## Contract Files

| Contract | Path | Purpose |
|----------|------|---------|
| Request Schema | `src/contracts/phase1/GOV_TOOL_CALL_REQUEST_V1.json` | Gateway request validation |
| Response Schema | `src/contracts/phase1/GOV_TOOL_CALL_RESPONSE_V1.json` | Gateway response validation |
| Trace Fields | `src/contracts/phase1/TRACE_REQUIRED_FIELDS_V1.json` | Audit trail requirements |

## HF1-HF5 Field Definitions

### Required Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | True if decision is ALLOW or DEGRADE |
| `decision` | enum | ALLOW, BLOCK, DEGRADE, UNKNOWN |
| `origin` | string | Data source identifier |
| `origin_proof` | boolean | True if verified AGE call |
| `mock_used` | boolean | True if mock fallback used |
| `policy_version` | string | Applied routing policy version |
| `trace_id` | string | Audit trace identifier |

### HF5 Consistency Rules (MACHINE-ENFORCED)

**Rule 1: Mock Fallback Scenario**
```
IF mock_used = true THEN:
  - origin MUST equal "liye_os.mock"
  - origin_proof MUST be false
  - decision MUST be "DEGRADE"
  - fallback_reason MUST be present
```

**Rule 2: Real AGE Scenario**
```
IF origin = "AGE" THEN:
  - origin_proof MUST be true
  - mock_used MUST be false
```

**Rule 3: Decision Consistency**
```
IF decision IN (ALLOW, DEGRADE) THEN ok = true
IF decision IN (BLOCK, UNKNOWN) THEN ok = false
```

## Compatibility Policy

### Allowed Changes (Backward Compatible)
- Adding new optional fields
- Adding new enum values (with fallback handling)
- Relaxing validation constraints
- Adding new trace event types

### Breaking Changes (Require v2)
- Removing required fields
- Changing field types
- Changing field semantics
- Adding new required fields
- Changing HF5 consistency rules

### Migration Path for Breaking Changes
1. Release v2 schema alongside v1
2. Support both versions for minimum 2 weeks
3. Log deprecation warnings for v1 usage
4. Remove v1 after migration period

## Validation

### Schema Validation
```bash
# Validate schemas are parseable
node -e "require('./src/contracts/phase1/GOV_TOOL_CALL_REQUEST_V1.json')"
node -e "require('./src/contracts/phase1/GOV_TOOL_CALL_RESPONSE_V1.json')"
node -e "require('./src/contracts/phase1/TRACE_REQUIRED_FIELDS_V1.json')"
```

### E2E Contract Validation
```bash
# Run contract assertions
LIYE_GOV_GATEWAY_URL=http://localhost:3210 \
  bash examples/moltbot/scripts/validate_e2e.sh

# Run mock fallback assertions
LIYE_GOV_GATEWAY_URL=http://localhost:3210 \
FORCE_FALLBACK=1 \
  bash examples/moltbot/scripts/validate_e2e.sh
```

### CI Gate
```bash
# Full drift gate check
.claude/scripts/check_contracts_gate.sh
```

## Changelog

### v1.0.0 (2026-01-30)
- Initial frozen version
- HF1: Mock fallback with DEGRADE decision
- HF2: phase0_only flag support
- HF3: WriteBlocker GUARANTEE enforcement
- HF4: origin field for multi-source telemetry
- HF5: origin/mock_used consistency rules
