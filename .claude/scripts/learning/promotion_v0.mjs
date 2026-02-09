#!/usr/bin/env node
/**
 * Promotion v0 (Week 6 Learning Pipeline)
 * SSOT: .claude/scripts/learning/promotion_v0.mjs
 *
 * Control Plane component: manages policy lifecycle transitions.
 * Checks promotion criteria and moves policies between status directories.
 *
 * Lifecycle: sandbox → candidate → production → disabled/quarantine
 *
 * Stub implementation for Week 6 bootstrap.
 *
 * Usage:
 *   node .claude/scripts/learning/promotion_v0.mjs [--dry-run] [--check-demotions]
 *
 * Output: JSON with promotion/demotion actions taken
 */

import { readdirSync, readFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

const POLICIES_BASE = 'state/memory/learned/policies';
const STATUS_DIRS = {
  sandbox: join(POLICIES_BASE, 'sandbox'),
  candidate: join(POLICIES_BASE, 'candidate'),
  production: join(POLICIES_BASE, 'production'),
  disabled: join(POLICIES_BASE, 'disabled'),
  quarantine: join(POLICIES_BASE, 'quarantine')
};

// Promotion criteria (aligned with execution_tiers.yaml)
const PROMOTION_CRITERIA = {
  sandbox_to_candidate: {
    min_days: 3,
    min_executions: 20,
    min_exec_success_rate: 0.70
  },
  candidate_to_production: {
    min_days: 7,
    min_proposals: 30,
    min_operator_approval_rate: 0.70,
    min_business_improvement_pct: 5.0
  }
};

// Demotion criteria (drift detection)
const DEMOTION_CRITERIA = {
  production_to_disabled: {
    drift_threshold: 0.20  // 20% performance degradation
  }
};

/**
 * Load a policy file (supports JSON content in .yaml files)
 * @param {string} filepath - Path to policy file
 * @returns {Object|null} Parsed policy or null if invalid
 */
function loadPolicy(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8');
    // Extract JSON from the file (our stub format)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error(`[promotion_v0] Failed to load ${filepath}: ${error.message}`);
    return null;
  }
}

/**
 * Get policies from a status directory
 * @param {string} status - Status directory name
 * @returns {Array} Array of {filepath, policy} objects
 */
function getPolicies(status) {
  const dir = STATUS_DIRS[status];
  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.yaml'));
  const policies = [];

  for (const file of files) {
    const filepath = join(dir, file);
    const policy = loadPolicy(filepath);
    if (policy) {
      policies.push({ filepath, policy });
    }
  }

  return policies;
}

/**
 * Move a policy to a new status directory
 * @param {string} filepath - Current policy filepath
 * @param {string} newStatus - Target status
 * @param {boolean} dryRun - If true, don't actually move
 * @returns {string} New filepath
 */
function movePolicy(filepath, newStatus, dryRun = false) {
  const filename = basename(filepath);
  const newDir = STATUS_DIRS[newStatus];
  const newPath = join(newDir, filename);

  if (!dryRun) {
    mkdirSync(newDir, { recursive: true });
    renameSync(filepath, newPath);
    console.error(`[promotion_v0] Moved: ${filepath} -> ${newPath}`);
  } else {
    console.error(`[promotion_v0] Dry-run: would move ${filepath} -> ${newPath}`);
  }

  return newPath;
}

/**
 * Check if a policy is ready for promotion from sandbox to candidate
 * @param {Object} policy - Policy object
 * @returns {Object} {eligible: boolean, reason: string}
 */
function checkSandboxPromotion(policy) {
  const criteria = PROMOTION_CRITERIA.sandbox_to_candidate;
  const learnedAt = new Date(policy.learned_at);
  const ageInDays = (Date.now() - learnedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays < criteria.min_days) {
    return { eligible: false, reason: `age ${ageInDays.toFixed(1)}d < ${criteria.min_days}d` };
  }

  const execCount = policy.success_signals?.exec?.count || 0;
  if (execCount < criteria.min_executions) {
    return { eligible: false, reason: `exec_count ${execCount} < ${criteria.min_executions}` };
  }

  const execRate = policy.success_signals?.exec?.success_rate || 0;
  if (execRate < criteria.min_exec_success_rate) {
    return { eligible: false, reason: `exec_rate ${(execRate * 100).toFixed(0)}% < ${criteria.min_exec_success_rate * 100}%` };
  }

  return { eligible: true, reason: 'meets all criteria' };
}

/**
 * Check if a policy is ready for promotion from candidate to production
 * @param {Object} policy - Policy object
 * @returns {Object} {eligible: boolean, reason: string}
 */
function checkCandidatePromotion(policy) {
  const criteria = PROMOTION_CRITERIA.candidate_to_production;
  const promotedAt = new Date(policy.promoted_at || policy.learned_at);
  const ageInDays = (Date.now() - promotedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays < criteria.min_days) {
    return { eligible: false, reason: `age ${ageInDays.toFixed(1)}d < ${criteria.min_days}d` };
  }

  const approvalCount = policy.success_signals?.operator?.approval_count || 0;
  if (approvalCount < criteria.min_proposals) {
    return { eligible: false, reason: `approvals ${approvalCount} < ${criteria.min_proposals}` };
  }

  const approvalRate = policy.success_signals?.operator?.approval_rate || 0;
  if (approvalRate < criteria.min_operator_approval_rate) {
    return { eligible: false, reason: `approval_rate ${(approvalRate * 100).toFixed(0)}% < ${criteria.min_operator_approval_rate * 100}%` };
  }

  const improvementPct = policy.success_signals?.business?.improvement_pct || 0;
  if (improvementPct < criteria.min_business_improvement_pct) {
    return { eligible: false, reason: `improvement ${improvementPct}% < ${criteria.min_business_improvement_pct}%` };
  }

  return { eligible: true, reason: 'meets all criteria' };
}

/**
 * Check promotions and optionally execute them
 * @param {boolean} dryRun - If true, don't actually move files
 * @returns {Array} Promotion actions taken
 */
function checkPromotions(dryRun = false) {
  const actions = [];

  // Check sandbox → candidate
  const sandboxPolicies = getPolicies('sandbox');
  for (const { filepath, policy } of sandboxPolicies) {
    const result = checkSandboxPromotion(policy);
    if (result.eligible) {
      const newPath = movePolicy(filepath, 'candidate', dryRun);
      actions.push({
        action: 'promote',
        policy_id: policy.policy_id,
        from: 'sandbox',
        to: 'candidate',
        new_path: newPath,
        reason: result.reason
      });
    } else {
      console.error(`[promotion_v0] ${policy.policy_id}: not eligible (${result.reason})`);
    }
  }

  // Check candidate → production
  const candidatePolicies = getPolicies('candidate');
  for (const { filepath, policy } of candidatePolicies) {
    const result = checkCandidatePromotion(policy);
    if (result.eligible) {
      const newPath = movePolicy(filepath, 'production', dryRun);
      actions.push({
        action: 'promote',
        policy_id: policy.policy_id,
        from: 'candidate',
        to: 'production',
        new_path: newPath,
        reason: result.reason
      });
    } else {
      console.error(`[promotion_v0] ${policy.policy_id}: not eligible (${result.reason})`);
    }
  }

  return actions;
}

/**
 * Check demotions (drift detection) and optionally execute them
 * @param {boolean} dryRun - If true, don't actually move files
 * @returns {Array} Demotion actions taken
 */
function checkDemotions(dryRun = false) {
  // Week 6 stub: drift detection not implemented
  console.error('[promotion_v0] Stub: demotion/drift detection not implemented');
  return [];
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const checkDemotionsFlag = args.includes('--check-demotions');

  console.error('[promotion_v0] Starting promotion check...');
  console.error(`[promotion_v0] Dry-run: ${dryRun}`);

  try {
    // Check promotions
    const promotions = checkPromotions(dryRun);
    console.error(`[promotion_v0] Promotions: ${promotions.length}`);

    // Optionally check demotions
    let demotions = [];
    if (checkDemotionsFlag) {
      demotions = checkDemotions(dryRun);
      console.error(`[promotion_v0] Demotions: ${demotions.length}`);
    }

    const result = {
      status: 'success',
      timestamp: new Date().toISOString(),
      dry_run: dryRun,
      promotions: promotions,
      demotions: demotions,
      summary: {
        promotions_count: promotions.length,
        demotions_count: demotions.length
      }
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);

  } catch (error) {
    const result = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'PROMOTION_CHECK_FAILED',
        message: error.message
      }
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

// Only run if directly executed
const isDirectRun = process.argv[1]?.endsWith('promotion_v0.mjs');
if (isDirectRun) {
  main();
}

export { checkSandboxPromotion, checkCandidatePromotion, checkPromotions, checkDemotions };
