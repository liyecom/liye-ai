/**
 * C3 — cross-language byte-equality golden test (SPEC DoD §3.5).
 *
 * The committed golden_sidecar.json was produced by REAL AGE emit_fact.py
 * (golden_harness.py, LIVE+tmp seam). Here the Node importer recomputes the
 * identity / content / canonical_record hashes and asserts they BYTE-equal the
 * Python-declared values — proving Node `canonical_json` reproduces Python
 * `json.dumps(sort_keys, separators=(",",":"), ensure_ascii=False)` exactly.
 *
 * To re-prove the live linkage:  python3 golden_harness.py --check
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCanonical, emitCanonical, hashCanonical, getEntry,
} from '../canonical_json.mjs';
import {
  computeIdentityKey, computeContentHash, computeCanonicalRecordHash,
} from '../import_facts.mjs';
import { loadGolden } from './_helpers.mjs';

const g = loadGolden();
const ast = parseCanonical(g.sidecar_text);

test('Gate A — Node identity recompute byte-equals Python emit_fact', () => {
  assert.equal(computeIdentityKey(ast), g.declared_identity);
});

test('Gate B — Node content recompute byte-equals Python emit_fact', () => {
  assert.equal(computeContentHash(ast), g.declared_content);
});

test('canonical_record_hash — Node recompute == Python (== sha256 of sidecar bytes)', () => {
  assert.equal(computeCanonicalRecordHash(ast), g.declared_canonical_record_hash);
});

test('sidecar round-trips byte-equal through token-preserving canonicalizer', () => {
  assert.equal(emitCanonical(ast), g.sidecar_text);
});

test('Gate B preimage regression — the double-pop of event_content_hash is REQUIRED', () => {
  // Naive (BUG): drop only emitted_at + raw_payload_summary.metric_formatting_hint,
  // but KEEP event_content_hash (emit_fact's exclusion tuple, which is wrong for the
  // importer because the sidecar it reads ALREADY contains event_content_hash).
  const naiveEntries = ast.entries
    .filter((e) => e.keyStr !== 'emitted_at')
    .map((e) => {
      if (e.keyStr === 'raw_payload_summary' && e.value.t === 'obj') {
        return { ...e, value: { t: 'obj', entries: e.value.entries.filter((se) => se.keyStr !== 'metric_formatting_hint') } };
      }
      return e;
    });
  const naiveHash = hashCanonical({ t: 'obj', entries: naiveEntries });
  assert.notEqual(naiveHash, g.declared_content,
    'naive single-pop MUST diverge (this is the 100%-false-positive bug the double-pop fixes)');
  // …and the correct double-pop recompute matches:
  assert.equal(computeContentHash(ast), g.declared_content);
});

test('event_identity_key is KEPT in the content preimage (emit ordering invariant)', () => {
  // The content hash preimage retains event_identity_key (emit_fact assigns it
  // before computing content_hash). Confirm the sidecar carries it and our
  // recompute still matches — i.e. we did not over-strip it.
  assert.ok(getEntry(ast, 'event_identity_key'));
  assert.equal(computeContentHash(ast), g.declared_content);
});
