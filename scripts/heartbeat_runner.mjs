#!/usr/bin/env node
/**
 * Heartbeat Runner - S1 Phase C
 * SSOT: scripts/heartbeat_runner.mjs
 *
 * Produces execution_request.json for AGE consumption.
 * Used in E2E flow: OS → AGE → Receipt
 *
 * Environment:
 *   LIYE_EXECUTION_TIER: observe | recommend | execute_limited (default: recommend)
 *   LIYE_CANARY_MAX_WRITES: max actions per request (default: 3)
 *   LIYE_EMIT_EXECUTION_REQUEST: true to write request file
 *   LIYE_EXECUTION_REQUEST_OUT: output path for execution_request.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  tier: process.env.LIYE_EXECUTION_TIER || 'recommend',
  canaryMaxWrites: parseInt(process.env.LIYE_CANARY_MAX_WRITES || '3', 10),
  emitRequest: process.env.LIYE_EMIT_EXECUTION_REQUEST === 'true',
  requestOutPath: process.env.LIYE_EXECUTION_REQUEST_OUT || '/tmp/execution_request.json',
  killSwitch: process.env.LIYE_KILL_SWITCH === 'true',
  costMeterEnabled: process.env.LIYE_COST_METER_ENABLED === 'true',
  costMeterBudget: parseInt(process.env.LIYE_COST_METER_BUDGET || '200', 10)
};

// ============================================================================
// Sample Actions Generator (for E2E testing)
// ============================================================================

function generateSampleActions(maxActions = 3) {
  /**
   * Generate sample actions for E2E testing.
   * In production, these would come from playbook recommendations.
   */
  const sampleActions = [
    {
      type: 'WRITE_LIMITED',
      kind: 'NEGATIVE_KEYWORD_ADD',
      payload: {
        keyword_text: 'cheap knockoff',
        match_type: 'negative_exact',
        campaign_id: 'camp-e2e-001',
        ad_group_id: 'adg-e2e-001'
      }
    },
    {
      type: 'WRITE_LIMITED',
      kind: 'BID_ADJUST',
      payload: {
        keyword_id: 'kw-e2e-001',
        current_bid: 1.25,
        new_bid: 1.50
      }
    },
    {
      type: 'WRITE_LIMITED',
      kind: 'NEGATIVE_KEYWORD_ADD',
      payload: {
        keyword_text: 'free sample',
        match_type: 'negative_phrase',
        campaign_id: 'camp-e2e-002',
        ad_group_id: 'adg-e2e-002'
      }
    }
  ];

  // Limit to maxActions
  const actions = sampleActions.slice(0, maxActions);

  // Compute action hashes
  return actions.map(action => ({
    ...action,
    action_hash: computeActionHash(action)
  }));
}

function computeActionHash(action) {
  const content = JSON.stringify(action, Object.keys(action).sort());
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ============================================================================
// Execution Request Builder
// ============================================================================

function buildExecutionRequest(actions) {
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputsHash = createHash('sha256')
    .update(JSON.stringify(actions))
    .digest('hex')
    .slice(0, 16);

  return {
    schema_version: '1.0.0',
    run_id: runId,
    inputs_hash: inputsHash,
    tier: CONFIG.tier,
    require_approval: CONFIG.tier === 'execute_limited',
    generated_at: new Date().toISOString(),
    generator: 'liye_os/heartbeat_runner',
    config: {
      canary_max_writes: CONFIG.canaryMaxWrites,
      cost_meter_enabled: CONFIG.costMeterEnabled,
      cost_meter_budget: CONFIG.costMeterBudget
    },
    actions
  };
}

// ============================================================================
// Preflight Checks
// ============================================================================

function runPreflightChecks() {
  const checks = [];

  // 1. Kill switch check
  if (CONFIG.killSwitch) {
    checks.push({
      check: 'kill_switch',
      passed: false,
      reason: 'Kill switch is active'
    });
    return { passed: false, checks };
  }
  checks.push({ check: 'kill_switch', passed: true });

  // 2. Tier check
  const validTiers = ['observe', 'recommend', 'execute_limited'];
  if (!validTiers.includes(CONFIG.tier)) {
    checks.push({
      check: 'tier_valid',
      passed: false,
      reason: `Invalid tier: ${CONFIG.tier}`
    });
    return { passed: false, checks };
  }
  checks.push({ check: 'tier_valid', passed: true, tier: CONFIG.tier });

  // 3. Cost meter check (if enabled)
  if (CONFIG.costMeterEnabled) {
    // In production, would check actual spend vs budget
    checks.push({
      check: 'cost_meter',
      passed: true,
      budget: CONFIG.costMeterBudget,
      note: 'Budget check passed (dry-run)'
    });
  }

  return { passed: true, checks };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('     LiYe OS Heartbeat Runner - S1 Phase C');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Tier: ${CONFIG.tier}`);
  console.log(`Canary Max Writes: ${CONFIG.canaryMaxWrites}`);
  console.log(`Emit Request: ${CONFIG.emitRequest}`);
  console.log('');

  // 1. Preflight checks
  console.log('Running preflight checks...');
  const preflight = runPreflightChecks();

  if (!preflight.passed) {
    console.error('❌ Preflight failed:', preflight.checks);
    process.exit(1);
  }
  console.log('✅ Preflight passed:', preflight.checks.length, 'checks');

  // 2. Generate sample actions
  console.log('');
  console.log('Generating actions...');
  const actions = generateSampleActions(CONFIG.canaryMaxWrites);
  console.log(`Generated ${actions.length} actions`);

  // 3. Build execution request
  const request = buildExecutionRequest(actions);
  console.log(`Run ID: ${request.run_id}`);
  console.log(`Inputs Hash: ${request.inputs_hash}`);

  // 4. Emit request file if enabled
  if (CONFIG.emitRequest) {
    const outPath = CONFIG.requestOutPath;
    const outDir = dirname(outPath);

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    writeFileSync(outPath, JSON.stringify(request, null, 2));
    console.log('');
    console.log(`✅ Execution request written to: ${outPath}`);
  }

  // 5. Log to facts (append-only)
  const factPath = join(ROOT, 'state/memory/facts/fact_heartbeat_runs.jsonl');
  const factDir = dirname(factPath);

  if (!existsSync(factDir)) {
    mkdirSync(factDir, { recursive: true });
  }

  const factEntry = {
    timestamp: new Date().toISOString(),
    event_type: 'heartbeat_run',
    run_id: request.run_id,
    tier: CONFIG.tier,
    actions_count: actions.length,
    preflight_checks: preflight.checks.length,
    request_emitted: CONFIG.emitRequest,
    request_path: CONFIG.emitRequest ? CONFIG.requestOutPath : null
  };

  const existingFacts = existsSync(factPath) ? readFileSync(factPath, 'utf-8') : '';
  writeFileSync(factPath, existingFacts + JSON.stringify(factEntry) + '\n');
  console.log(`✅ Fact logged: ${factPath}`);

  // 6. Output summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(JSON.stringify(request, null, 2));

  return request;
}

main().catch(err => {
  console.error('Heartbeat runner failed:', err);
  process.exit(1);
});
