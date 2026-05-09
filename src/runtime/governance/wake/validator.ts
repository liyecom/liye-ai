/**
 * BGHS Wake/Resume — Registration Validator
 * Location: src/runtime/governance/wake/validator.ts
 *
 * ADR-AGE-Wake-Resume §5.8. Sprint 1 Wave 1.2 covers the 4 hard-rejection
 * classes called out in the sprint exit criteria:
 *   1. IMPURE_REPLAY_REJECTED — replay.is_pure must be true.
 *   2. UNKNOWN failure codes — declared_failure_modes ⊆ KNOWN_FAILURE_MODES.
 *   3. SNAPSHOT_DANGLING_DERIVED_FROM — snapshot.derived_from ⊆ stream_refs.
 *   4. RESOURCE_CONTEXT_ESCAPE_HATCH — declared fields must equal the
 *      exact 4-field minimum (ADR §5.4 C3/C4).
 *
 * PreflightContract shape rules (P1–P6) are enforced in the same pass
 * since they are validator-level schema rejection per ADR §5.6.
 */

import type { StreamRegistry } from '../session/stream_registry';
import {
  KNOWN_FAILURE_MODES,
  RESOURCE_CONTEXT_REQUIRED_FIELDS,
  SNAPSHOT_BYPASSABLE,
  type RegisterResult,
  type ResumeFailureMode,
  type WakeResumeEntrypoint,
} from './types';

function setEq(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

export class WakeResumeRegistry {
  private entries: Map<string, WakeResumeEntrypoint> = new Map();

  constructor(private streamRegistry?: StreamRegistry) {}

  register(wre: WakeResumeEntrypoint): RegisterResult {
    // --- 0. Identity must be non-empty (catch-all for empty-string
    // entrypoint_id / component_id / declared_by_adr — without these the
    // registry can't do stable lookup or ADR-back attribution and the
    // duplicate guard collapses on the empty key). Run BEFORE the duplicate
    // check so empty strings are not accepted on first register. ---
    if (!wre.entrypoint_id) {
      return { ok: false, code: 'ENTRYPOINT_UNRESOLVED', detail: 'entrypoint_id is empty' };
    }
    if (!wre.component_id) {
      return { ok: false, code: 'ENTRYPOINT_UNRESOLVED', detail: 'component_id is empty' };
    }
    if (!wre.declared_by_adr) {
      return { ok: false, code: 'ENTRYPOINT_UNRESOLVED', detail: 'declared_by_adr is empty' };
    }

    if (this.entries.has(wre.entrypoint_id)) {
      return { ok: false, code: 'DUPLICATE_ENTRYPOINT_ID', detail: wre.entrypoint_id };
    }

    // --- 1. Entrypoint resolvability (shape-only in Sprint 1 — can't import
    // Python from TS; a deeper check lands when the dispatcher ships) ---
    if (!wre.module_path || !wre.callable) {
      return { ok: false, code: 'ENTRYPOINT_UNRESOLVED' };
    }

    // --- 2. stream_refs must be non-empty (a wake entrypoint with no
    // session source has no recovery surface — the entrypoint can never
    // produce a deterministic resume) and each ref must resolve in the
    // StreamRegistry when one is provided. ---
    if (wre.stream_refs.length === 0) {
      return { ok: false, code: 'MISSING_STREAM', detail: 'stream_refs is empty' };
    }
    if (this.streamRegistry) {
      for (const sr of wre.stream_refs) {
        if (this.streamRegistry.lookupStream(sr.stream_id) === null) {
          return { ok: false, code: 'STREAM_NOT_REGISTERED', detail: sr.stream_id };
        }
      }
    }

    // --- 3. Replay must be pure ---
    if (wre.replay.is_pure !== true) {
      return { ok: false, code: 'IMPURE_REPLAY_REJECTED' };
    }

    // --- 4. declared_failure_modes ⊆ KNOWN ---
    const unknown = wre.replay.declared_failure_modes.filter(
      (m) => !KNOWN_FAILURE_MODES.has(m as ResumeFailureMode),
    );
    if (unknown.length > 0) {
      return {
        ok: false,
        code: 'PREFLIGHT_UNKNOWN_CHECK',
        detail: `unknown failure codes in replay.declared_failure_modes: ${unknown.join(', ')}`,
      };
    }

    // --- 5. snapshot_refs.derived_from ⊆ stream_refs, and non-empty ---
    const streamIds = new Set(wre.stream_refs.map((s) => s.stream_id));
    for (const sn of wre.snapshot_refs) {
      if (sn.derived_from.length === 0) {
        return { ok: false, code: 'SNAPSHOT_MISSING_DERIVED_FROM', detail: sn.snapshot_id };
      }
      for (const sid of sn.derived_from) {
        if (!streamIds.has(sid)) {
          return {
            ok: false,
            code: 'SNAPSHOT_DANGLING_DERIVED_FROM',
            detail: `${sn.snapshot_id} -> ${sid}`,
          };
        }
      }
    }

    // --- 6. PreflightContract P1–P6 ---
    const pf = wre.preflight;
    for (const c of pf.required_checks) {
      if (!KNOWN_FAILURE_MODES.has(c)) {
        return { ok: false, code: 'PREFLIGHT_UNKNOWN_CHECK', detail: c };
      }
    }
    const req = new Set(pf.required_checks);
    for (const c of pf.allow_from_scratch_bypass) {
      if (!req.has(c)) {
        return { ok: false, code: 'PREFLIGHT_BYPASS_NOT_REQUIRED', detail: c };
      }
      if (!SNAPSHOT_BYPASSABLE.has(c)) {
        return { ok: false, code: 'PREFLIGHT_BYPASS_OUT_OF_SCOPE', detail: c };
      }
    }
    if (pf.diff_required_before_apply !== true) {
      return { ok: false, code: 'PREFLIGHT_WEAK_DIFF_GUARD' };
    }
    if (pf.abort_on_first_failure !== true) {
      return { ok: false, code: 'PREFLIGHT_CONTINUE_ON_FAILURE' };
    }
    if (pf.snapshot_required && !req.has('MISSING_SNAPSHOT')) {
      return { ok: false, code: 'PREFLIGHT_SNAPSHOT_CHECK_MISSING' };
    }

    // --- 7. ResourceContext declared fields must equal the exact 4 ---
    if (!setEq(wre.resource_context_declared_fields, RESOURCE_CONTEXT_REQUIRED_FIELDS as unknown as string[])) {
      return {
        ok: false,
        code: 'RESOURCE_CONTEXT_ESCAPE_HATCH',
        detail: `declared fields must equal ${RESOURCE_CONTEXT_REQUIRED_FIELDS.join(', ')}; got ${wre.resource_context_declared_fields.join(', ')}`,
      };
    }

    this.entries.set(wre.entrypoint_id, wre);
    return { ok: true, entrypoint_id: wre.entrypoint_id };
  }

  lookup(entrypoint_id: string): WakeResumeEntrypoint | null {
    return this.entries.get(entrypoint_id) ?? null;
  }

  size(): number {
    return this.entries.size;
  }

  _clearForTests(): void {
    this.entries.clear();
  }
}
