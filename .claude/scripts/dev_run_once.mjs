#!/usr/bin/env node
/**
 * Governance Kernel v1 - Development Verification Script
 *
 * Runs a complete governance cycle with a test input:
 * 1. Creates trace
 * 2. Runs gate → enforce → verdict
 * 3. Runs replay
 * 4. Prints results
 *
 * Usage: node .claude/scripts/dev_run_once.mjs [--tamper]
 *
 * --tamper: Demonstrate tampering detection (modifies trace then replays)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';

// Change to project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
process.chdir(projectRoot);

// Import governance kernel
const {
  createTrace,
  gate,
  enforce,
  generateVerdict,
  formatVerdictMarkdown,
  replay,
  formatReplayResult,
  PROTOCOL_VERSION,
  GateDecision,
  TraceEventType
} = await import('../../src/governance/index.mjs');

// Parse args
const tamperMode = process.argv.includes('--tamper');

console.log('='.repeat(60));
console.log('Governance Kernel v1 - Development Verification');
console.log('='.repeat(60));
console.log(`Protocol Version: ${PROTOCOL_VERSION}`);
console.log(`Mode: ${tamperMode ? 'TAMPER DETECTION' : 'NORMAL'}`);
console.log();

// Test input
const input = {
  task: 'Update user profile validation to include email format check',
  context: {
    scope: 'user-profile',
    component: 'validation',
    risk_level: 'low'
  },
  proposed_actions: [
    { action_type: 'read', tool: 'file_system', resource: 'src/user/profile.js' },
    { action_type: 'write', tool: 'file_system', resource: 'src/user/validation.js' },
    { action_type: 'write', tool: 'file_system', resource: 'tests/user/validation.test.js' }
  ]
};

// Test contract
const contract = {
  version: '1.0.0',
  scope: { name: 'file-operations', owner: 'governance' },
  rules: [
    {
      id: 'rule-001',
      effect: 'ALLOW',
      match: { action_type: 'read' },
      rationale: 'Read operations are generally safe'
    },
    {
      id: 'rule-002',
      effect: 'ALLOW',
      match: { action_type: 'write', path_prefix: 'src/' },
      rationale: 'Write to src/ is allowed for code changes'
    },
    {
      id: 'rule-003',
      effect: 'ALLOW',
      match: { action_type: 'write', path_prefix: 'tests/' },
      rationale: 'Write to tests/ is allowed for test changes'
    },
    {
      id: 'rule-004',
      effect: 'DENY',
      match: { action_type: 'delete' },
      rationale: 'Delete operations require explicit approval'
    }
  ]
};

console.log('--- Input ---');
console.log(`Task: ${input.task}`);
console.log(`Actions: ${input.proposed_actions.length}`);
console.log();

// Create trace
const trace = createTrace(undefined, '.liye/traces');
console.log(`Trace ID: ${trace.trace_id}`);
console.log(`Trace Dir: ${trace.traceDir}`);
console.log();

// Run gate
console.log('--- Gate ---');
const gateReport = gate(input, { trace });
console.log(`Decision: ${gateReport.decision}`);
console.log(`Risks: ${gateReport.risks.length}`);
console.log(`Unknowns: ${gateReport.unknowns.length}`);
console.log();

// Run enforce
console.log('--- Enforce ---');
const enforceResult = enforce(contract, input.proposed_actions, { trace, input });
console.log(`Decision: ${enforceResult.decision_summary}`);
console.log(`Allowed: ${enforceResult.allowed.length}`);
console.log(`Blocked: ${enforceResult.blocked.length}`);
console.log();

// Generate verdict
console.log('--- Verdict ---');
const verdict = generateVerdict(gateReport, enforceResult, { trace });
console.log(`Summary: ${verdict.summary}`);
console.log(`Confidence: ${(verdict.confidence * 100).toFixed(0)}%`);
console.log();

// Write verdict files
trace.writeFile('verdict.json', verdict);
trace.writeFile('verdict.md', formatVerdictMarkdown(verdict));

// Run replay
console.log('--- Replay (Normal) ---');
const replayResult = replay(trace.trace_id, { baseDir: '.liye/traces', writeResults: true });
console.log(formatReplayResult(replayResult));
console.log();

// Tamper detection demo
if (tamperMode) {
  console.log('--- Tamper Detection Demo ---');
  console.log('Modifying events.ndjson to simulate tampering...');

  const eventsPath = join(trace.traceDir, 'events.ndjson');
  const content = readFileSync(eventsPath, 'utf-8');
  const lines = content.trim().split('\n');

  // Tamper with the second line (modify payload)
  if (lines.length >= 2) {
    const event = JSON.parse(lines[1]);
    event.payload.tampered = true;  // Add tampered field
    lines[1] = JSON.stringify(event);

    writeFileSync(eventsPath, lines.join('\n') + '\n');
    console.log('Tampered event at seq=1');
    console.log();

    // Run replay again
    console.log('--- Replay (After Tampering) ---');
    const tamperResult = replay(trace.trace_id, { baseDir: '.liye/traces', writeResults: true });
    console.log(formatReplayResult(tamperResult));
    console.log();

    // Show diff
    const diffPath = join(trace.traceDir, 'diff.json');
    if (existsSync(diffPath)) {
      const diff = JSON.parse(readFileSync(diffPath, 'utf-8'));
      console.log('--- Diff (Tampering Detected) ---');
      console.log(JSON.stringify(diff, null, 2));
    }
  }
}

// Print evidence pack structure
console.log();
console.log('--- Evidence Pack ---');
const files = readdirSync(trace.traceDir);
for (const file of files) {
  console.log(`  ${file}`);
}

console.log();
console.log('='.repeat(60));
console.log(`✅ Trace ID: ${trace.trace_id}`);
console.log(`✅ Replay: ${replayResult.status}`);
console.log('='.repeat(60));
