/**
 * BGHS Memory — retrieval request validator
 * Location: src/runtime/governance/memory/retrieval.ts
 *
 * ADR-Hermes-Memory-Orchestration §3 + O2. This module does NOT
 * execute retrieval — it validates that a MemoryRetrievalRequest
 * satisfies the structural rules Layer 0 owns:
 *
 *   - tiers_allowed must be explicit non-empty (no "all tiers" default).
 *   - providers_allowed must be explicit non-empty (O7 — retrieval
 *     routing is static).
 *   - query_mode ∈ {'strict_truth', 'balanced_recency'}; the default
 *     at caller level is strict_truth.
 *   - balanced_recency is a diagnostic gate: Sprint 6 allows it only
 *     when triggered_by.purpose === 'audit'. The full policy matrix
 *     (conditions / whitelist) is deferred to P1-e.
 *   - triggered_by.plan_id must reference a frozen, unexpired plan.
 *
 * The Loamwise retrieval engine consumes a validated request; a
 * validator OK means "the shape is admissible" — not "retrieval
 * succeeded".
 */

import type { MemoryPlanRegistry } from './plan_registry';
import {
  type MemoryRetrievalRequest,
  type RetrievalValidateResult,
} from './types';

export function validateRetrievalRequest(
  req: MemoryRetrievalRequest,
  plans: MemoryPlanRegistry,
): RetrievalValidateResult {
  if (!req.tiers_allowed || req.tiers_allowed.length === 0) {
    return { ok: false, code: 'TIERS_ALLOWED_EMPTY' };
  }
  if (!req.providers_allowed || req.providers_allowed.length === 0) {
    return { ok: false, code: 'PROVIDERS_ALLOWED_EMPTY' };
  }
  if (req.query_mode !== 'strict_truth' && req.query_mode !== 'balanced_recency') {
    return { ok: false, code: 'INVALID_QUERY_MODE', detail: String(req.query_mode) };
  }
  if (req.query_mode === 'balanced_recency' && req.triggered_by.purpose !== 'audit') {
    return { ok: false, code: 'BALANCED_RECENCY_REQUIRES_AUDIT_PURPOSE' };
  }

  const plan = plans.lookup(req.triggered_by.plan_id);
  if (!plan) return { ok: false, code: 'PLAN_NOT_FOUND', detail: req.triggered_by.plan_id };
  if (!plan.frozen) return { ok: false, code: 'PLAN_NOT_FROZEN', detail: plan.plan_id };
  if (plans.isExpired(plan.plan_id)) {
    return { ok: false, code: 'PLAN_EXPIRED', detail: plan.expires_at };
  }

  return { ok: true };
}

/** Default for the caller's query_mode field — O2 truth-first. */
export const DEFAULT_QUERY_MODE: 'strict_truth' = 'strict_truth';
