#!/usr/bin/env node
/**
 * Governance Bridge for Python Integration
 *
 * JSON-in/JSON-out interface to LiYe Governance Kernel.
 * Called via subprocess from Python GovernedMCPToolProvider.
 *
 * I/O Contract:
 *   stdin:  { task, context, proposed_actions: [{server, tool, arguments}] }
 *   stdout: { gate_report, verdict, trace_id, evidence_path, replay_result }
 *
 * Usage:
 *   echo '{"task":"...","proposed_actions":[...]}' | node governance_bridge.mjs
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOVERNANCE_ROOT = join(__dirname, '..', '..', 'governance');

// Dynamic imports to handle module resolution
async function loadGovernance() {
  const { runGovernanceCycle } = await import(join(GOVERNANCE_ROOT, 'index.mjs'));
  const { gate } = await import(join(GOVERNANCE_ROOT, 'gate.mjs'));
  const { createTrace } = await import(join(GOVERNANCE_ROOT, 'trace', 'trace_writer.mjs'));
  const { replay, ReplayStatus } = await import(join(GOVERNANCE_ROOT, 'replay.mjs'));
  return { runGovernanceCycle, gate, createTrace, replay, ReplayStatus };
}

async function main() {
  // Read JSON from stdin
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    console.log(JSON.stringify({
      ok: false,
      error: 'No input provided',
      governance: { decision: 'UNKNOWN' }
    }));
    process.exit(1);
  }

  let request;
  try {
    request = JSON.parse(input);
  } catch (e) {
    console.log(JSON.stringify({
      ok: false,
      error: `Invalid JSON: ${e.message}`,
      governance: { decision: 'UNKNOWN' }
    }));
    process.exit(1);
  }

  const { task, context, proposed_actions } = request;

  // Validate required fields
  if (!task || !proposed_actions || !Array.isArray(proposed_actions)) {
    console.log(JSON.stringify({
      ok: false,
      error: 'Missing required fields: task, proposed_actions',
      governance: { decision: 'UNKNOWN' }
    }));
    process.exit(1);
  }

  try {
    const { runGovernanceCycle } = await loadGovernance();

    // Run full governance cycle: gate -> verdict -> replay
    const result = await runGovernanceCycle({
      task,
      context: context || {},
      proposed_actions
    }, {
      baseDir: '.liye/traces'
    });

    const traceId = result.trace_id;
    const decision = result.gateReport?.decision || 'UNKNOWN';
    const replayStatus = result.replayResult?.status || 'UNKNOWN';

    // Build response per contract
    const response = {
      ok: decision === 'ALLOW' || decision === 'DEGRADE',
      trace_id: traceId,
      evidence_path: `.liye/traces/${traceId}/`,
      governance: {
        decision
      },
      gate_report: result.gateReport,
      verdict: result.verdict,
      replay_result: {
        status: replayStatus,
        pass: replayStatus === 'PASS',
        checks: result.replayResult?.checks || {}
      }
    };

    // Add error for BLOCK/UNKNOWN
    if (decision === 'BLOCK' || decision === 'UNKNOWN') {
      response.error = `Governance decision: ${decision}`;
      if (result.gateReport?.risks?.length > 0) {
        response.error += ` (risks: ${result.gateReport.risks.map(r => r.type).join(', ')})`;
      }
    }

    console.log(JSON.stringify(response));

  } catch (e) {
    // Fail Closed: any error -> UNKNOWN/BLOCK
    console.log(JSON.stringify({
      ok: false,
      error: `Governance error: ${e.message}`,
      governance: { decision: 'UNKNOWN' },
      trace_id: null,
      evidence_path: null
    }));
    process.exit(1);
  }
}

main();
