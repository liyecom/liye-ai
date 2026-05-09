/**
 * BGHS Guard — Evidence redaction helpers + sink
 * Location: src/runtime/governance/guard/evidence.ts
 *
 * ADR-Loamwise-Guard-Content-Security §4 / G7. Evidence is
 * append-only and every `redacted_snippet` must never carry the raw
 * matched content. These utilities are the single seam for the
 * redaction rules; scanner implementations funnel through here.
 *
 * Reuses src/audit/evidence/hash.ts:sha256Hex (F4 discipline — one
 * evidence-infrastructure tree for the whole repo).
 */

import { randomUUID } from 'node:crypto';
import { sha256Hex } from '../../../audit/evidence/hash';
import type { GuardEvidence, GuardEvidenceSink, HitDetail } from './types';

const MAX_SNIPPET = 40;

/**
 * Produce a safe representation of a matched snippet for storage in
 * GuardEvidence.hits[].redacted_snippet. Rules:
 *   - Length <= MAX_SNIPPET → return as-is ONLY if it passes the
 *     sensitive-pattern heuristic; otherwise hash.
 *   - Longer → sha256 prefix + length hint.
 *   - Empty/undefined → '[empty]'.
 */
export function redactSnippet(raw: string | null | undefined): string {
  if (!raw) return '[empty]';
  if (looksSensitive(raw)) {
    const sha = sha256Hex(raw).slice(0, 12);
    return `sha256:${sha}...`;
  }
  if (raw.length <= MAX_SNIPPET) return raw;
  const sha = sha256Hex(raw).slice(0, 12);
  return `sha256:${sha}... [len=${raw.length}]`;
}

/** Heuristic — token-ish / high-entropy / credential-shaped strings. */
export function looksSensitive(s: string): boolean {
  // OAuth / Amazon / Google / JWT-like prefixes and common token shapes
  return (
    /^ya29\./.test(s) ||
    /^Atza\|/.test(s) ||
    /\bBearer\s+/.test(s) ||
    /\b[A-Za-z0-9+/]{32,}={0,2}\b/.test(s) ||        // base64-ish long run
    /\b[a-f0-9]{32,}\b/i.test(s)                      // hex token
  );
}

/** Build a GuardEvidence record with normalized defaults. */
export function makeEvidence(input: Omit<GuardEvidence, 'evidence_id' | 'scanned_at'>): GuardEvidence {
  return {
    evidence_id: randomUUID(),
    scanned_at: new Date().toISOString(),
    ...input,
  };
}

/** Normalize a hit, applying redaction to the snippet. */
export function normalizeHit(hit: Omit<HitDetail, 'redacted_snippet'> & { raw_snippet: string | null }): HitDetail {
  const { raw_snippet, ...rest } = hit;
  return {
    ...rest,
    redacted_snippet: redactSnippet(raw_snippet),
  };
}

/** In-memory evidence sink — the default sink for Sprint 3 tests and
 *  local dev. SessionAdjacentArtifact-backed sink (P1-e CREDENTIAL_AUDIT
 *  sibling) lands in a later sprint. */
export class InMemoryGuardEvidenceSink implements GuardEvidenceSink {
  private records: GuardEvidence[] = [];

  async append(ev: GuardEvidence): Promise<void> {
    this.records.push(ev);
  }

  list(): readonly GuardEvidence[] {
    return this.records;
  }

  _clearForTests(): void {
    this.records = [];
  }
}
