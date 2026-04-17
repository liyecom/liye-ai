/**
 * BGHS Memory — MemoryAssemblyPlan registry
 * Location: src/runtime/governance/memory/plan_registry.ts
 *
 * ADR-Hermes-Memory-Orchestration §4 + O5 + O7. Enforces:
 *   - Plans are registered in a non-frozen state, then explicitly frozen.
 *   - Once frozen, the plan is IMMUTABLE — no further register / freeze
 *     calls succeed; the underlying object is Object.frozen to guard
 *     against accidental in-place mutation (O5).
 *   - write_specs.use_policy_id must reference a registered MemoryUsePolicy.
 *   - write_specs.target_tier must match the referenced policy's tier.
 *   - Expired plans cannot be frozen and are not valid as triggered_by
 *     plan_id for retrieval requests.
 *
 * This registry is NOT a planner — it validates and stores plans that
 * higher layers (Loamwise `align/`) compose. The retrieval engine that
 * executes plans lives in Layer 1 and is out of scope.
 */

import type { MemoryUsePolicyRegistry } from './use_policy_registry';
import {
  type MemoryAssemblyPlan,
  type PlanFreezeResult,
  type PlanRegisterResult,
} from './types';

export class MemoryPlanRegistry {
  private plans: Map<string, MemoryAssemblyPlan> = new Map();

  constructor(private readonly policies: MemoryUsePolicyRegistry) {}

  register(plan: MemoryAssemblyPlan): PlanRegisterResult {
    if (this.plans.has(plan.plan_id)) {
      return { ok: false, code: 'DUPLICATE_PLAN_ID', detail: plan.plan_id };
    }
    if (plan.frozen) {
      return { ok: false, code: 'PLAN_ALREADY_FROZEN_AT_REGISTER', detail: plan.plan_id };
    }
    // write_specs must reference known MemoryUsePolicies; tier must match.
    for (const ws of plan.write_specs) {
      const policy = this.policies.lookup(ws.use_policy_id);
      if (!policy) {
        return { ok: false, code: 'UNKNOWN_USE_POLICY', detail: ws.use_policy_id };
      }
      if (policy.tier !== ws.target_tier) {
        return {
          ok: false,
          code: 'WRITE_SPEC_TIER_MISMATCH',
          detail: `${ws.target_tier} vs policy ${policy.tier}`,
        };
      }
    }
    // assembly_order can reference fragments by record_id; we do not yet
    // have a cross-registry validator against MemoryRecordRegistry
    // (plans may be registered before records exist — intentional).

    // Shallow copy so registered form cannot be flipped from the outside
    // before freeze(); fragments inside remain shared by ref (acceptable
    // — freeze snapshot happens on explicit freeze()).
    const stored: MemoryAssemblyPlan = { ...plan, frozen: false };
    this.plans.set(plan.plan_id, stored);
    return { ok: true, plan_id: plan.plan_id };
  }

  freeze(plan_id: string): PlanFreezeResult {
    const plan = this.plans.get(plan_id);
    if (!plan) return { ok: false, code: 'PLAN_NOT_FOUND', detail: plan_id };
    if (plan.frozen) return { ok: false, code: 'PLAN_ALREADY_FROZEN', detail: plan_id };
    if (new Date(plan.expires_at).getTime() < Date.now()) {
      return { ok: false, code: 'PLAN_EXPIRED', detail: plan.expires_at };
    }
    plan.frozen = true;
    // Object.freeze guards against in-place mutation of the plan object
    // (O5). Nested arrays / objects are frozen deeply to block item
    // swapping as well.
    deepFreeze(plan);
    return { ok: true, plan_id, frozen_at: new Date().toISOString() };
  }

  lookup(plan_id: string): MemoryAssemblyPlan | null {
    return this.plans.get(plan_id) ?? null;
  }

  isFrozen(plan_id: string): boolean {
    return this.plans.get(plan_id)?.frozen === true;
  }

  isExpired(plan_id: string): boolean {
    const plan = this.plans.get(plan_id);
    if (!plan) return false;
    return new Date(plan.expires_at).getTime() < Date.now();
  }

  size(): number {
    return this.plans.size;
  }

  _clearForTests(): void {
    this.plans.clear();
  }
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[key];
    if (v && typeof v === 'object') deepFreeze(v);
  }
  return obj;
}
