#!/usr/bin/env node
/**
 * MCP Federation Smoke Test
 *
 * Validates the MCP Federation Pack v1:
 * 1. Documentation exists (Catalog + Spec)
 * 2. Demo runs successfully
 * 3. Evidence package generated
 * 4. Replay PASS
 *
 * Usage:
 *   node .claude/scripts/federation_smoke_test.mjs
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { handleToolCall } from '../../src/mcp/tools.mjs';
import { runGovernanceCycle } from '../../src/governance/index.mjs';
import { validateGateReport, validateVerdict } from '../../src/mcp/validator.mjs';

const TRACE_DIR = '.liye/traces';
const DOCS_DIR = 'docs/integrations';
const EXAMPLES_DIR = 'examples/federation/governed-knowledge-call';

let passed = 0;
let failed = 0;
let traceId = null;

console.log('='.repeat(60));
console.log('MCP Federation Smoke Test');
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
 * Test 1: Documentation exists
 */
function testDocumentation() {
  console.log('Test 1: Documentation exists');

  assert(
    existsSync(join(DOCS_DIR, 'MCP_SERVICE_CATALOG_V1.md')),
    'MCP_SERVICE_CATALOG_V1.md exists'
  );

  assert(
    existsSync(join(DOCS_DIR, 'GOVERNED_TOOL_CALL_SPEC_V1.md')),
    'GOVERNED_TOOL_CALL_SPEC_V1.md exists'
  );

  // Check catalog content
  if (existsSync(join(DOCS_DIR, 'MCP_SERVICE_CATALOG_V1.md'))) {
    const catalog = readFileSync(join(DOCS_DIR, 'MCP_SERVICE_CATALOG_V1.md'), 'utf-8');
    assert(catalog.includes('Governance MCP'), 'Catalog mentions Governance MCP');
    assert(catalog.includes('Knowledge MCP'), 'Catalog mentions Knowledge MCP');
    assert(catalog.includes('governance_gate'), 'Catalog lists governance_gate');
    assert(catalog.includes('semantic_search'), 'Catalog lists semantic_search');
  }

  console.log();
}

/**
 * Test 2: Demo files exist
 */
function testDemoFiles() {
  console.log('Test 2: Demo files exist');

  assert(
    existsSync(join(EXAMPLES_DIR, 'input.json')),
    'input.json exists'
  );

  assert(
    existsSync(join(EXAMPLES_DIR, 'contract.json')),
    'contract.json exists'
  );

  assert(
    existsSync(join(EXAMPLES_DIR, 'run_demo.mjs')),
    'run_demo.mjs exists'
  );

  assert(
    existsSync(join(EXAMPLES_DIR, 'run_demo.sh')),
    'run_demo.sh exists'
  );

  // Validate input.json
  if (existsSync(join(EXAMPLES_DIR, 'input.json'))) {
    const input = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'input.json'), 'utf-8'));
    assert(input.task, 'input.json has task');
    assert(Array.isArray(input.proposed_actions), 'input.json has proposed_actions');
  }

  console.log();
}

/**
 * Test 3: One Command Up files exist
 */
function testOneCommandUp() {
  console.log('Test 3: One Command Up files exist');

  assert(
    existsSync('docker-compose.mcp.yml'),
    'docker-compose.mcp.yml exists'
  );

  assert(
    existsSync('Dockerfile.governance'),
    'Dockerfile.governance exists'
  );

  assert(
    existsSync('Dockerfile.knowledge'),
    'Dockerfile.knowledge exists'
  );

  assert(
    existsSync('.claude/scripts/mcp_up.sh'),
    'mcp_up.sh exists'
  );

  // Check package.json scripts
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  assert(pkg.scripts['mcp:up'], 'package.json has mcp:up script');
  assert(pkg.scripts['mcp:governance'], 'package.json has mcp:governance script');
  assert(pkg.scripts['mcp:knowledge'], 'package.json has mcp:knowledge script');

  console.log();
}

/**
 * Test 4: Governed call produces evidence package
 */
async function testGovernedCall() {
  console.log('Test 4: Governed call produces evidence package');

  // Load input
  const input = JSON.parse(readFileSync(join(EXAMPLES_DIR, 'input.json'), 'utf-8'));

  // Run full governance cycle
  const result = await runGovernanceCycle({
    task: input.task,
    context: input.context,
    proposed_actions: input.proposed_actions
  });

  traceId = result.trace_id;

  assert(result.trace_id, 'Has trace_id');
  assert(result.gateReport, 'Has gateReport');
  assert(result.verdict, 'Has verdict');
  assert(result.replayResult, 'Has replayResult');

  // Check gate report
  if (result.gateReport) {
    const validation = validateGateReport(result.gateReport);
    assert(validation.valid, 'GateReport schema valid');
    assert(
      ['ALLOW', 'BLOCK', 'DEGRADE', 'UNKNOWN'].includes(result.gateReport.decision),
      `GateReport decision valid: ${result.gateReport.decision}`
    );
  }

  // Check verdict
  if (result.verdict) {
    const validation = validateVerdict(result.verdict);
    assert(validation.valid, 'Verdict schema valid');
    assert(result.verdict.summary, 'Verdict has summary');
  }

  console.log(`  → trace_id: ${traceId}`);
  console.log();
}

/**
 * Test 5: Trace directory structure
 */
function testTraceDirectory() {
  console.log('Test 5: Trace directory structure');

  if (!traceId) {
    console.log('  ✗ No trace_id from previous test');
    failed++;
    console.log();
    return;
  }

  const traceDir = join(TRACE_DIR, traceId);
  assert(existsSync(traceDir), 'Trace directory exists');

  const files = existsSync(traceDir) ? readdirSync(traceDir) : [];
  assert(files.includes('events.ndjson'), 'Has events.ndjson');
  assert(files.includes('verdict.json'), 'Has verdict.json');
  assert(files.includes('verdict.md'), 'Has verdict.md');
  assert(files.includes('replay.json'), 'Has replay.json');

  console.log(`  → ${traceDir}/`);
  for (const file of files) {
    console.log(`    ├── ${file}`);
  }
  console.log();
}

/**
 * Test 6: Replay PASS
 */
async function testReplay() {
  console.log('Test 6: Replay PASS');

  if (!traceId) {
    console.log('  ✗ No trace_id from previous test');
    failed++;
    console.log();
    return;
  }

  const result = await handleToolCall('governance_replay', {
    trace_id: traceId
  });

  assert(!result.error, 'No error');
  assert(result.replay, 'Has replay result');

  if (result.replay) {
    assert(result.replay.status === 'PASS', `Status is PASS (got: ${result.replay.status})`);
    assert(result.replay.pass === true, 'Pass is true');
    assert(result.replay.checks?.schema_valid, 'Schema valid');
    assert(result.replay.checks?.hash_chain_valid, 'Hash chain valid');
    assert(result.replay.checks?.structure_valid, 'Structure valid');
  }

  console.log();
}

/**
 * Test 7: Knowledge MCP server entry point exists
 */
function testKnowledgeMCPEntry() {
  console.log('Test 7: Knowledge MCP server entry point');

  assert(
    existsSync('src/runtime/mcp/server_main.py'),
    'server_main.py exists'
  );

  if (existsSync('src/runtime/mcp/server_main.py')) {
    const content = readFileSync('src/runtime/mcp/server_main.py', 'utf-8');
    assert(content.includes('def handle_tools_list'), 'Has tools/list handler');
    assert(content.includes('async def handle_tools_call'), 'Has tools/call handler');
    assert(content.includes('semantic_search'), 'Exposes semantic_search');
  }

  console.log();
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    testDocumentation();
    testDemoFiles();
    testOneCommandUp();
    await testGovernedCall();
    testTraceDirectory();
    await testReplay();
    testKnowledgeMCPEntry();

    // Summary
    console.log('='.repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));

    if (failed === 0) {
      console.log('\n✅ All federation smoke tests passed!');
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
