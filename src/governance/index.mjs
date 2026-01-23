/**
 * LiYe Governance Kernel v1
 *
 * Four primitives for auditable agent governance:
 * - gate: Risk assessment before action
 * - enforce: Contract compliance checking
 * - trace: Append-only audit event chain
 * - replay: Deterministic verification
 *
 * @module governance
 */

// Types and constants
export {
  PROTOCOL_VERSION,
  GateDecision,
  RuleEffect,
  Severity,
  TraceEventType,
  generateTraceId,
  generateSpanId
} from './types.mjs';

// Hash utilities
export {
  sha256,
  stableStringify,
  hashEvent,
  computeHashChain
} from './utils/hash.mjs';

// Trace
export {
  createTrace,
  getTraceDir,
  traceExists
} from './trace/trace_writer.mjs';

export {
  readTrace,
  validateTrace,
  validateHashChain,
  validateSchema,
  findEventsByType,
  getTraceSummary,
  ValidationErrorType
} from './trace/trace_reader.mjs';

// Gate
export {
  gate,
  canProceed,
  getDecisionSeverity
} from './gate.mjs';

// Enforce
export {
  enforce,
  validateContract,
  createDenyRule,
  createAllowRule
} from './enforce.mjs';

// Verdict
export {
  generateVerdict,
  formatVerdictMarkdown
} from './verdict.mjs';

// Replay
export {
  replay,
  replayWithTrace,
  formatReplayResult,
  ReplayStatus
} from './replay.mjs';

/**
 * Run a complete governance cycle
 *
 * @param {GateInput} input - Task input
 * @param {Object} [options] - Options
 * @param {Object} [options.contract] - Contract to enforce
 * @param {string} [options.baseDir] - Base directory for traces
 * @returns {{trace_id: string, gateReport: GateReport, enforceResult: EnforceResult, verdict: Verdict, replayResult: ReplayResult}}
 */
export async function runGovernanceCycle(input, options = {}) {
  const { contract, baseDir = '.liye/traces' } = options;

  // Import functions dynamically to avoid circular deps
  const { createTrace } = await import('./trace/trace_writer.mjs');
  const { gate } = await import('./gate.mjs');
  const { enforce } = await import('./enforce.mjs');
  const { generateVerdict, formatVerdictMarkdown } = await import('./verdict.mjs');
  const { replay } = await import('./replay.mjs');

  // Create trace
  const trace = createTrace(undefined, baseDir);

  // Run gate
  const gateReport = gate(input, { trace });

  // Run enforce if contract provided and gate didn't block
  let enforceResult = null;
  if (contract && gateReport.decision !== 'BLOCK') {
    enforceResult = enforce(contract, input.proposed_actions || [], {
      trace,
      input
    });
  }

  // Generate verdict
  const verdict = generateVerdict(gateReport, enforceResult, { trace });

  // Write verdict files
  trace.writeFile('verdict.json', verdict);
  trace.writeFile('verdict.md', formatVerdictMarkdown(verdict));

  // Run replay
  const replayResult = replay(trace.trace_id, { baseDir, writeResults: true });

  return {
    trace_id: trace.trace_id,
    trace_dir: trace.traceDir,
    gateReport,
    enforceResult,
    verdict,
    replayResult
  };
}
