/**
 * Live Run Spec Writer
 *
 * Creates LiveRunSpec documents for P6-C supervised writes.
 * A LiveRunSpec must be explicitly declared before any live write operation.
 *
 * P6-C Constraints:
 * - Maximum 5 keywords per spec
 * - Evidence snapshot required (hash + path)
 * - Reason summary must explain why action is needed
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const TRACE_BASE_DIR = process.env.TRACE_BASE_DIR || '.liye/traces';

/**
 * Generate a unique Live Run Spec ID
 * Format: lrs-[8 random alphanumeric chars]
 */
function generateSpecId() {
  const random = Math.random().toString(36).substring(2, 10);
  return `lrs-${random}`;
}

/**
 * Hash evidence file for snapshot
 * @param {string} evidencePath - Path to evidence file
 * @returns {Object} { hash, file_path }
 */
function hashEvidence(evidencePath) {
  if (!existsSync(evidencePath)) {
    return { hash: 'MISSING', file_path: evidencePath };
  }
  const content = readFileSync(evidencePath, 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex').substring(0, 16);
  return { hash, file_path: evidencePath };
}

/**
 * Create a Live Run Spec for P6-C supervised writes
 *
 * @param {Object} params
 * @param {string} params.trace_id - Trace identifier
 * @param {string} params.customer - Customer identifier (e.g., 'timo')
 * @param {string} params.market - Target market (US, CA, UK, DE, FR, IT, ES, JP)
 * @param {string} params.action_type - Action type (currently only ADD_NEGATIVE_KEYWORDS)
 * @param {string} params.reason_summary - Why this action is being taken (min 20 chars)
 * @param {string} params.evidence_path - Path to evidence file (optional, defaults to trace evidence.json)
 * @param {Array} params.proposed_keywords - Keywords to add [{keyword, match_type}] (max 5)
 * @param {string} params.baseDir - Base directory for traces (optional)
 * @returns {Object} { success, spec, error }
 */
export function createLiveRunSpec(params) {
  const {
    trace_id,
    customer,
    market,
    action_type,
    reason_summary,
    evidence_path,
    proposed_keywords = [],
    baseDir
  } = params;

  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);

  // P6-C constraint: max 5 keywords
  if (proposed_keywords.length > 5) {
    return {
      success: false,
      error: `Keyword count ${proposed_keywords.length} exceeds P6-C limit of 5`
    };
  }

  // Validate reason_summary length
  if (!reason_summary || reason_summary.length < 20) {
    return {
      success: false,
      error: `reason_summary must be at least 20 characters (got ${reason_summary?.length || 0})`
    };
  }

  try {
    // Ensure trace directory exists
    if (!existsSync(traceDir)) {
      mkdirSync(traceDir, { recursive: true });
    }

    const spec = {
      spec_id: generateSpecId(),
      customer,
      market,
      action_type,
      reason_summary,
      evidence_snapshot: hashEvidence(evidence_path || join(traceDir, 'evidence.json')),
      proposed_keywords,
      created_at: new Date().toISOString()
    };

    const specPath = join(traceDir, 'live_run_spec.json');
    writeFileSync(specPath, JSON.stringify(spec, null, 2), 'utf-8');

    console.log(`[LiveRunSpec] Created spec at ${specPath}`);
    return { success: true, spec };

  } catch (e) {
    console.error('[LiveRunSpec] Failed to create spec:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Load an existing Live Run Spec from trace directory
 *
 * @param {string} trace_id - Trace identifier
 * @param {string} baseDir - Base directory for traces (optional)
 * @returns {Object|null} The spec object or null if not found
 */
export function loadLiveRunSpec(trace_id, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const specPath = join(traceBaseDir, trace_id, 'live_run_spec.json');

  if (!existsSync(specPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(specPath, 'utf-8'));
  } catch (e) {
    console.error('[LiveRunSpec] Failed to load spec:', e.message);
    return null;
  }
}

/**
 * Check if a Live Run Spec exists for a trace
 *
 * @param {string} trace_id - Trace identifier
 * @param {string} baseDir - Base directory for traces (optional)
 * @returns {boolean}
 */
export function specExists(trace_id, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const specPath = join(traceBaseDir, trace_id, 'live_run_spec.json');
  return existsSync(specPath);
}

/**
 * Get path to Live Run Spec file
 *
 * @param {string} trace_id - Trace identifier
 * @param {string} baseDir - Base directory for traces (optional)
 * @returns {string}
 */
export function getSpecPath(trace_id, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  return join(traceBaseDir, trace_id, 'live_run_spec.json');
}

export default { createLiveRunSpec, loadLiveRunSpec, specExists, getSpecPath };
