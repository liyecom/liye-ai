#!/usr/bin/env node
/**
 * Governed Tool Call HTTP Gateway for Dify
 *
 * Exposes a single endpoint for Dify Custom Tool integration.
 * Every call goes through LiYe Governance Kernel: Gate → Verdict → Replay
 *
 * Endpoint: POST /v1/governed_tool_call
 *
 * Request:
 *   {
 *     "task": "string",
 *     "context": {},
 *     "proposed_actions": [
 *       { "action_type": "read", "tool": "semantic_search", "arguments": { "query": "..." } }
 *     ]
 *   }
 *
 * Response:
 *   {
 *     "ok": true/false,
 *     "result": {},
 *     "decision": "ALLOW|DEGRADE|BLOCK|UNKNOWN",
 *     "trace_id": "trace-xxx",
 *     "evidence_path": ".liye/traces/trace-xxx/",
 *     "verdict_summary": "..."
 *   }
 *
 * Usage:
 *   node server.mjs                    # Default port 3210
 *   PORT=8080 node server.mjs          # Custom port
 */

import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOVERNANCE_ROOT = join(__dirname, '..', '..', '..', 'src', 'governance');
const PORT = process.env.PORT || 3210;

// Load governance kernel
async function loadGovernance() {
  const { runGovernanceCycle } = await import(join(GOVERNANCE_ROOT, 'index.mjs'));
  return { runGovernanceCycle };
}

// Parse JSON body from request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        reject(new Error(`Invalid JSON: ${e.message}`));
      }
    });
    req.on('error', reject);
  });
}

// Generate verdict summary for human readability
function generateVerdictSummary(gateReport, verdict) {
  const decision = gateReport?.decision || 'UNKNOWN';
  const risks = gateReport?.risks || [];

  if (decision === 'ALLOW') {
    return 'Action approved: no risks detected.';
  }

  if (decision === 'DEGRADE') {
    const riskTypes = risks.map(r => r.type).join(', ');
    return `Action approved with caution: ${riskTypes || 'minor risks detected'}.`;
  }

  if (decision === 'BLOCK') {
    const riskTypes = risks.map(r => r.type).join(', ');
    const details = risks.map(r => r.message || r.type).join('; ');
    return `Action blocked: ${riskTypes}. ${details}`;
  }

  return 'Unable to evaluate action safety.';
}

// Handle governed tool call
async function handleGovernedToolCall(req, res) {
  // CORS headers for Dify
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({
      ok: false,
      error: 'Method not allowed. Use POST.',
      decision: 'UNKNOWN'
    }));
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({
      ok: false,
      error: e.message,
      decision: 'UNKNOWN'
    }));
    return;
  }

  const { task, context, proposed_actions } = body;

  // Validate required fields
  if (!task || !proposed_actions || !Array.isArray(proposed_actions)) {
    res.writeHead(400);
    res.end(JSON.stringify({
      ok: false,
      error: 'Missing required fields: task, proposed_actions',
      decision: 'UNKNOWN'
    }));
    return;
  }

  try {
    const { runGovernanceCycle } = await loadGovernance();

    // Run full governance cycle
    const result = await runGovernanceCycle({
      task,
      context: context || {},
      proposed_actions
    }, {
      baseDir: '.liye/traces'
    });

    const traceId = result.trace_id;
    const decision = result.gateReport?.decision || 'UNKNOWN';

    // Build response
    const response = {
      ok: decision === 'ALLOW' || decision === 'DEGRADE',
      result: decision === 'ALLOW' || decision === 'DEGRADE'
        ? { message: 'Action approved for execution' }
        : null,
      decision,
      trace_id: traceId,
      evidence_path: `.liye/traces/${traceId}/`,
      verdict_summary: generateVerdictSummary(result.gateReport, result.verdict),
      replay_status: result.replayResult?.status || 'UNKNOWN'
    };

    // Add error for BLOCK/UNKNOWN
    if (decision === 'BLOCK' || decision === 'UNKNOWN') {
      response.error = response.verdict_summary;
    }

    res.writeHead(200);
    res.end(JSON.stringify(response, null, 2));

  } catch (e) {
    // Fail Closed: any error -> UNKNOWN
    console.error('Governance error:', e);
    res.writeHead(500);
    res.end(JSON.stringify({
      ok: false,
      error: `Governance error: ${e.message}`,
      decision: 'UNKNOWN',
      trace_id: null,
      evidence_path: null,
      verdict_summary: 'Governance system error - action blocked for safety.'
    }));
  }
}

// Create HTTP server
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/v1/governed_tool_call') {
    handleGovernedToolCall(req, res);
  } else if (url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'governed-tool-call-gateway' }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not found',
      endpoints: {
        'POST /v1/governed_tool_call': 'Execute governed tool call',
        'GET /health': 'Health check'
      }
    }));
  }
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  Governed Tool Call Gateway for Dify                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoint: http://localhost:${PORT}/v1/governed_tool_call       ║
║  Health:   http://localhost:${PORT}/health                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Every call goes through:                                     ║
║    Gate → Verdict → Replay → Evidence Package                 ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
