# Governed Tool Call Gateway for Dify

HTTP Gateway exposing LiYe Governance Kernel for Dify Custom Tool integration.

## Quick Start

```bash
# Start gateway (port 3210)
node server.mjs

# Custom port
PORT=8080 node server.mjs
```

## Endpoint

```
POST /v1/governed_tool_call
```

Request:
```json
{
  "task": "Search knowledge base",
  "proposed_actions": [
    { "action_type": "read", "tool": "semantic_search", "arguments": { "query": "..." } }
  ]
}
```

Response:
```json
{
  "ok": true,
  "decision": "ALLOW",
  "trace_id": "trace-xxx",
  "evidence_path": ".liye/traces/trace-xxx/",
  "verdict_summary": "Action approved: no risks detected."
}
```

## Dify Integration

1. Copy `openapi.yaml` content
2. Dify → Tools → Custom → Import via OpenAPI
3. Paste the OpenAPI schema
4. Set server URL: `http://localhost:3210`

See: `docs/integrations/DIFY_GOVERNED_DEMO_V1.md`
