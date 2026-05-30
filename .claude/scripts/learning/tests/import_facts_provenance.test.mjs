/**
 * C4 — provenance_dirty 4-clause OR, manifest-validator guard (PASS/FAIL/WARN),
 * and import_disabled soft-skip (SPEC §1.5 / §1.7.P).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { importFacts, computeProvenanceDirty } from '../import_facts.mjs';
import {
  loadGolden, tmpEngineRepo, tmpRoot, writeRegistry, placeSidecar, identityHex,
} from './_helpers.mjs';

const G = loadGolden();
const GOLDEN_HEX = identityHex(G.declared_identity);

const CLEAN_EVENT = { source_dirty: false, source_branch: 'main', manifest_hash: 'sha256:' + 'a'.repeat(64) };
const CLEAN_SOURCE = { allowed_branches: ['main'], expected_manifest_hash: 'sha256:' + 'a'.repeat(64) };

// ---------------------------------------------------------------------------
// provenance_dirty = literal OR of 4 clauses
// ---------------------------------------------------------------------------

test('provenance_dirty clean path = false when all 4 clauses false', () => {
  const { dirty, reasons } = computeProvenanceDirty(CLEAN_EVENT, 'PASS', CLEAN_SOURCE);
  assert.equal(dirty, false);
  assert.deepEqual(reasons, []);
});

test('clause 1 — source_dirty=true', () => {
  const { dirty, reasons } = computeProvenanceDirty({ ...CLEAN_EVENT, source_dirty: true }, 'PASS', CLEAN_SOURCE);
  assert.equal(dirty, true);
  assert.ok(reasons.includes('source_dirty'));
});

test('clause 2 — manifest_validator_status != PASS', () => {
  for (const status of ['WARN', 'FAIL']) {
    const { dirty, reasons } = computeProvenanceDirty(CLEAN_EVENT, status, CLEAN_SOURCE);
    assert.equal(dirty, true);
    assert.ok(reasons.some((r) => r.includes(`manifest_validator_status=${status}`)));
  }
});

test('clause 3 — source_branch not in allowed_branches', () => {
  const { dirty, reasons } = computeProvenanceDirty({ ...CLEAN_EVENT, source_branch: 'feature/x' }, 'PASS', CLEAN_SOURCE);
  assert.equal(dirty, true);
  assert.ok(reasons.some((r) => r.includes('source_branch=feature/x')));
});

test('clause 4 — manifest_hash != expected_manifest_hash', () => {
  const { dirty, reasons } = computeProvenanceDirty({ ...CLEAN_EVENT, manifest_hash: 'sha256:' + 'f'.repeat(64) }, 'PASS', CLEAN_SOURCE);
  assert.equal(dirty, true);
  assert.ok(reasons.some((r) => r.includes('manifest_hash')));
});

test("today's invariant — expected_manifest_hash=null makes clause 4 always true", () => {
  const { dirty, reasons } = computeProvenanceDirty(CLEAN_EVENT, 'PASS', { allowed_branches: ['main'], expected_manifest_hash: null });
  assert.equal(dirty, true);
  assert.ok(reasons.some((r) => r.includes('expected_manifest_hash(null)')));
});

// ---------------------------------------------------------------------------
// integration: golden import → provenance on the written record
// ---------------------------------------------------------------------------

function importGolden(opts) {
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  if (opts && opts.manifestText !== undefined) writeFileSync(join(eng, 'engine_manifest.yaml'), opts.manifestText, 'utf-8');
  const root = tmpRoot();
  const reg = writeRegistry(root, opts && opts.registry);
  const recordsOut = join(root, 'records.jsonl');
  const report = importFacts({ source: 'amazon-growth-engine', engineRepo: eng, rootDir: root, recordsOut, registryPath: reg, mode: 'live' });
  const rec = existsSync(recordsOut) ? JSON.parse(readFileSync(recordsOut, 'utf-8').trim()) : null;
  return { report, rec, root };
}

test('integration — Phase 1b record is always provenance_dirty=true', () => {
  const { report, rec } = importGolden();
  assert.equal(report.provenance_dirty_all, true);
  assert.equal(rec.provenance.provenance_dirty, true);
});

test('validator guard — WARN (not crash) when engine repo has no engine_manifest.yaml', () => {
  const { rec } = importGolden(); // fake engine repo has no manifest
  assert.equal(rec.provenance.manifest_validator_status, 'WARN');
});

test('validator guard — subprocess runs and maps a schema-invalid manifest to FAIL', () => {
  // Minimal v2-schema-INVALID manifest → validator exit 2 → FAIL (proves the
  // guarded subprocess executes; CI-safe, no AGE dependency).
  const { rec } = importGolden({ manifestText: 'schema_version: "2.0"\nengine_id: amazon-growth-engine\n' });
  assert.equal(rec.provenance.manifest_validator_status, 'FAIL');
});

// ---------------------------------------------------------------------------
// import_disabled (SPEC §1.5)
// ---------------------------------------------------------------------------

test('import_disabled — named source with enabled:false is skipped (soft-fail, no throw)', () => {
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  const root = tmpRoot();
  const reg = writeRegistry(root, { enabled: false });
  const recordsOut = join(root, 'records.jsonl');
  const report = importFacts({ source: 'amazon-growth-engine', engineRepo: eng, rootDir: root, recordsOut, registryPath: reg, mode: 'live' });
  assert.equal(report.scanned, 0);
  assert.equal(report.new_records, 0);
  assert.ok(report.skipped_sources.some((s) => s.reason === 'enabled=false'));
  assert.equal(existsSync(recordsOut), false);
});

test('default run (no --source) processes only enabled sources', () => {
  // registry: AGE disabled. Default run iterates enabled sources only → none.
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', GOLDEN_HEX + '.json', G.sidecar_text);
  const root = tmpRoot();
  const reg = writeRegistry(root, { enabled: false });
  const recordsOut = join(root, 'records.jsonl');
  const report = importFacts({ engineRepo: eng, rootDir: root, recordsOut, registryPath: reg, mode: 'live' });
  assert.equal(report.scanned, 0);
});
