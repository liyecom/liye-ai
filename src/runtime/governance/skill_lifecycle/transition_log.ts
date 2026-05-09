/**
 * BGHS Skill Lifecycle — append-only TransitionLog with hash chain
 * Location: src/runtime/governance/skill_lifecycle/transition_log.ts
 *
 * ADR-Hermes-Skill-Lifecycle §6 + L1. Every LifecycleTransition carries
 * entry_hash = sha256(prev_transition_id || canonical_payload). Existing
 * entries cannot be mutated or removed (L1); the class exposes no such
 * operation. A `_clearForTests()` escape hatch exists for unit tests
 * only — production call sites must not touch it.
 *
 * Storage location for the persisted form (per-candidate file / per-
 * session-adjacent shard) is decided by the P1-e Session-adjacent
 * taxonomy and lands with a later sprint. Sprint 5 ships the in-memory
 * append-only log with hash chain; the same entry shape will be the
 * serialized form.
 */

import { randomUUID } from 'node:crypto';
import { sha256Hex } from '../../../audit/evidence/hash';
import type {
  LifecycleDriver,
  LifecycleTransition,
  SkillLifecycleState,
} from './types';

export interface AppendTransitionInput {
  candidate_id: string;
  from_state: SkillLifecycleState;
  to_state: SkillLifecycleState;
  driver: LifecycleDriver;
}

/**
 * Canonical JSON stringify — sort keys so the hash is stable regardless
 * of input object key order. Handles nested objects and arrays; Date
 * objects are expected to be pre-stringified by callers (ISO 8601).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${parts.join(',')}}`;
}

export class TransitionLog {
  /** Per-candidate chain tip (last transition id). */
  private tips: Map<string, string> = new Map();
  /** Per-candidate ordered entries. */
  private perCandidate: Map<string, LifecycleTransition[]> = new Map();
  /** Global append order for audit / replay. */
  private all: LifecycleTransition[] = [];

  append(input: AppendTransitionInput): LifecycleTransition {
    const prev = this.tips.get(input.candidate_id) ?? null;
    const transitioned_at = new Date().toISOString();
    const transition_id = randomUUID();

    const payload = {
      transition_id,
      candidate_id: input.candidate_id,
      from_state: input.from_state,
      to_state: input.to_state,
      transitioned_at,
      driver_kind: input.driver.kind,
      driver_decision_id: input.driver.decision.decision_id,
    };
    const canonical = canonicalJson(payload);
    const entry_hash = sha256Hex((prev ?? '') + '|' + canonical);

    const entry: LifecycleTransition = {
      transition_id,
      candidate_id: input.candidate_id,
      from_state: input.from_state,
      to_state: input.to_state,
      transitioned_at,
      driver: input.driver,
      prev_transition_id: prev,
      entry_hash,
    };

    let list = this.perCandidate.get(input.candidate_id);
    if (!list) {
      list = [];
      this.perCandidate.set(input.candidate_id, list);
    }
    list.push(entry);
    this.all.push(entry);
    this.tips.set(input.candidate_id, transition_id);

    return entry;
  }

  getChain(candidate_id: string): readonly LifecycleTransition[] {
    return this.perCandidate.get(candidate_id) ?? [];
  }

  tip(candidate_id: string): string | null {
    return this.tips.get(candidate_id) ?? null;
  }

  list(): readonly LifecycleTransition[] {
    return this.all;
  }

  /**
   * Recompute every entry_hash in order and compare against the stored
   * value. Any mismatch or out-of-order prev_transition_id returns the
   * offending index. Used by tests and replay audits.
   */
  verifyChain(candidate_id: string): { ok: true } | { ok: false; at: number; reason: string } {
    const chain = this.perCandidate.get(candidate_id) ?? [];
    let prev: string | null = null;
    for (let i = 0; i < chain.length; i++) {
      const e = chain[i];
      if (e.prev_transition_id !== prev) {
        return { ok: false, at: i, reason: 'prev_transition_id mismatch' };
      }
      const payload = {
        transition_id: e.transition_id,
        candidate_id: e.candidate_id,
        from_state: e.from_state,
        to_state: e.to_state,
        transitioned_at: e.transitioned_at,
        driver_kind: e.driver.kind,
        driver_decision_id: e.driver.decision.decision_id,
      };
      const expected = sha256Hex((prev ?? '') + '|' + canonicalJson(payload));
      if (expected !== e.entry_hash) {
        return { ok: false, at: i, reason: 'entry_hash mismatch' };
      }
      prev = e.transition_id;
    }
    return { ok: true };
  }

  _clearForTests(): void {
    this.tips.clear();
    this.perCandidate.clear();
    this.all = [];
  }
}
