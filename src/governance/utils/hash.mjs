/**
 * Hash utilities for Governance Kernel v1
 *
 * IMPORTANT: Hash computation must be deterministic and stable for replay.
 * Any change here breaks existing traces.
 */

import { createHash } from 'crypto';

/**
 * Compute SHA256 hash of content
 * @param {string} content
 * @returns {string} 64-char hex hash
 */
export function sha256(content) {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Stable JSON stringify for deterministic hashing
 * - Sorts object keys
 * - No whitespace
 * - Handles undefined as null
 *
 * @param {any} obj
 * @returns {string}
 */
export function stableStringify(obj) {
  if (obj === undefined) return 'null';
  if (obj === null) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }

  // Sort keys for deterministic output
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => {
    const v = obj[k];
    return JSON.stringify(k) + ':' + stableStringify(v);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * Compute hash for a TraceEvent
 *
 * Input format (must match exactly for replay):
 * ts|trace_id|seq|type|stableStringify(payload)|hash_prev
 *
 * @param {object} event - Event without hash field
 * @param {string} event.ts - ISO8601 timestamp
 * @param {string} event.trace_id - Trace identifier
 * @param {number} event.seq - Sequence number
 * @param {string} event.type - Event type
 * @param {object} event.payload - Event payload
 * @param {string} event.hash_prev - Previous event hash (empty string for first)
 * @returns {string} SHA256 hash
 */
export function hashEvent(event) {
  const { ts, trace_id, seq, type, payload, hash_prev } = event;

  // Canonical format: pipe-separated, payload as stable JSON
  const canonical = [
    ts,
    trace_id,
    String(seq),
    type,
    stableStringify(payload),
    hash_prev || ''  // First event has empty hash_prev
  ].join('|');

  return sha256(canonical);
}

/**
 * Compute hash chain for an event given previous hash
 * Returns both hash_prev and computed hash
 *
 * @param {object} eventData - Event data without hash fields
 * @param {string|null} prevHash - Previous event's hash (null for first event)
 * @returns {{hash_prev: string, hash: string}}
 */
export function computeHashChain(eventData, prevHash) {
  // First event uses empty string as hash_prev (stored as "00000000" for schema minLength)
  const hash_prev = prevHash || '00000000';

  const hash = hashEvent({
    ...eventData,
    hash_prev
  });

  return { hash_prev, hash };
}
