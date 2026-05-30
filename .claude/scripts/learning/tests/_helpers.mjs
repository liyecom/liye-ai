/**
 * Shared test helpers — build throwaway tmp fixtures (fake engine repo + liye_os
 * root + test registry) so importer tests never touch the real registry, the real
 * state/ tree, or AGE. All fixtures live under os.tmpdir().
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = join(HERE, 'fixtures');
export const IMPORTER = join(HERE, '..', 'import_facts.mjs');

export function loadGolden() {
  return JSON.parse(readFileSync(join(FIXTURES, 'golden_sidecar.json'), 'utf-8'));
}

export function tmpEngineRepo() { return mkdtempSync(join(tmpdir(), 'ghl_eng_')); }
export function tmpRoot() { return mkdtempSync(join(tmpdir(), 'ghl_root_')); }

/** Place a sidecar at <engineRepo>/out/facts/<dateName>/<fileName>. Returns its path. */
export function placeSidecar(engineRepo, dateName, fileName, text) {
  const dir = join(engineRepo, 'out', 'facts', dateName);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, fileName);
  writeFileSync(p, text, 'utf-8');
  return p;
}

/** Append a line to <engineRepo>/out/facts/<dateName>/fact_run_outcome_events.jsonl. */
export function placeEventsLogLine(engineRepo, dateName, lineText) {
  const dir = join(engineRepo, 'out', 'facts', dateName);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, 'fact_run_outcome_events.jsonl');
  writeFileSync(p, lineText.endsWith('\n') ? lineText : lineText + '\n', { flag: 'a' });
  return p;
}

/** Write a test registry YAML; returns its path. */
export function writeRegistry(root, opts = {}) {
  const {
    enabled = true, allowed_branches = ['main'],
    expected_manifest_hash = null, sourceId = 'amazon-growth-engine',
  } = opts;
  const eh = expected_manifest_hash === null ? 'null' : JSON.stringify(expected_manifest_hash);
  const p = join(root, 'registry.yaml');
  writeFileSync(p,
    `sources:\n  ${sourceId}:\n    source_id: ${sourceId}\n` +
    `    allowed_branches: [${allowed_branches.join(', ')}]\n` +
    `    expected_manifest_hash: ${eh}\n    enabled: ${enabled}\n`, 'utf-8');
  return p;
}

/** Count non-empty lines in a jsonl file (0 if absent). */
export function countLines(path) {
  try { return readFileSync(path, 'utf-8').split('\n').filter((l) => l.trim()).length; }
  catch { return 0; }
}

export function identityHex(identityKey) { return identityKey.split('sha256:')[1]; }
