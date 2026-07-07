/**
 * C4 — decision tree S1-S6, all reject reasons, DUPLICATE_CONFLICT, sidecar-vs-log
 * cross-check, and dry-run 0-write side-effects. Fixtures are mutated from the
 * golden sidecar so every reject is isolated to exactly one tree branch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { makeObjectNode } from '../canonical_json.mjs';
import { importFacts, REJECT_REASONS } from '../import_facts.mjs';
import {
  loadGolden, goldenAst, tmpEngineRepo, tmpRoot, writeRegistry, placeSidecar,
  placeEventsLogLine, countLines, identityHex, withField, withoutField, reseal,
  strNode, numNode, emit,
} from './_helpers.mjs';

const G = loadGolden();
const GOLDEN_HEX = identityHex(G.declared_identity);

/** Place one sidecar and run the importer; returns { report, root, recordsOut }. */
function runOne(sidecarText, { fileName = GOLDEN_HEX + '.json', mode = 'live', eventsLogLine = null, since = null } = {}) {
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', fileName, sidecarText);
  if (eventsLogLine) placeEventsLogLine(eng, '2026-05-20', eventsLogLine);
  const root = tmpRoot();
  const reg = writeRegistry(root);
  const recordsOut = join(root, 'records.jsonl');
  const report = importFacts({ source: 'amazon-growth-engine', engineRepo: eng, rootDir: root, recordsOut, registryPath: reg, mode, since });
  return { report, root, recordsOut };
}

function findRejectDir(root) {
  const base = join(root, 'state/runtime/learning/fact_rejects');
  if (!existsSync(base)) return null;
  const sources = readdirSync(base);
  const src = sources[0];
  const shas = readdirSync(join(base, src));
  return { source: src, dir: join(base, src, shas[0]) };
}

// ---------------------------------------------------------------------------
// 5 decision-tree rejects (S1-S5) + numeric content policy
// ---------------------------------------------------------------------------

test('S1 SCHEMA_INVALID — missing required field (source_branch)', () => {
  const { report } = runOne(emit(withoutField(goldenAst(), 'source_branch')));
  assert.equal(report.rejects, 1);
  assert.equal(report.per_reject[0].reason, REJECT_REASONS.SCHEMA_INVALID);
});

test('S1 SCHEMA_INVALID — unparseable bytes → source segment "unknown"', () => {
  const { report, root } = runOne('{ this is not json');
  assert.equal(report.rejects, 1);
  assert.equal(report.per_reject[0].reason, REJECT_REASONS.SCHEMA_INVALID);
  assert.equal(findRejectDir(root).source, 'unknown');
});

test('S1b NUMERIC_NOT_STRING — native number in raw_payload_summary', () => {
  const ast = withField(goldenAst(), 'raw_payload_summary', makeObjectNode([['acos', numNode('0.42')]]));
  const { report } = runOne(emit(ast));
  assert.equal(report.rejects, 1);
  assert.equal(report.per_reject[0].reason, REJECT_REASONS.NUMERIC_NOT_STRING);
});

test('S1c SOURCE_MISMATCH — sidecar source_system must match registry source id', () => {
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  const root = tmpRoot();
  const reg = writeRegistry(root, { sourceId: 'user-growth-engine' });
  const recordsOut = join(root, 'records.jsonl');
  const report = importFacts({ engineRepo: eng, rootDir: root, recordsOut, registryPath: reg, mode: 'live' });
  assert.equal(report.scanned, 1);
  assert.equal(report.new_records, 0);
  assert.equal(report.rejects, 1);
  assert.equal(report.per_reject[0].reason, REJECT_REASONS.SOURCE_MISMATCH);
  assert.equal(countLines(recordsOut), 0);
});

test('registry guard — invalid source id fails before SOURCE_MISMATCH reject can escape sink root', () => {
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  const root = tmpRoot();
  const escapeName = `escape-pr206-${process.pid}`;
  const sourceId = `../../../../../${escapeName}`;
  const reg = join(root, 'registry.yaml');
  writeFileSync(reg, [
    'sources:',
    `  "${sourceId}":`,
    `    source_id: "${sourceId}"`,
    '    allowed_branches: [main]',
    '    expected_manifest_hash: null',
    '    enabled: true',
    '',
  ].join('\n'), 'utf-8');
  const recordsOut = join(root, 'records.jsonl');

  assert.throws(
    () => importFacts({ source: sourceId, engineRepo: eng, rootDir: root, recordsOut, registryPath: reg, mode: 'live' }),
    /invalid registry source id/,
  );
  assert.equal(existsSync(join(root, 'state/runtime/learning/fact_rejects')), false);
  assert.equal(existsSync(join(root, '..', escapeName)), false);
  assert.equal(countLines(recordsOut), 0);
});

test('S2 PATH_UNSAFE — colon injection via artifact_path (no schema pattern)', () => {
  const ast = withField(goldenAst(), 'artifact_path', strNode('out/2026:05/x.json'));
  const { report } = runOne(emit(ast));
  assert.equal(report.rejects, 1);
  assert.equal(report.per_reject[0].reason, REJECT_REASONS.PATH_UNSAFE);
});

test('S2 PATH_UNSAFE — dotdot escape via artifact_path', () => {
  const ast = withField(goldenAst(), 'artifact_path', strNode('out/../../etc/passwd'));
  const { report } = runOne(emit(ast));
  assert.equal(report.rejects, 1);
  assert.equal(report.per_reject[0].reason, REJECT_REASONS.PATH_UNSAFE);
});

test('S3 FILENAME_MISMATCH — valid event in wrongly-named file', () => {
  const { report } = runOne(G.sidecar_text, { fileName: '0'.repeat(64) + '.json' });
  assert.equal(report.rejects, 1);
  assert.equal(report.per_reject[0].reason, REJECT_REASONS.FILENAME_MISMATCH);
});

test('S4 IDENTITY_MISMATCH — identity field tampered, declared key kept', () => {
  // trace_id is a LOCKED identity field; change it but keep declared event_identity_key.
  const ast = withField(goldenAst(), 'trace_id', strNode('TAMPERED-TRACE'));
  const { report } = runOne(emit(ast));
  assert.equal(report.rejects, 1);
  assert.equal(report.per_reject[0].reason, REJECT_REASONS.IDENTITY_MISMATCH);
});

test('S5 CONTENT_MISMATCH — content field tampered, declared content hash kept', () => {
  // raw_payload_hash is NOT an identity field → Gate A passes, Gate B fails.
  const ast = withField(goldenAst(), 'raw_payload_hash', strNode('sha256:' + 'b'.repeat(64)));
  const { report } = runOne(emit(ast));
  assert.equal(report.rejects, 1);
  assert.equal(report.per_reject[0].reason, REJECT_REASONS.CONTENT_MISMATCH);
});

test('sidecar-vs-events.jsonl cross-check — same identity, different bytes → reject', () => {
  // events.jsonl line shares the identity but differs in content (redaction_status).
  const logLine = emit(withField(goldenAst(), 'redaction_status', strNode('unknown')));
  const { report } = runOne(G.sidecar_text, { eventsLogLine: logLine });
  assert.equal(report.rejects, 1);
  assert.equal(report.per_reject[0].reason, REJECT_REASONS.SIDECAR_LOG_MISMATCH);
});

test('cross-check passes when events.jsonl line matches the sidecar', () => {
  const { report } = runOne(G.sidecar_text, { eventsLogLine: G.sidecar_text });
  assert.equal(report.rejects, 0);
  assert.equal(report.new_records, 1);
});

// ---------------------------------------------------------------------------
// reject sink layout + dry-run abstinence
// ---------------------------------------------------------------------------

test('live reject writes fact_rejects/<source|unknown>/<sha256-of-bytes>/ with meta', () => {
  const { root } = runOne(emit(withoutField(goldenAst(), 'source_branch')));
  const rej = findRejectDir(root);
  assert.ok(rej, 'fact_rejects dir must exist in live mode');
  assert.ok(existsSync(join(rej.dir, 'sidecar.json')));
  const meta = readFileSync(join(rej.dir, 'reject_meta.yaml'), 'utf-8');
  assert.match(meta, /reason: "SCHEMA_INVALID"/);
  assert.match(meta, /raw_sidecar_sha256: "sha256:[0-9a-f]{64}"/);
});

test('dry_run writes NEITHER records NOR fact_rejects/ for a rejecting sidecar', () => {
  const { report, root, recordsOut } = runOne(emit(withoutField(goldenAst(), 'source_branch')), { mode: 'dry_run' });
  assert.equal(report.rejects, 1); // still COUNTED (so exit code reflects it)
  assert.equal(existsSync(recordsOut), false);
  assert.equal(existsSync(join(root, 'state/runtime/learning/fact_rejects')), false);
});

// ---------------------------------------------------------------------------
// DUPLICATE_CONFLICT (dual-hash divergence) — fact_conflicts/, non-fatal
// ---------------------------------------------------------------------------

test('DUPLICATE_CONFLICT — same identity, different content → fact_conflicts/, no append', () => {
  const eng = tmpEngineRepo();
  const sidecarPath = placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  const root = tmpRoot();
  const reg = writeRegistry(root);
  const recordsOut = join(root, 'records.jsonl');
  const common = { source: 'amazon-growth-engine', engineRepo: eng, rootDir: root, recordsOut, registryPath: reg, mode: 'live' };

  // 1) import the golden → 1 record.
  let r = importFacts(common);
  assert.equal(r.new_records, 1);
  assert.equal(countLines(recordsOut), 1);

  // 2) same identity, DIFFERENT content (internally consistent variant), same filename.
  const variant = reseal(withField(goldenAst(), 'raw_payload_hash', strNode('sha256:' + 'c'.repeat(64))), { content: true });
  writeFileSync(sidecarPath, emit(variant), 'utf-8');

  r = importFacts(common);
  assert.equal(r.conflicts, 1);
  assert.equal(r.new_records, 0);
  assert.equal(r.rejects, 0, 'DUPLICATE_CONFLICT is non-fatal (exit code unaffected)');
  assert.equal(countLines(recordsOut), 1, 'conflict must NOT append a record');

  const cdir = join(root, 'state/runtime/learning/fact_conflicts', 'amazon-growth-engine', GOLDEN_HEX);
  assert.ok(existsSync(join(cdir, 'original.json')));
  assert.ok(existsSync(join(cdir, 'incoming.json')));
  const meta = readFileSync(join(cdir, 'conflict_meta.yaml'), 'utf-8');
  assert.match(meta, /content_hash_diff_summary:/);
  // no policy_trial generated anywhere under state/runtime/learning
  assert.equal(existsSync(join(root, 'state/runtime/learning/policy_trials.jsonl')), false);
});

test('DUPLICATE_CONFLICT in dry_run writes no fact_conflicts/', () => {
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  const root = tmpRoot();
  const reg = writeRegistry(root);
  const recordsOut = join(root, 'records.jsonl');
  // pre-seed records.jsonl with a different-content record for the same identity
  mkdirSync(join(root, 'state/memory/facts'), { recursive: true });
  const seeded = JSON.parse(G.sidecar_text);
  seeded.event_content_hash = 'sha256:' + 'd'.repeat(64);
  seeded.ingested_at = '2026-05-20T00:00:00Z';
  seeded.importer_version = 'discover_new_runs@2.0.0';
  seeded.canonical_record_hash = 'sha256:' + 'e'.repeat(64);
  seeded.provenance = { manifest_validator_status: 'WARN', provenance_dirty: true };
  writeFileSync(recordsOut, JSON.stringify(seeded) + '\n', 'utf-8');

  const r = importFacts({ source: 'amazon-growth-engine', engineRepo: eng, rootDir: root, recordsOut, registryPath: reg, mode: 'dry_run' });
  assert.equal(r.conflicts, 1);
  assert.equal(existsSync(join(root, 'state/runtime/learning/fact_conflicts')), false);
});

// ---------------------------------------------------------------------------
// --since UTC date filtering
// ---------------------------------------------------------------------------

test('--since filters out earlier UTC date directories', () => {
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  const root = tmpRoot();
  const reg = writeRegistry(root);
  const recordsOut = join(root, 'records.jsonl');
  const r = importFacts({ source: 'amazon-growth-engine', engineRepo: eng, rootDir: root, recordsOut, registryPath: reg, mode: 'dry_run', since: '2026-05-21' });
  assert.equal(r.scanned, 0, '2026-05-20 dir is before --since 2026-05-21');
});
