/**
 * TraceReader - Read and validate trace events
 *
 * Reads NDJSON trace files and validates hash chain integrity.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { hashEvent } from '../utils/hash.mjs';
import { TraceEventType } from '../types.mjs';

/**
 * Default trace output directory
 */
const DEFAULT_TRACE_DIR = '.liye/traces';

/**
 * Validation error types
 */
export const ValidationErrorType = Object.freeze({
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_JSON: 'INVALID_JSON',
  INVALID_SCHEMA: 'INVALID_SCHEMA',
  SEQ_DISCONTINUITY: 'SEQ_DISCONTINUITY',
  HASH_CHAIN_BROKEN: 'HASH_CHAIN_BROKEN',
  HASH_MISMATCH: 'HASH_MISMATCH',
  INVALID_EVENT_TYPE: 'INVALID_EVENT_TYPE'
});

/**
 * Read trace events from NDJSON file
 *
 * @param {string} traceId - Trace identifier
 * @param {string} [baseDir] - Base directory for traces
 * @returns {{events: TraceEvent[], errors: ValidationError[]}}
 */
export function readTrace(traceId, baseDir = DEFAULT_TRACE_DIR) {
  const eventsPath = join(baseDir, traceId, 'events.ndjson');
  const errors = [];
  const events = [];

  if (!existsSync(eventsPath)) {
    errors.push({
      type: ValidationErrorType.FILE_NOT_FOUND,
      message: `Trace file not found: ${eventsPath}`,
      seq: null
    });
    return { events, errors };
  }

  const content = readFileSync(eventsPath, 'utf-8');
  const lines = content.trim().split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const event = JSON.parse(line);
      events.push(event);
    } catch (err) {
      errors.push({
        type: ValidationErrorType.INVALID_JSON,
        message: `Line ${i + 1}: Invalid JSON - ${err.message}`,
        seq: i,
        line
      });
    }
  }

  return { events, errors };
}

/**
 * Validate hash chain integrity
 *
 * @param {TraceEvent[]} events - Events to validate
 * @returns {{valid: boolean, errors: ValidationError[]}}
 */
export function validateHashChain(events) {
  const errors = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Check sequence continuity
    if (event.seq !== i) {
      errors.push({
        type: ValidationErrorType.SEQ_DISCONTINUITY,
        message: `Event ${i}: Expected seq=${i}, got seq=${event.seq}`,
        seq: i,
        expected_seq: i,
        actual_seq: event.seq
      });
    }

    // Check hash_prev links to previous event
    if (i === 0) {
      // First event should have "00000000" as hash_prev
      if (event.hash_prev !== '00000000') {
        errors.push({
          type: ValidationErrorType.HASH_CHAIN_BROKEN,
          message: `Event 0: First event hash_prev should be "00000000", got "${event.hash_prev}"`,
          seq: 0,
          expected: '00000000',
          actual: event.hash_prev
        });
      }
    } else {
      // Subsequent events should link to previous event's hash
      const prevHash = events[i - 1].hash;
      if (event.hash_prev !== prevHash) {
        errors.push({
          type: ValidationErrorType.HASH_CHAIN_BROKEN,
          message: `Event ${i}: hash_prev mismatch. Expected "${prevHash}", got "${event.hash_prev}"`,
          seq: i,
          expected: prevHash,
          actual: event.hash_prev
        });
      }
    }

    // Recompute and verify hash
    const eventData = {
      ts: event.ts,
      trace_id: event.trace_id,
      seq: event.seq,
      type: event.type,
      payload: event.payload,
      hash_prev: event.hash_prev
    };

    const expectedHash = hashEvent(eventData);
    if (event.hash !== expectedHash) {
      errors.push({
        type: ValidationErrorType.HASH_MISMATCH,
        message: `Event ${i}: Hash mismatch. Expected "${expectedHash}", got "${event.hash}"`,
        seq: i,
        expected: expectedHash,
        actual: event.hash
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate event schema (basic validation)
 *
 * @param {TraceEvent[]} events - Events to validate
 * @returns {{valid: boolean, errors: ValidationError[]}}
 */
export function validateSchema(events) {
  const errors = [];
  const validTypes = Object.values(TraceEventType);
  const requiredFields = ['ts', 'trace_id', 'seq', 'type', 'payload', 'hash_prev', 'hash'];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Check required fields
    for (const field of requiredFields) {
      if (!(field in event)) {
        errors.push({
          type: ValidationErrorType.INVALID_SCHEMA,
          message: `Event ${i}: Missing required field "${field}"`,
          seq: i,
          field
        });
      }
    }

    // Check event type
    if (!validTypes.includes(event.type)) {
      errors.push({
        type: ValidationErrorType.INVALID_EVENT_TYPE,
        message: `Event ${i}: Invalid type "${event.type}". Must be one of: ${validTypes.join(', ')}`,
        seq: i,
        type: event.type
      });
    }

    // Check hash length (should be 64 chars for SHA256)
    if (event.hash && event.hash.length !== 64) {
      errors.push({
        type: ValidationErrorType.INVALID_SCHEMA,
        message: `Event ${i}: Hash should be 64 characters, got ${event.hash.length}`,
        seq: i,
        field: 'hash'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Full trace validation
 *
 * @param {string} traceId - Trace identifier
 * @param {string} [baseDir] - Base directory for traces
 * @returns {{valid: boolean, events: TraceEvent[], errors: ValidationError[]}}
 */
export function validateTrace(traceId, baseDir = DEFAULT_TRACE_DIR) {
  // Read trace
  const { events, errors: readErrors } = readTrace(traceId, baseDir);

  if (readErrors.length > 0) {
    return {
      valid: false,
      events,
      errors: readErrors
    };
  }

  // Validate schema
  const schemaResult = validateSchema(events);

  // Validate hash chain
  const hashResult = validateHashChain(events);

  const allErrors = [...schemaResult.errors, ...hashResult.errors];

  return {
    valid: allErrors.length === 0,
    events,
    errors: allErrors
  };
}

/**
 * Find events by type
 *
 * @param {TraceEvent[]} events - Events to search
 * @param {string} type - Event type to find
 * @returns {TraceEvent[]}
 */
export function findEventsByType(events, type) {
  return events.filter(e => e.type === type);
}

/**
 * Get trace summary
 *
 * @param {TraceEvent[]} events - Events to summarize
 * @returns {Object}
 */
export function getTraceSummary(events) {
  const summary = {
    trace_id: events[0]?.trace_id,
    event_count: events.length,
    first_ts: events[0]?.ts,
    last_ts: events[events.length - 1]?.ts,
    event_types: {},
    has_gate_start: false,
    has_gate_end: false,
    has_verdict: false
  };

  for (const event of events) {
    summary.event_types[event.type] = (summary.event_types[event.type] || 0) + 1;

    if (event.type === TraceEventType.GATE_START) summary.has_gate_start = true;
    if (event.type === TraceEventType.GATE_END) summary.has_gate_end = true;
    if (event.type === TraceEventType.VERDICT_EMIT) summary.has_verdict = true;
  }

  return summary;
}
