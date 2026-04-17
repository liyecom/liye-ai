/**
 * BGHS Session Registry — Types
 * Location: src/runtime/governance/session/types.ts
 *
 * Mirrors ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query §1–§4.
 * Only the minimum shape required by Sprint 1 Wave 1.1 is landed here; the
 * full SessionAdjacentArtifact / FederatedQueryRequest surface is out of
 * scope for Sprint 1 and will come from later sprints.
 */

// === §1 ArtifactClass ===

export enum ArtifactClass {
  SESSION_EVENT_STREAM = 'session.event-stream',
  SESSION_ADJACENT = 'session.adjacent',
  NEITHER = 'neither',
}

// === §2 SessionEventStream ===

export type StreamFormat =
  | 'ndjson.append'
  | 'per-event-json-dir'
  | 'per-trace-dir';

export type OwnerLayer = 1 | 2;

export interface StreamOwner {
  component_id: string;
  layer: OwnerLayer;
}

export interface StreamScope {
  scope_kind: string;
  scope_keys: Record<string, string>;
}

export interface RetentionPolicy {
  min_retention_days: number;
  immutable_after_days: number | null;
  delete_after_days: number | null;
}

export interface SessionEventStream {
  stream_id: string;
  owner: StreamOwner;
  scope: StreamScope;

  format: StreamFormat;
  storage_location: string;
  retention: RetentionPolicy;

  is_append_only: true;        // F1.1 — schema-forced true
  is_hash_chained: boolean;    // F1.3 — true for F1-compliant; false = provisional
  hash_alg: 'sha256' | 'blake3';

  registered_at: string;       // ISO 8601
  registered_by_adr: string;
}

// === Registry flags & results ===

export interface RegistryEntry {
  stream: SessionEventStream;
  f1_compliant: boolean;       // true iff is_append_only && is_hash_chained
  provisional: boolean;        // true iff registered via registerProvisionalStream
}

export type RegisterResultOk = { ok: true; stream_id: string; f1_compliant: boolean };
export type RegisterResultFail = { ok: false; code: RegisterFailureCode; detail?: string };
export type RegisterResult = RegisterResultOk | RegisterResultFail;

export type RegisterFailureCode =
  | 'DUPLICATE_STREAM_ID'
  | 'INVALID_OWNER_LAYER'
  | 'MISSING_REGISTERED_BY_ADR'
  | 'NOT_APPEND_ONLY'
  | 'NOT_HASH_CHAINED_STRICT'   // strict path only
  | 'INVALID_HASH_ALG'
  | 'INVALID_FORMAT'
  | 'MISSING_STREAM_ID'
  | 'MISSING_STORAGE_LOCATION';

// === §4 Filters ===

export interface StreamFilter {
  owner_component_id?: string;
  scope_kind?: string;
  scope_keys?: Record<string, string>;
  format?: StreamFormat;
  f1_compliant_only?: boolean;
}

// === §3 StreamRef (used by downstream artifacts — wake/resume, etc.) ===

export type StreamRefKind = 'session-event' | 'session-adjacent';

export interface StreamRef {
  ref_kind: StreamRefKind;
  stream_id: string;
  f1_compliant: boolean;
}
