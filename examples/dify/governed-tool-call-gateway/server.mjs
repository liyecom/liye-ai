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

// ============================================
// HF1: AGE MCP Routing + Mock Fallback
// ============================================
const AGE_MCP_CONFIG = {
  base_url: process.env.AGE_MCP_URL || 'http://localhost:8765',
  timeout_ms: parseInt(process.env.AGE_MCP_TIMEOUT || '5000'),
  tools_allowlist: [
    'amazon://strategy/campaign-audit',
    'amazon://strategy/wasted-spend-detect',
    'amazon://execution/dry-run'
  ]
};

// Route to AGE MCP server (default path)
async function routeToAgeMcp(tool, args, traceId) {
  const url = `${AGE_MCP_CONFIG.base_url}/v1/tools/call`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGE_MCP_CONFIG.timeout_ms);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, arguments: args, trace_id: traceId }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      throw new Error(`AGE MCP returned ${resp.status}`);
    }
    const data = await resp.json();
    return { ok: true, data, mock_used: false };
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[AGE MCP] Failed: ${err.message}`);
    return { ok: false, error: err.message, mock_used: true };
  }
}

// HF1: Mock fallback response (DEGRADE, not BLOCK)
function createMockFallbackResponse(tool, args, traceId, error) {
  return {
    origin: 'amazon-growth-engine',
    phase0_only: true,
    trace_id: traceId,
    tool: tool,
    mode: 'mock_fallback',
    mock_used: true,
    fallback_reason: error,
    result: {
      message: 'Mock fallback response - AGE MCP unavailable',
      simulated: true,
      data: tool.includes('campaign-audit')
        ? { metrics: { acos: 'N/A', spend: 'N/A' }, status: 'MOCK' }
        : tool.includes('wasted-spend')
          ? { candidates: [], total_wasted_spend: 0 }
          : { simulated_outcome: 'UNKNOWN', what_would_happen: 'Unable to simulate' }
    },
    timestamp: new Date().toISOString(),
    GUARANTEE: {
      no_real_write: true,
      mock_used: true,
      fallback_active: true
    }
  };
}

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

    // Generate trace_id early for AGE routing
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // HF1: Route AGE tools through AGE MCP first (default path)
    let ageResults = [];
    let mockUsed = false;
    for (const action of proposed_actions) {
      if (AGE_MCP_CONFIG.tools_allowlist.includes(action.tool)) {
        const ageResult = await routeToAgeMcp(action.tool, action.arguments || {}, traceId);
        if (ageResult.ok) {
          ageResults.push({ action, result: ageResult.data, mock_used: false });
        } else {
          // HF1: Fallback to mock (DEGRADE, not BLOCK)
          mockUsed = true;
          const mockResp = createMockFallbackResponse(action.tool, action.arguments || {}, traceId, ageResult.error);
          ageResults.push({ action, result: mockResp, mock_used: true });
        }
      }
    }

    // Run full governance cycle
    const result = await runGovernanceCycle({
      task,
      context: { ...context, age_results: ageResults, mock_used: mockUsed },
      proposed_actions
    }, {
      baseDir: '.liye/traces'
    });

    // Use governance trace_id if available, otherwise use our generated one
    const finalTraceId = result.trace_id || traceId;
    const decision = mockUsed ? 'DEGRADE' : (result.gateReport?.decision || 'UNKNOWN');

    // Build response
    const response = {
      ok: decision === 'ALLOW' || decision === 'DEGRADE',
      result: decision === 'ALLOW' || decision === 'DEGRADE'
        ? {
            message: mockUsed ? 'Action approved with mock fallback' : 'Action approved for execution',
            age_results: ageResults.length > 0 ? ageResults : undefined
          }
        : null,
      decision,
      mock_used: mockUsed,
      trace_id: finalTraceId,
      evidence_path: `.liye/traces/${finalTraceId}/`,
      verdict_summary: mockUsed
        ? `AGE MCP unavailable - using mock fallback. ${generateVerdictSummary(result.gateReport, result.verdict)}`
        : generateVerdictSummary(result.gateReport, result.verdict),
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
