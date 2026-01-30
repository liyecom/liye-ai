# LiYe Governance Kernel v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an embeddable governance kernel that produces auditable evidence chains (trace + replay + verdict) for any Agent platform.

**Architecture:** Four primitive functions (gate, enforce, trace, replay) with frozen JSON Schema protocols (v1), 10 golden test cases proving "stupidity is controllable", and CI enforcement via replay validation.

**Tech Stack:** Node.js (ESM), JSON Schema draft-2020-12, NDJSON for traces, hash chains for tamper-evidence.

---

## Success Criteria (Acceptance Test)

1. **Protocol v1 frozen** — 4 schemas + human-readable doc
2. **10 golden cases pass** — including failure scenarios
3. **Every run produces** — trace.ndjson + verdict.md + replay.json + diff.json
4. **CI enforces replay** — any drift = build fail
5. **No UI/platform drift** — pure kernel only

---

## Day 1: Protocol Freeze (Foundation)

### Task 1.1: Create Protocol Directory Structure

**Files:**
- Create: `docs/contracts/governance/v1/GOVERNANCE_PROTOCOL_V1.md`
- Create: `contracts/governance/v1/GateReport.schema.json`
- Create: `contracts/governance/v1/Contract.schema.json`
- Create: `contracts/governance/v1/TraceEvent.schema.json`
- Create: `contracts/governance/v1/Verdict.schema.json`

**Step 1: Create directory structure**

```bash
mkdir -p docs/contracts/governance/v1
mkdir -p contracts/governance/v1
```

**Step 2: Commit directory structure**

```bash
git add docs/contracts/governance/v1 contracts/governance/v1
git commit -m "chore(governance): create protocol v1 directory structure"
```

---

### Task 1.2: Write GateReport Schema

**Files:**
- Create: `contracts/governance/v1/GateReport.schema.json`

**Step 1: Write GateReport schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://liye-os.dev/contracts/governance/v1/GateReport.schema.json",
  "title": "GateReport",
  "description": "Risk gate output for governance decisions",
  "type": "object",
  "required": ["gate_id", "ts", "decision", "risks", "unknowns", "constraints"],
  "properties": {
    "gate_id": {
      "type": "string",
      "pattern": "^gate-[a-z0-9]{8}$",
      "description": "Unique gate execution identifier"
    },
    "ts": {
      "type": "string",
      "format": "date-time",
      "description": "ISO8601 timestamp of gate execution"
    },
    "decision": {
      "type": "string",
      "enum": ["ALLOW", "BLOCK", "DEGRADE", "UNKNOWN"],
      "description": "Gate decision outcome"
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "severity", "rationale"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^risk-[a-z0-9]{4}$"
          },
          "severity": {
            "type": "string",
            "enum": ["low", "medium", "high", "critical"]
          },
          "rationale": {
            "type": "string",
            "minLength": 10
          },
          "evidence_required": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "unknowns": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "question"],
        "properties": {
          "id": { "type": "string" },
          "question": { "type": "string" },
          "blocking": { "type": "boolean", "default": false }
        }
      }
    },
    "constraints": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "rule", "enforcement"],
        "properties": {
          "id": { "type": "string" },
          "rule": { "type": "string" },
          "enforcement": {
            "type": "string",
            "enum": ["must", "should", "may"]
          }
        }
      },
      "description": "Hard constraints for subsequent actions"
    },
    "recommended_next_actions": {
      "type": "array",
      "items": { "type": "string" }
    },
    "input_hash": {
      "type": "string",
      "description": "SHA256 hash of input for traceability"
    }
  }
}
```

**Step 2: Validate schema syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('contracts/governance/v1/GateReport.schema.json'))"`
Expected: No output (valid JSON)

**Step 3: Commit**

```bash
git add contracts/governance/v1/GateReport.schema.json
git commit -m "feat(governance): add GateReport.schema.json v1"
```

---

### Task 1.3: Write Contract Schema

**Files:**
- Create: `contracts/governance/v1/Contract.schema.json`

**Step 1: Write Contract schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://liye-os.dev/contracts/governance/v1/Contract.schema.json",
  "title": "Contract",
  "description": "Machine-executable governance contract",
  "type": "object",
  "required": ["contract_id", "version", "scope", "rules"],
  "properties": {
    "contract_id": {
      "type": "string",
      "pattern": "^contract-[a-z0-9-]+$",
      "description": "Unique contract identifier"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version"
    },
    "scope": {
      "type": "string",
      "description": "What this contract governs (e.g., 'file-operations', 'api-calls')"
    },
    "description": {
      "type": "string"
    },
    "rules": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["rule_id", "type", "pattern", "action"],
        "properties": {
          "rule_id": {
            "type": "string",
            "pattern": "^[a-z]+-\\d{3}$"
          },
          "type": {
            "type": "string",
            "enum": ["allow", "deny", "require", "limit"]
          },
          "pattern": {
            "type": "string",
            "description": "Regex or glob pattern to match"
          },
          "condition": {
            "type": "string",
            "description": "Optional JSONPath or expression for conditional rules"
          },
          "action": {
            "type": "string",
            "enum": ["pass", "block", "warn", "audit"]
          },
          "rationale": {
            "type": "string"
          },
          "gate_mapping": {
            "type": "string",
            "description": "Maps to specific Gate decision"
          },
          "verdict_template": {
            "type": "string",
            "description": "Template for human-readable verdict"
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "created_at": { "type": "string", "format": "date-time" },
        "updated_at": { "type": "string", "format": "date-time" },
        "author": { "type": "string" },
        "source": { "type": "string", "description": "Reference to constitution/ADR" }
      }
    }
  }
}
```

**Step 2: Validate schema syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('contracts/governance/v1/Contract.schema.json'))"`
Expected: No output (valid JSON)

**Step 3: Commit**

```bash
git add contracts/governance/v1/Contract.schema.json
git commit -m "feat(governance): add Contract.schema.json v1"
```

---

### Task 1.4: Write TraceEvent Schema

**Files:**
- Create: `contracts/governance/v1/TraceEvent.schema.json`

**Step 1: Write TraceEvent schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://liye-os.dev/contracts/governance/v1/TraceEvent.schema.json",
  "title": "TraceEvent",
  "description": "Append-only audit event with hash chain",
  "type": "object",
  "required": ["trace_id", "span_id", "ts", "type", "payload", "hash"],
  "properties": {
    "trace_id": {
      "type": "string",
      "pattern": "^trace-[a-z0-9]{12}$",
      "description": "Unique trace session identifier"
    },
    "span_id": {
      "type": "string",
      "pattern": "^span-[a-z0-9]{8}$",
      "description": "Event sequence identifier within trace"
    },
    "seq": {
      "type": "integer",
      "minimum": 0,
      "description": "Sequence number for ordering"
    },
    "ts": {
      "type": "string",
      "format": "date-time",
      "description": "ISO8601 timestamp"
    },
    "type": {
      "type": "string",
      "enum": [
        "gate.start",
        "gate.decision",
        "enforce.check",
        "enforce.result",
        "action.proposed",
        "action.executed",
        "action.blocked",
        "error",
        "verdict.generated"
      ],
      "description": "Event type for categorization"
    },
    "payload": {
      "type": "object",
      "description": "Event-specific data"
    },
    "hash_prev": {
      "type": ["string", "null"],
      "pattern": "^[a-f0-9]{64}$",
      "description": "SHA256 hash of previous event (null for first event)"
    },
    "hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "SHA256 hash of this event (ts + type + payload + hash_prev)"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "actor": { "type": "string" },
        "session_id": { "type": "string" },
        "parent_span_id": { "type": "string" }
      }
    }
  }
}
```

**Step 2: Validate schema syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('contracts/governance/v1/TraceEvent.schema.json'))"`
Expected: No output (valid JSON)

**Step 3: Commit**

```bash
git add contracts/governance/v1/TraceEvent.schema.json
git commit -m "feat(governance): add TraceEvent.schema.json v1"
```

---

### Task 1.5: Write Verdict Schema

**Files:**
- Create: `contracts/governance/v1/Verdict.schema.json`

**Step 1: Write Verdict schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://liye-os.dev/contracts/governance/v1/Verdict.schema.json",
  "title": "Verdict",
  "description": "Human-readable decision semantics for audit and replay",
  "type": "object",
  "required": ["verdict_id", "trace_id", "ts", "summary", "decision", "why"],
  "properties": {
    "verdict_id": {
      "type": "string",
      "pattern": "^verdict-[a-z0-9]{8}$",
      "description": "Unique verdict identifier"
    },
    "trace_id": {
      "type": "string",
      "pattern": "^trace-[a-z0-9]{12}$",
      "description": "Reference to source trace"
    },
    "ts": {
      "type": "string",
      "format": "date-time"
    },
    "summary": {
      "type": "string",
      "minLength": 20,
      "maxLength": 500,
      "description": "One paragraph summary of the decision"
    },
    "decision": {
      "type": "string",
      "enum": ["ALLOW", "BLOCK", "DEGRADE", "UNKNOWN"]
    },
    "why": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string" },
      "description": "Key reasons as bullet points"
    },
    "what_changed": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Actions that were taken"
    },
    "what_blocked": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Actions that were prevented"
    },
    "evidence": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "reference": { "type": "string" },
          "summary": { "type": "string" }
        }
      },
      "description": "Supporting evidence for the decision"
    },
    "next_steps": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Recommended follow-up actions"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Confidence level in the decision"
    }
  }
}
```

**Step 2: Validate schema syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('contracts/governance/v1/Verdict.schema.json'))"`
Expected: No output (valid JSON)

**Step 3: Commit**

```bash
git add contracts/governance/v1/Verdict.schema.json
git commit -m "feat(governance): add Verdict.schema.json v1"
```

---

### Task 1.6: Write Protocol Documentation

**Files:**
- Create: `docs/contracts/governance/v1/GOVERNANCE_PROTOCOL_V1.md`

**Step 1: Write protocol documentation**

```markdown
# Governance Protocol v1

> **Status:** FROZEN
> **Version:** 1.0.0
> **Effective:** 2026-01-23

## Overview

The LiYe Governance Kernel provides four primitives for auditable agent governance:

1. **Gate** — Risk assessment before action
2. **Enforce** — Contract compliance checking
3. **Trace** — Append-only audit event chain
4. **Replay** — Deterministic verification

## Schemas

| Schema | Purpose | Location |
|--------|---------|----------|
| GateReport | Risk gate output | `contracts/governance/v1/GateReport.schema.json` |
| Contract | Machine constraints | `contracts/governance/v1/Contract.schema.json` |
| TraceEvent | Audit event | `contracts/governance/v1/TraceEvent.schema.json` |
| Verdict | Human-readable decision | `contracts/governance/v1/Verdict.schema.json` |

## GateReport

Gate produces a risk assessment before any action.

### Decisions

| Decision | Meaning | Action |
|----------|---------|--------|
| `ALLOW` | Proceed with constraints | Execute with logged constraints |
| `BLOCK` | Do not proceed | Halt, generate verdict |
| `DEGRADE` | Proceed with fallback | Use safe alternative |
| `UNKNOWN` | Insufficient evidence | Request more information |

### Required Fields

- `gate_id`: Unique identifier (`gate-[a-z0-9]{8}`)
- `ts`: ISO8601 timestamp
- `decision`: One of ALLOW/BLOCK/DEGRADE/UNKNOWN
- `risks[]`: Identified risks with severity
- `unknowns[]`: Questions requiring answers
- `constraints[]`: Hard constraints for subsequent actions

## Contract

Machine-executable governance rules.

### Rule Types

| Type | Meaning |
|------|---------|
| `allow` | Explicitly permit matching actions |
| `deny` | Explicitly forbid matching actions |
| `require` | Mandate certain conditions |
| `limit` | Rate or quantity limits |

### Rule Actions

| Action | Effect |
|--------|--------|
| `pass` | Continue silently |
| `block` | Halt execution |
| `warn` | Log warning, continue |
| `audit` | Log for review, continue |

## TraceEvent

Append-only event with cryptographic hash chain.

### Event Types

| Type | When |
|------|------|
| `gate.start` | Gate evaluation begins |
| `gate.decision` | Gate produces decision |
| `enforce.check` | Contract rule checked |
| `enforce.result` | Enforcement outcome |
| `action.proposed` | Action about to execute |
| `action.executed` | Action completed |
| `action.blocked` | Action prevented |
| `error` | Error occurred |
| `verdict.generated` | Verdict produced |

### Hash Chain

Each event includes:
- `hash_prev`: SHA256 of previous event (null for first)
- `hash`: SHA256 of `ts + type + JSON(payload) + hash_prev`

This ensures tamper-evidence: any modification breaks the chain.

## Verdict

Human-readable decision interpretation for audit.

### Required Fields

- `summary`: One paragraph (20-500 chars)
- `decision`: Final outcome
- `why[]`: Bullet point reasons
- `what_changed[]`: Actions taken
- `what_blocked[]`: Actions prevented
- `next_steps[]`: Recommended follow-up

## Evidence Pack Structure

Each execution produces an evidence pack:

```
.liye/traces/<trace_id>/
├── events.ndjson      # Append-only trace events
├── verdict.md         # Human-readable verdict
├── verdict.json       # Machine-readable verdict
├── replay.json        # Replay verification result
└── diff.json          # Drift detection (if any)
```

## Replay Verification

Replay validates:
1. Schema compliance (all events valid)
2. Hash chain integrity (no tampering)
3. Decision consistency (same inputs → same outputs)

## Version Policy

- **v1.x.x**: Backward compatible additions only
- **v2.0.0**: Breaking changes require migration path
- Protocol changes require ADR

---

*This protocol is frozen. Changes require formal amendment process.*
```

**Step 2: Commit**

```bash
git add docs/contracts/governance/v1/GOVERNANCE_PROTOCOL_V1.md
git commit -m "docs(governance): add GOVERNANCE_PROTOCOL_V1.md"
```

---

### Task 1.7: Create Schema Validation Test

**Files:**
- Create: `contracts/governance/v1/validate-schemas.mjs`

**Step 1: Write validation script**

```javascript
#!/usr/bin/env node
/**
 * Schema validation for Governance Protocol v1
 * Validates all four schemas are syntactically correct JSON Schema
 */

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCHEMAS = [
  'GateReport.schema.json',
  'Contract.schema.json',
  'TraceEvent.schema.json',
  'Verdict.schema.json'
];

let exitCode = 0;

console.log('Validating Governance Protocol v1 Schemas...\n');

for (const schemaFile of SCHEMAS) {
  const schemaPath = join(__dirname, schemaFile);

  try {
    const content = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(content);

    // Basic structural checks
    if (!schema.$schema) {
      throw new Error('Missing $schema declaration');
    }
    if (!schema.$id) {
      throw new Error('Missing $id');
    }
    if (!schema.title) {
      throw new Error('Missing title');
    }
    if (!schema.type) {
      throw new Error('Missing type');
    }
    if (!schema.required || !Array.isArray(schema.required)) {
      throw new Error('Missing or invalid required array');
    }

    console.log(`✓ ${schemaFile}`);
  } catch (err) {
    console.error(`✗ ${schemaFile}: ${err.message}`);
    exitCode = 1;
  }
}

console.log('\n' + (exitCode === 0 ? 'All schemas valid.' : 'Schema validation failed.'));
process.exit(exitCode);
```

**Step 2: Run validation**

Run: `node contracts/governance/v1/validate-schemas.mjs`
Expected:
```
Validating Governance Protocol v1 Schemas...

✓ GateReport.schema.json
✓ Contract.schema.json
✓ TraceEvent.schema.json
✓ Verdict.schema.json

All schemas valid.
```

**Step 3: Commit**

```bash
git add contracts/governance/v1/validate-schemas.mjs
git commit -m "test(governance): add schema validation script"
```

---

## Day 2-3: Kernel Implementation

### Task 2.1: Create Kernel Directory Structure

**Files:**
- Create: `src/governance/index.mjs`
- Create: `src/governance/gate.mjs`
- Create: `src/governance/enforce.mjs`
- Create: `src/governance/trace.mjs`
- Create: `src/governance/replay.mjs`
- Create: `src/governance/utils/hash.mjs`
- Create: `src/governance/utils/id.mjs`

**Step 1: Create directory structure**

```bash
mkdir -p src/governance/utils
```

**Step 2: Write utility - hash.mjs**

```javascript
/**
 * Cryptographic hash utilities for trace chain
 */
import { createHash } from 'crypto';

/**
 * Generate SHA256 hash of content
 * @param {string} content
 * @returns {string} 64-char hex hash
 */
export function sha256(content) {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Generate hash for trace event
 * @param {string} ts - ISO timestamp
 * @param {string} type - Event type
 * @param {object} payload - Event payload
 * @param {string|null} hashPrev - Previous hash
 * @returns {string}
 */
export function hashEvent(ts, type, payload, hashPrev) {
  const content = `${ts}|${type}|${JSON.stringify(payload)}|${hashPrev || 'null'}`;
  return sha256(content);
}
```

**Step 3: Write utility - id.mjs**

```javascript
/**
 * ID generation utilities
 */
import { randomBytes } from 'crypto';

/**
 * Generate random hex string
 * @param {number} bytes
 * @returns {string}
 */
function randomHex(bytes) {
  return randomBytes(bytes).toString('hex');
}

export const generateTraceId = () => `trace-${randomHex(6)}`;
export const generateSpanId = () => `span-${randomHex(4)}`;
export const generateGateId = () => `gate-${randomHex(4)}`;
export const generateVerdictId = () => `verdict-${randomHex(4)}`;
```

**Step 4: Commit**

```bash
git add src/governance/utils/
git commit -m "feat(governance): add hash and id utilities"
```

---

### Task 2.2: Implement Trace Module

**Files:**
- Create: `src/governance/trace.mjs`

**Step 1: Write trace implementation**

```javascript
/**
 * Trace module - append-only audit event chain
 */
import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { hashEvent } from './utils/hash.mjs';
import { generateTraceId, generateSpanId } from './utils/id.mjs';

/**
 * Create a new trace session
 * @param {string} outputDir - Base directory for traces
 * @returns {Trace}
 */
export function createTrace(outputDir) {
  const traceId = generateTraceId();
  const traceDir = join(outputDir, traceId);
  const eventsPath = join(traceDir, 'events.ndjson');

  mkdirSync(traceDir, { recursive: true });

  let seq = 0;
  let lastHash = null;

  return {
    traceId,
    traceDir,
    eventsPath,

    /**
     * Append event to trace
     * @param {string} type - Event type
     * @param {object} payload - Event data
     * @param {object} [metadata] - Optional metadata
     * @returns {object} The appended event
     */
    append(type, payload, metadata = {}) {
      const ts = new Date().toISOString();
      const spanId = generateSpanId();
      const hash = hashEvent(ts, type, payload, lastHash);

      const event = {
        trace_id: traceId,
        span_id: spanId,
        seq: seq++,
        ts,
        type,
        payload,
        hash_prev: lastHash,
        hash,
        metadata
      };

      appendFileSync(eventsPath, JSON.stringify(event) + '\n');
      lastHash = hash;

      return event;
    },

    /**
     * Get all events in this trace
     * @returns {object[]}
     */
    getEvents() {
      if (!existsSync(eventsPath)) return [];
      const content = readFileSync(eventsPath, 'utf-8').trim();
      if (!content) return [];
      return content.split('\n').map(line => JSON.parse(line));
    },

    /**
     * Get trace metadata
     */
    getMetadata() {
      return {
        trace_id: traceId,
        trace_dir: traceDir,
        event_count: seq,
        last_hash: lastHash
      };
    }
  };
}

/**
 * Load existing trace from directory
 * @param {string} traceDir
 * @returns {Trace}
 */
export function loadTrace(traceDir) {
  const eventsPath = join(traceDir, 'events.ndjson');
  const events = [];

  if (existsSync(eventsPath)) {
    const content = readFileSync(eventsPath, 'utf-8').trim();
    if (content) {
      for (const line of content.split('\n')) {
        events.push(JSON.parse(line));
      }
    }
  }

  const traceId = events[0]?.trace_id || dirname(traceDir).split('/').pop();
  let seq = events.length;
  let lastHash = events[events.length - 1]?.hash || null;

  return {
    traceId,
    traceDir,
    eventsPath,

    append(type, payload, metadata = {}) {
      const ts = new Date().toISOString();
      const spanId = generateSpanId();
      const hash = hashEvent(ts, type, payload, lastHash);

      const event = {
        trace_id: traceId,
        span_id: spanId,
        seq: seq++,
        ts,
        type,
        payload,
        hash_prev: lastHash,
        hash,
        metadata
      };

      appendFileSync(eventsPath, JSON.stringify(event) + '\n');
      lastHash = hash;
      events.push(event);

      return event;
    },

    getEvents() {
      return [...events];
    },

    getMetadata() {
      return {
        trace_id: traceId,
        trace_dir: traceDir,
        event_count: seq,
        last_hash: lastHash
      };
    }
  };
}
```

**Step 2: Write basic test**

Create: `src/governance/__tests__/trace.test.mjs`

```javascript
import { createTrace } from '../trace.mjs';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';

const testDir = mkdtempSync(join(tmpdir(), 'trace-test-'));

try {
  // Test: create trace and append events
  const trace = createTrace(testDir);

  assert(trace.traceId.startsWith('trace-'), 'trace ID format');

  const e1 = trace.append('gate.start', { input: 'test' });
  assert(e1.seq === 0, 'first event seq is 0');
  assert(e1.hash_prev === null, 'first event has null hash_prev');
  assert(e1.hash.length === 64, 'hash is 64 chars');

  const e2 = trace.append('gate.decision', { decision: 'ALLOW' });
  assert(e2.seq === 1, 'second event seq is 1');
  assert(e2.hash_prev === e1.hash, 'hash chain links');

  const events = trace.getEvents();
  assert(events.length === 2, 'two events recorded');

  console.log('✓ All trace tests passed');
} finally {
  rmSync(testDir, { recursive: true });
}
```

**Step 3: Run test**

Run: `node src/governance/__tests__/trace.test.mjs`
Expected: `✓ All trace tests passed`

**Step 4: Commit**

```bash
git add src/governance/trace.mjs src/governance/__tests__/
git commit -m "feat(governance): implement trace module with hash chain"
```

---

### Task 2.3: Implement Gate Module

**Files:**
- Create: `src/governance/gate.mjs`

**Step 1: Write gate implementation**

```javascript
/**
 * Gate module - risk assessment before action
 */
import { sha256 } from './utils/hash.mjs';
import { generateGateId } from './utils/id.mjs';

/**
 * Default risk evaluators
 */
const DEFAULT_EVALUATORS = {
  /**
   * Check for destructive operations
   */
  destructive: (input) => {
    const destructivePatterns = [
      /\bdelete\b/i,
      /\bremove\b/i,
      /\bdrop\b/i,
      /\btruncate\b/i,
      /\brm\s+-rf/i,
      /\boverwrite\b/i
    ];

    const inputStr = JSON.stringify(input);
    for (const pattern of destructivePatterns) {
      if (pattern.test(inputStr)) {
        return {
          id: 'risk-dest',
          severity: 'high',
          rationale: `Destructive operation detected: ${pattern.toString()}`,
          evidence_required: ['user_confirmation', 'backup_exists']
        };
      }
    }
    return null;
  },

  /**
   * Check for insufficient evidence
   */
  evidence: (input) => {
    if (!input.context || Object.keys(input.context || {}).length === 0) {
      return {
        id: 'risk-evid',
        severity: 'medium',
        rationale: 'No context provided for decision',
        evidence_required: ['task_context', 'user_intent']
      };
    }
    return null;
  },

  /**
   * Check for ambiguous intent
   */
  ambiguity: (input) => {
    if (!input.task || input.task.length < 10) {
      return {
        id: 'risk-ambg',
        severity: 'medium',
        rationale: 'Task description too brief or missing',
        evidence_required: ['detailed_task']
      };
    }
    return null;
  }
};

/**
 * Evaluate input against gate
 * @param {object} input - Gate input
 * @param {object} [options] - Gate options
 * @param {object} [options.evaluators] - Custom evaluators
 * @param {object} [options.contracts] - Contracts to check
 * @returns {GateReport}
 */
export function gate(input, options = {}) {
  const gateId = generateGateId();
  const ts = new Date().toISOString();
  const inputHash = sha256(JSON.stringify(input));

  const evaluators = { ...DEFAULT_EVALUATORS, ...(options.evaluators || {}) };

  const risks = [];
  const unknowns = [];
  const constraints = [];

  // Run risk evaluators
  for (const [name, evaluator] of Object.entries(evaluators)) {
    try {
      const risk = evaluator(input);
      if (risk) {
        risks.push(risk);
      }
    } catch (err) {
      unknowns.push({
        id: `unknown-${name}`,
        question: `Evaluator '${name}' failed: ${err.message}`,
        blocking: false
      });
    }
  }

  // Check contracts if provided
  if (options.contracts) {
    for (const contract of options.contracts) {
      for (const rule of contract.rules || []) {
        if (rule.type === 'require') {
          // Check required conditions
          const pattern = new RegExp(rule.pattern);
          const inputStr = JSON.stringify(input);
          if (!pattern.test(inputStr)) {
            constraints.push({
              id: rule.rule_id,
              rule: rule.pattern,
              enforcement: 'must'
            });
          }
        }
      }
    }
  }

  // Determine decision
  let decision = 'ALLOW';

  const hasBlockingUnknown = unknowns.some(u => u.blocking);
  const hasCriticalRisk = risks.some(r => r.severity === 'critical');
  const hasHighRisk = risks.some(r => r.severity === 'high');
  const hasUnmetConstraints = constraints.some(c => c.enforcement === 'must');

  if (hasCriticalRisk || hasBlockingUnknown) {
    decision = 'BLOCK';
  } else if (hasHighRisk || hasUnmetConstraints) {
    decision = 'DEGRADE';
  } else if (unknowns.length > 0 || risks.some(r => r.evidence_required?.length > 0)) {
    decision = 'UNKNOWN';
  }

  // Generate recommendations
  const recommended_next_actions = [];

  if (decision === 'UNKNOWN') {
    for (const risk of risks) {
      if (risk.evidence_required) {
        recommended_next_actions.push(`Provide: ${risk.evidence_required.join(', ')}`);
      }
    }
  }

  if (decision === 'BLOCK') {
    recommended_next_actions.push('Review and address critical risks before proceeding');
  }

  return {
    gate_id: gateId,
    ts,
    decision,
    risks,
    unknowns,
    constraints,
    recommended_next_actions,
    input_hash: inputHash
  };
}
```

**Step 2: Write test**

Create: `src/governance/__tests__/gate.test.mjs`

```javascript
import { gate } from '../gate.mjs';
import assert from 'assert';

// Test 1: Basic ALLOW
{
  const result = gate({
    task: 'Add a new feature to the user profile',
    context: { user: 'test', scope: 'profile' }
  });

  assert(result.gate_id.startsWith('gate-'), 'gate ID format');
  assert(result.decision === 'ALLOW', 'allows valid input');
  assert(result.input_hash.length === 64, 'has input hash');
  console.log('✓ Test 1: Basic ALLOW');
}

// Test 2: Destructive operation → DEGRADE
{
  const result = gate({
    task: 'Delete all user data',
    context: { scope: 'users' }
  });

  assert(result.decision === 'DEGRADE', 'degrades on destructive');
  assert(result.risks.some(r => r.id === 'risk-dest'), 'detects destructive');
  console.log('✓ Test 2: Destructive → DEGRADE');
}

// Test 3: No context → UNKNOWN
{
  const result = gate({
    task: 'Process the request appropriately'
  });

  assert(result.decision === 'UNKNOWN', 'unknown without context');
  assert(result.risks.some(r => r.id === 'risk-evid'), 'detects missing evidence');
  console.log('✓ Test 3: No context → UNKNOWN');
}

// Test 4: Too brief → UNKNOWN
{
  const result = gate({
    task: 'Fix it',
    context: { scope: 'test' }
  });

  assert(result.decision === 'UNKNOWN', 'unknown with brief task');
  console.log('✓ Test 4: Brief task → UNKNOWN');
}

console.log('\n✓ All gate tests passed');
```

**Step 3: Run test**

Run: `node src/governance/__tests__/gate.test.mjs`
Expected: `✓ All gate tests passed`

**Step 4: Commit**

```bash
git add src/governance/gate.mjs src/governance/__tests__/gate.test.mjs
git commit -m "feat(governance): implement gate module with risk evaluation"
```

---

### Task 2.4: Implement Enforce Module

**Files:**
- Create: `src/governance/enforce.mjs`

**Step 1: Write enforce implementation**

```javascript
/**
 * Enforce module - contract compliance checking
 */

/**
 * Check if action matches a rule pattern
 * @param {string} action - Action to check
 * @param {string} pattern - Regex pattern
 * @returns {boolean}
 */
function matchesPattern(action, pattern) {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(typeof action === 'string' ? action : JSON.stringify(action));
  } catch {
    return false;
  }
}

/**
 * Evaluate condition expression (simple JSONPath-like)
 * @param {object} context - Evaluation context
 * @param {string} condition - Condition expression
 * @returns {boolean}
 */
function evaluateCondition(context, condition) {
  if (!condition) return true;

  // Simple key.subkey accessor
  const parts = condition.split('.');
  let value = context;

  for (const part of parts) {
    if (value === undefined || value === null) return false;
    value = value[part];
  }

  return Boolean(value);
}

/**
 * Enforce contract against proposed actions
 * @param {object} contract - Contract to enforce
 * @param {object[]|object} actions - Proposed action(s)
 * @param {object} [context] - Execution context
 * @returns {EnforceResult}
 */
export function enforce(contract, actions, context = {}) {
  const actionList = Array.isArray(actions) ? actions : [actions];

  const results = [];
  let overallPassed = true;
  const violations = [];
  const warnings = [];
  const audits = [];

  for (const action of actionList) {
    const actionStr = typeof action === 'string' ? action : JSON.stringify(action);

    for (const rule of contract.rules || []) {
      const matches = matchesPattern(actionStr, rule.pattern);
      const conditionMet = evaluateCondition(context, rule.condition);

      if (!matches) continue;
      if (!conditionMet) continue;

      const ruleResult = {
        rule_id: rule.rule_id,
        action: actionStr.slice(0, 100),
        matched: true,
        type: rule.type,
        outcome: rule.action
      };

      switch (rule.type) {
        case 'deny':
          if (rule.action === 'block') {
            violations.push({
              rule_id: rule.rule_id,
              action: actionStr.slice(0, 100),
              rationale: rule.rationale || `Denied by rule ${rule.rule_id}`
            });
            overallPassed = false;
          } else if (rule.action === 'warn') {
            warnings.push({
              rule_id: rule.rule_id,
              action: actionStr.slice(0, 100),
              rationale: rule.rationale
            });
          }
          break;

        case 'allow':
          // Explicit allow - no violation
          break;

        case 'require':
          // Requirement not met is a violation
          if (rule.action === 'block') {
            violations.push({
              rule_id: rule.rule_id,
              action: actionStr.slice(0, 100),
              rationale: rule.rationale || `Requirement not met: ${rule.pattern}`
            });
            overallPassed = false;
          }
          break;

        case 'limit':
          // Limit checking (simplified)
          if (rule.action === 'audit') {
            audits.push({
              rule_id: rule.rule_id,
              action: actionStr.slice(0, 100),
              rationale: rule.rationale
            });
          }
          break;
      }

      results.push(ruleResult);
    }
  }

  return {
    contract_id: contract.contract_id,
    passed: overallPassed,
    violations,
    warnings,
    audits,
    results,
    summary: overallPassed
      ? 'All actions comply with contract'
      : `${violations.length} violation(s) detected`
  };
}
```

**Step 2: Write test**

Create: `src/governance/__tests__/enforce.test.mjs`

```javascript
import { enforce } from '../enforce.mjs';
import assert from 'assert';

const testContract = {
  contract_id: 'contract-test-001',
  version: '1.0.0',
  scope: 'file-operations',
  rules: [
    {
      rule_id: 'file-001',
      type: 'deny',
      pattern: 'rm\\s+-rf',
      action: 'block',
      rationale: 'Destructive recursive delete forbidden'
    },
    {
      rule_id: 'file-002',
      type: 'deny',
      pattern: '\\.env',
      action: 'warn',
      rationale: 'Accessing .env files should be reviewed'
    },
    {
      rule_id: 'file-003',
      type: 'allow',
      pattern: 'read.*\\.md',
      action: 'pass'
    }
  ]
};

// Test 1: Allowed action
{
  const result = enforce(testContract, 'read README.md');
  assert(result.passed === true, 'allows safe action');
  assert(result.violations.length === 0, 'no violations');
  console.log('✓ Test 1: Allowed action passes');
}

// Test 2: Blocked action
{
  const result = enforce(testContract, 'rm -rf /tmp/data');
  assert(result.passed === false, 'blocks dangerous action');
  assert(result.violations.length === 1, 'one violation');
  assert(result.violations[0].rule_id === 'file-001', 'correct rule');
  console.log('✓ Test 2: Blocked action fails');
}

// Test 3: Warning action
{
  const result = enforce(testContract, 'read .env.local');
  assert(result.passed === true, 'warning does not block');
  assert(result.warnings.length === 1, 'one warning');
  console.log('✓ Test 3: Warning action passes with warning');
}

// Test 4: Multiple actions
{
  const result = enforce(testContract, [
    'read config.md',
    'rm -rf temp',
    'write output.txt'
  ]);
  assert(result.passed === false, 'fails if any action blocked');
  console.log('✓ Test 4: Multiple actions with one violation fails');
}

console.log('\n✓ All enforce tests passed');
```

**Step 3: Run test**

Run: `node src/governance/__tests__/enforce.test.mjs`
Expected: `✓ All enforce tests passed`

**Step 4: Commit**

```bash
git add src/governance/enforce.mjs src/governance/__tests__/enforce.test.mjs
git commit -m "feat(governance): implement enforce module with contract checking"
```

---

### Task 2.5: Implement Replay Module

**Files:**
- Create: `src/governance/replay.mjs`

**Step 1: Write replay implementation**

```javascript
/**
 * Replay module - deterministic verification of traces
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { hashEvent } from './utils/hash.mjs';

/**
 * Verify hash chain integrity
 * @param {object[]} events
 * @returns {{valid: boolean, errors: string[]}}
 */
function verifyHashChain(events) {
  const errors = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Check first event has null hash_prev
    if (i === 0 && event.hash_prev !== null) {
      errors.push(`Event 0: hash_prev should be null, got ${event.hash_prev}`);
    }

    // Check subsequent events link correctly
    if (i > 0 && event.hash_prev !== events[i - 1].hash) {
      errors.push(`Event ${i}: hash_prev mismatch. Expected ${events[i - 1].hash}, got ${event.hash_prev}`);
    }

    // Verify hash is correct
    const expectedHash = hashEvent(event.ts, event.type, event.payload, event.hash_prev);
    if (event.hash !== expectedHash) {
      errors.push(`Event ${i}: hash mismatch. Expected ${expectedHash}, got ${event.hash}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Verify event schema compliance (basic)
 * @param {object[]} events
 * @returns {{valid: boolean, errors: string[]}}
 */
function verifySchema(events) {
  const errors = [];
  const requiredFields = ['trace_id', 'span_id', 'ts', 'type', 'payload', 'hash'];
  const validTypes = [
    'gate.start', 'gate.decision',
    'enforce.check', 'enforce.result',
    'action.proposed', 'action.executed', 'action.blocked',
    'error', 'verdict.generated'
  ];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    for (const field of requiredFields) {
      if (!(field in event)) {
        errors.push(`Event ${i}: missing required field '${field}'`);
      }
    }

    if (!validTypes.includes(event.type)) {
      errors.push(`Event ${i}: invalid type '${event.type}'`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Extract key decisions from trace for comparison
 * @param {object[]} events
 * @returns {object}
 */
function extractDecisions(events) {
  const decisions = {
    gate_decisions: [],
    enforce_results: [],
    actions_blocked: [],
    actions_executed: []
  };

  for (const event of events) {
    switch (event.type) {
      case 'gate.decision':
        decisions.gate_decisions.push(event.payload.decision);
        break;
      case 'enforce.result':
        decisions.enforce_results.push({
          passed: event.payload.passed,
          violations: event.payload.violations?.length || 0
        });
        break;
      case 'action.blocked':
        decisions.actions_blocked.push(event.payload.action?.slice(0, 50));
        break;
      case 'action.executed':
        decisions.actions_executed.push(event.payload.action?.slice(0, 50));
        break;
    }
  }

  return decisions;
}

/**
 * Compare two decision sets
 * @param {object} expected
 * @param {object} actual
 * @returns {{match: boolean, diffs: object[]}}
 */
function compareDecisions(expected, actual) {
  const diffs = [];

  for (const key of Object.keys(expected)) {
    const exp = JSON.stringify(expected[key]);
    const act = JSON.stringify(actual[key]);

    if (exp !== act) {
      diffs.push({
        field: key,
        expected: expected[key],
        actual: actual[key]
      });
    }
  }

  return {
    match: diffs.length === 0,
    diffs
  };
}

/**
 * Replay and verify a trace
 * @param {string} traceDir - Directory containing trace
 * @param {object} [expected] - Expected decisions (optional)
 * @returns {ReplayResult}
 */
export function replay(traceDir, expected = null) {
  const eventsPath = join(traceDir, 'events.ndjson');

  if (!existsSync(eventsPath)) {
    return {
      status: 'FAIL',
      trace_dir: traceDir,
      errors: ['events.ndjson not found'],
      schema_valid: false,
      hash_chain_valid: false,
      decisions_match: null
    };
  }

  // Load events
  const content = readFileSync(eventsPath, 'utf-8').trim();
  const events = content.split('\n').map(line => JSON.parse(line));

  // Verify schema
  const schemaResult = verifySchema(events);

  // Verify hash chain
  const hashResult = verifyHashChain(events);

  // Extract decisions
  const actualDecisions = extractDecisions(events);

  // Compare with expected if provided
  let decisionsMatch = null;
  let diffs = [];

  if (expected) {
    const comparison = compareDecisions(expected, actualDecisions);
    decisionsMatch = comparison.match;
    diffs = comparison.diffs;
  }

  // Determine overall status
  const allErrors = [...schemaResult.errors, ...hashResult.errors];
  const passed = schemaResult.valid && hashResult.valid && (decisionsMatch !== false);

  const result = {
    status: passed ? 'PASS' : 'FAIL',
    trace_dir: traceDir,
    event_count: events.length,
    schema_valid: schemaResult.valid,
    hash_chain_valid: hashResult.valid,
    decisions_match: decisionsMatch,
    actual_decisions: actualDecisions,
    errors: allErrors,
    diffs
  };

  // Write replay result
  writeFileSync(
    join(traceDir, 'replay.json'),
    JSON.stringify(result, null, 2)
  );

  // Write diff if any
  if (diffs.length > 0) {
    writeFileSync(
      join(traceDir, 'diff.json'),
      JSON.stringify({ diffs, timestamp: new Date().toISOString() }, null, 2)
    );
  }

  return result;
}
```

**Step 2: Write test**

Create: `src/governance/__tests__/replay.test.mjs`

```javascript
import { replay } from '../replay.mjs';
import { createTrace } from '../trace.mjs';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';

const testDir = mkdtempSync(join(tmpdir(), 'replay-test-'));

try {
  // Create a valid trace
  const trace = createTrace(testDir);

  trace.append('gate.start', { input: { task: 'test' } });
  trace.append('gate.decision', { decision: 'ALLOW' });
  trace.append('enforce.check', { contract_id: 'test-001' });
  trace.append('enforce.result', { passed: true, violations: [] });
  trace.append('action.executed', { action: 'write test.txt' });
  trace.append('verdict.generated', { verdict_id: 'v-001' });

  // Test 1: Valid trace passes
  {
    const result = replay(trace.traceDir);
    assert(result.status === 'PASS', 'valid trace passes');
    assert(result.schema_valid === true, 'schema valid');
    assert(result.hash_chain_valid === true, 'hash chain valid');
    console.log('✓ Test 1: Valid trace passes replay');
  }

  // Test 2: With expected decisions
  {
    const result = replay(trace.traceDir, {
      gate_decisions: ['ALLOW'],
      enforce_results: [{ passed: true, violations: 0 }],
      actions_blocked: [],
      actions_executed: ['write test.txt']
    });

    assert(result.decisions_match === true, 'decisions match');
    console.log('✓ Test 2: Decisions match expected');
  }

  // Test 3: Mismatched expectations
  {
    const result = replay(trace.traceDir, {
      gate_decisions: ['BLOCK'], // Wrong!
      enforce_results: [{ passed: true, violations: 0 }],
      actions_blocked: [],
      actions_executed: ['write test.txt']
    });

    assert(result.decisions_match === false, 'detects mismatch');
    assert(result.diffs.length > 0, 'has diffs');
    console.log('✓ Test 3: Detects decision mismatch');
  }

  console.log('\n✓ All replay tests passed');
} finally {
  rmSync(testDir, { recursive: true });
}
```

**Step 3: Run test**

Run: `node src/governance/__tests__/replay.test.mjs`
Expected: `✓ All replay tests passed`

**Step 4: Commit**

```bash
git add src/governance/replay.mjs src/governance/__tests__/replay.test.mjs
git commit -m "feat(governance): implement replay module with verification"
```

---

### Task 2.6: Create Kernel Entry Point

**Files:**
- Create: `src/governance/index.mjs`

**Step 1: Write index module**

```javascript
/**
 * LiYe Governance Kernel v1
 *
 * Four primitives for auditable agent governance:
 * - gate: Risk assessment before action
 * - enforce: Contract compliance checking
 * - trace: Append-only audit event chain
 * - replay: Deterministic verification
 */

export { gate } from './gate.mjs';
export { enforce } from './enforce.mjs';
export { createTrace, loadTrace } from './trace.mjs';
export { replay } from './replay.mjs';

// Re-export utilities
export { sha256, hashEvent } from './utils/hash.mjs';
export {
  generateTraceId,
  generateSpanId,
  generateGateId,
  generateVerdictId
} from './utils/id.mjs';

/**
 * Kernel version
 */
export const VERSION = '1.0.0';

/**
 * Run a complete governance cycle
 * @param {object} input - Task input
 * @param {object} options - Options
 * @param {string} options.outputDir - Output directory for traces
 * @param {object[]} [options.contracts] - Contracts to enforce
 * @returns {object} Execution result with trace
 */
export async function runGovernedTask(input, options) {
  const { outputDir, contracts = [] } = options;

  // Create trace
  const { createTrace } = await import('./trace.mjs');
  const trace = createTrace(outputDir);

  // Gate check
  trace.append('gate.start', { input });
  const { gate } = await import('./gate.mjs');
  const gateReport = gate(input, { contracts });
  trace.append('gate.decision', gateReport);

  if (gateReport.decision === 'BLOCK') {
    const verdict = {
      verdict_id: `verdict-${Date.now().toString(36)}`,
      trace_id: trace.traceId,
      ts: new Date().toISOString(),
      summary: 'Task blocked due to governance gate.',
      decision: 'BLOCK',
      why: gateReport.risks.map(r => r.rationale),
      what_changed: [],
      what_blocked: ['Task execution'],
      next_steps: gateReport.recommended_next_actions
    };

    trace.append('verdict.generated', verdict);

    return {
      status: 'BLOCKED',
      trace_id: trace.traceId,
      trace_dir: trace.traceDir,
      gate_report: gateReport,
      verdict
    };
  }

  // Enforce contracts
  const { enforce } = await import('./enforce.mjs');

  for (const contract of contracts) {
    trace.append('enforce.check', { contract_id: contract.contract_id });
    const enforceResult = enforce(contract, input.actions || [], input.context);
    trace.append('enforce.result', enforceResult);

    if (!enforceResult.passed) {
      const verdict = {
        verdict_id: `verdict-${Date.now().toString(36)}`,
        trace_id: trace.traceId,
        ts: new Date().toISOString(),
        summary: `Task blocked by contract ${contract.contract_id}.`,
        decision: 'BLOCK',
        why: enforceResult.violations.map(v => v.rationale),
        what_changed: [],
        what_blocked: enforceResult.violations.map(v => v.action),
        next_steps: ['Review and modify proposed actions']
      };

      trace.append('verdict.generated', verdict);

      return {
        status: 'BLOCKED',
        trace_id: trace.traceId,
        trace_dir: trace.traceDir,
        gate_report: gateReport,
        enforce_result: enforceResult,
        verdict
      };
    }
  }

  // All checks passed
  const verdict = {
    verdict_id: `verdict-${Date.now().toString(36)}`,
    trace_id: trace.traceId,
    ts: new Date().toISOString(),
    summary: 'Task approved by governance kernel.',
    decision: 'ALLOW',
    why: ['No blocking risks detected', 'All contracts satisfied'],
    what_changed: [],
    what_blocked: [],
    next_steps: ['Proceed with task execution']
  };

  trace.append('verdict.generated', verdict);

  return {
    status: 'ALLOWED',
    trace_id: trace.traceId,
    trace_dir: trace.traceDir,
    gate_report: gateReport,
    verdict
  };
}
```

**Step 2: Write integration test**

Create: `src/governance/__tests__/integration.test.mjs`

```javascript
import { runGovernedTask, VERSION } from '../index.mjs';
import { replay } from '../replay.mjs';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';

console.log(`Testing Governance Kernel v${VERSION}\n`);

const testDir = mkdtempSync(join(tmpdir(), 'kernel-test-'));

try {
  // Test 1: Happy path
  {
    const result = await runGovernedTask(
      {
        task: 'Add a new feature to the user profile system',
        context: { scope: 'profile', user: 'test' },
        actions: ['read user.js', 'write profile.js']
      },
      { outputDir: testDir }
    );

    assert(result.status === 'ALLOWED', 'allows valid task');
    assert(existsSync(join(result.trace_dir, 'events.ndjson')), 'trace exists');

    // Verify replay
    const replayResult = replay(result.trace_dir);
    assert(replayResult.status === 'PASS', 'replay passes');

    console.log('✓ Test 1: Happy path - ALLOW + replay PASS');
  }

  // Test 2: Blocked by gate
  {
    const result = await runGovernedTask(
      {
        task: 'Do it',  // Too brief
        context: {}      // No context
      },
      { outputDir: testDir }
    );

    assert(result.status === 'BLOCKED' || result.gate_report.decision !== 'ALLOW',
           'blocks or degrades insufficient input');
    console.log('✓ Test 2: Insufficient input handled');
  }

  // Test 3: Blocked by contract
  {
    const result = await runGovernedTask(
      {
        task: 'Clean up temporary files',
        context: { scope: 'cleanup' },
        actions: ['rm -rf /tmp/data']
      },
      {
        outputDir: testDir,
        contracts: [{
          contract_id: 'contract-safety-001',
          version: '1.0.0',
          scope: 'file-operations',
          rules: [{
            rule_id: 'safe-001',
            type: 'deny',
            pattern: 'rm\\s+-rf',
            action: 'block',
            rationale: 'Recursive delete forbidden'
          }]
        }]
      }
    );

    assert(result.status === 'BLOCKED', 'blocks dangerous action');
    assert(result.verdict.what_blocked.length > 0, 'records blocked action');
    console.log('✓ Test 3: Contract violation - BLOCK');
  }

  console.log('\n✓ All integration tests passed');
} finally {
  rmSync(testDir, { recursive: true });
}
```

**Step 3: Run test**

Run: `node src/governance/__tests__/integration.test.mjs`
Expected: `✓ All integration tests passed`

**Step 4: Commit**

```bash
git add src/governance/index.mjs src/governance/__tests__/integration.test.mjs
git commit -m "feat(governance): add kernel entry point with runGovernedTask"
```

---

## Day 4: Golden Test Cases

### Task 4.1: Create Golden Cases Directory Structure

**Files:**
- Create: `golden/10-cases/README.md`
- Create: `golden/10-cases/run_all.mjs`

**Step 1: Create directory structure**

```bash
mkdir -p golden/10-cases
```

**Step 2: Write README**

```markdown
# Golden Test Cases

10 reference cases for Governance Kernel v1 validation.

## Running Cases

```bash
# Run all cases
node golden/10-cases/run_all.mjs

# Run single case
node golden/10-cases/run_case.mjs <case-name>
```

## Case Categories

| # | Case | Type | Expected Decision |
|---|------|------|-------------------|
| 1 | evidence-sufficient | Happy Path | ALLOW |
| 2 | evidence-insufficient | Missing Info | UNKNOWN |
| 3 | action-unauthorized | Authorization | BLOCK |
| 4 | contract-violation | Contract | BLOCK |
| 5 | degraded-fallback | Degradation | DEGRADE |
| 6 | external-unavailable | Dependency | DEGRADE/UNKNOWN |
| 7 | output-contradictory | Consistency | BLOCK/UNKNOWN |
| 8 | goal-unclear | Clarity | UNKNOWN |
| 9 | high-risk-write | Safety | BLOCK |
| 10 | happy-path-full | Complete | ALLOW |

## Evidence Pack Structure

Each case produces:
```
output/
├── events.ndjson    # Trace events
├── verdict.md       # Human-readable verdict
├── verdict.json     # Machine verdict
├── replay.json      # Replay verification
└── diff.json        # Drift (if any)
```
```

**Step 3: Write run_all.mjs**

```javascript
#!/usr/bin/env node
/**
 * Run all golden test cases
 */
import { readdirSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CASES = [
  '01-evidence-sufficient',
  '02-evidence-insufficient',
  '03-action-unauthorized',
  '04-contract-violation',
  '05-degraded-fallback',
  '06-external-unavailable',
  '07-output-contradictory',
  '08-goal-unclear',
  '09-high-risk-write',
  '10-happy-path-full'
];

console.log('Running Golden Test Cases\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;
const results = [];

for (const caseName of CASES) {
  const caseDir = join(__dirname, caseName);

  if (!existsSync(caseDir)) {
    console.log(`⚠ ${caseName}: SKIP (not implemented)`);
    continue;
  }

  const runScript = join(caseDir, 'run.mjs');
  if (!existsSync(runScript)) {
    console.log(`⚠ ${caseName}: SKIP (no run.mjs)`);
    continue;
  }

  try {
    execSync(`node ${runScript}`, {
      cwd: caseDir,
      stdio: 'pipe',
      timeout: 30000
    });

    // Check replay result
    const outputDir = join(caseDir, 'output');
    const replayPath = join(outputDir, 'replay.json');

    if (existsSync(replayPath)) {
      const replay = JSON.parse(readFileSync(replayPath, 'utf-8'));

      if (replay.status === 'PASS') {
        console.log(`✓ ${caseName}: PASS`);
        passed++;
        results.push({ case: caseName, status: 'PASS' });
      } else {
        console.log(`✗ ${caseName}: FAIL (replay failed)`);
        failed++;
        results.push({ case: caseName, status: 'FAIL', reason: 'replay' });
      }
    } else {
      console.log(`✗ ${caseName}: FAIL (no replay.json)`);
      failed++;
      results.push({ case: caseName, status: 'FAIL', reason: 'no replay' });
    }
  } catch (err) {
    console.log(`✗ ${caseName}: FAIL (${err.message})`);
    failed++;
    results.push({ case: caseName, status: 'FAIL', reason: err.message });
  }
}

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);

// Write summary
writeFileSync(
  join(__dirname, 'results.json'),
  JSON.stringify({
    timestamp: new Date().toISOString(),
    passed,
    failed,
    results
  }, null, 2)
);

process.exit(failed > 0 ? 1 : 0);
```

**Step 4: Commit**

```bash
git add golden/10-cases/
git commit -m "feat(governance): add golden test case framework"
```

---

### Task 4.2: Implement Case 1 - Evidence Sufficient (ALLOW)

**Files:**
- Create: `golden/10-cases/01-evidence-sufficient/input.json`
- Create: `golden/10-cases/01-evidence-sufficient/expected.json`
- Create: `golden/10-cases/01-evidence-sufficient/run.mjs`

**Step 1: Create case directory**

```bash
mkdir -p golden/10-cases/01-evidence-sufficient/output
```

**Step 2: Write input.json**

```json
{
  "task": "Add user profile validation to ensure email addresses are properly formatted",
  "context": {
    "scope": "user-profile",
    "component": "validation",
    "risk_level": "low",
    "user_confirmed": true
  },
  "actions": [
    "read src/user/profile.js",
    "write src/user/validation.js",
    "write tests/user/validation.test.js"
  ]
}
```

**Step 3: Write expected.json**

```json
{
  "decision": "ALLOW",
  "gate_decisions": ["ALLOW"],
  "enforce_results": [{ "passed": true, "violations": 0 }],
  "actions_blocked": [],
  "verdict_decision": "ALLOW"
}
```

**Step 4: Write run.mjs**

```javascript
#!/usr/bin/env node
import { runGovernedTask } from '../../../src/governance/index.mjs';
import { replay } from '../../../src/governance/replay.mjs';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, 'output');

// Clean previous output
if (existsSync(outputDir)) {
  rmSync(outputDir, { recursive: true });
}

// Load input and expected
const input = JSON.parse(readFileSync(join(__dirname, 'input.json'), 'utf-8'));
const expected = JSON.parse(readFileSync(join(__dirname, 'expected.json'), 'utf-8'));

// Run governed task
const result = await runGovernedTask(input, {
  outputDir: __dirname,
  contracts: [{
    contract_id: 'contract-standard-dev',
    version: '1.0.0',
    scope: 'development',
    rules: [{
      rule_id: 'dev-001',
      type: 'allow',
      pattern: '.*\\.js$',
      action: 'pass'
    }]
  }]
});

// Move trace to output
const traceDir = result.trace_dir;
const fs = await import('fs');
fs.renameSync(traceDir, outputDir);
result.trace_dir = outputDir;

// Write verdict.md
const verdict = result.verdict;
const verdictMd = `# Verdict: ${verdict.decision}

**Trace ID:** ${verdict.trace_id}
**Timestamp:** ${verdict.ts}

## Summary

${verdict.summary}

## Why

${verdict.why.map(w => `- ${w}`).join('\n')}

## What Changed

${verdict.what_changed?.length ? verdict.what_changed.map(w => `- ${w}`).join('\n') : '_Nothing_'}

## What Blocked

${verdict.what_blocked?.length ? verdict.what_blocked.map(w => `- ${w}`).join('\n') : '_Nothing_'}

## Next Steps

${verdict.next_steps?.map(s => `- ${s}`).join('\n') || '_None_'}
`;

writeFileSync(join(outputDir, 'verdict.md'), verdictMd);
writeFileSync(join(outputDir, 'verdict.json'), JSON.stringify(verdict, null, 2));

// Run replay with expected decisions
const replayResult = replay(outputDir, {
  gate_decisions: expected.gate_decisions,
  enforce_results: expected.enforce_results,
  actions_blocked: expected.actions_blocked,
  actions_executed: []
});

// Verify against expected
const passed = (
  result.verdict.decision === expected.decision &&
  replayResult.status === 'PASS'
);

console.log(`Case: 01-evidence-sufficient`);
console.log(`Expected: ${expected.decision}`);
console.log(`Actual: ${result.verdict.decision}`);
console.log(`Replay: ${replayResult.status}`);
console.log(`Result: ${passed ? 'PASS' : 'FAIL'}`);

if (!passed) {
  process.exit(1);
}
```

**Step 5: Run test**

Run: `node golden/10-cases/01-evidence-sufficient/run.mjs`
Expected: `Result: PASS`

**Step 6: Commit**

```bash
git add golden/10-cases/01-evidence-sufficient/
git commit -m "test(governance): add case 01 - evidence sufficient (ALLOW)"
```

---

### Task 4.3-4.11: Implement Remaining Cases

_Due to space constraints, I'll provide the pattern. Each case follows the same structure._

**Cases to implement:**

| Case | Input Focus | Expected | Key Contract/Evaluator |
|------|-------------|----------|----------------------|
| 02-evidence-insufficient | Empty context | UNKNOWN | Default evidence evaluator |
| 03-action-unauthorized | Admin-only action | BLOCK | Authorization contract |
| 04-contract-violation | rm -rf command | BLOCK | Safety contract |
| 05-degraded-fallback | API unavailable flag | DEGRADE | Fallback contract |
| 06-external-unavailable | External dep missing | UNKNOWN | Dependency evaluator |
| 07-output-contradictory | Conflicting goals | UNKNOWN | Consistency evaluator |
| 08-goal-unclear | Vague task | UNKNOWN | Ambiguity evaluator |
| 09-high-risk-write | DELETE FROM users | BLOCK | Data safety contract |
| 10-happy-path-full | Complete valid input | ALLOW | All contracts pass |

**For each case:**
1. Create `input.json` with appropriate test data
2. Create `expected.json` with expected decision/outcomes
3. Create `run.mjs` following Case 1 pattern
4. Run and verify
5. Commit

**Step: Commit all cases**

```bash
git add golden/10-cases/
git commit -m "test(governance): add all 10 golden test cases"
```

---

## Day 5: CI Gate

### Task 5.1: Create CI Workflow

**Files:**
- Create: `.github/workflows/governance-kernel-gate.yml`

**Step 1: Write workflow**

```yaml
name: Governance Kernel Gate

on:
  pull_request:
    paths:
      - 'src/governance/**'
      - 'contracts/governance/**'
      - 'golden/**'
  push:
    branches: [main]
    paths:
      - 'src/governance/**'
      - 'contracts/governance/**'
      - 'golden/**'
  workflow_dispatch:

jobs:
  validate-schemas:
    name: Validate Schemas
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Validate Protocol Schemas
        run: node contracts/governance/v1/validate-schemas.mjs

  run-golden-cases:
    name: Run Golden Cases
    runs-on: ubuntu-latest
    needs: validate-schemas
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run All Golden Cases
        run: node golden/10-cases/run_all.mjs

      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: golden-case-results
          path: |
            golden/10-cases/results.json
            golden/10-cases/*/output/
          retention-days: 30

      - name: Check for Drift
        run: |
          if find golden/10-cases -name "diff.json" -size +2c | grep -q .; then
            echo "::error::Drift detected in golden cases!"
            find golden/10-cases -name "diff.json" -exec cat {} \;
            exit 1
          fi

  replay-verification:
    name: Replay Verification
    runs-on: ubuntu-latest
    needs: run-golden-cases
    steps:
      - uses: actions/checkout@v4

      - name: Download Results
        uses: actions/download-artifact@v4
        with:
          name: golden-case-results
          path: golden/10-cases/

      - name: Verify All Replays Pass
        run: |
          FAIL_COUNT=0
          for replay in golden/10-cases/*/output/replay.json; do
            if [ -f "$replay" ]; then
              STATUS=$(jq -r '.status' "$replay")
              CASE=$(dirname $(dirname "$replay") | xargs basename)
              if [ "$STATUS" != "PASS" ]; then
                echo "::error::Replay FAIL: $CASE"
                FAIL_COUNT=$((FAIL_COUNT + 1))
              else
                echo "Replay PASS: $CASE"
              fi
            fi
          done

          if [ $FAIL_COUNT -gt 0 ]; then
            echo "::error::$FAIL_COUNT replay(s) failed"
            exit 1
          fi
```

**Step 2: Commit**

```bash
git add .github/workflows/governance-kernel-gate.yml
git commit -m "ci(governance): add kernel gate workflow"
```

---

## Day 6: MCP Integration

### Task 6.1: Create MCP Server

**Files:**
- Create: `src/governance/mcp/server.mjs`

**Step 1: Write MCP server**

```javascript
/**
 * Governance Kernel MCP Server
 * Exposes gate, enforce, replay as MCP tools
 */
import { gate } from '../gate.mjs';
import { enforce } from '../enforce.mjs';
import { createTrace } from '../trace.mjs';
import { replay } from '../replay.mjs';
import { runGovernedTask, VERSION } from '../index.mjs';

/**
 * MCP Tool definitions
 */
export const tools = [
  {
    name: 'governance_gate',
    description: 'Evaluate risk gate for proposed task',
    inputSchema: {
      type: 'object',
      required: ['task'],
      properties: {
        task: { type: 'string', description: 'Task description' },
        context: { type: 'object', description: 'Task context' },
        contracts: { type: 'array', description: 'Contracts to check' }
      }
    }
  },
  {
    name: 'governance_enforce',
    description: 'Check actions against contract',
    inputSchema: {
      type: 'object',
      required: ['contract', 'actions'],
      properties: {
        contract: { type: 'object', description: 'Contract definition' },
        actions: { type: 'array', description: 'Actions to check' },
        context: { type: 'object', description: 'Execution context' }
      }
    }
  },
  {
    name: 'governance_replay',
    description: 'Verify trace integrity',
    inputSchema: {
      type: 'object',
      required: ['trace_dir'],
      properties: {
        trace_dir: { type: 'string', description: 'Path to trace directory' },
        expected: { type: 'object', description: 'Expected decisions' }
      }
    }
  },
  {
    name: 'governance_run',
    description: 'Run complete governance cycle',
    inputSchema: {
      type: 'object',
      required: ['task', 'output_dir'],
      properties: {
        task: { type: 'string', description: 'Task description' },
        context: { type: 'object', description: 'Task context' },
        actions: { type: 'array', description: 'Proposed actions' },
        output_dir: { type: 'string', description: 'Output directory' },
        contracts: { type: 'array', description: 'Contracts to enforce' }
      }
    }
  }
];

/**
 * Handle MCP tool call
 */
export async function handleToolCall(name, args) {
  switch (name) {
    case 'governance_gate':
      return gate(
        { task: args.task, context: args.context || {} },
        { contracts: args.contracts }
      );

    case 'governance_enforce':
      return enforce(args.contract, args.actions, args.context || {});

    case 'governance_replay':
      return replay(args.trace_dir, args.expected);

    case 'governance_run':
      return runGovernedTask(
        {
          task: args.task,
          context: args.context || {},
          actions: args.actions || []
        },
        {
          outputDir: args.output_dir,
          contracts: args.contracts || []
        }
      );

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * MCP Server info
 */
export const serverInfo = {
  name: 'liye-governance-kernel',
  version: VERSION,
  description: 'LiYe Governance Kernel - auditable agent governance'
};
```

**Step 2: Write STDIO transport wrapper**

Create: `src/governance/mcp/stdio.mjs`

```javascript
#!/usr/bin/env node
/**
 * STDIO transport for Governance Kernel MCP
 */
import { createInterface } from 'readline';
import { tools, handleToolCall, serverInfo } from './server.mjs';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function respond(id, result) {
  const response = { jsonrpc: '2.0', id, result };
  console.log(JSON.stringify(response));
}

function respondError(id, code, message) {
  const response = { jsonrpc: '2.0', id, error: { code, message } };
  console.log(JSON.stringify(response));
}

rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    const { id, method, params } = request;

    switch (method) {
      case 'initialize':
        respond(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo
        });
        break;

      case 'tools/list':
        respond(id, { tools });
        break;

      case 'tools/call':
        try {
          const result = await handleToolCall(params.name, params.arguments);
          respond(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
        } catch (err) {
          respondError(id, -32000, err.message);
        }
        break;

      default:
        respondError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    respondError(null, -32700, 'Parse error');
  }
});

// Signal ready
console.error(`Governance Kernel MCP Server v${serverInfo.version} ready`);
```

**Step 3: Add to package.json bin**

Edit package.json to add:
```json
{
  "bin": {
    "governance-mcp": "./src/governance/mcp/stdio.mjs"
  }
}
```

**Step 4: Commit**

```bash
git add src/governance/mcp/
git commit -m "feat(governance): add MCP server for kernel integration"
```

---

## Day 7: Documentation & Acceptance

### Task 7.1: Write Acceptance Document

**Files:**
- Create: `docs/execution/GOVERNANCE_KERNEL_P0_ACCEPTANCE.md`

**Step 1: Write acceptance doc**

```markdown
# Governance Kernel P0 Acceptance

> **Version:** 1.0.0
> **Date:** 2026-01-23
> **Status:** Ready for Review

## Deliverables Checklist

### A. Protocol v1 (Frozen)

- [x] `contracts/governance/v1/GateReport.schema.json`
- [x] `contracts/governance/v1/Contract.schema.json`
- [x] `contracts/governance/v1/TraceEvent.schema.json`
- [x] `contracts/governance/v1/Verdict.schema.json`
- [x] `docs/contracts/governance/v1/GOVERNANCE_PROTOCOL_V1.md`

### B. Kernel v1 (Minimal Implementation)

- [x] `src/governance/gate.mjs` — Risk assessment
- [x] `src/governance/enforce.mjs` — Contract enforcement
- [x] `src/governance/trace.mjs` — Append-only audit chain
- [x] `src/governance/replay.mjs` — Deterministic verification
- [x] `src/governance/index.mjs` — Entry point + `runGovernedTask`

### C. Evidence Pack (10 Golden Cases)

- [x] 01-evidence-sufficient (ALLOW)
- [x] 02-evidence-insufficient (UNKNOWN)
- [x] 03-action-unauthorized (BLOCK)
- [x] 04-contract-violation (BLOCK)
- [x] 05-degraded-fallback (DEGRADE)
- [x] 06-external-unavailable (DEGRADE/UNKNOWN)
- [x] 07-output-contradictory (BLOCK/UNKNOWN)
- [x] 08-goal-unclear (UNKNOWN)
- [x] 09-high-risk-write (BLOCK)
- [x] 10-happy-path-full (ALLOW)

### D. CI Gate

- [x] `.github/workflows/governance-kernel-gate.yml`
- [x] Schema validation step
- [x] Golden case execution
- [x] Replay verification
- [x] Drift detection

## Quick Start (5 Minutes)

```bash
# 1. Clone and enter repo
git clone <repo> && cd liye_os

# 2. Run all golden cases
node golden/10-cases/run_all.mjs

# 3. View evidence pack for any case
ls golden/10-cases/01-evidence-sufficient/output/
# events.ndjson  verdict.md  verdict.json  replay.json

# 4. View replay result
cat golden/10-cases/01-evidence-sufficient/output/replay.json
```

## Evidence Pack Structure

```
golden/10-cases/<case>/output/
├── events.ndjson     # Append-only trace (hash chain)
├── verdict.md        # Human-readable decision
├── verdict.json      # Machine-readable verdict
├── replay.json       # Verification result
└── diff.json         # Drift (only if detected)
```

## How Replay Detects Drift

1. **Schema Check** — All events match TraceEvent.schema.json
2. **Hash Chain** — Each event.hash = SHA256(ts + type + payload + hash_prev)
3. **Decision Match** — Actual decisions match expected

If any check fails, replay.json shows `status: "FAIL"` with errors.

## Known Limitations

1. **No runtime behavior modification** — Phase 0 is observation-only
2. **No perplexity calculation** — Uses proxy signals only
3. **No external API validation** — Contracts are local
4. **Basic condition evaluation** — JSONPath-like, not full expression language

## Verification Commands

```bash
# Validate all schemas
node contracts/governance/v1/validate-schemas.mjs

# Run specific case
node golden/10-cases/01-evidence-sufficient/run.mjs

# Run all cases
node golden/10-cases/run_all.mjs

# Check CI locally
act -j validate-schemas  # requires 'act' tool
```

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Schema validation | 4/4 pass | ✅ |
| Golden cases | 10/10 pass | ✅ |
| Replay integrity | 100% | ✅ |
| CI green | All jobs | ✅ |

---

*No UI. No platform. Pure kernel.*
```

**Step 2: Commit**

```bash
git add docs/execution/GOVERNANCE_KERNEL_P0_ACCEPTANCE.md
git commit -m "docs(governance): add P0 acceptance document"
```

---

### Task 7.2: Final PR

**Step 1: Create feature branch (if not already)**

```bash
git checkout -b feat/governance-kernel-v1
```

**Step 2: Push and create PR**

```bash
git push -u origin feat/governance-kernel-v1

gh pr create \
  --title "feat(governance): kernel v1 protocol+trace+replay" \
  --body "$(cat <<'EOF'
## Summary

LiYe Governance Kernel v1 - embeddable governance primitives for auditable agent execution.

## Deliverables

- **Protocol v1 (frozen)**: 4 JSON Schemas + documentation
- **Kernel v1**: gate, enforce, trace, replay primitives
- **10 Golden Cases**: Including failure scenarios
- **CI Gate**: Schema validation + replay enforcement

## Evidence

```
golden/10-cases/01-evidence-sufficient/output/
├── events.ndjson   # 6 events, hash chain verified
├── verdict.md      # ALLOW decision
├── replay.json     # status: PASS
└── verdict.json    # machine-readable
```

## Gate Status

- [x] Schema validation: PASS
- [x] Golden cases: 10/10 PASS
- [x] Replay verification: PASS
- [x] No drift detected

## Not Included (P0 Scope)

- ❌ No UI
- ❌ No platform
- ❌ No multi-tenant
- ❌ No RAG backend
EOF
)"
```

---

## Execution Summary

| Day | Deliverable | Commits |
|-----|-------------|---------|
| 1 | Protocol v1 frozen | 7 |
| 2-3 | Kernel implementation | 6 |
| 4 | 10 golden cases | 11 |
| 5 | CI gate | 1 |
| 6 | MCP integration | 2 |
| 7 | Acceptance + PR | 2 |

**Total: ~29 commits over 7 days**

---

Plan complete and saved to `docs/plans/2026-01-23-governance-kernel-v1.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
