/**
 * C2 smoke — import_facts.mjs pipeline mechanics against the golden sidecar.
 * (Cross-language byte-equality is asserted rigorously in golden.test.mjs / C3.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { importFacts } from '../import_facts.mjs';
import {
  loadGolden, tmpEngineRepo, tmpRoot, placeSidecar, writeRegistry,
  countLines, identityHex, IMPORTER,
} from './_helpers.mjs';

function setup() {
  const g = loadGolden();
  const eng = tmpEngineRepo();
  placeSidecar(eng, '2026-05-20', identityHex(g.declared_identity) + '.json', g.sidecar_text);
  const root = tmpRoot();
  const reg = writeRegistry(root);
  const recordsOut = join(root, 'records.jsonl');
  return { g, common: { source: 'amazon-growth-engine', engineRepo: eng, rootDir: root, recordsOut, registryPath: reg }, recordsOut };
}

test('dry_run: NEW counted, ZERO disk writes', () => {
  const { common, recordsOut } = setup();
  const r = importFacts({ ...common, mode: 'dry_run' });
  assert.equal(r.scanned, 1);
  assert.equal(r.new_records, 1);
  assert.equal(r.rejects, 0);
  assert.equal(r.mode, 'dry_run');
  assert.equal(existsSync(recordsOut), false, 'dry_run MUST NOT write records.jsonl');
});

test('live: appends a schema-valid record with correct importer fields', () => {
  const { g, common, recordsOut } = setup();
  const r = importFacts({ ...common, mode: 'live' });
  assert.equal(r.new_records, 1);
  assert.equal(countLines(recordsOut), 1);
  const rec = JSON.parse(readFileSync(recordsOut, 'utf-8').trim());
  assert.equal(rec.importer_version, 'discover_new_runs@2.0.0');
  assert.equal(rec.event_identity_key, g.declared_identity);
  assert.equal(rec.event_content_hash, g.declared_content);
  assert.equal(rec.canonical_record_hash, g.declared_canonical_record_hash);
  assert.equal(rec.provenance.provenance_dirty, true);
  assert.equal(rec.provenance.manifest_validator_status, 'WARN'); // no engine_manifest.yaml in fixture
});

test('idempotency: re-running live silent-skips, line count stable', () => {
  const { common, recordsOut } = setup();
  importFacts({ ...common, mode: 'live' });
  const r2 = importFacts({ ...common, mode: 'live' });
  assert.equal(r2.silent_skips, 1);
  assert.equal(r2.new_records, 0);
  assert.equal(countLines(recordsOut), 1);
});

test('CLI --help exits 0', () => {
  const r = spawnSync('node', [IMPORTER, '--help'], { encoding: 'utf-8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /dry-run-first/);
});

test('CLI default (no --mode) is dry_run and exits 0 on the real registry', () => {
  const r = spawnSync('node', [IMPORTER, '--json'], { encoding: 'utf-8' });
  assert.equal(r.status, 0);
  const report = JSON.parse(r.stdout);
  assert.equal(report.mode, 'dry_run');
});
