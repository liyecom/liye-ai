# Governed Tool Call Specification v1

> **LiYe OS Federation Pack** - Standard pattern for governed tool execution.

**Version**: 1.0.0
**Last Updated**: 2026-01-24
**Status**: MANDATORY

---

## Overview

**Every external tool call** (including Knowledge MCP operations) **MUST** follow the Governed Tool Call pattern:

```
Gate → Execute (if allowed) → Verdict → Replay
```

This ensures:
- **Auditability**: Every action has a tamper-evident trace
- **Accountability**: Decisions are explainable with evidence
- **Compliance**: Contracts are enforced before execution

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Governed Tool Call Flow                      │
└─────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │  Task Input  │
     │  + Actions   │
     └──────┬───────┘
            │
            ▼
  ┌─────────────────────┐
  │  1. governance_gate │  ←── Risk assessment
  └─────────┬───────────┘
            │
            ▼
    ┌───────────────┐
    │   Decision?   │
    └───────┬───────┘
            │
   ┌────────┼────────┬────────┐
   │        │        │        │
   ▼        ▼        ▼        ▼
 BLOCK   UNKNOWN  DEGRADE  ALLOW
   │        │        │        │
   │        │        │        ▼
   │        │        │  ┌─────────────────┐
   │        │        │  │ 2. Execute Tool │ ←── Knowledge MCP
   │        │        │  └────────┬────────┘
   │        │        │           │
   │        │        ▼           ▼
   │        │    [degraded    [full
   │        │     execution]  execution]
   │        │        │           │
   └────────┴────────┴───────────┘
                     │
                     ▼
          ┌───────────────────────┐
          │ 3. governance_verdict │ ←── Human-readable decision
          └───────────┬───────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │ 4. governance_replay  │ ←── Verify trace integrity
          └───────────┬───────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │   Evidence Package    │
          │  .liye/traces/<id>/   │
          └───────────────────────┘
```

---

## Step-by-Step Protocol

### Step 1: Gate (Pre-flight Check)

**Call**: `governance_gate`

**Purpose**: Assess risk of proposed actions BEFORE execution.

```json
{
  "task": "Query knowledge base for ACOS optimization strategies",
  "context": {
    "user": "operator",
    "environment": "production"
  },
  "proposed_actions": [
    {
      "action_type": "read",
      "tool": "semantic_search",
      "resource": "qdrant://amazon_knowledge_base"
    }
  ]
}
```

**Possible Decisions**:

| Decision | Meaning | Next Step |
|----------|---------|-----------|
| `ALLOW` | Safe to proceed | Execute tool |
| `DEGRADE` | Proceed with constraints | Execute with limitations |
| `UNKNOWN` | Insufficient information | Request evidence, then re-gate |
| `BLOCK` | Action prohibited | Skip to Verdict (no execution) |

### Step 2: Execute (Conditional)

**Execute Knowledge MCP tool ONLY IF**:
- Decision is `ALLOW` or `DEGRADE`

**Skip execution IF**:
- Decision is `BLOCK` or `UNKNOWN`

```javascript
// Pseudo-code
if (gateReport.decision === 'BLOCK') {
  // Skip execution, go directly to verdict
  skipExecution = true;
} else if (gateReport.decision === 'UNKNOWN') {
  // Request evidence or re-plan
  skipExecution = true;
} else {
  // ALLOW or DEGRADE: execute
  toolResult = await knowledgeMCP.call('semantic_search', { query: '...' });
}
```

### Step 3: Verdict (Decision Synthesis)

**Call**: `governance_verdict`

**Purpose**: Generate human-readable explanation of the decision.

```json
{
  "trace_id": "<from gate>",
  "gate_report": { /* from step 1 */ },
  "enforce_result": null
}
```

**Output includes**:
- `summary`: One-line decision summary
- `why`: List of reasons for the decision
- `next_steps`: Recommended actions
- `confidence`: Decision confidence score

### Step 4: Replay (Integrity Verification)

**Call**: `governance_replay`

**Purpose**: Verify the trace is complete and untampered.

```json
{
  "trace_id": "<from gate>"
}
```

**Verification checks**:
- Schema validation (all events match schema)
- Hash chain verification (no tampering)
- Structure validation (gate.start → gate.end → verdict exists)

**ONLY** accept `status: "PASS"` as valid.

---

## Decision Matrix

| Gate Decision | Contract Effect | Final Action |
|---------------|-----------------|--------------|
| ALLOW | ALLOW | Execute normally |
| ALLOW | DENY | BLOCK (contract overrides) |
| ALLOW | DEGRADE | Execute with constraints |
| DEGRADE | ALLOW | Execute with gate constraints |
| DEGRADE | DENY | BLOCK |
| DEGRADE | DEGRADE | Execute with combined constraints |
| BLOCK | (any) | No execution |
| UNKNOWN | (any) | No execution, request evidence |

---

## Code Example (JavaScript)

```javascript
import { handleToolCall } from './src/mcp/tools.mjs';

async function governedKnowledgeCall(task, proposedActions) {
  // Step 1: Gate
  const gateResult = await handleToolCall('governance_gate', {
    task,
    proposed_actions: proposedActions
  });

  const traceId = gateResult.trace_id;
  const decision = gateResult.gate_report.decision;

  let toolResult = null;

  // Step 2: Execute (conditional)
  if (decision === 'ALLOW' || decision === 'DEGRADE') {
    // Call Knowledge MCP tool
    toolResult = await knowledgeMCP.call(
      proposedActions[0].tool,
      proposedActions[0].arguments
    );
  }

  // Step 3: Verdict
  const verdictResult = await handleToolCall('governance_verdict', {
    trace_id: traceId,
    gate_report: gateResult.gate_report
  });

  // Step 4: Replay
  const replayResult = await handleToolCall('governance_replay', {
    trace_id: traceId
  });

  // Verify replay passed
  if (replayResult.replay.status !== 'PASS') {
    throw new Error(`Trace integrity check failed: ${traceId}`);
  }

  return {
    decision,
    toolResult,
    verdict: verdictResult.verdict,
    traceId,
    replayStatus: replayResult.replay.status
  };
}
```

---

## Evidence Package Structure

After a governed call completes, the trace directory contains:

```
.liye/traces/<trace_id>/
├── events.ndjson    # Hash-chained event log (NDJSON format)
├── verdict.json     # Structured verdict (JSON)
├── verdict.md       # Human-readable verdict (Markdown)
├── replay.json      # Verification result
└── diff.json        # Discrepancies (empty if PASS)
```

### events.ndjson Format

```json
{"seq":0,"type":"gate.start","ts":"...","payload":{...},"hash":"sha256:..."}
{"seq":1,"type":"gate.risk","ts":"...","payload":{...},"prev_hash":"sha256:...","hash":"sha256:..."}
{"seq":2,"type":"gate.end","ts":"...","payload":{...},"prev_hash":"sha256:...","hash":"sha256:..."}
{"seq":3,"type":"verdict","ts":"...","payload":{...},"prev_hash":"sha256:...","hash":"sha256:..."}
```

---

## Violations & Remediation

### Violation: Tool called without Gate

**Detection**: No `gate.start` event before tool execution in audit log.

**Remediation**: All integrations MUST use the governed call pattern. Direct tool calls are prohibited.

### Violation: Replay FAIL

**Detection**: `governance_replay` returns `status: "FAIL"`.

**Possible causes**:
- Hash chain broken (tampering detected)
- Missing events (incomplete trace)
- Schema validation failed

**Remediation**: Investigate trace, do not trust the results.

### Violation: Execution despite BLOCK

**Detection**: Tool result present when gate decision was BLOCK.

**Remediation**: This is a critical violation. Escalate to security review.

---

## FAQ

### Q: Can I call Knowledge MCP directly without governance?

**A**: NO. All external tool calls must go through the governed pattern. Direct calls bypass auditability and compliance.

### Q: What if Gate returns UNKNOWN?

**A**: Do NOT execute. Either:
1. Provide additional evidence and re-gate
2. Reject the request with explanation

### Q: Is Replay required for every call?

**A**: YES. Replay verifies trace integrity. Skipping replay means you cannot prove the decision was legitimate.

### Q: Can I batch multiple tool calls in one governed call?

**A**: Yes, include all proposed actions in `proposed_actions` array. Gate evaluates them together.
