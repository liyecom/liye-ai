/**
 * BGHS Memory — MemoryUsePolicy registry + validator
 * Location: src/runtime/governance/memory/use_policy_registry.ts
 *
 * ADR-Hermes-Memory-Orchestration §5 validator. Enforces the twin
 * invariants that shape decision authority in the memory tree:
 *
 *   - AUTHORITATIVE tier → `decision_consumers` MUST be non-empty
 *     (authoritative memory exists specifically to drive decisions).
 *   - Non-AUTHORITATIVE tiers → `decision_consumers` MUST be empty
 *     (decision-support / context-only may NEVER drive decisions
 *     directly — they are inputs, not authorities).
 *
 * Also enforces O3: derivation rules may not elevate tier —
 * `can_summarize_to` and `can_index_into` must only contain tiers
 * with rank ≥ the source tier's rank.
 */

import {
  MemoryTier,
  tierRank,
  type MemoryUsePolicy,
  type UsePolicyRegisterResult,
} from './types';

const VALID_TIERS = new Set<MemoryTier>([
  MemoryTier.AUTHORITATIVE,
  MemoryTier.DECISION_SUPPORT,
  MemoryTier.CONTEXT_ONLY,
]);

export class MemoryUsePolicyRegistry {
  private policies: Map<string, MemoryUsePolicy> = new Map();

  register(p: MemoryUsePolicy): UsePolicyRegisterResult {
    if (!p.policy_id) {
      return { ok: false, code: 'MISSING_POLICY_ID' };
    }
    if (this.policies.has(p.policy_id)) {
      return { ok: false, code: 'DUPLICATE_POLICY_ID', detail: p.policy_id };
    }
    if (!VALID_TIERS.has(p.tier)) {
      return { ok: false, code: 'INVALID_TIER', detail: p.tier };
    }
    // §5 twin invariants
    if (p.tier === MemoryTier.AUTHORITATIVE) {
      if (!p.decision_consumers || p.decision_consumers.length === 0) {
        return { ok: false, code: 'AUTHORITATIVE_MUST_DECLARE_DECISION_CONSUMERS' };
      }
    } else {
      if (p.decision_consumers && p.decision_consumers.length > 0) {
        return { ok: false, code: 'NON_AUTH_MUST_HAVE_EMPTY_DECISION_CONSUMERS', detail: p.tier };
      }
    }
    // O3: derivation rules cannot elevate tier
    const elevates = [
      ...(p.derivation_rule?.can_summarize_to ?? []),
      ...(p.derivation_rule?.can_index_into ?? []),
    ].some((t) => tierRank(t) < tierRank(p.tier));
    if (elevates) {
      return { ok: false, code: 'DERIVATION_CANNOT_ELEVATE_TIER' };
    }
    if (!p.write_allowed_by || p.write_allowed_by.length === 0) {
      return { ok: false, code: 'WRITE_ACTOR_RULES_EMPTY' };
    }

    this.policies.set(p.policy_id, p);
    return { ok: true, policy_id: p.policy_id };
  }

  has(policy_id: string): boolean {
    return this.policies.has(policy_id);
  }

  lookup(policy_id: string): MemoryUsePolicy | null {
    return this.policies.get(policy_id) ?? null;
  }

  size(): number {
    return this.policies.size;
  }

  _clearForTests(): void {
    this.policies.clear();
  }
}
