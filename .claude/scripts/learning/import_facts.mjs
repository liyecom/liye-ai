#!/usr/bin/env node
/**
 * import_facts.mjs — Phase 1b GHL fact importer (liye_os, NEW file).
 * SSOT: .claude/scripts/learning/import_facts.mjs
 *
 * Normative: SPEC `.planning/phase-1b/SPEC.md` v1.0 (blob 4a606e18).
 * CODE-SSOT for hash algorithms: AGE `scripts/learning/emit_fact.py` @ main 7b28956.
 *
 * liye_os ACTIVELY PULLS enabled engine event sidecars
 *   <engine_repo>/out/facts/<UTC_DATE>/<event_identity_key>.json
 * → dual-hash verify + dedupe → writes canonical fact_run_outcome_record_v1 to
 *   state/memory/facts/fact_run_outcome_records.jsonl
 * with conflict/reject side-channels under state/runtime/learning/.
 *
 * Q1 (user-approved deviation from plan §3 letter): NEW file, NOT a rewrite of
 * legacy discover_new_runs.mjs (whose sole consumer is heartbeat_runner.mjs;
 * heartbeat upgrade is Phase 1d). discover_new_runs.mjs + heartbeat are NOT touched.
 *
 * Phase 1b/Stage-C posture: dry-run-first (default), manual CLI only, NO scheduler.
 * Registry sources are processed only when enabled:true, and each sidecar must match
 * its registry source id before it can be imported.
 *
 * Hard boundaries (SPEC §2): never mutate AGE / loamwise / frozen schemas / legacy
 * fact_run_outcomes.jsonl / heartbeat; never generate policy trials; observability
 * write only (Hard Gate 8 — no production_write).
 */

import {
  readFileSync, readdirSync, existsSync, statSync, realpathSync,
  lstatSync, readlinkSync, mkdirSync, openSync, writeSync, closeSync, appendFileSync,
} from 'fs';
import { join, dirname, basename, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';

import {
  parseCanonical, emitCanonical, sha256Prefixed, hashCanonical,
  makeStringNode, makeObjectNode, getEntry, astToValue, containsNativeNumber,
} from './canonical_json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// --------------------------------------------------------------------------- //
// Locked constants
// --------------------------------------------------------------------------- //

// Frozen importer_version token. The record schema pins
// ^discover_new_runs@\d+\.\d+\.\d+$ — so even though THIS file is import_facts.mjs,
// the token MUST stay discover_new_runs@ (SPEC §1.3 / §9).
export const IMPORTER_VERSION = 'discover_new_runs@2.0.0';

// LOCKED 8-key identity set (must equal emit_fact.py IDENTITY_KEYS).
export const IDENTITY_KEYS = [
  'artifact_path', 'artifact_type', 'playbook_ref', 'source_commit_sha',
  'source_repo', 'source_system', 'step_id', 'trace_id',
];

// Content-hash exclusion. emit_fact excludes {emitted_at} (top) +
// {raw_payload_summary.metric_formatting_hint} (nested) when it has NOT YET added
// event_content_hash. The importer reads a sidecar that ALREADY contains
// event_content_hash, so it must ADDITIONALLY pop it (Gate B preimage fix, SPEC
// §1.4 / A2), while KEEPING event_identity_key.
const CONTENT_HASH_EXCLUDED_TOP = ['emitted_at', 'event_content_hash'];
const CONTENT_HASH_EXCLUDED_NESTED = { raw_payload_summary: ['metric_formatting_hint'] };

// canonical_record_hash excludes ALL 4 importer-only fields (Q3).
const RECORD_HASH_EXCLUDED = ['ingested_at', 'importer_version', 'canonical_record_hash', 'provenance'];

// Stricter-than-emit path regex (importer is the trust boundary; SPEC §1.6).
// NOT emit_fact's weaker ^[a-zA-Z0-9_./-]+$ (allows leading '/').
const STRICT_PATH_RE = /^(?![~/])(?!.*\.\.)[a-zA-Z0-9_./-]+$/;
const PATH_GUARDED_FIELDS = ['raw_payload_ref', 'artifact_path'];

export const REJECT_REASONS = {
  SCHEMA_INVALID: 'SCHEMA_INVALID',
  NUMERIC_NOT_STRING: 'NUMERIC_NOT_STRING',
  PATH_UNSAFE: 'PATH_UNSAFE',
  FILENAME_MISMATCH: 'FILENAME_MISMATCH',
  IDENTITY_MISMATCH: 'IDENTITY_MISMATCH',
  CONTENT_MISMATCH: 'CONTENT_MISMATCH',
  SIDECAR_LOG_MISMATCH: 'SIDECAR_LOG_MISMATCH',
  SOURCE_MISMATCH: 'SOURCE_MISMATCH',
};

const DEFAULT_RECORDS_OUT = 'state/memory/facts/fact_run_outcome_records.jsonl';
const CONFLICTS_BASE = 'state/runtime/learning/fact_conflicts';
const REJECTS_BASE = 'state/runtime/learning/fact_rejects';
const EVENTS_LOG_FILENAME = 'fact_run_outcome_events.jsonl';

const EXIT = { SUCCESS: 0, UNEXPECTED: 1, REJECTS_PRESENT: 2 };

// --------------------------------------------------------------------------- //
// Hash recompute (GHL field knowledge over the generic canonical serializer)
// --------------------------------------------------------------------------- //

/** Gate A: recompute event_identity_key from the LOCKED 8-key dict. */
export function computeIdentityKey(eventAst) {
  const pairs = IDENTITY_KEYS.map((k) => {
    const v = getEntry(eventAst, k);
    if (v === undefined) throw new Error(`identity field missing: ${k}`);
    return [k, v]; // reuse the preserved value node (token-exact)
  });
  return hashCanonical(makeObjectNode(pairs));
}

/** Gate B: recompute event_content_hash over the content-hash preimage. */
export function computeContentHash(eventAst) {
  const topDrop = new Set(CONTENT_HASH_EXCLUDED_TOP);
  const entries = eventAst.entries
    .filter((e) => !topDrop.has(e.keyStr))
    .map((e) => {
      const nestedDrop = CONTENT_HASH_EXCLUDED_NESTED[e.keyStr];
      if (nestedDrop && e.value.t === 'obj') {
        const drop = new Set(nestedDrop);
        return { ...e, value: { t: 'obj', entries: e.value.entries.filter((se) => !drop.has(se.keyStr)) } };
      }
      return e;
    });
  return hashCanonical({ t: 'obj', entries });
}

/**
 * canonical_record_hash = sha256(canonicalize(record minus 4 importer fields)).
 * record minus the 4 importer fields == the 20 event fields == the sidecar's
 * canonical form, so this equals sha256(canonical event AST) — replay-stable,
 * depends only on sidecar content.
 */
export function computeCanonicalRecordHash(eventAst) {
  const drop = new Set(RECORD_HASH_EXCLUDED);
  const entries = eventAst.entries.filter((e) => !drop.has(e.keyStr));
  return hashCanonical({ t: 'obj', entries });
}

// --------------------------------------------------------------------------- //
// Schema validation (ajv Draft-07; matches Python jsonschema default: no format)
// --------------------------------------------------------------------------- //

function buildValidators() {
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
  const eventSchema = parseYaml(readFileSync(
    join(PROJECT_ROOT, '_meta/contracts/learning/fact_run_outcome_event_v1.schema.yaml'), 'utf-8'));
  const recordSchema = parseYaml(readFileSync(
    join(PROJECT_ROOT, '_meta/contracts/learning/fact_run_outcome_record_v1.schema.yaml'), 'utf-8'));
  return { validateEvent: ajv.compile(eventSchema), validateRecord: ajv.compile(recordSchema) };
}

function firstError(validate) {
  const e = validate.errors && validate.errors[0];
  if (!e) return 'schema invalid';
  return `${e.instancePath || '<root>'} ${e.message}`;
}

// --------------------------------------------------------------------------- //
// Path defense (SPEC §1.6)
// --------------------------------------------------------------------------- //

/**
 * os.path.realpath-equivalent resolver: resolves '.'/'..' and follows symlinks by
 * their link TEXT even when the target is DANGLING (missing), and tolerates
 * non-existent components lexically. This mirrors emit_fact.py's os.path.realpath
 * so the importer (the trust boundary) is never weaker than the emitter it
 * backstops. (Node's realpathSync throws ENOENT on a broken symlink, hiding where
 * it points — a naive walk-up would treat a dangling-outside symlink as a safe
 * missing leaf and let it escape; see SPEC §1.6 "无 symlink 逃逸".)
 */
function resolveSymlinksAllowingMissing(absPath) {
  const resolved = [];
  let queue = absPath.startsWith(sep) ? absPath.slice(1).split(sep) : absPath.split(sep);
  let iterations = 0;
  while (queue.length) {
    if (++iterations > 8192) break; // symlink-cycle guard
    const name = queue.shift();
    if (name === '' || name === '.') continue;
    if (name === '..') { resolved.pop(); continue; }
    const probePath = sep + [...resolved, name].join(sep);
    let st;
    try { st = lstatSync(probePath); }
    catch (err) { if (err.code === 'ENOENT') { resolved.push(name); continue; } throw err; }
    if (st.isSymbolicLink()) {
      let target;
      try { target = readlinkSync(probePath); } catch { resolved.push(name); continue; }
      if (target.startsWith(sep)) { resolved.length = 0; queue = target.slice(1).split(sep).concat(queue); }
      else { queue = target.split(sep).concat(queue); } // relative to the symlink's parent
    } else {
      resolved.push(name);
    }
  }
  return sep + resolved.join(sep);
}

/**
 * Validate a repo-relative path field. Lexical stricter regex always; when the
 * engine repo is on disk, also assert the realpath stays within it (symlink
 * escape defense). Returns null if safe, or a reason string.
 */
function checkPathField(value, engineRepoReal) {
  if (typeof value !== 'string' || !STRICT_PATH_RE.test(value)) {
    return `fails strict repo-relative regex`;
  }
  if (engineRepoReal) {
    const abs = resolve(engineRepoReal, value);
    const real = resolveSymlinksAllowingMissing(abs);
    if (real !== engineRepoReal && !real.startsWith(engineRepoReal + sep)) {
      return `resolves outside engine repo (symlink escape)`;
    }
  }
  return null;
}

// --------------------------------------------------------------------------- //
// Provenance (SPEC §1.7.P)
// --------------------------------------------------------------------------- //

/**
 * Run validate_manifest_reality.py (best-effort, guarded). Returns one of
 * PASS / FAIL / WARN. WARN iff the validator cannot be run (AGE/manifest absent
 * or spawn failure) — orthogonal to expected_manifest_hash=null.
 */
function runManifestValidator(engineRepoReal) {
  if (!engineRepoReal) return 'WARN';
  const validator = join(PROJECT_ROOT, '_meta/contracts/scripts/validate_manifest_reality.py');
  const manifest = join(engineRepoReal, 'engine_manifest.yaml');
  if (!existsSync(validator) || !existsSync(manifest)) return 'WARN';
  let res;
  try {
    res = spawnSync('python3', [validator, '--manifest-path', manifest, '--engine-repo', engineRepoReal, '--json'],
      { encoding: 'utf-8' });
  } catch {
    return 'WARN';
  }
  if (res.error || res.status === null || res.status === undefined) return 'WARN';
  if (res.status === 0) return 'PASS';
  return 'FAIL'; // exit 1 (reality FAIL) or 2 (schema FAIL) both map to FAIL
}

/**
 * provenance_dirty = literal OR of 4 clauses; per-clause reasons for audit.
 * Today (expected_manifest_hash=null) clause 4 is always true → all 1b records dirty.
 */
export function computeProvenanceDirty(eventObj, validatorStatus, source) {
  const reasons = [];
  if (eventObj.source_dirty === true) reasons.push('source_dirty');
  if (validatorStatus !== 'PASS') reasons.push(`manifest_validator_status=${validatorStatus}`);
  const allowed = source.allowed_branches || [];
  if (!allowed.includes(eventObj.source_branch)) reasons.push(`source_branch=${eventObj.source_branch} not in allowed_branches`);
  const expected = source.expected_manifest_hash;
  if (eventObj.manifest_hash !== expected) reasons.push(`manifest_hash != expected_manifest_hash(${expected === null ? 'null' : String(expected)})`);
  return { dirty: reasons.length > 0, reasons };
}

// --------------------------------------------------------------------------- //
// Sinks (live-mode side-channels; append-once via O_EXCL)
// --------------------------------------------------------------------------- //

function nowIso() { return new Date().toISOString(); } // ...Z == +00:00 offset

function identityHex(identityKey) { return identityKey.split('sha256:', 2)[1] || identityKey; }

/** Write a file with O_CREAT|O_EXCL (append-once). Returns true if written, false if it already existed. */
function writeExclusive(filePath, data) {
  let fd;
  try {
    fd = openSync(filePath, 'wx'); // O_CREAT | O_EXCL | O_WRONLY
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
  try { writeSync(fd, data); } finally { closeSync(fd); }
  return true;
}

function writeConflict(rootDir, sourceSystem, identityKey, originalLine, incomingRawText, declaredOriginalHash, incomingHash) {
  const dir = join(rootDir, CONFLICTS_BASE, sourceSystem, identityHex(identityKey));
  mkdirSync(dir, { recursive: true });
  writeExclusive(join(dir, 'original.json'), originalLine.endsWith('\n') ? originalLine : originalLine + '\n');
  writeExclusive(join(dir, 'incoming.json'), incomingRawText);
  const meta = [
    `detected_at: "${nowIso()}"`,
    `event_identity_key: "${identityKey}"`,
    `content_hash_diff_summary:`,
    `  original_event_content_hash: "${declaredOriginalHash}"`,
    `  incoming_event_content_hash: "${incomingHash}"`,
    '',
  ].join('\n');
  writeExclusive(join(dir, 'conflict_meta.yaml'), meta);
  return dir;
}

function writeReject(rootDir, sourceSegment, rawBytes, rawText, reason, recomputedVsDeclared) {
  const sha = createHash('sha256').update(rawBytes).digest('hex');
  const dir = join(rootDir, REJECTS_BASE, sourceSegment, sha);
  mkdirSync(dir, { recursive: true });
  writeExclusive(join(dir, 'sidecar.json'), rawText);
  const lines = [
    `reason: "${reason}"`,
    `detected_at: "${nowIso()}"`,
    `raw_sidecar_sha256: "sha256:${sha}"`,
  ];
  if (recomputedVsDeclared) {
    lines.push('recomputed_vs_declared:');
    for (const [k, v] of Object.entries(recomputedVsDeclared)) lines.push(`  ${k}: "${v}"`);
  }
  lines.push('');
  writeExclusive(join(dir, 'reject_meta.yaml'), lines.join('\n'));
  return dir;
}

// --------------------------------------------------------------------------- //
// Registry
// --------------------------------------------------------------------------- //

function loadRegistry(registryPath) {
  const path = registryPath || join(PROJECT_ROOT, '.claude/config/learning_sources.yaml');
  const parsed = parseYaml(readFileSync(path, 'utf-8')) || {};
  return parsed.sources || {};
}

function repoNameFromUrl(value) {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\/+$/, '');
  const last = clean.split('/').pop();
  if (!last) return null;
  return last.endsWith('.git') ? last.slice(0, -4) : last;
}

/** Resolve the local engine repo dir: explicit override, else source-specific sibling clone. */
function resolveEngineRepo(explicit, source) {
  if (explicit) return existsSync(explicit) ? realpathSync(explicit) : null;
  const candidates = [
    repoNameFromUrl(source && source.engine_repo),
    source && source.source_id,
  ].filter(Boolean).map((name) => join(PROJECT_ROOT, '..', name));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return realpathSync(candidate);
  }
  return null;
}

// --------------------------------------------------------------------------- //
// seen_index — rebuilt from records.jsonl on startup (records.jsonl sole SSOT)
// --------------------------------------------------------------------------- //

function buildSeenIndex(recordsOutAbs) {
  const index = new Map(); // event_identity_key -> { contentHash, line }
  if (!existsSync(recordsOutAbs)) return index;
  const text = readFileSync(recordsOutAbs, 'utf-8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let rec;
    try { rec = JSON.parse(trimmed); } catch { continue; }
    if (rec && typeof rec.event_identity_key === 'string') {
      index.set(rec.event_identity_key, { contentHash: rec.event_content_hash, line: trimmed });
    }
  }
  return index;
}

// --------------------------------------------------------------------------- //
// Per-source processing
// --------------------------------------------------------------------------- //

function utcDateFromSince(since) {
  if (!since) return null;
  // Lexical YYYY-MM-DD prefix is sufficient for UTC date-dir filtering.
  const m = String(since).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function loadEventsLog(dateDir) {
  // Returns Map identity -> canonical(line) for cross-check, or null if no log.
  const logPath = join(dateDir, EVENTS_LOG_FILENAME);
  if (!existsSync(logPath)) return null;
  const map = new Map();
  const text = readFileSync(logPath, 'utf-8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const ast = parseCanonical(trimmed);
      const idNode = getEntry(ast, 'event_identity_key');
      if (idNode && idNode.t === 'str') map.set(idNode.value, emitCanonical(ast));
    } catch { /* skip malformed log line; sidecar remains authoritative */ }
  }
  return map;
}

/**
 * Process one sidecar file through the decision tree. Mutates `report`, `seenIndex`.
 * Returns nothing; all outcomes recorded on `report`.
 */
function processSidecar(ctx, sidecarPath, eventsLogMap) {
  const { validators, engineRepoReal, source, sourceId, validatorStatus, mode, rootDir, report, seenIndex, recordsOutAbs } = ctx;
  const rawBytes = readFileSync(sidecarPath);
  const rawText = rawBytes.toString('utf-8');

  const reject = (reason, sourceSegment, recomputed) => {
    report.rejects += 1;
    let sinkPath = null;
    if (mode === 'live') sinkPath = writeReject(rootDir, sourceSegment, rawBytes, rawText, reason, recomputed);
    report.per_reject.push({ reason, sidecar_path: sidecarPath, sink_path: sinkPath });
  };

  // Parse (token-preserving). Parse failure == schema-invalid (untrusted source).
  let eventAst;
  try { eventAst = parseCanonical(rawText); }
  catch (err) { reject(REJECT_REASONS.SCHEMA_INVALID, 'unknown', { parse_error: err.message }); return; }
  if (eventAst.t !== 'obj') { reject(REJECT_REASONS.SCHEMA_INVALID, 'unknown', { parse_error: 'top-level not an object' }); return; }

  const eventObj = astToValue(eventAst);

  // S1 — event schema validate.
  if (!validators.validateEvent(eventObj)) {
    reject(REJECT_REASONS.SCHEMA_INVALID, 'unknown', { schema_error: firstError(validators.validateEvent) });
    return;
  }
  // Schema passed → source_system is a trusted enum from here on.
  const sourceSystem = eventObj.source_system;
  if (sourceSystem !== sourceId) {
    reject(REJECT_REASONS.SOURCE_MISMATCH, sourceId, { declared_source_system: sourceSystem, registry_source: sourceId });
    return;
  }

  // S1b — numeric-not-string content policy (Pilot 1 string-encode-all).
  const summaryNode = getEntry(eventAst, 'raw_payload_summary');
  if (containsNativeNumber(summaryNode)) {
    reject(REJECT_REASONS.NUMERIC_NOT_STRING, sourceSystem, { policy: 'raw_payload_summary numerics must be string-encoded' });
    return;
  }

  // S2 — path defense on raw_payload_ref AND artifact_path.
  for (const field of PATH_GUARDED_FIELDS) {
    const why = checkPathField(eventObj[field], engineRepoReal);
    if (why) { reject(REJECT_REASONS.PATH_UNSAFE, sourceSystem, { field, detail: why }); return; }
  }

  // S3 — filename stem == declared event_identity_key hex.
  const declaredIdentity = eventObj.event_identity_key;
  const stem = basename(sidecarPath).replace(/\.json$/, '');
  if (stem !== identityHex(declaredIdentity)) {
    reject(REJECT_REASONS.FILENAME_MISMATCH, sourceSystem, { filename_stem: stem, declared_identity: declaredIdentity });
    return;
  }

  // S4 — Gate A: recompute identity.
  const recomputedIdentity = computeIdentityKey(eventAst);
  if (recomputedIdentity !== declaredIdentity) {
    reject(REJECT_REASONS.IDENTITY_MISMATCH, sourceSystem, { recomputed: recomputedIdentity, declared: declaredIdentity });
    return;
  }

  // S5 — Gate B: recompute content hash (double-pop preimage).
  const declaredContent = eventObj.event_content_hash;
  const recomputedContent = computeContentHash(eventAst);
  if (recomputedContent !== declaredContent) {
    reject(REJECT_REASONS.CONTENT_MISMATCH, sourceSystem, { recomputed: recomputedContent, declared: declaredContent });
    return;
  }

  // sidecar vs events.jsonl cross-check (sidecar authoritative; mismatch → reject).
  if (eventsLogMap && eventsLogMap.has(declaredIdentity)) {
    if (eventsLogMap.get(declaredIdentity) !== emitCanonical(eventAst)) {
      reject(REJECT_REASONS.SIDECAR_LOG_MISMATCH, sourceSystem, { detail: 'sidecar bytes != fact_run_outcome_events.jsonl line for same identity' });
      return;
    }
  }

  // S6 — dedup three-state.
  const seen = seenIndex.get(declaredIdentity);
  if (seen) {
    if (seen.contentHash === declaredContent) {
      report.silent_skips += 1;
      log(`[import_facts] skip identity=${declaredIdentity}`);
      return;
    }
    // DUPLICATE_CONFLICT — same identity, different content (non-fatal).
    report.conflicts += 1;
    let sinkPath = null;
    if (mode === 'live') {
      sinkPath = writeConflict(rootDir, sourceSystem, declaredIdentity, seen.line, rawText, seen.contentHash, declaredContent);
    }
    report.per_conflict.push({ event_identity_key: declaredIdentity, sink_path: sinkPath });
    return;
  }

  // NEW — build record, validate, (live) append.
  const { dirty, reasons } = computeProvenanceDirty(eventObj, validatorStatus, source);
  const provenanceNode = makeObjectNode([
    ['manifest_validator_status', makeStringNode(validatorStatus)],
    ['provenance_dirty', { t: 'bool', raw: dirty ? 'true' : 'false' }],
  ]);
  const canonicalRecordHash = computeCanonicalRecordHash(eventAst);
  const recordEntries = [
    ...eventAst.entries,
    { keyRaw: JSON.stringify('ingested_at'), keyStr: 'ingested_at', value: makeStringNode(nowIso()) },
    { keyRaw: JSON.stringify('importer_version'), keyStr: 'importer_version', value: makeStringNode(IMPORTER_VERSION) },
    { keyRaw: JSON.stringify('canonical_record_hash'), keyStr: 'canonical_record_hash', value: makeStringNode(canonicalRecordHash) },
    { keyRaw: JSON.stringify('provenance'), keyStr: 'provenance', value: provenanceNode },
  ];
  const recordAst = { t: 'obj', entries: recordEntries };
  const recordObj = astToValue(recordAst);

  // Validate the record before write (record-level SCHEMA_INVALID → reject).
  if (!validators.validateRecord(recordObj)) {
    reject(REJECT_REASONS.SCHEMA_INVALID, sourceSystem, { record_schema_error: firstError(validators.validateRecord) });
    return;
  }

  report.new_records += 1;
  if (dirty) {
    report.provenance_dirty_true_count += 1;
    report.provenance_dirty_any = true;
    if (report.provenance_reasons_sample.length === 0) report.provenance_reasons_sample = reasons;
  } else {
    report.provenance_dirty_false_count += 1;
  }
  report.provenance_dirty_all = report.provenance_dirty_false_count === 0;
  if (mode === 'live') {
    const line = emitCanonical(recordAst) + '\n';
    mkdirSync(dirname(recordsOutAbs), { recursive: true });
    appendFileSync(recordsOutAbs, line);
    seenIndex.set(declaredIdentity, { contentHash: declaredContent, line: line.trim() });
  } else {
    // dry_run: would-write only; still register in-memory so repeated identities
    // within the same dry run silent-skip (full-re-run idempotent semantics).
    seenIndex.set(declaredIdentity, { contentHash: declaredContent, line: emitCanonical(recordAst) });
  }
}

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

/**
 * Import facts from one or all enabled registry sources.
 * In dry_run (default) NOTHING is written to disk (pure aside from reads + logs).
 *
 * @param {object} options
 * @param {string|null} [options.source]      registry source id; default = all enabled
 * @param {string|null} [options.since]       ISO8601; filter by UTC date dir
 * @param {'dry_run'|'live'} [options.mode]   default 'dry_run'
 * @param {string} [options.recordsOut]       default state/memory/facts/fact_run_outcome_records.jsonl
 * @param {string|null} [options.engineRepo]  local engine repo dir override; default source-specific sibling clone
 * @param {string} [options.rootDir]          liye_os root for sinks/records (test seam); default PROJECT_ROOT
 * @param {string} [options.registryPath]     learning_sources.yaml path (test seam); default canonical registry
 * @returns {object} RunReport
 */
export function importFacts(options = {}) {
  const mode = options.mode === 'live' ? 'live' : 'dry_run';
  const rootDir = options.rootDir ? realpathSync(options.rootDir) : PROJECT_ROOT;
  const recordsOutRel = options.recordsOut || DEFAULT_RECORDS_OUT;
  const recordsOutAbs = recordsOutRel.startsWith('/') ? recordsOutRel : join(rootDir, recordsOutRel);
  const windowStart = nowIso();

  const validators = buildValidators();
  const registry = loadRegistry(options.registryPath); // default = canonical registry

  const report = {
    source: options.source || null,
    mode,
    scanned: 0, new_records: 0, silent_skips: 0, conflicts: 0, rejects: 0,
    per_reject: [], per_conflict: [],
    provenance_dirty_all: true,
    provenance_dirty_any: false,
    provenance_dirty_true_count: 0,
    provenance_dirty_false_count: 0,
    provenance_reasons_sample: [],
    records_out: recordsOutAbs,
    window_start: windowStart,
    window_end: null,
    skipped_sources: [],
  };

  const sourceIds = options.source
    ? (registry[options.source] ? [options.source] : [])
    : Object.keys(registry).filter((id) => registry[id] && registry[id].enabled === true);

  // seen_index is shared across sources (records.jsonl is the single SSOT).
  const seenIndex = buildSeenIndex(recordsOutAbs);

  for (const sourceId of sourceIds) {
    const source = registry[sourceId];
    if (options.source && source.enabled !== true) {
      // Explicitly named but disabled → skip (soft-fail, does not block).
      report.skipped_sources.push({ source: sourceId, reason: 'enabled=false' });
      continue;
    }
    const engineRepoReal = resolveEngineRepo(options.engineRepo, source);
    const factsBase = engineRepoReal ? join(engineRepoReal, 'out', 'facts') : null;
    if (!factsBase || !existsSync(factsBase)) {
      report.skipped_sources.push({ source: sourceId, reason: engineRepoReal ? 'out/facts absent' : 'engine repo not on disk (provenance WARN)' });
      continue;
    }
    const validatorStatus = runManifestValidator(engineRepoReal);
    const sinceDate = utcDateFromSince(options.since);

    const ctx = { validators, engineRepoReal, source, sourceId, validatorStatus, mode, rootDir, report, seenIndex, recordsOutAbs };

    const dateDirs = readdirSync(factsBase, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map((d) => d.name)
      .filter((name) => !sinceDate || name >= sinceDate)
      .sort();

    for (const dateName of dateDirs) {
      const dateDir = join(factsBase, dateName);
      const eventsLogMap = loadEventsLog(dateDir);
      const sidecars = readdirSync(dateDir, { withFileTypes: true })
        .filter((f) => f.isFile() && f.name.endsWith('.json'))
        .map((f) => f.name)
        .sort();
      for (const name of sidecars) {
        report.scanned += 1;
        processSidecar(ctx, join(dateDir, name), eventsLogMap);
      }
    }
  }

  report.window_end = nowIso();
  return report;
}

// --------------------------------------------------------------------------- //
// Logging (stderr; never pollutes --json stdout)
// --------------------------------------------------------------------------- //

let QUIET = false;
function log(msg) { if (!QUIET) process.stderr.write(msg + '\n'); }

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //

const HELP = `import_facts.mjs — Phase 1b GHL fact importer (dry-run-first)

Usage:
  node import_facts.mjs [options]

Options:
  --source <id>        Registry source id (default: all enabled sources)
  --since <ISO8601>    Filter by UTC date directory (>= date)
  --mode <dry_run|live>  Default dry_run (Phase 1b locks dry-run-first; 0 disk writes)
  --records-out <path> Default state/memory/facts/fact_run_outcome_records.jsonl
  --engine-repo <dir>  Local engine repo root override; default source-specific sibling clone
  --registry-path <p>  learning_sources.yaml override (test / alt-config); default canonical registry
  --json               Print the RunReport as JSON on stdout
  --help               Show this help and exit 0

Exit codes:
  0  success (0 rejects; NEW/SKIP/CONFLICT any mix)
  2  >= 1 reject written to fact_rejects/
  1  unexpected error
`;

function parseArgs(argv) {
  const opts = { source: null, since: null, mode: 'dry_run', recordsOut: null, engineRepo: null, registryPath: null, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--source') opts.source = argv[++i];
    else if (a === '--since') opts.since = argv[++i];
    else if (a === '--mode') opts.mode = argv[++i];
    else if (a === '--records-out') opts.recordsOut = argv[++i];
    else if (a === '--engine-repo') opts.engineRepo = argv[++i];
    else if (a === '--registry-path') opts.registryPath = argv[++i];
    else { process.stderr.write(`unknown argument: ${a}\n`); }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { process.stdout.write(HELP); return EXIT.SUCCESS; }
  if (opts.mode !== 'dry_run' && opts.mode !== 'live') {
    process.stderr.write(`invalid --mode ${opts.mode} (use dry_run|live)\n`);
    return EXIT.UNEXPECTED;
  }
  if (opts.json) QUIET = true;
  let report;
  try {
    report = importFacts(opts);
  } catch (err) {
    process.stderr.write(`[import_facts] unexpected error: ${err.stack || err.message}\n`);
    return EXIT.UNEXPECTED;
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(
      `[import_facts] mode=${report.mode} scanned=${report.scanned} new=${report.new_records} ` +
      `skip=${report.silent_skips} conflict=${report.conflicts} reject=${report.rejects}\n`);
    for (const r of report.per_reject) process.stderr.write(`  reject ${r.reason}: ${r.sidecar_path}\n`);
  }
  return report.rejects > 0 ? EXIT.REJECTS_PRESENT : EXIT.SUCCESS;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) process.exit(main());
