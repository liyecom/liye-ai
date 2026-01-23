/**
 * Governance Kernel v1 - Internal Types
 *
 * These are runtime constants matching the frozen v1 schemas.
 * DO NOT modify without corresponding v2 schema update.
 */

/**
 * Protocol version (frozen)
 */
export const PROTOCOL_VERSION = '1.0.0';

/**
 * Gate decision enum (matches GateReport.schema.json)
 * @readonly
 * @enum {string}
 */
export const GateDecision = Object.freeze({
  ALLOW: 'ALLOW',
  BLOCK: 'BLOCK',
  DEGRADE: 'DEGRADE',
  UNKNOWN: 'UNKNOWN'
});

/**
 * Contract rule effect enum (matches Contract.schema.json)
 * @readonly
 * @enum {string}
 */
export const RuleEffect = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  DEGRADE: 'DEGRADE',
  REQUIRE_EVIDENCE: 'REQUIRE_EVIDENCE'
});

/**
 * Risk severity enum
 * @readonly
 * @enum {string}
 */
export const Severity = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
});

/**
 * TraceEvent type enum (matches TraceEvent.schema.json - 12 types)
 * @readonly
 * @enum {string}
 */
export const TraceEventType = Object.freeze({
  GATE_START: 'gate.start',
  GATE_END: 'gate.end',
  CONTRACT_LOAD: 'contract.load',
  ENFORCE_ALLOW: 'enforce.allow',
  ENFORCE_BLOCK: 'enforce.block',
  ACTION_PLAN: 'action.plan',
  ACTION_EXECUTE: 'action.execute',
  ACTION_RESULT: 'action.result',
  VERDICT_EMIT: 'verdict.emit',
  REPLAY_START: 'replay.start',
  REPLAY_END: 'replay.end',
  ERROR: 'error'
});

/**
 * Generate unique trace ID
 * Format: trace-<timestamp>-<random>
 * @returns {string}
 */
export function generateTraceId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `trace-${ts}-${rand}`;
}

/**
 * Generate unique span ID
 * @returns {string}
 */
export function generateSpanId() {
  return `span-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @typedef {Object} GateInput
 * @property {string} task - Task description
 * @property {Object} [context] - Task context
 * @property {Action[]} [proposed_actions] - Proposed actions
 */

/**
 * @typedef {Object} Action
 * @property {string} action_type - Action type (e.g., 'write', 'delete', 'read')
 * @property {string} [tool] - Tool name
 * @property {string} [resource] - Resource identifier
 * @property {string} [path_prefix] - Path prefix for file operations
 */

/**
 * @typedef {Object} RiskItem
 * @property {string} id - Risk identifier
 * @property {string} severity - low/medium/high/critical
 * @property {string} rationale - Explanation
 * @property {string[]} [evidence_required] - Required evidence
 */

/**
 * @typedef {Object} GateReport
 * @property {string} version - "1.0.0"
 * @property {string} [trace_id] - Associated trace
 * @property {string} created_at - ISO8601 timestamp
 * @property {string} decision - ALLOW/BLOCK/DEGRADE/UNKNOWN
 * @property {RiskItem[]} risks - Identified risks
 * @property {Object[]} unknowns - Unknown factors
 * @property {Object[]} constraints - Applied constraints
 * @property {string[]} recommended_next_actions - Recommendations
 */

/**
 * @typedef {Object} Verdict
 * @property {string} version - "1.0.0"
 * @property {string} [trace_id] - Associated trace
 * @property {string} created_at - ISO8601 timestamp
 * @property {string} summary - Decision summary
 * @property {string[]} why - Reasons
 * @property {string[]} what_changed - Changes made
 * @property {string[]} what_blocked - Blocked actions
 * @property {string[]} next_steps - Next steps
 * @property {number} [confidence] - 0-1 confidence score
 */

/**
 * @typedef {Object} TraceEvent
 * @property {string} ts - ISO8601 timestamp
 * @property {string} trace_id - Trace identifier
 * @property {string} [span_id] - Span identifier
 * @property {string} [parent_span_id] - Parent span
 * @property {number} seq - Sequence number
 * @property {string} type - Event type
 * @property {Object} payload - Event data
 * @property {string} hash_prev - Previous hash
 * @property {string} hash - This event's hash
 */
