/**
 * Replay - Deterministic verification of traces
 *
 * Validates trace integrity:
 * 1. Schema compliance (each event matches TraceEvent.schema.json)
 * 2. Hash chain integrity (no tampering)
 * 3. Structural completeness (gate.start → gate.end → verdict.emit)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  validateTrace,
  findEventsByType,
  getTraceSummary,
  ValidationErrorType
} from './trace/trace_reader.mjs';
import { createTrace } from './trace/trace_writer.mjs';
import { TraceEventType, PROTOCOL_VERSION } from './types.mjs';

/**
 * Default trace output directory
 */
const DEFAULT_TRACE_DIR = '.liye/traces';

/**
 * Replay result status
 */
export const ReplayStatus = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL'
});

/**
 * Replay and verify a trace
 *
 * @param {string} traceId - Trace identifier
 * @param {Object} [options] - Options
 * @param {string} [options.baseDir] - Base directory for traces
 * @param {boolean} [options.writeResults] - Write replay.json and diff.json
 * @returns {ReplayResult}
 */
export function replay(traceId, options = {}) {
  const { baseDir = DEFAULT_TRACE_DIR, writeResults = true } = options;
  const traceDir = join(baseDir, traceId);

  const started_at = new Date().toISOString();
  const errors = [];
  const warnings = [];

  // Step 1: Validate trace (schema + hash chain)
  const validation = validateTrace(traceId, baseDir);

  if (!validation.valid) {
    errors.push(...validation.errors.map(e => ({
      type: e.type,
      message: e.message,
      seq: e.seq
    })));
  }

  const events = validation.events;
  const summary = events.length > 0 ? getTraceSummary(events) : null;

  // Step 2: Structural completeness check
  const structuralErrors = validateStructure(events);
  errors.push(...structuralErrors);

  // Step 3: Payload schema validation
  const payloadErrors = validatePayloads(events);
  errors.push(...payloadErrors);

  // Determine result
  const status = errors.length === 0 ? ReplayStatus.PASS : ReplayStatus.FAIL;
  const ended_at = new Date().toISOString();

  const result = {
    status,
    trace_id: traceId,
    trace_dir: traceDir,
    started_at,
    ended_at,
    event_count: events.length,
    summary,
    errors,
    warnings,
    checks: {
      schema_valid: !validation.errors.some(e => e.type === ValidationErrorType.INVALID_SCHEMA),
      hash_chain_valid: !validation.errors.some(e =>
        e.type === ValidationErrorType.HASH_CHAIN_BROKEN ||
        e.type === ValidationErrorType.HASH_MISMATCH
      ),
      structure_valid: structuralErrors.length === 0,
      payloads_valid: payloadErrors.length === 0
    }
  };

  // Write results
  if (writeResults) {
    // Write replay.json
    writeFileSync(
      join(traceDir, 'replay.json'),
      JSON.stringify(result, null, 2)
    );

    // Write diff.json (always, even if empty)
    const diff = errors.length > 0 ? {
      timestamp: ended_at,
      error_count: errors.length,
      errors: errors.slice(0, 10)  // Limit to first 10 errors
    } : {
      timestamp: ended_at,
      error_count: 0,
      errors: []
    };

    writeFileSync(
      join(traceDir, 'diff.json'),
      JSON.stringify(diff, null, 2)
    );
  }

  return result;
}

/**
 * Validate structural completeness
 *
 * @param {TraceEvent[]} events
 * @returns {ValidationError[]}
 */
function validateStructure(events) {
  const errors = [];

  const gateStarts = findEventsByType(events, TraceEventType.GATE_START);
  const gateEnds = findEventsByType(events, TraceEventType.GATE_END);
  const verdicts = findEventsByType(events, TraceEventType.VERDICT_EMIT);

  // Must have gate.start
  if (gateStarts.length === 0) {
    errors.push({
      type: 'STRUCTURE_INCOMPLETE',
      message: 'Missing gate.start event',
      required: 'gate.start'
    });
  }

  // Must have gate.end
  if (gateEnds.length === 0) {
    errors.push({
      type: 'STRUCTURE_INCOMPLETE',
      message: 'Missing gate.end event',
      required: 'gate.end'
    });
  }

  // Must have verdict.emit
  if (verdicts.length === 0) {
    errors.push({
      type: 'STRUCTURE_INCOMPLETE',
      message: 'Missing verdict.emit event',
      required: 'verdict.emit'
    });
  }

  // gate.start should come before gate.end
  if (gateStarts.length > 0 && gateEnds.length > 0) {
    const startSeq = gateStarts[0].seq;
    const endSeq = gateEnds[0].seq;

    if (startSeq >= endSeq) {
      errors.push({
        type: 'STRUCTURE_ORDER',
        message: `gate.start (seq=${startSeq}) should come before gate.end (seq=${endSeq})`,
        start_seq: startSeq,
        end_seq: endSeq
      });
    }
  }

  return errors;
}

/**
 * Validate payload schemas
 *
 * @param {TraceEvent[]} events
 * @returns {ValidationError[]}
 */
function validatePayloads(events) {
  const errors = [];

  for (const event of events) {
    switch (event.type) {
      case TraceEventType.GATE_END:
        // Validate GateReport in payload
        const gateReport = event.payload;
        if (!gateReport.version || gateReport.version !== PROTOCOL_VERSION) {
          errors.push({
            type: 'PAYLOAD_INVALID',
            message: `gate.end payload: invalid version "${gateReport.version}"`,
            seq: event.seq,
            expected_version: PROTOCOL_VERSION
          });
        }
        if (!gateReport.decision) {
          errors.push({
            type: 'PAYLOAD_INVALID',
            message: 'gate.end payload: missing decision',
            seq: event.seq
          });
        }
        if (!gateReport.created_at) {
          errors.push({
            type: 'PAYLOAD_INVALID',
            message: 'gate.end payload: missing created_at',
            seq: event.seq
          });
        }
        break;

      case TraceEventType.VERDICT_EMIT:
        // Validate Verdict in payload
        const verdict = event.payload;
        if (!verdict.version || verdict.version !== PROTOCOL_VERSION) {
          errors.push({
            type: 'PAYLOAD_INVALID',
            message: `verdict.emit payload: invalid version "${verdict.version}"`,
            seq: event.seq,
            expected_version: PROTOCOL_VERSION
          });
        }
        if (!verdict.summary) {
          errors.push({
            type: 'PAYLOAD_INVALID',
            message: 'verdict.emit payload: missing summary',
            seq: event.seq
          });
        }
        if (!verdict.why || verdict.why.length === 0) {
          errors.push({
            type: 'PAYLOAD_INVALID',
            message: 'verdict.emit payload: missing or empty why',
            seq: event.seq
          });
        }
        if (!verdict.next_steps || verdict.next_steps.length === 0) {
          errors.push({
            type: 'PAYLOAD_INVALID',
            message: 'verdict.emit payload: missing or empty next_steps',
            seq: event.seq
          });
        }
        break;
    }
  }

  return errors;
}

/**
 * Run replay with trace events recorded
 *
 * @param {string} traceId
 * @param {Object} [options]
 * @returns {ReplayResult}
 */
export function replayWithTrace(traceId, options = {}) {
  const { baseDir = DEFAULT_TRACE_DIR } = options;
  const traceDir = join(baseDir, traceId);

  // Create a new trace for replay events
  const replayTrace = createTrace(`${traceId}-replay`, baseDir);

  // Record replay.start
  replayTrace.append(TraceEventType.REPLAY_START, {
    target_trace_id: traceId,
    target_trace_dir: traceDir
  });

  // Run replay
  const result = replay(traceId, { ...options, writeResults: true });

  // Record replay.end
  replayTrace.append(TraceEventType.REPLAY_END, {
    status: result.status,
    error_count: result.errors.length
  });

  return result;
}

/**
 * Format replay result for console output
 *
 * @param {ReplayResult} result
 * @returns {string}
 */
export function formatReplayResult(result) {
  const lines = [
    `Replay: ${result.status}`,
    `Trace: ${result.trace_id}`,
    `Events: ${result.event_count}`,
    '',
    'Checks:',
    `  Schema: ${result.checks.schema_valid ? '✓' : '✗'}`,
    `  Hash Chain: ${result.checks.hash_chain_valid ? '✓' : '✗'}`,
    `  Structure: ${result.checks.structure_valid ? '✓' : '✗'}`,
    `  Payloads: ${result.checks.payloads_valid ? '✓' : '✗'}`
  ];

  if (result.errors.length > 0) {
    lines.push('', 'Errors:');
    for (const err of result.errors.slice(0, 5)) {
      lines.push(`  - [${err.type}] ${err.message}`);
    }
    if (result.errors.length > 5) {
      lines.push(`  ... and ${result.errors.length - 5} more`);
    }
  }

  return lines.join('\n');
}
