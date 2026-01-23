/**
 * TraceWriter - Append-only trace event writer
 *
 * Writes TraceEvents to NDJSON with hash chain for tamper evidence.
 * Each trace gets its own directory: .liye/traces/<trace_id>/events.ndjson
 */

import { appendFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { computeHashChain } from '../utils/hash.mjs';
import { generateTraceId, generateSpanId, TraceEventType } from '../types.mjs';

/**
 * Default trace output directory
 */
const DEFAULT_TRACE_DIR = '.liye/traces';

/**
 * Create a new TraceWriter
 *
 * @param {string} [traceId] - Optional trace ID (auto-generated if not provided)
 * @param {string} [baseDir] - Base directory for traces (default: .liye/traces)
 * @returns {TraceWriter}
 */
export function createTrace(traceId, baseDir = DEFAULT_TRACE_DIR) {
  const trace_id = traceId || generateTraceId();
  const traceDir = join(baseDir, trace_id);
  const eventsPath = join(traceDir, 'events.ndjson');

  // Ensure trace directory exists
  mkdirSync(traceDir, { recursive: true });

  // State
  let seq = 0;
  let lastHash = null;
  const events = [];

  /**
   * @typedef {Object} TraceWriter
   * @property {string} trace_id - Trace identifier
   * @property {string} traceDir - Trace directory path
   * @property {Function} append - Append event
   * @property {Function} flush - Flush to disk
   * @property {Function} getEvents - Get all events
   * @property {Function} getLastHash - Get last event hash
   */

  const writer = {
    trace_id,
    traceDir,
    eventsPath,

    /**
     * Append a new event to the trace
     *
     * @param {string} type - Event type (must be valid TraceEventType)
     * @param {Object} payload - Event payload
     * @param {Object} [options] - Additional options
     * @param {string} [options.span_id] - Span ID (auto-generated if not provided)
     * @param {string} [options.parent_span_id] - Parent span ID
     * @returns {TraceEvent} The appended event
     */
    append(type, payload, options = {}) {
      // Validate event type
      const validTypes = Object.values(TraceEventType);
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid event type: ${type}. Must be one of: ${validTypes.join(', ')}`);
      }

      const ts = new Date().toISOString();
      const span_id = options.span_id || generateSpanId();

      // Build event without hash fields first
      const eventData = {
        ts,
        trace_id,
        seq,
        type,
        payload
      };

      // Add optional fields
      if (span_id) eventData.span_id = span_id;
      if (options.parent_span_id) eventData.parent_span_id = options.parent_span_id;

      // Compute hash chain
      const { hash_prev, hash } = computeHashChain(eventData, lastHash);

      // Build complete event
      const event = {
        ts,
        trace_id,
        span_id,
        ...(options.parent_span_id && { parent_span_id: options.parent_span_id }),
        seq,
        type,
        payload,
        hash_prev,
        hash
      };

      // Append to file (NDJSON: one JSON object per line)
      appendFileSync(eventsPath, JSON.stringify(event) + '\n');

      // Update state
      events.push(event);
      lastHash = hash;
      seq++;

      return event;
    },

    /**
     * Write additional file to trace directory
     *
     * @param {string} filename - Filename (e.g., 'verdict.json')
     * @param {string|Object} content - Content to write
     */
    writeFile(filename, content) {
      const filePath = join(traceDir, filename);
      const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      writeFileSync(filePath, data);
    },

    /**
     * Get all events in this trace
     * @returns {TraceEvent[]}
     */
    getEvents() {
      return [...events];
    },

    /**
     * Get last event's hash
     * @returns {string|null}
     */
    getLastHash() {
      return lastHash;
    },

    /**
     * Get current sequence number (next event will have this seq)
     * @returns {number}
     */
    getSeq() {
      return seq;
    },

    /**
     * Get trace metadata
     * @returns {Object}
     */
    getMetadata() {
      return {
        trace_id,
        trace_dir: traceDir,
        events_path: eventsPath,
        event_count: seq,
        last_hash: lastHash
      };
    }
  };

  return writer;
}

/**
 * Get trace directory path for a given trace ID
 * @param {string} traceId
 * @param {string} [baseDir]
 * @returns {string}
 */
export function getTraceDir(traceId, baseDir = DEFAULT_TRACE_DIR) {
  return join(baseDir, traceId);
}

/**
 * Check if a trace exists
 * @param {string} traceId
 * @param {string} [baseDir]
 * @returns {boolean}
 */
export function traceExists(traceId, baseDir = DEFAULT_TRACE_DIR) {
  const eventsPath = join(baseDir, traceId, 'events.ndjson');
  return existsSync(eventsPath);
}
