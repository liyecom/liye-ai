/**
 * BGHS Memory — Guard wiring (Sprint 6 Wave 6.2)
 * Location: src/runtime/governance/memory/guard_wire.ts
 *
 * Connects the Sprint-3 Guard ShadowRunner to exactly two real
 * protected paths:
 *
 *   - MEMORY_WRITE_{NON_AUTH, AUTH}  → guardedMemoryWrite()
 *   - ASSEMBLY_FRAGMENT_INGEST       → guardedAssemblyFragmentIngest()
 *
 * Scope discipline (Sprint 6 exit gates):
 *   - SHADOW ONLY. The runner writes evidence and never blocks.
 *   - Registry / plan rules remain authoritative for admission.
 *   - GuardKind is chosen by the target: AUTHORITATIVE writes take
 *     the TRUTH_WRITE guard; other tiers take CONTENT_SCAN. Fragment
 *     ingest takes CONTEXT_INJECT.
 *   - Does NOT wire retrieval, query orchestration, provider registration,
 *     summarization, or any other memory path. Those remain SHADOW-less.
 */

import {
  GuardKind,
  GuardVerdict,
  type GuardEvidenceSink,
  type ScannedPath,
} from '../guard';
import type { ShadowRunner } from '../guard/shadow_runner';
import type { MemoryPlanRegistry } from './plan_registry';
import type { MemoryRecordRegistry } from './record_registry';
import type { MemoryUsePolicyRegistry } from './use_policy_registry';
import {
  MemoryTier,
  type AssemblyFragmentIngestRequest,
  type GuardKindId,
  type GuardedFragmentIngestResult,
  type GuardedMemoryWriteResult,
  type MemoryRecord,
  type MemoryWriteRequest,
} from './types';

export interface GuardedMemoryWriteOptions {
  runner: ShadowRunner;
  sink: GuardEvidenceSink;
  policies: MemoryUsePolicyRegistry;
  records: MemoryRecordRegistry;
  scanner_id: string;
}

function guardKindForTier(tier: MemoryTier): { gk: GuardKind; label: GuardKindId } {
  return tier === MemoryTier.AUTHORITATIVE
    ? { gk: GuardKind.TRUTH_WRITE, label: 'truth-write' }
    : { gk: GuardKind.CONTENT_SCAN, label: 'content-scan' };
}

function verdictLiteral(v: GuardVerdict): 'safe' | 'caution' | 'dangerous' {
  switch (v) {
    case GuardVerdict.SAFE: return 'safe';
    case GuardVerdict.CAUTION: return 'caution';
    case GuardVerdict.DANGEROUS: return 'dangerous';
  }
}

/**
 * Run SHADOW guard → append GuardEvidence → register the MemoryRecord
 * (with the new guard evidence ref attached). The policy's tier must
 * match the record's tier (two different tiers pointing at the same
 * policy id is a registration error, not a runtime guard concern).
 */
export async function guardedMemoryWrite(
  req: MemoryWriteRequest,
  opts: GuardedMemoryWriteOptions,
): Promise<GuardedMemoryWriteResult> {
  const policy = opts.policies.lookup(req.use_policy_id);
  if (!policy) {
    return { ok: false, code: 'UNKNOWN_USE_POLICY', detail: req.use_policy_id };
  }
  if (policy.tier !== req.record.tier) {
    return {
      ok: false,
      code: 'POLICY_TIER_MISMATCH',
      detail: `${req.record.tier} vs policy ${policy.tier}`,
    };
  }

  const { gk, label } = guardKindForTier(req.record.tier);
  const scanned_path: ScannedPath = {
    path_kind: 'memory-write',
    target_ref: req.record.record_id,
  };

  const out = await opts.runner.run({
    guard_id: `memory-write:${opts.scanner_id}`,
    guard_kind: gk,
    scanner_version: '',
    pattern_catalog_version: '',
    trace_id: req.trace_id,
    scanned_path,
    payload: req.scan_payload,
  });

  const vl = verdictLiteral(out.verdict);

  const finalRecord: MemoryRecord = {
    ...req.record,
    guard_evidence: [
      { evidence_id: out.evidence_id, guard_kind: label, verdict: vl },
    ],
  };

  const reg = opts.records.register(finalRecord);
  if (!reg.ok) {
    return {
      ok: false,
      code: reg.code,
      detail: reg.detail,
      guard_evidence_id: out.evidence_id,
      guard_verdict: vl,
    };
  }
  return {
    ok: true,
    record_id: reg.record_id,
    guard_evidence_id: out.evidence_id,
    guard_kind: label,
    guard_verdict: vl,
    guard_mode: 'shadow',
  };
}

export interface GuardedFragmentIngestOptions {
  runner: ShadowRunner;
  sink: GuardEvidenceSink;
  plans: MemoryPlanRegistry;
  records: MemoryRecordRegistry;
  scanner_id: string;
}

/**
 * Run SHADOW CONTEXT_INJECT guard for a fragment on its way into a
 * frozen plan's assembly stream. Rejects if plan is not frozen, is
 * expired, or the referenced record is unknown — those are the
 * structural preconditions Layer 0 owns. Evidence is still written
 * when the ingest is rejected, so audits can observe attempts.
 */
export async function guardedAssemblyFragmentIngest(
  req: AssemblyFragmentIngestRequest,
  opts: GuardedFragmentIngestOptions,
): Promise<GuardedFragmentIngestResult> {
  const scanned_path: ScannedPath = {
    path_kind: 'frozen-snapshot-fragment',
    target_ref: req.fragment_id,
  };
  const out = await opts.runner.run({
    guard_id: `assembly-fragment-ingest:${opts.scanner_id}`,
    guard_kind: GuardKind.CONTEXT_INJECT,
    scanner_version: '',
    pattern_catalog_version: '',
    trace_id: req.trace_id,
    scanned_path,
    payload: req.scan_payload,
  });
  const vl = verdictLiteral(out.verdict);

  const plan = opts.plans.lookup(req.plan_id);
  if (!plan) {
    return { ok: false, code: 'PLAN_NOT_FOUND', detail: req.plan_id, guard_evidence_id: out.evidence_id, guard_verdict: vl };
  }
  if (!plan.frozen) {
    return { ok: false, code: 'PLAN_NOT_FROZEN', detail: req.plan_id, guard_evidence_id: out.evidence_id, guard_verdict: vl };
  }
  if (opts.plans.isExpired(req.plan_id)) {
    return { ok: false, code: 'PLAN_EXPIRED', detail: plan.expires_at, guard_evidence_id: out.evidence_id, guard_verdict: vl };
  }
  if (!opts.records.has(req.record_ref)) {
    return { ok: false, code: 'UNKNOWN_RECORD_REF', detail: req.record_ref, guard_evidence_id: out.evidence_id, guard_verdict: vl };
  }

  return {
    ok: true,
    fragment_id: req.fragment_id,
    guard_evidence_id: out.evidence_id,
    guard_verdict: vl,
    guard_mode: 'shadow',
  };
}
