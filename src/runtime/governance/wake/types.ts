/**
 * BGHS Wake/Resume — Types
 * Location: src/runtime/governance/wake/types.ts
 *
 * Mirrors ADR-AGE-Wake-Resume §5.1–§5.7. Sprint 1 Wave 1.2 lands the
 * declarative surface (types + validator); runtime wake() dispatch
 * remains on the caller (AGE ships wake_contract.py as the first
 * reference binding).
 */

import type { StreamRef } from '../session/types';

// === Failure-mode enum (ADR §5.7) ===

export type ResumeFailureMode =
  // Stream layer
  | 'MISSING_STREAM'
  | 'EMPTY_STREAM'
  | 'STRUCTURAL_INVALID'
  | 'ILLEGAL_TRANSITION'
  | 'STREAM_CORRUPTED'
  | 'STREAM_NOT_REGISTERED'
  // Snapshot layer
  | 'MISSING_SNAPSHOT'
  | 'SNAPSHOT_UNREADABLE'
  | 'SNAPSHOT_DIVERGED'
  | 'SNAPSHOT_MISSING_DERIVED_FROM'
  | 'SNAPSHOT_DANGLING_DERIVED_FROM'
  | 'SNAPSHOT_MISSING_DERIVED_MARKER'
  // Entrypoint / replay layer
  | 'ENTRYPOINT_UNRESOLVED'
  | 'IMPURE_REPLAY_REJECTED'
  // ResourceContext layer
  | 'RESOURCE_CONTEXT_ANY_TYPE'
  | 'RESOURCE_CONTEXT_UNSAFE_SUMMARY'
  | 'RESOURCE_CONTEXT_MISSING_FIELD'
  | 'RESOURCE_CONTEXT_ESCAPE_HATCH'
  // Preflight layer
  | 'PREFLIGHT_UNKNOWN_CHECK'
  | 'PREFLIGHT_BYPASS_NOT_REQUIRED'
  | 'PREFLIGHT_BYPASS_OUT_OF_SCOPE'
  | 'PREFLIGHT_WEAK_DIFF_GUARD'
  | 'PREFLIGHT_CONTINUE_ON_FAILURE'
  | 'PREFLIGHT_SNAPSHOT_CHECK_MISSING'
  // Result shape
  | 'RESULT_SHAPE_VIOLATION'
  | 'PREFLIGHT_REPORT_FALSIFIED'
  | 'RESUME_HINT_UNSAFE_SUMMARY'
  | 'RESUME_RESULT_BYPASSED';

export const KNOWN_FAILURE_MODES: ReadonlySet<ResumeFailureMode> = new Set<ResumeFailureMode>([
  'MISSING_STREAM', 'EMPTY_STREAM', 'STRUCTURAL_INVALID', 'ILLEGAL_TRANSITION',
  'STREAM_CORRUPTED', 'STREAM_NOT_REGISTERED',
  'MISSING_SNAPSHOT', 'SNAPSHOT_UNREADABLE', 'SNAPSHOT_DIVERGED',
  'SNAPSHOT_MISSING_DERIVED_FROM', 'SNAPSHOT_DANGLING_DERIVED_FROM',
  'SNAPSHOT_MISSING_DERIVED_MARKER',
  'ENTRYPOINT_UNRESOLVED', 'IMPURE_REPLAY_REJECTED',
  'RESOURCE_CONTEXT_ANY_TYPE', 'RESOURCE_CONTEXT_UNSAFE_SUMMARY',
  'RESOURCE_CONTEXT_MISSING_FIELD', 'RESOURCE_CONTEXT_ESCAPE_HATCH',
  'PREFLIGHT_UNKNOWN_CHECK', 'PREFLIGHT_BYPASS_NOT_REQUIRED',
  'PREFLIGHT_BYPASS_OUT_OF_SCOPE', 'PREFLIGHT_WEAK_DIFF_GUARD',
  'PREFLIGHT_CONTINUE_ON_FAILURE', 'PREFLIGHT_SNAPSHOT_CHECK_MISSING',
  'RESULT_SHAPE_VIOLATION', 'PREFLIGHT_REPORT_FALSIFIED',
  'RESUME_HINT_UNSAFE_SUMMARY', 'RESUME_RESULT_BYPASSED',
]);

// === §5.4 ResourceContext — minimum closed 4-field surface ===

export interface ResourceContext {
  resource_type: string;
  id: string;
  scope: string;
  safe_summary: string;
}

/**
 * Exact-field allowlist for ResourceContext (ADR §5.4 C3/C4). The validator
 * rejects any declaration whose resource_context_declared_fields differs
 * from this list (catches escape-hatch additions like 'extra' / 'metadata').
 */
export const RESOURCE_CONTEXT_REQUIRED_FIELDS: readonly (keyof ResourceContext)[] = [
  'resource_type',
  'id',
  'scope',
  'safe_summary',
];

// === §5.5 StateSnapshot ===

export interface GovernanceFields {
  ops_mode: string;
  discovery_done: boolean;
  smoke_passed: boolean;
  record_provenance: string | null;
  confidence: string | null;
}

export interface StateSnapshot {
  snapshot_id: string;
  derived_from: string[];           // stream_ids, must be non-empty
  warning_marker: 'DERIVED';
  last_replay_at: string;
  total_events: number;
  governance_fields: GovernanceFields;
}

// === §5.1 SnapshotRef ===

export interface SnapshotRef {
  snapshot_id: string;
  derived_from: string[];           // stream_ids; must be ⊆ stream_refs.stream_id
}

// === §5.6 PreflightContract ===

export interface PreflightContract {
  required_checks: ResumeFailureMode[];
  snapshot_required: boolean;
  allow_from_scratch_bypass: ResumeFailureMode[];
  diff_required_before_apply: true;
  abort_on_first_failure: true;
}

export const SNAPSHOT_BYPASSABLE: ReadonlySet<ResumeFailureMode> = new Set([
  'MISSING_SNAPSHOT',
  'SNAPSHOT_UNREADABLE',
  'SNAPSHOT_DIVERGED',
]);

// === §5.7 ReplayContract ===

export interface ReplayContract {
  is_pure: true;                    // schema-level; validator rejects false
  stable_ordering_keys: string[];
  declared_failure_modes: ResumeFailureMode[];
}

// === §5.1 WakeResumeEntrypoint ===

export interface WakeResumeEntrypoint {
  entrypoint_id: string;
  component_id: string;
  declared_by_adr: string;

  module_path: string;
  callable: string;

  stream_refs: StreamRef[];
  snapshot_refs: SnapshotRef[];

  preflight: PreflightContract;
  replay: ReplayContract;

  /**
   * The exact field names the entrypoint exposes on its ResourceContext
   * shape. Validator compares this set to RESOURCE_CONTEXT_REQUIRED_FIELDS.
   * Catches escape-hatch additions that TS can't see at runtime.
   */
  resource_context_declared_fields: string[];
}

// === Register result ===

export type RegisterResultOk = { ok: true; entrypoint_id: string };
export type RegisterResultFail = { ok: false; code: ResumeFailureMode | 'DUPLICATE_ENTRYPOINT_ID'; detail?: string };
export type RegisterResult = RegisterResultOk | RegisterResultFail;
