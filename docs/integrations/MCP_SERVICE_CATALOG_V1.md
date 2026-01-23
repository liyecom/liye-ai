# MCP Service Catalog v1

> **LiYe OS Federation Pack** - Unified service directory for MCP integrations.

**Version**: 1.0.0
**Last Updated**: 2026-01-24
**Status**: ACTIVE

---

## Overview

LiYe OS exposes two MCP servers with distinct responsibilities:

| Server | Plane | Language | Location |
|--------|-------|----------|----------|
| **Governance MCP** | Control Plane | JavaScript (Node.js) | `src/mcp/` |
| **Knowledge MCP** | Data Plane | Python | `src/runtime/mcp/` |

**Architecture Principle**: Physical separation, unified integration.

---

## 1. Governance MCP (Control Plane)

**Purpose**: Answer "Is this action permitted? Why?"

**Location**: `src/mcp/server.mjs`
**Protocol**: JSON-RPC 2.0 over stdio
**Start Command**: `node src/mcp/server.mjs`

### Tools

| Tool | Description | Risk Level |
|------|-------------|------------|
| `governance_gate` | Evaluate proposed actions for risks before execution | N/A |
| `governance_enforce` | Check proposed actions against a contract | N/A |
| `governance_verdict` | Generate human-readable verdict from gate + enforce | N/A |
| `governance_replay` | Verify trace integrity (schema, hash chain, structure) | N/A |

### Tool Schemas

#### governance_gate

**Input**:
```json
{
  "task": "string (required) - Task description",
  "context": "object (optional) - Task context",
  "proposed_actions": [
    {
      "action_type": "string (required)",
      "tool": "string (optional)",
      "resource": "string (optional)"
    }
  ],
  "trace_id": "string (optional) - Append to existing trace"
}
```

**Output**:
```json
{
  "gate_report": {
    "version": "1.0.0",
    "decision": "ALLOW | BLOCK | DEGRADE | UNKNOWN",
    "risks": [
      {
        "severity": "critical | high | medium | low",
        "category": "string",
        "message": "string"
      }
    ]
  },
  "trace_id": "string"
}
```

#### governance_enforce

**Input**:
```json
{
  "trace_id": "string (optional)",
  "contract": {
    "version": "1.0.0",
    "scope": { "name": "string" },
    "rules": [
      {
        "id": "string",
        "effect": "ALLOW | DENY | DEGRADE | REQUIRE_EVIDENCE",
        "match": { "path_prefix": "string" },
        "rationale": "string"
      }
    ]
  },
  "actions": [
    {
      "action_type": "string",
      "path_prefix": "string (optional)"
    }
  ]
}
```

**Output**:
```json
{
  "enforce_result": {
    "contract_id": "string",
    "decision_summary": "ALLOW | BLOCK",
    "blocked_rule_ids": ["string"],
    "allowed_count": 0,
    "blocked_count": 0,
    "degraded_count": 0
  },
  "trace_id": "string"
}
```

#### governance_verdict

**Input**:
```json
{
  "trace_id": "string (optional)",
  "gate_report": "object (required) - From governance_gate",
  "enforce_result": "object (optional) - From governance_enforce"
}
```

**Output**:
```json
{
  "verdict": {
    "version": "1.0.0",
    "decision_id": "string",
    "final_decision": "ALLOW | BLOCK | DEGRADE | UNKNOWN",
    "summary": "string",
    "why": ["string"],
    "next_steps": ["string"],
    "confidence": 0.0
  },
  "verdict_md": "string (markdown)",
  "trace_id": "string"
}
```

#### governance_replay

**Input**:
```json
{
  "trace_id": "string (required)"
}
```

**Output**:
```json
{
  "replay": {
    "status": "PASS | FAIL",
    "pass": true,
    "event_count": 0,
    "error_count": 0,
    "checks": {
      "schema_valid": true,
      "hash_chain_valid": true,
      "structure_valid": true
    }
  },
  "trace_id": "string"
}
```

---

## 2. Knowledge MCP (Data Plane)

**Purpose**: Answer "What facts are available?"

**Location**: `src/runtime/mcp/`
**Protocol**: JSON-RPC 2.0 over stdio
**Start Command**: `python -m src.runtime.mcp.server_main`

### Servers

The Knowledge MCP contains multiple server implementations:

| Server | Description | Configuration |
|--------|-------------|---------------|
| `qdrant-knowledge` | Vector database semantic search | Qdrant URL, collection |
| `duckdb-datalake` | SQL query on data warehouse | DuckDB file path |

### Tools: qdrant-knowledge

| Tool | Description | Risk Level |
|------|-------------|------------|
| `semantic_search` | Search knowledge base using semantic similarity | READ_ONLY |
| `similar_docs` | Find documents similar to a given document | READ_ONLY |
| `get_document` | Retrieve a specific document by ID | READ_ONLY |
| `list_collections` | List all available Qdrant collections | READ_ONLY |

#### semantic_search

**Input**:
```json
{
  "query": "string (required) - Search query (Chinese or English)",
  "top_k": "integer (optional, default: 5)"
}
```

**Output**:
```json
{
  "query": "string",
  "collection": "string",
  "total_results": 0,
  "results": [
    {
      "id": "string",
      "score": 0.0,
      "source_file": "string",
      "section_title": "string",
      "text_preview": "string"
    }
  ]
}
```

#### similar_docs

**Input**:
```json
{
  "doc_id": "string (required)",
  "top_k": "integer (optional, default: 5)"
}
```

**Output**:
```json
{
  "source_doc_id": "string",
  "collection": "string",
  "similar_docs": [
    { "id": "string", "score": 0.0, "source_file": "string" }
  ]
}
```

#### get_document

**Input**:
```json
{
  "doc_id": "string (required)"
}
```

**Output**:
```json
{
  "id": "string",
  "collection": "string",
  "document": {
    "source_file": "string",
    "section_title": "string",
    "text": "string"
  }
}
```

#### list_collections

**Input**: `{}`

**Output**:
```json
{
  "collections": [
    { "name": "string", "vectors_count": 0 }
  ],
  "total": 0
}
```

### Tools: duckdb-datalake

| Tool | Description | Risk Level |
|------|-------------|------------|
| `execute_query` | Run SQL queries (read-only) | READ_ONLY |
| `get_schema` | Get table schema information | READ_ONLY |
| `list_tables` | List available tables | READ_ONLY |
| `get_sample` | Get sample rows from a table | READ_ONLY |
| `describe_stats` | Get statistical summary of numeric columns | READ_ONLY |

#### execute_query

**Input**:
```json
{
  "sql": "string (required) - SELECT query only",
  "max_rows": "integer (optional, default: 1000)"
}
```

**Output**:
```json
{
  "query": "string",
  "columns": ["string"],
  "row_count": 0,
  "data": [{ "column": "value" }]
}
```

---

## Quick Start

### One Command Up

```bash
# Docker Compose (recommended)
docker compose -f docker-compose.mcp.yml up

# Or npm script
npm run mcp:up
```

### Manual Start

```bash
# Terminal 1: Governance MCP
node src/mcp/server.mjs

# Terminal 2: Knowledge MCP
python -m src.runtime.mcp.server_main
```

---

## Integration Pattern

**All tool calls MUST follow the Governed Tool Call pattern**:

```
Gate → Execute → Verdict → Replay
```

See: [GOVERNED_TOOL_CALL_SPEC_V1.md](./GOVERNED_TOOL_CALL_SPEC_V1.md)

---

## Evidence & Audit

All governance operations produce tamper-evident traces in:

```
.liye/traces/<trace_id>/
├── events.ndjson    # Hash-chained event log
├── verdict.json     # Structured verdict
├── verdict.md       # Human-readable verdict
├── replay.json      # Verification result
└── diff.json        # Discrepancies (if any)
```
