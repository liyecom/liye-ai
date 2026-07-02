/**
 * artifact_type: growth_outcome + source_system: user-growth-engine — positive + negative
 * coverage via the REAL importer path.
 * Doctrine: _meta/adr/ADR-UGE-Fact-Taxonomy.md (Accepted 2026-07-02, anchor e62e82e),
 * mirroring the write_outcome precedent (_meta/adr/ADR-Learning-Fact-Artifact-Type-Taxonomy.md).
 *
 * Operator non-negotiable DoD: prove a growth_outcome event with
 * raw_payload_summary.action_kind=growth.signup.qualified + string-encoded qualified-signup
 * profile passes ALL THREE importer validation stages end-to-end —
 *   S1  event schema      (import_facts.mjs:402)
 *   S1b numeric-not-string (import_facts.mjs:411 — string-encode-all)
 *   S2  record schema     (import_facts.mjs:489)
 * via importFacts() (NOT a re-compiled ajv), so it tracks the importer's own validators.
 *
 * The positive test is the SPLIT-FAILURE SENTINEL: if the record-schema copies
 * (fact_run_outcome_record_v1: source_system + artifact_type enums) are NOT widened in
 * lockstep with the event schema, importFacts rejects at record-validate (rejects=1,
 * new_records=0) and this test fails — catching the "event passed, record copy didn't" hazard.
 *
 * impedance solution (ADR §impedance): a business signup has no natural run identity, so the
 * UGE lead-ingest job IS the run — playbook_ref=lead_ingest, step_id=ingest, artifact_path =
 * the signup record's canonical path, trace_id = the ingest run id.
 *
 * The synthetic sidecar is DERIVED from the real golden_sidecar.json (a true AGE emit_fact.py
 * output) and resealed (identity then content) so it stays internally consistent through the
 * importer's recompute gates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { importFacts, computeIdentityKey } from '../import_facts.mjs';
import { makeStringNode, makeObjectNode } from '../canonical_json.mjs';
import {
  goldenAst, withField, reseal, emit, numNode,
  identityHex, tmpEngineRepo, tmpRoot, writeRegistry, placeSidecar, countLines,
} from './_helpers.mjs';

// The artifact raw_payload_ref resolves to: ONLY non-PII fields, contact channel scrubbed.
// Original contact values live in the UGE private lead store/broker — never in this artifact,
// the event sidecar, or the audit record (ADR-UGE-Fact-Taxonomy §Q7). raw_payload_hash binds
// the emitted fact to this exact redacted content.
const REDACTED_PAYLOAD = {
  seller_category: 'home_kitchen',
  monthly_gmv_band: '10k-50k',
  is_amazon_seller: 'true',
  submitted_asin: 'B0C5Q8L7FP',
  contactable: 'true',
  contact_channel: '[REDACTED]',
  attribution_click_id: 'clk_abc123',
  utm_source: 'youtube',
  redaction_status: 'redacted',
};
const REDACTED_REF = 'out/facts/growth/signup_redacted.json';
const REDACTED_TEXT = JSON.stringify(REDACTED_PAYLOAD, null, 2) + '\n';
const REDACTED_HASH = 'sha256:' + createHash('sha256').update(REDACTED_TEXT).digest('hex');

/** Derive a self-consistent growth_outcome event AST from the golden sidecar. */
function buildGrowthOutcomeAst({ nativeGmvBand = false, piiInSummary = false, traceId = 'go-default' } = {}) {
  let ast = goldenAst();
  ast = withField(ast, 'artifact_type', makeStringNode('growth_outcome'));
  // UGE engine registration — the new source_system enum value under test.
  ast = withField(ast, 'source_system', makeStringNode('user-growth-engine'));
  ast = withField(ast, 'source_repo', makeStringNode('user-growth-engine'));
  ast = withField(ast, 'source_worktree_id', makeStringNode('user-growth-engine'));
  // impedance: the UGE lead-ingest job IS the run.
  ast = withField(ast, 'playbook_ref', makeStringNode('lead_ingest'));
  ast = withField(ast, 'step_id', makeStringNode('ingest'));
  ast = withField(ast, 'artifact_path', makeStringNode('out/facts/growth/signup.json'));
  // PII red line: raw contact never in the fact; ref points to an already-redacted artifact,
  // and raw_payload_hash binds the fact to that redacted content (deref integrity).
  ast = withField(ast, 'raw_payload_ref', makeStringNode(REDACTED_REF));
  ast = withField(ast, 'raw_payload_hash', makeStringNode(REDACTED_HASH));
  ast = withField(ast, 'redaction_status', makeStringNode('redacted'));
  // distinct trace_id per test → distinct event_identity_key (trace_id ∈ the 8-key identity set;
  // raw_payload_summary is NOT, so without this the cases would collide on one identity).
  ast = withField(ast, 'trace_id', makeStringNode(traceId));
  // qualified-signup profile — ALL string-encoded (S1b); NO PII contact value, only contactable bool-string.
  const gmvBand = nativeGmvBand ? numNode(25000) : makeStringNode('10k-50k');
  const entries = [
    ['action_kind', makeStringNode('growth.signup.qualified')],
    ['seller_category', makeStringNode('home_kitchen')],
    ['monthly_gmv_band', gmvBand],
    ['is_amazon_seller', makeStringNode('true')],
    ['submitted_asin', makeStringNode('B0C5Q8L7FP')],
    ['contactable', makeStringNode('true')],
    ['attribution_click_id', makeStringNode('clk_abc123')],
    ['utm_source', makeStringNode('youtube')],
  ];
  // boundary probe only: a string-encoded PII value the importer does NOT gate (see PII boundary test).
  if (piiInSummary) entries.push(['contact_email', makeStringNode('seller@example.com')]);
  ast = withField(ast, 'raw_payload_summary', makeObjectNode(entries));
  // identity (8-key) resealed first, then content (over the dict that already contains identity).
  return reseal(ast, { identity: true, content: true });
}

function setup(opts) {
  const ast = buildGrowthOutcomeAst(opts);
  const identity = computeIdentityKey(ast);
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-07-02', identityHex(identity) + '.json', emit(ast));
  // The redacted artifact raw_payload_ref resolves to. Placed under out/facts/growth/ — NOT a
  // YYYY-MM-DD date dir, so the importer's date-dir filter (import_facts.mjs:574,
  // /^\d{4}-\d{2}-\d{2}$/) never scans it as a sidecar. Deref is a fixture-level proof, not importer work.
  const redactedPath = placeSidecar(eng, 'growth', 'signup_redacted.json', REDACTED_TEXT);
  const root = tmpRoot();
  const reg = writeRegistry(root, { sourceId: 'user-growth-engine' });
  const recordsOut = join(root, 'records.jsonl');
  return {
    ast, identity, recordsOut, redactedPath,
    common: { source: 'user-growth-engine', engineRepo: eng, rootDir: root, recordsOut, registryPath: reg },
  };
}

test('growth_outcome positive: event(S1) + S1b string-profile + record(S2) all pass via real importer', () => {
  const { common, recordsOut, identity } = setup({ traceId: 'go-positive' });
  const r = importFacts({ ...common, mode: 'live' });
  assert.equal(r.rejects, 0, `unexpected rejects: ${JSON.stringify(r.per_reject)}`);
  assert.equal(r.new_records, 1);
  assert.equal(countLines(recordsOut), 1);
  const rec = JSON.parse(readFileSync(recordsOut, 'utf-8').trim());
  assert.equal(rec.artifact_type, 'growth_outcome');
  assert.equal(rec.source_system, 'user-growth-engine');           // new enum value survives (event + record)
  assert.equal(rec.raw_payload_summary.action_kind, 'growth.signup.qualified');
  assert.equal(rec.raw_payload_summary.monthly_gmv_band, '10k-50k'); // string-encoded survives
  assert.equal(rec.raw_payload_summary.contactable, 'true');
  assert.equal(rec.redaction_status, 'redacted');
  // PII red line: no raw contact value leaked into the summary (only contactable bool-string).
  const sumKeys = Object.keys(rec.raw_payload_summary);
  assert.ok(!sumKeys.some((k) => /email|phone|wechat/i.test(k)), `summary carries a PII contact key: ${sumKeys}`);
  assert.equal(rec.schema_version, '1.0.0');                         // additive: const unchanged
  assert.equal(rec.event_identity_key, identity);
});

test('growth_outcome negative control: native-number monthly_gmv_band → S1b NUMERIC_NOT_STRING reject', () => {
  const { common, recordsOut } = setup({ nativeGmvBand: true, traceId: 'go-negative' });
  const r = importFacts({ ...common, mode: 'live' });
  assert.equal(r.new_records, 0);
  assert.equal(r.rejects, 1);
  assert.equal(r.per_reject[0].reason, 'NUMERIC_NOT_STRING');
  assert.equal(countLines(recordsOut), 0);
});

test('growth_outcome dry_run: NEW counted, ZERO disk writes', () => {
  const { common, recordsOut } = setup({ traceId: 'go-dryrun' });
  const r = importFacts({ ...common, mode: 'dry_run' });
  assert.equal(r.new_records, 1);
  assert.equal(r.rejects, 0);
  assert.equal(existsSync(recordsOut), false, 'dry_run MUST NOT write records.jsonl');
});

test('growth_outcome PII boundary: importer does NOT gate a string-encoded PII value (enforcement = UGE profile validator, NOT S1b)', () => {
  // Documents the layer boundary (mirrors the bool caveat in ADR-UGE-Fact-Taxonomy §DoD):
  // S1b only rejects native numbers, and NO importer stage inspects for PII, so a string email
  // passes. PII exclusion MUST be enforced upstream by the UGE emitter/profile validator — this
  // PR intentionally adds NO importer-level PII gate.
  const { common } = setup({ piiInSummary: true, traceId: 'go-pii-boundary' });
  const r = importFacts({ ...common, mode: 'live' });
  assert.equal(r.rejects, 0, 'importer has no PII gate — a string-encoded PII value is not rejected here');
  assert.equal(r.new_records, 1);
});

test('growth_outcome PII red line: raw_payload_ref resolves to a redacted artifact with NO cleartext contact', () => {
  // Completes the ADR §DoD PII proof: not just "summary has no PII key" — the artifact the fact
  // references is itself redacted, and raw_payload_hash pins the fact to that exact clean content.
  const { common, recordsOut, redactedPath } = setup({ traceId: 'go-redaction' });
  const r = importFacts({ ...common, mode: 'live' });
  assert.equal(r.rejects, 0, `unexpected rejects: ${JSON.stringify(r.per_reject)}`);
  assert.equal(r.new_records, 1);
  // 1) the artifact raw_payload_ref points to actually exists on disk
  assert.ok(existsSync(redactedPath), 'redacted artifact must exist at raw_payload_ref');
  const redactedText = readFileSync(redactedPath, 'utf-8');
  // 2) dereferenced content carries NO cleartext contact (email / phone / wechat)
  assert.ok(!redactedText.includes('seller@example.com'), 'redacted artifact leaks the seed email');
  assert.ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(redactedText), 'redacted artifact contains an email address');
  assert.ok(!/\d{7,}/.test(redactedText), 'redacted artifact contains a phone-like long digit run');
  assert.ok(!/wechat|weixin/i.test(redactedText), 'redacted artifact references a wechat handle');
  // 3) raw_payload_hash in the emitted record == sha256 of the redacted artifact (deref integrity)
  const rec = JSON.parse(readFileSync(recordsOut, 'utf-8').trim());
  assert.equal(rec.raw_payload_hash, REDACTED_HASH);
  const actual = 'sha256:' + createHash('sha256').update(redactedText).digest('hex');
  assert.equal(actual, rec.raw_payload_hash, 'raw_payload_hash must equal sha256 of the redacted artifact');
});
