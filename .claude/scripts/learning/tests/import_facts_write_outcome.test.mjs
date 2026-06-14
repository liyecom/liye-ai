/**
 * artifact_type: write_outcome — positive + negative coverage via the REAL importer path.
 * Doctrine: _meta/adr/ADR-Learning-Fact-Artifact-Type-Taxonomy.md (2026-06-14).
 *
 * Operator non-negotiable DoD: prove a write_outcome event with
 * raw_payload_summary.action_kind + string-encoded budget fields passes ALL THREE
 * importer validation stages end-to-end —
 *   S1  event schema     (import_facts.mjs:402)
 *   S1b numeric-not-string (import_facts.mjs:411 — Pilot 1 string-encode-all)
 *   S2  record schema    (import_facts.mjs:489)
 * via importFacts() (NOT a re-compiled ajv), so it tracks the importer's own validators.
 *
 * The positive test is also the SPLIT-FAILURE SENTINEL: if the record-schema enum
 * copy (fact_run_outcome_record_v1) is NOT widened in lockstep with the event schema,
 * importFacts rejects at record-validate (rejects=1, new_records=0) and this test fails —
 * catching exactly the "event passed, record copy didn't" hazard.
 *
 * The synthetic sidecar is DERIVED from the real golden_sidecar.json (a true AGE
 * emit_fact.py output) and resealed (identity then content), so it remains internally
 * consistent through the importer's recompute gates S4/S5.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { importFacts, computeIdentityKey } from '../import_facts.mjs';
import { makeStringNode, makeObjectNode } from '../canonical_json.mjs';
import {
  goldenAst, withField, reseal, emit, numNode,
  identityHex, tmpEngineRepo, tmpRoot, writeRegistry, placeSidecar, countLines,
} from './_helpers.mjs';

/** Derive a self-consistent write_outcome event AST from the golden sidecar. */
function buildWriteOutcomeAst({ nativeBudget = false, traceId = 'wo-default' } = {}) {
  let ast = goldenAst();
  ast = withField(ast, 'artifact_type', makeStringNode('write_outcome'));
  // distinct trace_id per test → distinct event_identity_key (trace_id ∈ the 8-key identity set;
  // raw_payload_summary is NOT, so without this the 3 cases would collide on one identity).
  ast = withField(ast, 'trace_id', makeStringNode(traceId));
  // kind lives in the summary (NOT a per-kind artifact_type value); budgets string-encoded (S1b).
  const prevBudget = nativeBudget ? numNode(25) : makeStringNode('25.00');
  const summary = makeObjectNode([
    ['action_kind', makeStringNode('CAMPAIGN_BUDGET_UPDATE')],
    ['previous_daily_budget', prevBudget],
    ['proposed_daily_budget', makeStringNode('30.00')],
    ['proposed_spend_delta', makeStringNode('5.00')],
    ['currency', makeStringNode('USD')],
  ]);
  ast = withField(ast, 'raw_payload_summary', summary);
  // artifact_type + summary changed → reseal identity (8-key) then content (incl. identity).
  return reseal(ast, { identity: true, content: true });
}

function setup(opts) {
  const ast = buildWriteOutcomeAst(opts);
  const identity = computeIdentityKey(ast);
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-06-14', identityHex(identity) + '.json', emit(ast));
  const root = tmpRoot();
  const reg = writeRegistry(root);
  const recordsOut = join(root, 'records.jsonl');
  return {
    ast, identity, recordsOut,
    common: { source: 'amazon-growth-engine', engineRepo: eng, rootDir: root, recordsOut, registryPath: reg },
  };
}

test('write_outcome positive: event(S1) + S1b string-budgets + record(S2) all pass via real importer', () => {
  const { common, recordsOut, identity } = setup({ traceId: 'wo-positive' });
  const r = importFacts({ ...common, mode: 'live' });
  assert.equal(r.rejects, 0, `unexpected rejects: ${JSON.stringify(r.per_reject)}`);
  assert.equal(r.new_records, 1);
  assert.equal(countLines(recordsOut), 1);
  const rec = JSON.parse(readFileSync(recordsOut, 'utf-8').trim());
  assert.equal(rec.artifact_type, 'write_outcome');
  assert.equal(rec.raw_payload_summary.action_kind, 'CAMPAIGN_BUDGET_UPDATE');
  assert.equal(rec.raw_payload_summary.previous_daily_budget, '25.00'); // string-encoded survives
  assert.equal(rec.schema_version, '1.0.0');                            // additive: const unchanged
  assert.equal(rec.event_identity_key, identity);
});

test('write_outcome negative control: native-number budget → S1b NUMERIC_NOT_STRING reject', () => {
  const { common, recordsOut } = setup({ nativeBudget: true, traceId: 'wo-negative' });
  const r = importFacts({ ...common, mode: 'live' });
  assert.equal(r.new_records, 0);
  assert.equal(r.rejects, 1);
  assert.equal(r.per_reject[0].reason, 'NUMERIC_NOT_STRING');
  assert.equal(countLines(recordsOut), 0);
});

test('write_outcome dry_run: NEW counted, ZERO disk writes', () => {
  const { common, recordsOut } = setup({ traceId: 'wo-dryrun' });
  const r = importFacts({ ...common, mode: 'dry_run' });
  assert.equal(r.new_records, 1);
  assert.equal(r.rejects, 0);
  assert.equal(existsSync(recordsOut), false, 'dry_run MUST NOT write records.jsonl');
});
