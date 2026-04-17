/**
 * BGHS Skill Lifecycle — Guard-wired candidate submit (Sprint 5 Wave 5.2)
 * Location: src/runtime/governance/skill_lifecycle/candidate_submit.ts
 *
 * This is the deferred wiring from Sprint 3: the ShadowRunner is
 * connected to exactly one real governance path — skill candidate
 * submit (ProtectedPathKind.SKILL_CANDIDATE_SUBMIT).
 *
 * Scope discipline (Sprint 5 exit gates):
 *   - SHADOW ONLY. The runner never blocks; we record evidence and
 *     forward to SkillLifecycleRegistry.submitCandidate.
 *   - Does NOT wire skill promotion, install, enable, or invoke.
 *     Those remain SHADOW-less / unwired until later sprints.
 *   - Does NOT short-circuit lifecycle admission on scanner failure:
 *     the lifecycle registry is authoritative; the guard is observer.
 *   - Produces a ScanResultRef from the evidence so the same record
 *     persisted in SkillCandidateRecord.scan_results points back at
 *     the GuardEvidence sink entry.
 */

import { GuardKind, type GuardEvidenceSink, type ScannedPath } from '../guard';
import type { ShadowRunner } from '../guard/shadow_runner';
import type { SkillLifecycleRegistry } from './registry';
import type {
  GuardedSubmitResult,
  ScanResultRef,
  SkillCandidateRecord,
  ScanVerdictLiteral,
} from './types';
import { GuardVerdict } from '../guard';

export interface GuardedSubmitOptions {
  runner: ShadowRunner;
  sink: GuardEvidenceSink;
  registry: SkillLifecycleRegistry;
  /** Trace id to tie evidence back to the session event stream. */
  trace_id: string;
  /** Opaque payload handed to the scanner (skill body + frontmatter). */
  payload: unknown;
  /** Scanner metadata — used to build the ScanResultRef. */
  scanner_id: string;
}

function verdictToLiteral(v: GuardVerdict): ScanVerdictLiteral {
  switch (v) {
    case GuardVerdict.SAFE: return 'safe';
    case GuardVerdict.CAUTION: return 'caution';
    case GuardVerdict.DANGEROUS: return 'dangerous';
  }
}

/**
 * Run SHADOW guard → append evidence → submit candidate.
 * SHADOW never blocks, so registry rejection is the only terminal
 * failure path. The returned object always includes the guard evidence
 * id so the caller can reconcile with the evidence sink.
 */
export async function guardedSubmitCandidate(
  record: SkillCandidateRecord,
  opts: GuardedSubmitOptions,
): Promise<GuardedSubmitResult> {
  const scanned_path: ScannedPath = {
    path_kind: 'skill-candidate',
    target_ref: record.candidate_id,
  };

  const out = await opts.runner.run({
    guard_id: `skill-candidate-submit:${opts.scanner_id}`,
    guard_kind: GuardKind.CONTENT_SCAN,
    scanner_version: '',                   // scanner fills in
    pattern_catalog_version: '',
    trace_id: opts.trace_id,
    scanned_path,
    payload: opts.payload,
  });

  const verdictLiteral = verdictToLiteral(out.verdict);

  // Attach the guard evidence as a ScanResultRef — the lifecycle record
  // may arrive with or without prior scan_results; the Guard seam always
  // contributes one. SHADOW evidence is non-authoritative for L4; §8
  // allows subsequent PromotionDecisions to supply 'safe' evidence.
  const ref: ScanResultRef = {
    scanner_id: opts.scanner_id,
    scanned_at: new Date().toISOString(),
    verdict: verdictLiteral,
    evidence_path: out.evidence_id,
  };

  const next: SkillCandidateRecord = {
    ...record,
    scan_results: [...record.scan_results, ref],
  };

  const submit = opts.registry.submitCandidate(next);
  if (!submit.ok) {
    return {
      ok: false,
      code: submit.code,
      detail: submit.detail,
      guard_evidence_id: out.evidence_id,
      guard_verdict: verdictLiteral,
    };
  }

  return {
    ok: true,
    candidate_id: submit.candidate_id,
    guard_evidence_id: out.evidence_id,
    guard_verdict: verdictLiteral,
    guard_mode: 'shadow',
  };
}
