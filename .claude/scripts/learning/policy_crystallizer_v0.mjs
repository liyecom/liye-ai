#!/usr/bin/env node
/**
 * Policy Crystallizer v0.1 (Week 6 Learning Pipeline)
 * SSOT: .claude/scripts/learning/policy_crystallizer_v0.mjs
 *
 * Control Plane component: crystallizes detected patterns into learned policies.
 * Writes policies to state/memory/learned/policies/sandbox/ directory.
 *
 * Crystallization thresholds:
 * - sample_size >= 10
 * - business_improve_rate >= 0.6
 *
 * Confidence calculation:
 * confidence = clamp(0, 1, 0.2*exec + 0.3*operator + 0.5*business)
 *
 * Usage:
 *   node .claude/scripts/learning/policy_crystallizer_v0.mjs [--dry-run] [--patterns-file <path>]
 *
 * Input: Reads patterns from patterns file (default: latest patterns_{date}.json)
 * Output: YAML policy files in state/memory/learned/policies/sandbox/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directories
const PATTERNS_DIR = join(__dirname, '../../../state/runtime/learning/patterns');
const POLICIES_DIR = join(__dirname, '../../../state/memory/learned/policies');
const SANDBOX_DIR = join(POLICIES_DIR, 'sandbox');

// Crystallization thresholds
const MIN_SAMPLE_SIZE = 10;
const MIN_IMPROVE_RATE = 0.6;

/**
 * Find the latest patterns file
 */
function findLatestPatternsFile() {
  if (!existsSync(PATTERNS_DIR)) {
    return null;
  }

  const files = readdirSync(PATTERNS_DIR)
    .filter(f => f.startsWith('patterns_') && f.endsWith('.json'))
    .sort()
    .reverse();

  return files.length > 0 ? join(PATTERNS_DIR, files[0]) : null;
}

/**
 * Load patterns from file
 */
function loadPatterns(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Patterns file not found: ${filePath}`);
  }

  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  return data.patterns || [];
}

/**
 * Calculate confidence score
 */
function calculateConfidence(pattern) {
  // Week 6: simplified confidence calculation
  // In production, would use actual exec/operator rates from facts
  const execRate = 1.0;  // Assume exec success (we filtered for this)
  const operatorRate = 1.0;  // Assume operator approved (we filtered for this)
  const businessRate = pattern.business_improve_rate || 0;

  const confidence = 0.2 * execRate + 0.3 * operatorRate + 0.5 * businessRate;
  return Math.max(0, Math.min(1, confidence));  // Clamp 0-1
}

/**
 * Generate policy ID from pattern
 */
function generatePolicyId(pattern) {
  // Extract key parts from pattern_id
  const parts = pattern.pattern_id.split(':');
  const playbookId = (parts[1] || 'bid_recommend').toUpperCase().replace(/-/g, '_');
  const metricName = (parts[2] || 'acos').toUpperCase();
  const matchType = (pattern.conditions?.match_type || 'BROAD').toUpperCase();
  const cvrBucket = (pattern.conditions?.cvr_bucket || 'MID').toUpperCase().replace('CVR_', '');
  const acosBucket = (pattern.conditions?.acos_bucket || 'MID').toUpperCase().replace('ACOS_', '');

  const hash = createHash('sha256')
    .update(pattern.pattern_id)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();

  return `${playbookId}_${metricName}_${matchType}_CVR${cvrBucket}_ACOS${acosBucket}_${hash}`;
}

/**
 * Convert pattern to policy YAML content
 */
function patternToPolicy(pattern) {
  const now = new Date().toISOString();
  const policyId = generatePolicyId(pattern);
  const confidence = calculateConfidence(pattern);

  // Calculate suggested delta_pct with cap
  const suggestedDeltaPct = Math.min(
    Math.max(pattern.avg_delta_pct || 25, 10),  // Min 10%
    30  // Max 30% (cap_pct)
  );

  const policy = {
    schema_version: '1.0.0',
    policy_id: policyId,
    domain: 'amazon-advertising',
    learned_at: now,
    scope: {
      type: 'global',  // Week 6: global scope for initial learning
      keys: {
        tenant_id: 'default',
        marketplace: 'US'
      }
    },
    risk_level: 'medium',
    validation_status: 'sandbox',
    confidence: Math.round(confidence * 1000) / 1000,
    primary_metric: pattern.primary_metric || {
      name: 'acos',
      anomaly_direction: 'low'
    },
    preconditions: {
      playbook_id: pattern.playbook_id || 'bid_recommend',
      match_type: pattern.conditions?.match_type || 'broad',
      cvr_bucket: pattern.conditions?.cvr_bucket || 'cvr_mid',
      acos_bucket: pattern.conditions?.acos_bucket || 'acos_mid',
      min_clicks: pattern.conditions?.min_clicks || 50,
      thresholds: {
        cvr_min: pattern.conditions?.cvr_bucket === 'cvr_high' ? 0.15 :
                 pattern.conditions?.cvr_bucket === 'cvr_mid' ? 0.10 : 0,
        acos_max: pattern.conditions?.acos_bucket === 'acos_low' ? 0.25 :
                  pattern.conditions?.acos_bucket === 'acos_mid' ? 0.35 : 1.0
      }
    },
    actions: [{
      action_type: 'bid_adjust',
      parameters: {
        delta_pct: suggestedDeltaPct,
        cap_pct: 30
      },
      dry_run_compatible: true
    }],
    constraints: {
      max_bid_change_pct: 30,
      max_actions_per_day: 5
    },
    require_approval: true,  // Always require operator approval
    rollback_plan: {
      type: 'automatic',
      steps: [
        'Revert bid to original value',
        'Wait 48h for stabilization'
      ],
      safe_window_hours: 48
    },
    success_signals: {
      exec: {
        count: pattern.sample_size || 0,
        success_rate: 1.0  // All samples in pattern are exec success
      },
      operator: {
        approval_count: pattern.sample_size || 0,
        rejection_count: 0,
        approval_rate: 1.0  // All samples in pattern are approved
      },
      business: {
        metric_name: pattern.primary_metric?.name || 'acos',
        baseline: null,
        current: null,
        improvement_pct: Math.round((pattern.business_improve_rate || 0) * 100),
        sample_size: pattern.sample_size || 0
      }
    },
    evaluation_window_days: 7,
    expiry_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    evidence: pattern.evidence_refs?.slice(0, 10).map(runId => ({
      trace_id: runId,
      summary: `Run ${runId} contributed to pattern`
    })) || []
  };

  return policy;
}

/**
 * Write policy to sandbox as YAML-like format
 */
function writePolicy(policy, dryRun = false) {
  mkdirSync(SANDBOX_DIR, { recursive: true });

  const filename = `${policy.policy_id}.yaml`;
  const filepath = join(SANDBOX_DIR, filename);

  if (!dryRun) {
    // Write as formatted JSON with YAML-like header
    const content = `# Learned Policy (auto-generated by policy_crystallizer v0.1)
# Schema: _meta/contracts/learning/learned_policy.schema.yaml
# Generated: ${policy.learned_at}
# Policy ID: ${policy.policy_id}
# Confidence: ${policy.confidence}
# Sample Size: ${policy.success_signals.exec.count}
# Improve Rate: ${policy.success_signals.business.improvement_pct}%

${JSON.stringify(policy, null, 2)}
`;
    writeFileSync(filepath, content);
    console.error(`[policy_crystallizer] Wrote: ${filepath}`);
  } else {
    console.error(`[policy_crystallizer] Dry-run: would write ${filepath}`);
  }

  return filepath;
}

/**
 * Crystallize patterns into policies
 */
function crystallize(patterns, dryRun = false) {
  const policies = [];

  for (const pattern of patterns) {
    // Check crystallization thresholds
    const sampleSize = pattern.sample_size || 0;
    const improveRate = pattern.business_improve_rate || 0;

    if (sampleSize < MIN_SAMPLE_SIZE) {
      console.error(`[policy_crystallizer] Skipping ${pattern.pattern_id}: sample_size=${sampleSize} < ${MIN_SAMPLE_SIZE}`);
      continue;
    }

    if (improveRate < MIN_IMPROVE_RATE) {
      console.error(`[policy_crystallizer] Skipping ${pattern.pattern_id}: improve_rate=${improveRate} < ${MIN_IMPROVE_RATE}`);
      continue;
    }

    // Crystallize!
    const policy = patternToPolicy(pattern);
    const filepath = writePolicy(policy, dryRun);

    policies.push({
      policy_id: policy.policy_id,
      filepath,
      pattern_id: pattern.pattern_id,
      sample_size: sampleSize,
      improve_rate: improveRate,
      confidence: policy.confidence
    });

    console.error(`[policy_crystallizer] Crystallized: ${policy.policy_id} (samples=${sampleSize}, improve=${(improveRate*100).toFixed(1)}%)`);
  }

  return policies;
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  // Find patterns file
  let patternsFile = null;
  const patternsIndex = args.indexOf('--patterns-file');
  if (patternsIndex !== -1 && args[patternsIndex + 1]) {
    patternsFile = args[patternsIndex + 1];
  } else {
    patternsFile = findLatestPatternsFile();
  }

  console.error('[policy_crystallizer] Starting crystallization v0.1...');
  console.error(`[policy_crystallizer] Dry-run: ${dryRun}`);
  console.error(`[policy_crystallizer] Patterns file: ${patternsFile || '(not found)'}`);
  console.error(`[policy_crystallizer] Thresholds: sample_size >= ${MIN_SAMPLE_SIZE}, improve_rate >= ${MIN_IMPROVE_RATE}`);

  try {
    if (!patternsFile) {
      const result = {
        status: 'success',
        timestamp: new Date().toISOString(),
        dry_run: dryRun,
        patterns_received: 0,
        policies_created: 0,
        policies: [],
        message: 'No patterns file found'
      };
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    }

    // Load patterns
    const patterns = loadPatterns(patternsFile);
    console.error(`[policy_crystallizer] Loaded ${patterns.length} patterns from ${basename(patternsFile)}`);

    // Filter for crystallizable patterns
    const crystallizable = patterns.filter(p => p.can_crystallize);
    console.error(`[policy_crystallizer] Crystallizable: ${crystallizable.length}`);

    // Crystallize
    const policies = crystallize(crystallizable, dryRun);

    const result = {
      status: 'success',
      timestamp: new Date().toISOString(),
      dry_run: dryRun,
      patterns_file: patternsFile,
      patterns_received: patterns.length,
      patterns_crystallizable: crystallizable.length,
      policies_created: policies.length,
      policies
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);

  } catch (error) {
    const result = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'CRYSTALLIZATION_FAILED',
        message: error.message
      }
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

// Only run if directly executed
const isDirectRun = process.argv[1]?.endsWith('policy_crystallizer_v0.mjs');
if (isDirectRun) {
  main();
}

export { crystallize, patternToPolicy, calculateConfidence, generatePolicyId };
