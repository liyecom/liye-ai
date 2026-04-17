/**
 * BGHS Guard — ShadowRunner
 * Location: src/runtime/governance/guard/shadow_runner.ts
 *
 * ADR-Loamwise-Guard-Content-Security G3 / G5. Runs a pluggable
 * Scanner in SHADOW mode: observes, writes GuardEvidence, and NEVER
 * blocks. SHADOW is the only mode supported by Sprint 3 Wave 3.1;
 * ADVISORY and ACTIVE land after SHADOW evidence justifies escalation
 * (Sprint 7).
 *
 * Scanner implementations plug in via the Scanner interface. Sprint 3
 * ships a NoopScanner that returns SAFE + [] — enough to exercise the
 * full plumbing (scan → evidence → sink) without any real content
 * matching. Business-path wiring to skill candidate submit / memory
 * write / assembly ingest happens in Sprint 5.2 and Sprint 6.2.
 */

import { makeEvidence } from './evidence';
import type {
  GuardEvidence,
  GuardEvidenceSink,
  GuardKind,
  GuardRunInput,
  GuardVerdict,
  HitDetail,
} from './types';
import { GuardEnforcementMode, GuardVerdict as Verdict } from './types';

export interface ScannerResult {
  verdict: GuardVerdict;
  hits: HitDetail[];
}

export interface Scanner {
  scanner_id: string;
  scanner_version: string;
  pattern_catalog_version: string;
  supports_kind: GuardKind;
  scan(input: GuardRunInput): Promise<ScannerResult>;
}

/** A scanner that always reports SAFE with zero hits. Use as the
 *  default for skeleton wiring and as a fixture in unit tests. */
export class NoopScanner implements Scanner {
  readonly scanner_id: string;
  readonly scanner_version = '0.0.0-noop';
  readonly pattern_catalog_version = '0.0.0-noop';

  constructor(readonly supports_kind: GuardKind, id: string = 'noop-scanner') {
    this.scanner_id = id;
  }

  async scan(_input: GuardRunInput): Promise<ScannerResult> {
    return { verdict: Verdict.SAFE, hits: [] };
  }
}

/** Always reports DANGEROUS. Useful for unit tests that need to assert
 *  shadow-mode non-blocking behavior. */
export class AlwaysDangerousScanner implements Scanner {
  readonly scanner_id: string;
  readonly scanner_version = '0.0.0-always-dangerous';
  readonly pattern_catalog_version = '0.0.0-always-dangerous';

  constructor(readonly supports_kind: GuardKind, id: string = 'always-dangerous') {
    this.scanner_id = id;
  }

  async scan(_input: GuardRunInput): Promise<ScannerResult> {
    return {
      verdict: Verdict.DANGEROUS,
      hits: [
        {
          pattern_id: 'test.always-dangerous',
          category: 'test',
          redacted_snippet: '[test-fixture]',
          position_hint: null,
          severity_score: 1,
        },
      ],
    };
  }
}

export interface ShadowRunnerOptions {
  sink: GuardEvidenceSink;
  /**
   * Whether fail-open is permitted on scanner failure. SHADOW is the
   * only mode that accepts `true`; ADVISORY/ACTIVE runners (not in
   * Sprint 3) must set false.
   */
  fail_open: true;
}

export interface ShadowRunOutput {
  verdict: GuardVerdict;        // the scanner's verdict, recorded for observability
  evidence_id: string;
  blocked: false;               // SHADOW never blocks
}

export class ShadowRunner {
  readonly mode = GuardEnforcementMode.SHADOW;

  constructor(
    private readonly scanner: Scanner,
    private readonly opts: ShadowRunnerOptions,
  ) {}

  async run(input: GuardRunInput): Promise<ShadowRunOutput> {
    let result: ScannerResult;
    let scannerFailed = false;
    let failureReason: string | null = null;

    try {
      result = await this.scanner.scan(input);
    } catch (err) {
      if (!this.opts.fail_open) {
        throw err;    // Cannot happen in Sprint 3 — fail_open is forced true.
      }
      scannerFailed = true;
      failureReason = err instanceof Error ? err.message : String(err);
      result = { verdict: Verdict.SAFE, hits: [] };
    }

    const evidence: GuardEvidence = makeEvidence({
      guard_id: input.guard_id,
      guard_kind: input.guard_kind,
      mode: this.mode,
      verdict: result.verdict,
      trace_id: input.trace_id,
      scanned_path: input.scanned_path,
      hits: result.hits,
      scanner_version: this.scanner.scanner_version,
      pattern_catalog_version: this.scanner.pattern_catalog_version,
      scanner_failed: scannerFailed,
      failure_reason: failureReason,
    });

    await this.opts.sink.append(evidence);

    return { verdict: result.verdict, evidence_id: evidence.evidence_id, blocked: false };
  }
}
