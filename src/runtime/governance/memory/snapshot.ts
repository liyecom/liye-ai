/**
 * BGHS Memory — FrozenSnapshot builder
 * Location: src/runtime/governance/memory/snapshot.ts
 *
 * ADR-Hermes-Memory-Orchestration §6 + O5. Per-turn prefetch freezes
 * the assembled fragments into a snapshot. Once built, the snapshot
 * is IMMUTABLE — the same snapshot must be replayable verbatim later.
 *
 * Sprint 6 provides the snapshot shape and the builder; prefix-cache
 * integration / prefetch orchestration live in Loamwise.
 */

import { randomUUID } from 'node:crypto';
import { tierRank, type FrozenSnapshot, type RetrievalFragment } from './types';

/**
 * Build a FrozenSnapshot from assembled fragments. Fragments are sorted
 * by tierRank asc (strict_truth ordering) then by rank_in_tier asc,
 * deep-frozen, and returned as a readonly artifact.
 */
export function buildFrozenSnapshot(
  plan_id: string,
  fragments: readonly RetrievalFragment[],
): FrozenSnapshot {
  // Strict-truth ordering: authoritative(0) → decision-support(1) →
  // context-only(2). Within a tier, preserve caller's rank_in_tier.
  const sorted = [...fragments].sort((a, b) => {
    const d = tierRank(a.record.tier) - tierRank(b.record.tier);
    if (d !== 0) return d;
    return a.rank_in_tier - b.rank_in_tier;
  });
  const snapshot: FrozenSnapshot = {
    snapshot_id: randomUUID(),
    plan_id,
    fragments: Object.freeze(sorted) as ReadonlyArray<RetrievalFragment>,
    frozen_at: new Date().toISOString(),
  };
  // Object.freeze the top-level record so every field is non-writable.
  return Object.freeze(snapshot);
}
