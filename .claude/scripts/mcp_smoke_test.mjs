#!/usr/bin/env node
/**
 * MCP Smoke Test for Governance Kernel v1
 *
 * Validates:
 * 1. governance_gate - with delete action (expect BLOCK)
 * 2. governance_enforce - with DENY contract (expect BLOCK)
 * 3. governance_verdict - generates valid verdict
 * 4. governance_replay - verifies trace (expect PASS)
 *
 * Usage:
 *   node .claude/scripts/mcp_smoke_test.mjs
 */

import { handleToolCall, toolDefinitions } from '../../src/mcp/tools.mjs';
import { listTools } from '../../src/mcp/server.mjs';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const TRACE_DIR = '.liye/traces';

let passed = 0;
let failed = 0;
let traceId = null;

console.log('='.repeat(60));
console.log('MCP Governance Smoke Test');
console.log('='.repeat(60));
console.log();

/**
 * Assert helper
 */
function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

/**
 * Test 0: Tools are registered
 */
async function testToolsRegistered() {
  console.log('Test 0: Tools Registered');

  const tools = listTools();
  assert(tools.tools.length === 4, 'Has 4 tools');

  const toolNames = tools.tools.map(t => t.name);
  assert(toolNames.includes('governance_gate'), 'Has governance_gate');
  assert(toolNames.includes('governance_enforce'), 'Has governance_enforce');
  assert(toolNames.includes('governance_verdict'), 'Has governance_verdict');
  assert(toolNames.includes('governance_replay'), 'Has governance_replay');
  console.log();
}

/**
 * Test 1: governance_gate with delete action
 */
async function testGovernanceGate() {
  console.log('Test 1: governance_gate (delete action → BLOCK)');

  const result = await handleToolCall('governance_gate', {
    task: 'Delete user account for cleanup',
    context: {},
    proposed_actions: [
      { action_type: 'delete', resource: 'user/123' }
    ]
  });

  assert(!result.error, 'No error');
  assert(result.gate_report, 'Has gate_report');
  assert(result.trace_id, 'Has trace_id');

  if (result.gate_report) {
    assert(result.gate_report.version === '1.0.0', 'Version is 1.0.0');
    assert(result.gate_report.decision === 'BLOCK', 'Decision is BLOCK');
    assert(result.gate_report.risks?.length > 0, 'Has risks identified');
    assert(
      result.gate_report.risks?.some(r => r.severity === 'critical'),
      'Has critical severity risk'
    );
  }

  // Save trace_id for later tests
  traceId = result.trace_id;
  console.log(`  → trace_id: ${traceId}`);
  console.log();
}

/**
 * Test 2: governance_enforce with DENY contract
 */
async function testGovernanceEnforce() {
  console.log('Test 2: governance_enforce (DENY contract → BLOCK)');

  const contract = {
    version: '1.0.0',
    scope: { name: 'test-contract' },
    rules: [
      {
        id: 'deny-write-prod',
        effect: 'DENY',
        match: { path_prefix: '/prod/' },
        rationale: 'Production writes are prohibited'
      }
    ]
  };

  const actions = [
    { action_type: 'write', path_prefix: '/prod/config.json' }
  ];

  const result = await handleToolCall('governance_enforce', {
    trace_id: traceId,
    contract,
    actions
  });

  assert(!result.error, 'No error');
  assert(result.enforce_result, 'Has enforce_result');
  assert(result.trace_id, 'Has trace_id');

  if (result.enforce_result) {
    assert(result.enforce_result.decision_summary === 'BLOCK', 'Decision is BLOCK');
    assert(result.enforce_result.blocked_count > 0, 'Has blocked actions');
    assert(
      result.enforce_result.blocked_rule_ids?.includes('deny-write-prod'),
      'Blocked by deny-write-prod rule'
    );
  }

  console.log();
}

/**
 * Test 3: governance_verdict (using full governance cycle)
 */
async function testGovernanceVerdict() {
  console.log('Test 3: governance_verdict (full cycle with gate → verdict)');

  // Import full cycle function for proper trace continuity
  const { runGovernanceCycle } = await import('../../src/governance/index.mjs');

  const cycleResult = await runGovernanceCycle({
    task: 'Send notification email to users',
    proposed_actions: [
      { action_type: 'send_email', resource: 'user@example.com' }
    ]
  });

  assert(cycleResult.verdict, 'Has verdict');
  assert(cycleResult.trace_id, 'Has trace_id');
  assert(cycleResult.gateReport, 'Has gateReport');
  assert(cycleResult.replayResult, 'Has replayResult');

  if (cycleResult.verdict) {
    assert(cycleResult.verdict.version === '1.0.0', 'Version is 1.0.0');
    assert(cycleResult.verdict.summary, 'Has summary');
    assert(cycleResult.verdict.why?.length > 0, 'Has why reasons');
    assert(cycleResult.verdict.next_steps?.length > 0, 'Has next_steps');
    assert(typeof cycleResult.verdict.confidence === 'number', 'Has confidence score');
  }

  // Update traceId for replay test (this one should have complete structure)
  traceId = cycleResult.trace_id;
  console.log(`  → trace_id: ${traceId}`);
  console.log();
}

/**
 * Test 4: governance_replay
 */
async function testGovernanceReplay() {
  console.log('Test 4: governance_replay (verify trace → PASS)');

  const result = await handleToolCall('governance_replay', {
    trace_id: traceId
  });

  assert(!result.error, 'No error');
  assert(result.replay, 'Has replay result');
  assert(result.trace_id === traceId, 'Correct trace_id');

  if (result.replay) {
    assert(result.replay.status === 'PASS', 'Status is PASS');
    assert(result.replay.pass === true, 'Pass is true');
    assert(result.replay.event_count > 0, 'Has events');
    assert(result.replay.error_count === 0, 'No errors');
    assert(result.replay.checks?.schema_valid, 'Schema valid');
    assert(result.replay.checks?.hash_chain_valid, 'Hash chain valid');
    assert(result.replay.checks?.structure_valid, 'Structure valid');
  }

  console.log();
}

/**
 * Test 5: Trace directory structure
 */
async function testTraceDirectory() {
  console.log('Test 5: Trace directory structure');

  const traceDir = join(TRACE_DIR, traceId);
  assert(existsSync(traceDir), 'Trace directory exists');

  const files = existsSync(traceDir) ? readdirSync(traceDir) : [];
  assert(files.includes('events.ndjson'), 'Has events.ndjson');
  assert(files.includes('verdict.json'), 'Has verdict.json');
  assert(files.includes('verdict.md'), 'Has verdict.md');
  assert(files.includes('replay.json'), 'Has replay.json');
  assert(files.includes('diff.json'), 'Has diff.json');

  console.log(`  → ${traceDir}/`);
  for (const file of files) {
    console.log(`    ├── ${file}`);
  }
  console.log();
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    await testToolsRegistered();
    await testGovernanceGate();
    await testGovernanceEnforce();
    await testGovernanceVerdict();
    await testGovernanceReplay();
    await testTraceDirectory();

    // Summary
    console.log('='.repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));

    if (failed === 0) {
      console.log('\n✅ All MCP smoke tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed.');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Test error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();
