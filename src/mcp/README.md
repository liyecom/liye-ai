# LiYe Governance MCP Server v1

Minimal MCP server exposing the Governance Kernel v1 as 4 tools.

## Tools

| Tool | Input | Output |
|------|-------|--------|
| `governance_gate` | task, context, proposed_actions | GateReport (v1 schema) |
| `governance_enforce` | contract, actions | EnforceResult |
| `governance_verdict` | gate_report, enforce_result | Verdict (v1 schema) |
| `governance_replay` | trace_id | ReplayResult (PASS/FAIL) |

## Usage

### As MCP Server (stdio)

```bash
node src/mcp/server.mjs
```

### Programmatic

```javascript
import { handleToolCall } from './tools.mjs';

// Call gate
const result = await handleToolCall('governance_gate', {
  task: 'Delete user account',
  proposed_actions: [
    { action_type: 'delete', resource: 'user/123' }
  ]
});

console.log(result.gate_report.decision);  // 'BLOCK'
console.log(result.trace_id);              // 'trace-xxx'
```

## Schema Validation

All outputs are validated against frozen v1 schemas:

- GateReport → `contracts/governance/v1/gate-report.schema.json`
- Verdict → `contracts/governance/v1/verdict.schema.json`
- TraceEvent → `contracts/governance/v1/trace-event.schema.json`

## Trace Directory

All tool calls generate trace events in:

```
.liye/traces/<trace_id>/
├── events.ndjson   # Hash-chained audit events
├── verdict.json    # Machine-readable verdict
├── verdict.md      # Human-readable verdict
├── replay.json     # Replay verification result
└── diff.json       # Drift detection (if errors)
```

## Testing

```bash
node .claude/scripts/mcp_smoke_test.mjs
```
