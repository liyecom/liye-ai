/**
 * Live Run Report Writer
 *
 * Generates LiveRunReport documents immediately after P6-C supervised writes.
 * The report provides a complete audit trail of what was written, the API response,
 * and the action outcome event for feedback loops.
 *
 * P6-C Audit Requirements:
 * - Report generated immediately after write completion
 * - Contains ActionOutcomeEvent for playbook evaluation
 * - Tracks rollback status for recovery capability
 * - Records any guards triggered during execution
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const TRACE_BASE_DIR = process.env.TRACE_BASE_DIR || '.liye/traces';

/**
 * Generate a unique Live Run Report ID
 * Format: lrr-[timestamp in base36]
 */
function generateReportId() {
  return `lrr-${Date.now().toString(36)}`;
}

/**
 * Generate a Live Run Report after a write operation
 *
 * @param {Object} params
 * @param {string} params.trace_id - Trace identifier
 * @param {string} params.spec_id - LiveRunSpec ID that authorized this write
 * @param {Object} params.write_content - What was actually written
 * @param {Object} params.api_response - Raw API response from Amazon Ads
 * @param {Object} params.rollback_action - Rollback action details (optional)
 * @param {Array<string>} params.guards_triggered - Guards triggered during execution (optional)
 * @param {string} params.baseDir - Base directory for traces (optional)
 * @returns {Object} { success, report, error }
 */
export function generateLiveRunReport(params) {
  const {
    trace_id,
    spec_id,
    write_content,
    api_response,
    rollback_action,
    guards_triggered = [],
    baseDir
  } = params;

  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);

  try {
    // Ensure trace directory exists
    if (!existsSync(traceDir)) {
      mkdirSync(traceDir, { recursive: true });
    }

    const report = {
      report_id: generateReportId(),
      trace_id,
      spec_id,
      write_content,
      api_response,
      action_outcome_event: {
        event_type: 'ACTION_OUTCOME',
        timestamp: new Date().toISOString(),
        payload: {
          action_type: write_content?.action_type || 'ADD_NEGATIVE_KEYWORDS',
          success: api_response?.success || false,
          items_affected: write_content?.keywords?.length || 0,
          ...(api_response?.success === false && api_response?.error_message
            ? { error_message: api_response.error_message }
            : {})
        }
      },
      rollback_status: rollback_action ? 'READY' : 'NOT_AVAILABLE',
      rollback_action: rollback_action || null,
      guards_triggered,
      generated_at: new Date().toISOString()
    };

    const reportPath = join(traceDir, 'live_run_report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`[LiveRunReport] Generated at ${reportPath}`);
    return { success: true, report };

  } catch (e) {
    console.error('[LiveRunReport] Failed:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Load an existing Live Run Report from trace directory
 *
 * @param {string} trace_id - Trace identifier
 * @param {string} baseDir - Base directory for traces (optional)
 * @returns {Object|null} The report object or null if not found
 */
export function loadLiveRunReport(trace_id, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const reportPath = join(traceBaseDir, trace_id, 'live_run_report.json');

  if (!existsSync(reportPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(reportPath, 'utf-8'));
  } catch (e) {
    console.error('[LiveRunReport] Failed to load report:', e.message);
    return null;
  }
}

/**
 * Check if a Live Run Report exists for a trace
 *
 * @param {string} trace_id - Trace identifier
 * @param {string} baseDir - Base directory for traces (optional)
 * @returns {boolean}
 */
export function reportExists(trace_id, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const reportPath = join(traceBaseDir, trace_id, 'live_run_report.json');
  return existsSync(reportPath);
}

/**
 * Get path to Live Run Report file
 *
 * @param {string} trace_id - Trace identifier
 * @param {string} baseDir - Base directory for traces (optional)
 * @returns {string}
 */
export function getReportPath(trace_id, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  return join(traceBaseDir, trace_id, 'live_run_report.json');
}

/**
 * Update rollback status in an existing report
 *
 * @param {string} trace_id - Trace identifier
 * @param {string} status - New rollback status (READY, NOT_AVAILABLE, EXECUTED)
 * @param {string} baseDir - Base directory for traces (optional)
 * @returns {Object} { success, error }
 */
export function updateRollbackStatus(trace_id, status, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const reportPath = join(traceBaseDir, trace_id, 'live_run_report.json');

  if (!existsSync(reportPath)) {
    return { success: false, error: 'Report not found' };
  }

  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
    report.rollback_status = status;
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`[LiveRunReport] Updated rollback status to ${status}`);
    return { success: true };
  } catch (e) {
    console.error('[LiveRunReport] Failed to update rollback status:', e.message);
    return { success: false, error: e.message };
  }
}

export default {
  generateLiveRunReport,
  loadLiveRunReport,
  reportExists,
  getReportPath,
  updateRollbackStatus
};
