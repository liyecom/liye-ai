/**
 * C6 — hardening from the pre-PR adversarial review.
 *  #1 dangling-symlink escape (path defense weaker than emit_fact) — REGRESSION
 *  #3 reject_meta.yaml recomputed_vs_declared audit block for a hash-mismatch
 *  #4 end-to-end CLI exit code 2 (REJECTS_PRESENT) and 0 (conflict non-fatal)
 *  #5 canonical_record_hash replay-stability under importer-field variation
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, mkdtempSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { makeStringNode } from '../canonical_json.mjs';
import { importFacts, computeCanonicalRecordHash } from '../import_facts.mjs';
import {
  loadGolden, goldenAst, tmpEngineRepo, tmpRoot, writeRegistry, placeSidecar,
  identityHex, withField, strNode, emit, countLines, IMPORTER,
} from './_helpers.mjs';

const G = loadGolden();
const GOLDEN_HEX = identityHex(G.declared_identity);

function findRejectDir(root) {
  const base = join(root, 'state/runtime/learning/fact_rejects');
  const src = readdirSync(base)[0];
  const sha = readdirSync(join(base, src))[0];
  return join(base, src, sha);
}

// ---------------------------------------------------------------------------
// #1 — dangling-symlink escape must REJECT (matches emit_fact os.path.realpath)
// ---------------------------------------------------------------------------

function engineRepoWithDanglingEscape() {
  const eng = tmpEngineRepo();
  // create out/facts/<date> first so the dir exists
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  // dangling symlink out/escape -> an OUTSIDE path whose target does NOT exist
  const outside = mkdtempSync(join(tmpdir(), 'ghl_outside_'));
  symlinkSync(join(outside, 'absent_target'), join(eng, 'out', 'escape'));
  return eng;
}

function runWith(eng, sidecarText) {
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', sidecarText);
  const root = tmpRoot();
  const reg = writeRegistry(root);
  return importFacts({ source: 'amazon-growth-engine', engineRepo: eng, rootDir: root, recordsOut: join(root, 'records.jsonl'), registryPath: reg, mode: 'live' });
}

test('#1 dangling symlink escape via raw_payload_ref → PATH_UNSAFE', () => {
  const eng = engineRepoWithDanglingEscape();
  const ast = withField(goldenAst(), 'raw_payload_ref', strNode('out/escape/x.json'));
  const r = runWith(eng, emit(ast));
  assert.equal(r.rejects, 1);
  assert.equal(r.per_reject[0].reason, 'PATH_UNSAFE');
});

test('#1 dangling symlink escape via artifact_path (no schema pattern) → PATH_UNSAFE', () => {
  const eng = engineRepoWithDanglingEscape();
  const ast = withField(goldenAst(), 'artifact_path', strNode('out/escape/secret'));
  const r = runWith(eng, emit(ast));
  assert.equal(r.rejects, 1);
  assert.equal(r.per_reject[0].reason, 'PATH_UNSAFE');
});

test('#1 normal nonexistent repo-relative path still PASSES (no over-rejection)', () => {
  // golden raw_payload_ref points to a file that does not exist on disk; must NOT reject.
  const eng = tmpEngineRepo();
  const r = runWith(eng, G.sidecar_text);
  assert.equal(r.rejects, 0);
  assert.equal(r.new_records, 1);
});

// ---------------------------------------------------------------------------
// #3 — reject_meta.yaml recomputed_vs_declared block for a hash-mismatch reject
// ---------------------------------------------------------------------------

test('#3 CONTENT_MISMATCH reject_meta carries recomputed_vs_declared + sink_path set', () => {
  const eng = tmpEngineRepo();
  const ast = withField(goldenAst(), 'raw_payload_hash', strNode('sha256:' + 'b'.repeat(64)));
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', emit(ast));
  const root = tmpRoot();
  const reg = writeRegistry(root);
  const report = importFacts({ source: 'amazon-growth-engine', engineRepo: eng, rootDir: root, recordsOut: join(root, 'records.jsonl'), registryPath: reg, mode: 'live' });
  assert.equal(report.per_reject[0].reason, 'CONTENT_MISMATCH');
  assert.ok(report.per_reject[0].sink_path, 'per_reject.sink_path must be set in live mode');
  const meta = readFileSync(join(findRejectDir(root), 'reject_meta.yaml'), 'utf-8');
  assert.match(meta, /reason: "CONTENT_MISMATCH"/);
  assert.match(meta, /recomputed_vs_declared:/);
  assert.match(meta, /recomputed: "sha256:[0-9a-f]{64}"/);
  assert.match(meta, /declared: "sha256:[0-9a-f]{64}"/);
});

// ---------------------------------------------------------------------------
// #4 — end-to-end CLI exit codes (dry_run so NO disk writes under PROJECT_ROOT)
// ---------------------------------------------------------------------------

function cli(args) {
  return spawnSync('node', [IMPORTER, ...args], { encoding: 'utf-8' });
}

test('#4 CLI exit 2 (REJECTS_PRESENT) on a rejecting sidecar (dry_run, 0 disk writes)', () => {
  const eng = tmpEngineRepo();
  const badAst = goldenAst();
  const bad = { t: 'obj', entries: badAst.entries.filter((e) => e.keyStr !== 'source_branch') };
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', emit(bad));
  const root = tmpRoot();
  const reg = writeRegistry(root);
  const r = cli(['--source', 'amazon-growth-engine', '--engine-repo', eng, '--registry-path', reg, '--records-out', join(root, 'records.jsonl'), '--json']);
  assert.equal(r.status, 2);
  const report = JSON.parse(r.stdout);
  assert.equal(report.rejects, 1);
});

test('#4 CLI exit 0 on a NEW import (dry_run)', () => {
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  const root = tmpRoot();
  const reg = writeRegistry(root);
  const r = cli(['--source', 'amazon-growth-engine', '--engine-repo', eng, '--registry-path', reg, '--records-out', join(root, 'records.jsonl'), '--json']);
  assert.equal(r.status, 0);
});

test('#4 CLI exit 0 on DUPLICATE_CONFLICT (non-fatal)', () => {
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  const root = tmpRoot();
  const reg = writeRegistry(root);
  const recordsOut = join(root, 'records.jsonl');
  // pre-seed records.jsonl with a same-identity, DIFFERENT-content record
  const seeded = JSON.parse(G.sidecar_text);
  seeded.event_content_hash = 'sha256:' + 'd'.repeat(64);
  seeded.ingested_at = '2026-05-20T00:00:00Z';
  seeded.importer_version = 'discover_new_runs@2.0.0';
  seeded.canonical_record_hash = 'sha256:' + 'e'.repeat(64);
  seeded.provenance = { manifest_validator_status: 'WARN', provenance_dirty: true };
  writeFileSync(recordsOut, JSON.stringify(seeded) + '\n', 'utf-8');
  const r = cli(['--source', 'amazon-growth-engine', '--engine-repo', eng, '--registry-path', reg, '--records-out', recordsOut, '--json']);
  assert.equal(r.status, 0); // conflict is non-fatal
  assert.equal(JSON.parse(r.stdout).conflicts, 1);
});

// ---------------------------------------------------------------------------
// #5 — canonical_record_hash excludes the 4 importer fields (replay-stable)
// ---------------------------------------------------------------------------

test('#5 canonical_record_hash is invariant under importer-field variation', () => {
  const importerFields = (vals) => [
    { keyRaw: JSON.stringify('ingested_at'), keyStr: 'ingested_at', value: makeStringNode(vals.ingested) },
    { keyRaw: JSON.stringify('importer_version'), keyStr: 'importer_version', value: makeStringNode(vals.version) },
    { keyRaw: JSON.stringify('canonical_record_hash'), keyStr: 'canonical_record_hash', value: makeStringNode(vals.crh) },
    { keyRaw: JSON.stringify('provenance'), keyStr: 'provenance', value: { t: 'obj', entries: [
      { keyRaw: JSON.stringify('manifest_validator_status'), keyStr: 'manifest_validator_status', value: makeStringNode(vals.pv) },
      { keyRaw: JSON.stringify('provenance_dirty'), keyStr: 'provenance_dirty', value: { t: 'bool', raw: 'true' } },
    ] } },
  ];
  const ev = goldenAst();
  const recA = { t: 'obj', entries: [...ev.entries, ...importerFields({ ingested: '2026-05-20T00:00:00Z', version: 'discover_new_runs@2.0.0', crh: 'sha256:' + '1'.repeat(64), pv: 'WARN' }) ] };
  const recB = { t: 'obj', entries: [...ev.entries, ...importerFields({ ingested: '2099-01-01T12:34:56Z', version: 'discover_new_runs@9.9.9', crh: 'sha256:' + '2'.repeat(64), pv: 'FAIL' }) ] };
  const hEvent = computeCanonicalRecordHash(ev);
  const hA = computeCanonicalRecordHash(recA);
  const hB = computeCanonicalRecordHash(recB);
  assert.equal(hA, G.declared_canonical_record_hash, 'recordA hash == golden');
  assert.equal(hA, hEvent, 'including-importer-fields hash == event-only hash (fields excluded)');
  assert.equal(hA, hB, 'varying the 4 importer fields does not change canonical_record_hash');
});
