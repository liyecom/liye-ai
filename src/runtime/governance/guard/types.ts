/**
 * BGHS Guard — Types
 * Location: src/runtime/governance/guard/types.ts
 *
 * Mirrors ADR-Loamwise-Guard-Content-Security §1–§5. Sprint 3 Wave 3.1
 * lands the declarative surface and a SHADOW-only runner. ADVISORY and
 * ACTIVE modes, real scanner implementations, and business-path wiring
 * (skill candidate submit, memory write, assembly ingest) land in later
 * sprints per the sprint 3 discipline.
 */

// === §1 GuardKind (固定三种) ===

export enum GuardKind {
  CONTENT_SCAN = 'content-scan',
  TRUTH_WRITE = 'truth-write',
  CONTEXT_INJECT = 'context-inject',
}

// === §2 GuardVerdict (固定三级) ===

export enum GuardVerdict {
  SAFE = 'safe',
  CAUTION = 'caution',
  DANGEROUS = 'dangerous',
}

// === §3 GuardEnforcementMode (SHADOW → ADVISORY → ACTIVE) ===

export enum GuardEnforcementMode {
  SHADOW = 'shadow',
  ADVISORY = 'advisory',
  ACTIVE = 'active',
}

// === §4 GuardEvidence ===

export type ProtectedScannedPathKind =
  | 'skill-candidate'
  | 'memory-write'
  | 'frozen-snapshot-fragment'
  | 'capability-registration';

export interface ScannedPath {
  path_kind: ProtectedScannedPathKind;
  target_ref: string;
}

export interface HitDetail {
  pattern_id: string;
  category: string;
  redacted_snippet: string;   // ADR §7 G7 — never raw
  position_hint: string | null;
  severity_score: number;     // 0..1
}

export interface GuardEvidence {
  evidence_id: string;
  guard_id: string;
  guard_kind: GuardKind;
  mode: GuardEnforcementMode;
  verdict: GuardVerdict;
  scanned_at: string;
  trace_id: string;
  scanned_path: ScannedPath;
  hits: HitDetail[];
  scanner_version: string;
  pattern_catalog_version: string;
  scanner_failed: boolean;       // SHADOW only; ADVISORY/ACTIVE must be false
  failure_reason: string | null;
}

// === §5 GuardChain ===

export enum ProtectedPathKind {
  SKILL_CANDIDATE_SUBMIT = 'skill.candidate-submit',
  SKILL_PROMOTION = 'skill.promotion',
  MEMORY_WRITE_NON_AUTH = 'memory.write.non-authoritative',
  MEMORY_WRITE_AUTH = 'memory.write.authoritative',
  ASSEMBLY_FRAGMENT_INGEST = 'assembly.fragment-ingest',
  CAPABILITY_REGISTRATION = 'capability.registration',
}

export const PROTECTED_PATHS_WHITELIST: ReadonlySet<ProtectedPathKind> = new Set<ProtectedPathKind>([
  ProtectedPathKind.SKILL_CANDIDATE_SUBMIT,
  ProtectedPathKind.SKILL_PROMOTION,
  ProtectedPathKind.MEMORY_WRITE_NON_AUTH,
  ProtectedPathKind.MEMORY_WRITE_AUTH,
  ProtectedPathKind.ASSEMBLY_FRAGMENT_INGEST,
  ProtectedPathKind.CAPABILITY_REGISTRATION,
]);

export interface ProtectedPath {
  kind: ProtectedPathKind;
  required_guard_kinds: GuardKind[];
}

export interface VerdictRouting {
  on_safe: 'pass';
  on_caution: 'pass-with-warning' | 'escalate-approval' | 'block';
  on_dangerous: 'block' | 'escalate-approval';   // 'pass' never allowed
}

export interface GuardChainStep {
  step_id: string;
  guard_kind: GuardKind;
  mode: GuardEnforcementMode;
  parallel_with: string[] | null;
  on_verdict: VerdictRouting;
  /**
   * Step-level escalation reference. SHADOW steps MUST be null; any
   * ADVISORY/ACTIVE step MUST be non-null (chain-level ADR is not
   * enough — ADR §7 G3).
   */
  non_shadow_allowed_by: string | null;
}

export interface GuardChain {
  chain_id: string;
  protected_path: ProtectedPath;
  steps: GuardChainStep[];
  global_shadow: false;          // always false unless a double-signed ADR says otherwise
  declared_at: string;
  declared_by_adr: string;
}

// === Registration result ===

export type GuardRegisterFailureCode =
  | 'DUPLICATE_CHAIN_ID'
  | 'PATH_NOT_IN_WHITELIST'
  | 'MISSING_REQUIRED_GUARD_KIND'
  | 'SHADOW_STEP_HAS_NON_SHADOW_REF'
  | 'NON_SHADOW_STEP_MISSING_ESCALATION_ADR'
  | 'VERDICT_ROUTING_ALLOWS_DANGEROUS_PASS'
  | 'GLOBAL_SHADOW_DISALLOWED'
  | 'MISSING_CHAIN_ADR';

export type GuardRegisterResult =
  | { ok: true; chain_id: string }
  | { ok: false; code: GuardRegisterFailureCode; detail?: string };

// === Runner interfaces ===

export interface GuardEvidenceSink {
  append(ev: GuardEvidence): Promise<void>;
  list(): readonly GuardEvidence[];
}

export interface GuardRunInput {
  guard_id: string;
  guard_kind: GuardKind;
  scanner_version: string;
  pattern_catalog_version: string;

  trace_id: string;
  scanned_path: ScannedPath;

  /**
   * Opaque payload to scan. The shadow runner does NOT inspect this —
   * real scanners plug in later via a Scanner interface (later sprint).
   * Sprint 3 ships a stub scanner that always returns SAFE with zero
   * hits so the full pipe is exercisable without real content.
   */
  payload: unknown;
}
