#!/usr/bin/env node
/**
 * Promotion v0.1 (Week 6 Learning Pipeline)
 * SSOT: .claude/scripts/learning/promotion_v0.mjs
 *
 * Control Plane component: manages policy lifecycle transitions.
 * Week 6 only supports: sandbox → candidate
 *
 * Promotion criteria (sandbox → candidate):
 * - sample_size >= 20 OR consecutive 2 report periods with improve_rate >= 0.6
 * - No drift guard triggered
 * - Scope within bounds
 *
 * Usage:
 *   node .claude/scripts/learning/promotion_v0.mjs [--dry-run]
 *
 * Output: JSON with promotion actions taken
 */

import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directories
const POLICIES_BASE = join(__dirname, '../../../state/memory/learned/policies');
const PROMOTION_LOG = join(__dirname, '../../../state/runtime/learning/promotion_log.jsonl');

const STATUS_DIRS = {
  sandbox: join(POLICIES_BASE, 'sandbox'),
  candidate: join(POLICIES_BASE, 'candidate'),
  production: join(POLICIES_BASE, 'production'),
  disabled: join(POLICIES_BASE, 'disabled'),
  quarantine: join(POLICIES_BASE, 'quarantine')
};

// Promotion criteria
const PROMOTION_CRITERIA = {
  sandbox_to_candidate: {
    min_sample_size: 20,
    alt_min_sample_size: 10,  // If improve_rate high
    min_improve_rate: 0.6,
    min_confidence: 0.5
  }
};

/**
 * Load a policy file
 */
function loadPolicy(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8');
    // Extract JSON from the file (our format has JSON after header comments)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error(`[promotion] Failed to load ${filepath}: ${error.message}`);
    return null;
  }
}

/**
 * Get policies from a status directory
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
      policies.push({ filepath, policy, filename: file });
    }
  }

  return policies;
}

/**
 * Write promotion log entry (append-only)
 */
function logPromotion(entry) {
  mkdirSync(dirname(PROMOTION_LOG), { recursive: true });

  const logEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  };

  appendFileSync(PROMOTION_LOG, JSON.stringify(logEntry) + '\n');
}

/**
 * Move a policy to a new status directory
 */
function movePolicy(filepath, newStatus, dryRun = false) {
  const filename = basename(filepath);
  const newDir = STATUS_DIRS[newStatus];
  const newPath = join(newDir, filename);

  if (!dryRun) {
    mkdirSync(newDir, { recursive: true });
    renameSync(filepath, newPath);
    console.error(`[promotion] Moved: ${filepath} -> ${newPath}`);
  } else {
    console.error(`[promotion] Dry-run: would move ${filepath} -> ${newPath}`);
  }

  return newPath;
}

/**
 * Update policy status in file
 */
function updatePolicyStatus(filepath, newStatus, dryRun = false) {
  if (dryRun) {
    return;
  }

  const content = readFileSync(filepath, 'utf-8');
  const policy = loadPolicy(filepath);

  if (!policy) {
    return;
  }

  policy.validation_status = newStatus;
  policy.promoted_at = new Date().toISOString();

  // Preserve header comments and update JSON
  const headerMatch = content.match(/^(#[^\n]*\n)*/);
  const header = headerMatch ? headerMatch[0] : '';

  const newContent = `${header}${JSON.stringify(policy, null, 2)}\n`;
  writeFileSync(filepath, newContent);
}

/**
 * Check if a sandbox policy is ready for promotion to candidate
 */
function checkSandboxPromotion(policy) {
  const criteria = PROMOTION_CRITERIA.sandbox_to_candidate;

  // Get metrics from success_signals
  const sampleSize = policy.success_signals?.exec?.count || 0;
  const improveRate = (policy.success_signals?.business?.improvement_pct || 0) / 100;
  const confidence = policy.confidence || 0;

  // Check minimum confidence
  if (confidence < criteria.min_confidence) {
    return {
      eligible: false,
      reason: `confidence=${confidence.toFixed(2)} < ${criteria.min_confidence}`
    };
  }

  // Primary path: sample_size >= 20
  if (sampleSize >= criteria.min_sample_size) {
    return {
      eligible: true,
      reason: `sample_size=${sampleSize} >= ${criteria.min_sample_size}`
    };
  }

  // Alternative path: sample_size >= 10 AND improve_rate >= 0.6
  if (sampleSize >= criteria.alt_min_sample_size && improveRate >= criteria.min_improve_rate) {
    return {
      eligible: true,
      reason: `sample_size=${sampleSize} >= ${criteria.alt_min_sample_size} AND improve_rate=${(improveRate*100).toFixed(1)}% >= ${criteria.min_improve_rate*100}%`
    };
  }

  return {
    eligible: false,
    reason: `sample_size=${sampleSize} < ${criteria.min_sample_size} AND (sample_size < ${criteria.alt_min_sample_size} OR improve_rate=${(improveRate*100).toFixed(1)}% < ${criteria.min_improve_rate*100}%)`
  };
}

/**
 * Check scope is within bounds (no cross-tenant violations)
 */
function checkScopeBounds(policy) {
  const scope = policy.scope || {};

  // Week 6: basic scope validation
  if (scope.type === 'global') {
    return { valid: true };
  }

  // Ensure tenant_id is present for non-global scopes
  if (!scope.keys?.tenant_id) {
    return { valid: false, reason: 'missing tenant_id in scope.keys' };
  }

  return { valid: true };
}

/**
 * Check for drift (placeholder for Week 6)
 */
function checkDriftGuard(policy) {
  // Week 6: no drift detection implemented yet
  // Always pass for now
  return { triggered: false };
}

/**
 * Check and execute promotions
 */
function checkPromotions(dryRun = false) {
  const actions = [];

  // Get sandbox policies
  const sandboxPolicies = getPolicies('sandbox');
  console.error(`[promotion] Found ${sandboxPolicies.length} sandbox policies`);

  for (const { filepath, policy, filename } of sandboxPolicies) {
    const policyId = policy.policy_id || filename.replace('.yaml', '');

    // Check scope bounds
    const scopeCheck = checkScopeBounds(policy);
    if (!scopeCheck.valid) {
      console.error(`[promotion] ${policyId}: scope invalid - ${scopeCheck.reason}`);
      continue;
    }

    // Check drift guard
    const driftCheck = checkDriftGuard(policy);
    if (driftCheck.triggered) {
      console.error(`[promotion] ${policyId}: drift guard triggered`);
      continue;
    }

    // Check promotion criteria
    const promotionCheck = checkSandboxPromotion(policy);

    if (promotionCheck.eligible) {
      // Promote to candidate!
      const newPath = movePolicy(filepath, 'candidate', dryRun);
      updatePolicyStatus(newPath, 'candidate', dryRun);

      actions.push({
        action: 'promote',
        policy_id: policyId,
        from: 'sandbox',
        to: 'candidate',
        new_path: newPath,
        reason: promotionCheck.reason
      });

      console.error(`[promotion] PROMOTED: ${policyId} (${promotionCheck.reason})`);
    } else {
      console.error(`[promotion] ${policyId}: not eligible (${promotionCheck.reason})`);
    }
  }

  return actions;
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.error('[promotion] Starting promotion check v0.1...');
  console.error(`[promotion] Dry-run: ${dryRun}`);
  console.error(`[promotion] Week 6: sandbox → candidate only`);

  try {
    // Check promotions
    const promotions = checkPromotions(dryRun);
    console.error(`[promotion] Promotions: ${promotions.length}`);

    // Log promotions (append-only)
    if (!dryRun && promotions.length > 0) {
      for (const p of promotions) {
        try {
          logPromotion(p);
        } catch (e) {
          console.error(`[promotion] Failed to log promotion: ${e.message}`);
        }
      }
    }

    const result = {
      status: 'success',
      timestamp: new Date().toISOString(),
      dry_run: dryRun,
      promotions_count: promotions.length,
      promotions,
      summary: {
        sandbox_checked: getPolicies('sandbox').length + promotions.length,
        promoted_to_candidate: promotions.length
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

export { checkSandboxPromotion, checkPromotions, checkScopeBounds, checkDriftGuard };
