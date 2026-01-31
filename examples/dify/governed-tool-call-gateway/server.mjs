#!/usr/bin/env node
/**
 * Governed Tool Call HTTP Gateway for Dify
 *
 * Phase 1 + Phase 2 Contract-Aligned Implementation
 * Implements HF1-HF5 with full contract compliance.
 *
 * Endpoint: POST /v1/governed_tool_call
 *
 * Contract: src/contracts/phase1/GOV_TOOL_CALL_RESPONSE_V1.json
 *
 * Week3: Added /v1/feishu/actions and /trace/:id/:file endpoints
 * Week4: Added WRITE_ENABLED gate and extended file whitelist
 * Week5: Added execution_result to file whitelist for dry-run results
 * Phase2 Week1: Added rollback_plan to file whitelist for real write recovery
 */

import { createServer } from 'http';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs';

// Feishu Thin-Agent adapters
import { handleFeishuEvent } from '../../feishu/feishu_adapter.mjs';
import { handleFeishuAction } from '../../feishu/feishu_actions.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOVERNANCE_ROOT = join(__dirname, '..', '..', '..', 'src', 'governance');
const TRACE_BASE_DIR = '.liye/traces';
const PORT = process.env.PORT || 3210;
const POLICY_VERSION = process.env.POLICY_VERSION || 'phase1-v1.0.0';

// Week4: WRITE_ENABLED gate (default: 0 = disabled)
const WRITE_ENABLED = process.env.WRITE_ENABLED === '1';

// Week3+4+5+Phase2: Allowed evidence files for static serving (security: whitelist only)
const ALLOWED_EVIDENCE_FILES = [
  'evidence_package.md',
  'dry_run_plan.md',
  'verdict.md',
  'verdict.json',
  'replay.json',
  'action_plan.md',       // Week4
  'action_plan.json',     // Week4
  'approval.json',        // Week4 (optional exposure)
  'execution_result.md',  // Week5
  'execution_result.json', // Week5 (optional exposure)
  'rollback_plan.md',     // Phase2 Week1
  'rollback_plan.json'    // Phase2 Week1
];

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
    // HF5: Real AGE response - origin_proof=true, mock_used=false
    return {
      ok: true,
      data: {
        ...data,
        origin_proof: true,
        mock_used: false
      },
      mock_used: false
    };
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[AGE MCP] Failed: ${err.message}`);
    return { ok: false, error: err.message, mock_used: true };
  }
}

// HF1 + HF5: Mock fallback response (DEGRADE, not BLOCK)
function createMockFallbackResponse(tool, args, traceId, error) {
  return {
    // HF5: Mock origin - clearly different from real AGE
    origin: 'liye_os.mock',
    origin_proof: false,
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

// Write gateway.response event to trace (Contract: TRACE_REQUIRED_FIELDS_V1)
function writeGatewayResponseEvent(traceDir, meta) {
  if (!traceDir) return;

  const eventsFile = join(traceDir, 'events.ndjson');
  const event = {
    ts: new Date().toISOString(),
    type: 'gateway.response',
    meta: {
      trace_id: meta.trace_id,
      tenant_id: meta.tenant_id,
      policy_version: meta.policy_version,
      tool: meta.tool,
      action_type: meta.action_type,
      decision: meta.decision,
      origin: meta.origin,
      origin_proof: meta.origin_proof,
      mock_used: meta.mock_used,
      ...(meta.mock_used && { fallback_reason: meta.fallback_reason })
    }
  };

  try {
    appendFileSync(eventsFile, JSON.stringify(event) + '\n');
  } catch (e) {
    console.error(`[Trace] Failed to write gateway.response: ${e.message}`);
  }
}

// Week4: Check if action type requires write gate
function isWriteAction(actionType) {
  return ['write', 'delete', 'execute', 'send'].includes(actionType);
}

// Week4: Apply write gate to actions
function applyWriteGate(actions) {
  if (WRITE_ENABLED) {
    return { actions, write_blocked: false };
  }

  // Block or degrade write actions
  const gatedActions = actions.map(action => {
    if (isWriteAction(action.action_type)) {
      return {
        ...action,
        dry_run_only: true,
        write_gate_blocked: true
      };
    }
    return action;
  });

  const hasWriteActions = actions.some(a => isWriteAction(a.action_type));
  return {
    actions: gatedActions,
    write_blocked: hasWriteActions
  };
}

// Handle governed tool call
async function handleGovernedToolCall(req, res) {
  // CORS headers for Dify
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-ID');
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
      decision: 'UNKNOWN',
      origin: 'liye_os.mock',
      origin_proof: false,
      mock_used: true,
      policy_version: POLICY_VERSION,
      trace_id: null
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
      decision: 'UNKNOWN',
      origin: 'liye_os.mock',
      origin_proof: false,
      mock_used: true,
      policy_version: POLICY_VERSION,
      trace_id: null
    }));
    return;
  }

  const { task, context, proposed_actions, tenant_id } = body;
  const tenantId = tenant_id || req.headers['x-tenant-id'] || 'default';

  // Validate required fields
  if (!task || !proposed_actions || !Array.isArray(proposed_actions)) {
    res.writeHead(400);
    res.end(JSON.stringify({
      ok: false,
      error: 'Missing required fields: task, proposed_actions',
      decision: 'UNKNOWN',
      origin: 'liye_os.mock',
      origin_proof: false,
      mock_used: true,
      policy_version: POLICY_VERSION,
      trace_id: null
    }));
    return;
  }

  try {
    const { runGovernanceCycle } = await loadGovernance();

    // Generate trace_id early for AGE routing
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Week4: Apply write gate
    const { actions: gatedActions, write_blocked } = applyWriteGate(proposed_actions);

    // HF1: Route AGE tools through AGE MCP first (default path)
    let ageResults = [];
    let mockUsed = false;
    let fallbackReason = null;
    let primaryTool = null;
    let primaryActionType = null;

    for (const action of gatedActions) {
      if (!primaryTool) {
        primaryTool = action.tool;
        primaryActionType = action.action_type || 'read';
      }

      if (AGE_MCP_CONFIG.tools_allowlist.includes(action.tool)) {
        const ageResult = await routeToAgeMcp(action.tool, action.arguments || {}, traceId);
        if (ageResult.ok) {
          ageResults.push({ action, result: ageResult.data, mock_used: false });
        } else {
          // HF1: Fallback to mock (DEGRADE, not BLOCK)
          mockUsed = true;
          fallbackReason = ageResult.error;
          const mockResp = createMockFallbackResponse(action.tool, action.arguments || {}, traceId, ageResult.error);
          ageResults.push({ action, result: mockResp, mock_used: true });
        }
      }
    }

    // Run full governance cycle
    const result = await runGovernanceCycle({
      task,
      context: { ...context, age_results: ageResults, mock_used: mockUsed, tenant_id: tenantId },
      proposed_actions: gatedActions
    }, {
      baseDir: TRACE_BASE_DIR
    });

    // Use governance trace_id if available, otherwise use our generated one
    const finalTraceId = result.trace_id || traceId;

    // Week4: Degrade if write blocked
    let decision = result.gateReport?.decision || 'UNKNOWN';
    if (write_blocked && decision === 'ALLOW') {
      decision = 'DEGRADE';
      fallbackReason = fallbackReason || 'WRITE_ENABLED=0: Write operations blocked';
    }
    if (mockUsed) {
      decision = 'DEGRADE';
    }

    // HF5: Consistent origin/mock signals
    const origin = mockUsed ? 'liye_os.mock' : 'amazon-growth-engine';
    const originProof = !mockUsed;

    // Build contract-compliant response (GOV_TOOL_CALL_RESPONSE_V1)
    const response = {
      ok: decision === 'ALLOW' || decision === 'DEGRADE',
      result: decision === 'ALLOW' || decision === 'DEGRADE'
        ? {
            message: mockUsed ? 'Action approved with mock fallback' : 'Action approved for execution',
            age_results: ageResults.length > 0 ? ageResults : undefined
          }
        : null,
      decision,
      // Contract required fields
      origin,
      origin_proof: originProof,
      mock_used: mockUsed,
      policy_version: POLICY_VERSION,
      trace_id: finalTraceId,
      evidence_path: `.liye/traces/${finalTraceId}/`,
      verdict_summary: mockUsed
        ? `AGE MCP unavailable - using mock fallback. ${generateVerdictSummary(result.gateReport, result.verdict)}`
        : generateVerdictSummary(result.gateReport, result.verdict),
      replay_status: result.replayResult?.status || 'UNKNOWN',
      // Week4: Write gate info
      write_enabled: WRITE_ENABLED,
      write_calls_attempted: 0,  // Week4 GUARANTEE
      // Conditional fields
      ...(mockUsed && { fallback_reason: fallbackReason }),
      ...(write_blocked && { write_gate_reason: 'WRITE_ENABLED=0' })
    };

    // Add error for BLOCK/UNKNOWN
    if (decision === 'BLOCK' || decision === 'UNKNOWN') {
      response.error = response.verdict_summary;
    }

    // Write gateway.response event to trace (Contract: TRACE_REQUIRED_FIELDS_V1)
    writeGatewayResponseEvent(result.trace_dir, {
      trace_id: finalTraceId,
      tenant_id: tenantId,
      policy_version: POLICY_VERSION,
      tool: primaryTool || 'unknown',
      action_type: primaryActionType || 'unknown',
      decision,
      origin,
      origin_proof: originProof,
      mock_used: mockUsed,
      fallback_reason: fallbackReason
    });

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
      origin: 'liye_os.mock',
      origin_proof: false,
      mock_used: true,
      policy_version: POLICY_VERSION,
      trace_id: null,
      evidence_path: null,
      verdict_summary: 'Governance system error - action blocked for safety.',
      fallback_reason: e.message,
      write_enabled: WRITE_ENABLED,
      write_calls_attempted: 0
    }));
  }
}

// Week3: Handle static evidence file serving (read-only)
function handleTraceFileRequest(req, res, traceId, fileName) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  // Security: Validate file name against whitelist
  const cleanFileName = basename(fileName);
  if (!ALLOWED_EVIDENCE_FILES.includes(cleanFileName)) {
    res.writeHead(403);
    res.end(`Forbidden: File not in whitelist. Allowed: ${ALLOWED_EVIDENCE_FILES.join(', ')}`);
    return;
  }

  // Security: Prevent path traversal
  if (traceId.includes('..') || traceId.includes('/') || traceId.includes('\\')) {
    res.writeHead(400);
    res.end('Bad Request: Invalid trace_id');
    return;
  }

  const filePath = join(TRACE_BASE_DIR, traceId, cleanFileName);

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end(`Not Found: ${cleanFileName} for trace ${traceId}`);
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');

    // Set appropriate content type
    if (cleanFileName.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else if (cleanFileName.endsWith('.md')) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    }

    res.writeHead(200);
    res.end(content);
  } catch (e) {
    console.error(`[TraceFile] Failed to read ${filePath}: ${e.message}`);
    res.writeHead(500);
    res.end(`Error reading file: ${e.message}`);
  }
}

// Create HTTP server
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/v1/governed_tool_call') {
    handleGovernedToolCall(req, res);
  } else if (url.pathname === '/v1/feishu/events') {
    // Feishu Thin-Agent event handler (Week2)
    handleFeishuEvent(req, res, {
      gatewayUrl: `http://localhost:${PORT}`,
      traceBaseDir: TRACE_BASE_DIR
    });
  } else if (url.pathname === '/v1/feishu/actions') {
    // Feishu Thin-Agent action handler (Week3+4)
    handleFeishuAction(req, res, {
      traceBaseDir: TRACE_BASE_DIR,
      traceViewerBaseUrl: `http://localhost:${PORT}/trace`
    });
  } else if (url.pathname.startsWith('/trace/')) {
    // Week3: Static evidence file serving
    const parts = url.pathname.slice(7).split('/');  // Remove '/trace/'
    if (parts.length === 2) {
      const [traceId, fileName] = parts;
      handleTraceFileRequest(req, res, traceId, fileName);
    } else {
      res.writeHead(400);
      res.setHeader('Content-Type', 'text/plain');
      res.end('Bad Request: Use /trace/{trace_id}/{file_name}');
    }
  } else if (url.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      service: 'governed-tool-call-gateway',
      policy_version: POLICY_VERSION,
      contracts: ['GOV_TOOL_CALL_REQUEST_V1', 'GOV_TOOL_CALL_RESPONSE_V1', 'TRACE_REQUIRED_FIELDS_V1', 'ACTION_PLAN_V1', 'APPROVAL_STATE_V1', 'EXECUTION_RESULT_V1'],
      integrations: ['feishu'],
      write_enabled: WRITE_ENABLED
    }));
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not found',
      endpoints: {
        'POST /v1/governed_tool_call': 'Execute governed tool call',
        'POST /v1/feishu/events': 'Feishu event webhook (Thin-Agent, Week2)',
        'POST /v1/feishu/actions': 'Feishu action callback (Week3+4)',
        'GET /trace/:id/:file': 'Static evidence file serving (Week3+4)',
        'GET /health': 'Health check'
      }
    }));
  }
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  Governed Tool Call Gateway (Phase 2 Week1)                   ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoint: http://localhost:${PORT}/v1/governed_tool_call       ║
║  Feishu:   http://localhost:${PORT}/v1/feishu/events            ║
║  Actions:  http://localhost:${PORT}/v1/feishu/actions           ║
║  Trace:    http://localhost:${PORT}/trace/{id}/{file}           ║
║  Health:   http://localhost:${PORT}/health                      ║
║  Policy:   ${POLICY_VERSION}                                ║
╠═══════════════════════════════════════════════════════════════╣
║  Contracts: GOV_TOOL_CALL_RESPONSE_V1, EXECUTION_RESULT_V1    ║
║  HF1-HF5:   Enforced                                          ║
║  Week2:     Feishu Thin-Agent (Interactive Card)              ║
║  Week3:     Evidence Package + Dry-run Plan                   ║
║  Week4:     Approval Shell + Write Gate                       ║
║  Week5:     Dry-run Execution + Result Files                  ║
║  Phase2W1:  Real Write Gray Launch + Rollback Plans           ║
╠═══════════════════════════════════════════════════════════════╣
║  WRITE_ENABLED: ${WRITE_ENABLED ? 'ON (DANGER)' : 'OFF (Safe)'}                                      ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
