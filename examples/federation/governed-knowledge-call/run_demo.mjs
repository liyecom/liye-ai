#!/usr/bin/env node
/**
 * Governed Knowledge Call Demo
 *
 * Demonstrates the full governed tool call pattern:
 * 1. Gate - Risk assessment
 * 2. Execute (if allowed) - Call Knowledge MCP
 * 3. Verdict - Human-readable decision
 * 4. Replay - Verify trace integrity
 *
 * Usage:
 *   node examples/federation/governed-knowledge-call/run_demo.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Import governance tools
import { handleToolCall } from '../../../src/mcp/tools.mjs';
import { runGovernanceCycle } from '../../../src/governance/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(60));
console.log('Governed Knowledge Call Demo');
console.log('='.repeat(60));
console.log();

// Load input
const inputPath = join(__dirname, 'input.json');
const input = JSON.parse(readFileSync(inputPath, 'utf-8'));

console.log('Input:');
console.log(`  Task: ${input.task}`);
console.log(`  Actions: ${input.proposed_actions.map(a => a.tool).join(', ')}`);
console.log();

// Run governed cycle
console.log('Running governed tool call pattern...');
console.log();

async function runDemo() {
  try {
    // Use runGovernanceCycle for proper trace continuity
    // This ensures gate → verdict → replay are in the same trace
    console.log('Step 1-3: Running full governance cycle (gate → verdict → replay)');
    console.log();

    const result = await runGovernanceCycle({
      task: input.task,
      context: input.context,
      proposed_actions: input.proposed_actions
    });

    const traceId = result.trace_id;
    const decision = result.gateReport?.decision || 'UNKNOWN';
    const replayStatus = result.replayResult?.status || 'UNKNOWN';

    console.log('Gate:');
    console.log(`  → trace_id: ${traceId}`);
    console.log(`  → decision: ${decision}`);
    console.log(`  → risks: ${result.gateReport?.risks?.length || 0}`);
    console.log();

    // Step 2: Execute (conditional)
    let toolResult = null;
    console.log('Execute Knowledge Tool (conditional):');

    if (decision === 'ALLOW' || decision === 'DEGRADE') {
      console.log('  → Decision allows execution');
      // Simulate calling Knowledge MCP
      // In real integration, this would call the actual Knowledge MCP server
      toolResult = {
        query: input.proposed_actions[0].resource,
        collection: 'amazon_knowledge_base',
        total_results: 3,
        results: [
          { id: 'doc-001', score: 95.2, section_title: 'ACOS Optimization' },
          { id: 'doc-002', score: 87.5, section_title: 'Keyword Selection' },
          { id: 'doc-003', score: 82.1, section_title: 'Campaign Structure' }
        ]
      };
      console.log(`  → Retrieved ${toolResult.total_results} results`);
    } else {
      console.log(`  → Skipped (decision: ${decision})`);
    }
    console.log();

    console.log('Verdict:');
    console.log(`  → summary: ${result.verdict?.summary || 'N/A'}`);
    console.log(`  → confidence: ${result.verdict?.confidence || 'N/A'}`);
    console.log(`  → final_decision: ${result.verdict?.final_decision || 'N/A'}`);
    console.log();

    console.log('Replay:');
    console.log(`  → status: ${replayStatus}`);
    console.log(`  → event_count: ${result.replayResult?.event_count || 0}`);
    console.log(`  → hash_chain_valid: ${result.replayResult?.checks?.hash_chain_valid || false}`);
    console.log(`  → structure_valid: ${result.replayResult?.checks?.structure_valid || false}`);
    console.log();

    // Summary
    console.log('='.repeat(60));
    console.log('Demo Result');
    console.log('='.repeat(60));
    console.log();
    console.log(`Gate Decision:    ${decision}`);
    console.log(`Tool Executed:    ${toolResult ? 'Yes' : 'No'}`);
    console.log(`Verdict:          ${result.verdict?.final_decision || 'N/A'}`);
    console.log(`Replay Status:    ${replayStatus}`);
    console.log(`Trace ID:         ${traceId}`);
    console.log();

    // Evidence package location
    const tracePath = `.liye/traces/${traceId}/`;
    console.log(`Evidence Package: ${tracePath}`);
    console.log();

    // Return results for programmatic use
    return {
      success: replayStatus === 'PASS',
      traceId,
      gateDecision: decision,
      toolExecuted: !!toolResult,
      replayStatus,
      tracePath
    };
  } catch (err) {
    console.error('Demo failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

const result = await runDemo();

if (result.success) {
  console.log('✅ Demo completed successfully!');
  process.exit(0);
} else {
  console.log('❌ Demo failed - replay did not pass');
  process.exit(1);
}
