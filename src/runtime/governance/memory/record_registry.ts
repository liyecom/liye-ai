/**
 * BGHS Memory — MemoryRecord registry
 * Location: src/runtime/governance/memory/record_registry.ts
 *
 * ADR-Hermes-Memory-Orchestration §2 + O3. Enforces:
 *   - source.layer ∈ {0, 1, 2}; Layer 3 may NOT write memory records.
 *   - content_hash is a valid sha256 (with or without "sha256:" prefix).
 *   - guard_evidence must be non-empty (O4 — all writes are observed).
 *   - upstream_ref must exist if specified; derived record cannot
 *     elevate tier (O3): tierRank(derived) >= tierRank(upstream).
 *   - trace_id mandatory.
 *
 * This registry is storage-only. It does not implement retrieval,
 * routing, summarization, or any provider behavior — those belong to
 * Loamwise `align/` (Layer 1). The Sprint 6 scope is governance
 * structure for records, not query execution.
 */

import {
  MemoryTier,
  tierRank,
  type MemoryRecord,
  type RecordRegisterResult,
} from './types';

const CONTENT_HASH_RE = /^sha256:[a-f0-9]{64}$|^[a-f0-9]{64}$/i;
const VALID_TIERS = new Set<MemoryTier>([
  MemoryTier.AUTHORITATIVE,
  MemoryTier.DECISION_SUPPORT,
  MemoryTier.CONTEXT_ONLY,
]);

export class MemoryRecordRegistry {
  private records: Map<string, MemoryRecord> = new Map();

  register(rec: MemoryRecord): RecordRegisterResult {
    if (!VALID_TIERS.has(rec.tier)) {
      return { ok: false, code: 'INVALID_TIER', detail: rec.tier };
    }
    if (!CONTENT_HASH_RE.test(rec.content_hash)) {
      return { ok: false, code: 'INVALID_CONTENT_HASH', detail: rec.content_hash };
    }
    if (![0, 1, 2].includes(rec.source?.layer)) {
      // Layer 3 or other: covered by next check but give a specific code when it's 3.
      if ((rec.source?.layer as number) === 3) {
        return { ok: false, code: 'LAYER_3_CANNOT_WRITE_MEMORY' };
      }
      return { ok: false, code: 'INVALID_SOURCE_LAYER', detail: String(rec.source?.layer) };
    }
    if (!rec.source.trace_id) {
      return { ok: false, code: 'MISSING_TRACE_ID' };
    }
    if (!rec.guard_evidence || rec.guard_evidence.length === 0) {
      return { ok: false, code: 'MISSING_GUARD_EVIDENCE' };
    }
    if (this.records.has(rec.record_id)) {
      return { ok: false, code: 'DUPLICATE_RECORD_ID', detail: rec.record_id };
    }
    if (rec.source.upstream_ref !== null) {
      const parent = this.records.get(rec.source.upstream_ref);
      if (!parent) {
        return { ok: false, code: 'UNKNOWN_UPSTREAM_REF', detail: rec.source.upstream_ref };
      }
      // O3: derived record may not elevate tier.
      if (tierRank(rec.tier) < tierRank(parent.tier)) {
        return {
          ok: false,
          code: 'DERIVATION_ELEVATES_TIER',
          detail: `${parent.tier} → ${rec.tier}`,
        };
      }
    }

    this.records.set(rec.record_id, rec);
    return { ok: true, record_id: rec.record_id };
  }

  has(record_id: string): boolean {
    return this.records.has(record_id);
  }

  lookup(record_id: string): MemoryRecord | null {
    return this.records.get(record_id) ?? null;
  }

  size(): number {
    return this.records.size;
  }

  _clearForTests(): void {
    this.records.clear();
  }
}
