/**
 * BGHS Session Registry — Validator
 * Location: src/runtime/governance/session/validator.ts
 *
 * ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query §7.
 * Two entry points:
 *   - validateStrict(): enforces full F1 (is_append_only && is_hash_chained).
 *   - validateProvisional(): permits is_hash_chained=false for streams that
 *     have declared themselves provisional candidates (AGE state_transitions
 *     jsonl today — see P1-e C4 and ADR-AGE-Wake-Resume §7).
 *
 * Layer-1/Layer-2 ownership (P1-Doctrine) and ADR reference requirement
 * (F5) apply on both paths.
 */

import type { RegisterFailureCode, SessionEventStream } from './types';

const VALID_FORMATS = new Set(['ndjson.append', 'per-event-json-dir', 'per-trace-dir']);
const VALID_HASH_ALGS = new Set(['sha256', 'blake3']);
const VALID_OWNER_LAYERS = new Set([1, 2]);

function validateShared(s: SessionEventStream): RegisterFailureCode | null {
  if (!s.stream_id || typeof s.stream_id !== 'string') return 'MISSING_STREAM_ID';
  if (!s.storage_location) return 'MISSING_STORAGE_LOCATION';
  if (!s.registered_by_adr) return 'MISSING_REGISTERED_BY_ADR';
  if (!VALID_FORMATS.has(s.format)) return 'INVALID_FORMAT';
  if (!VALID_HASH_ALGS.has(s.hash_alg)) return 'INVALID_HASH_ALG';
  if (!s.owner || !VALID_OWNER_LAYERS.has(s.owner.layer)) return 'INVALID_OWNER_LAYER';
  if (s.is_append_only !== true) return 'NOT_APPEND_ONLY';
  return null;
}

/** Strict registration — F1.1 + F1.3 both enforced. */
export function validateStrict(s: SessionEventStream): RegisterFailureCode | null {
  const shared = validateShared(s);
  if (shared) return shared;
  if (s.is_hash_chained !== true) return 'NOT_HASH_CHAINED_STRICT';
  return null;
}

/** Provisional registration — F1.1 required, F1.3 optional. */
export function validateProvisional(s: SessionEventStream): RegisterFailureCode | null {
  return validateShared(s);
}
