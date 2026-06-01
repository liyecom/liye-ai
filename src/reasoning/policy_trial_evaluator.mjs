#!/usr/bin/env node
/**
 * policy_trial_evaluator.mjs - Phase 1c GHL policy-trial evaluator (liye_os, NEW file).
 * SSOT: src/reasoning/policy_trial_evaluator.mjs
 *
 * Normative: SPEC `.planning/phase-1c/SPEC.md` v1.0 (blob c6975a6).
 * Upstream: Phase 1b importer `.claude/scripts/learning/import_facts.mjs` (blob 39f02581)
 *           + `canonical_json.mjs` (blob 42b05d04), both FROZEN CODE-SSOT.
 *
 * WHAT THIS DOES (SPEC scope):
 *   Reads the 1b importer output:
 *     - state/runtime/learning/fact_conflicts/<source_system>/<identityHex>/  (duplicate_conflict 情形2 = the only trial source)
 *     - state/memory/facts/fact_run_outcome_records.jsonl                     (metrics + artifact-deref binding rehearsal; produces NO trial in 1c)
 *   Binds policy_id by EXPLICIT reference only (A6), renders the Pilot 1
 *   negative-learning verdict (A5: only duplicate_conflict 情形2 -> NEEDS_HUMAN
 *   with provenance overlay), and writes:
 *     - state/runtime/learning/policy_trials.jsonl                 (policy_trial_v1, sealed schema)
 *     - state/runtime/learning/policy_trials_evidence/<trial_id>.yaml  (evidence-ledger side-car, A3)
 *
 * POSTURE (SPEC §1.8 / §2 / 2a-α §2a.3):
 *   dry_run is the default (0 disk writes), manual CLI only, NO scheduler. `--mode live`
 *   is gated by an up-front heartbeat authorization check: it writes a trial only when the
 *   live heartbeat state is operator-flipped to current_phase==trialing AND
 *   trial_write_enabled==true (Phase 2a-α); otherwise it fails closed
 *   (not_authorized_for_live, 0 writes, exit 2). observability-only (Hard Gate 8): no
 *   production / candidate / promotion write, no AGE / loamwise / heartbeat / schema
 *   mutation. Expected `bound=0` at 1c runtime is BY-DESIGN (SPEC §1.3 F5).
 *
 * PHASE 2a-β (trialing 后果面, SPEC `.planning/phase-2a-beta/SPEC.md` blob d1b11bae):
 *   After a trial is written (live), F3 appends trial_id to the bound policy's
 *   learned_policy_ghl_v1.trial_history (back-reference, observability-only — NOT a
 *   promotion/content/status write) and F2 recomputes confidence via the FROZEN
 *   ghl_confidence_v1 formula. The in-place YAML write targets ONLY compliant GHL
 *   sandbox/candidate instances; production/disabled/quarantine + legacy (no confidence_basis)
 *   are SKIPPED (report-only: production 0-diff + no legacy YAML rewrite). verdict stays
 *   NEEDS_HUMAN; confidence is an orthogonal readiness dimension, NOT a promotion gate.
 *
 * REUSE (SPEC: do not self-implement canonicalization):
 *   canonical_record_hash is recomputed via canonical_json.mjs `hashCanonical`.
 *   For a raw conflict event (incoming.json = the 20 event fields, no importer
 *   fields), hashCanonical(eventAst) == the 1b canonical_record_hash invariant
 *   (import_facts.computeCanonicalRecordHash drops only the 4 importer fields,
 *   none of which are present in incoming.json). We deliberately depend on the
 *   SPEC-named canonical module, not on import_facts internals.
 */

import {
  readFileSync, readdirSync, existsSync, realpathSync, writeFileSync,
  lstatSync, readlinkSync, mkdirSync, openSync, writeSync, closeSync, appendFileSync,
} from 'fs';
import { join, dirname, resolve, sep, relative } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { parse as parseYaml, parseDocument } from 'yaml';
import Ajv from 'ajv';

import {
  parseCanonical, hashCanonical, getEntry, astToValue,
} from '../../.claude/scripts/learning/canonical_json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

// --------------------------------------------------------------------------- //
// Locked constants
// --------------------------------------------------------------------------- //

export const SCHEMA_VERSION = '1.0.0';

// RFC 4122 URL namespace + the policy_trial.v1 contract $id -> the GHL trial namespace.
const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
export const POLICY_TRIAL_V1_URI = 'https://liye.com/contracts/learning/policy_trial.v1';

// Default I/O paths (repo-relative; resolved under rootDir test seam).
const DEFAULT_RECORDS = 'state/memory/facts/fact_run_outcome_records.jsonl';
const DEFAULT_CONFLICTS = 'state/runtime/learning/fact_conflicts';
const DEFAULT_POLICIES = 'state/memory/learned/policies';
const DEFAULT_TRIALS_OUT = 'state/runtime/learning/policy_trials.jsonl';
const EVIDENCE_LEDGER_DIR = 'state/runtime/learning/policy_trials_evidence';

// Heartbeat live-state path for the Phase 2a-α `--mode live` authorization gate (§2a.3).
// The literal is copied (NOT imported from the 1d File-A runner) to avoid creating a
// 1c->1d module coupling that would expand the blast radius (SPEC red-team L2-1). The
// learning/ tree is the CODE-SSOT; the schema header's proactive/ path is a v1-dormant
// decoy and is NEVER read here (red-team L1-3).
const LIVE_STATE_REL = 'state/runtime/learning/heartbeat_learning_state.json';

// learned_policy lifecycle dirs (binding scan target). Both legacy + GHL schema
// instances live here and both carry evidence[].trace_id (SPEC §0 N0).
const POLICY_STATUS_DIRS = ['sandbox', 'candidate', 'production', 'disabled', 'quarantine'];

// Phase 2a-β F3 trial_history write-back is permitted ONLY to these lifecycle dirs
// (SPEC §1 F3 production/legacy guard, red-team fold): an in-place YAML mutation of a
// production/disabled/quarantine instance would break DoD#9 "production dir 内容 0-diff"
// and, for a legacy instance lacking the GHL-required confidence_basis, fail re-validation.
// Those instances are SKIPPED (recorded in report.trial_history_skipped, observability-only).
const TRIAL_HISTORY_WRITABLE_STATUS = ['sandbox', 'candidate'];

// Phase 2a-β F2 confidence: the FROZEN ghl_confidence_v1 formula contract (read-only;
// confidence_formulas.yaml is NEVER mutated — §2 R-β1, blob 9b8c2044). The evaluator is a
// faithful interpreter of the contract's inputs/weights/missing_input_policy/boundary policy,
// so the literal weights are NOT hardcoded here (single SSOT = the contract file).
const CONFIDENCE_FORMULAS_REL = '_meta/contracts/learning/confidence_formulas.yaml';
const GHL_POLICY_SCHEMA_REL = '_meta/contracts/learning/learned_policy_ghl_v1.schema.yaml';

// Legacy-alias divergence threshold (confidence_formulas legacy_aliases: WARN > 5%).
const LEGACY_ALIAS_DIVERGENCE_THRESHOLD = 0.05;

// Stricter-than-emit repo-relative path regex for artifact-deref (mirrors 1b
// import_facts STRICT_PATH_RE: no leading '/' or '~', no '..' segment).
const STRICT_PATH_RE = /^(?![~/])(?!.*\.\.)[a-zA-Z0-9_./-]+$/;

// The ONLY reason codes referenced by this module (SPEC A5: the other 7 negative
// codes + the 8th non-negative all-clear code have ZERO code reference here --
// surgical, no scaffolding; enforced by a grep assertion in the test suite).
const REASON_DUPLICATE_CONFLICT = 'duplicate_conflict';
const REASON_SOURCE_DIRTY = 'source_dirty';
const REASON_MANIFEST_VALIDATOR_FAILED = 'manifest_validator_failed';

// bound_via channels (SPEC §1.3).
const BOUND_VIA_CONFLICT_TRACE = 'conflict_trace_evidence';
const BOUND_VIA_ARTIFACT_DEREF = 'artifact_deref';

const EXIT = { SUCCESS: 0, FAIL_CLOSED: 2, UNEXPECTED: 1 };

// --------------------------------------------------------------------------- //
// uuidv5 (RFC 4122, sha1-based, dependency-free). NOT canonicalization; a
// standard deterministic hash-to-UUID. Verified against the published vectors
// uuidv5(DNS,"python.org") and uuidv5(DNS,"example.com") in the test suite.
// --------------------------------------------------------------------------- //

export function uuidv5(name, namespaceUuid) {
  const nsHex = String(namespaceUuid).replace(/-/g, '');
  if (nsHex.length !== 32 || /[^0-9a-fA-F]/.test(nsHex)) {
    throw new Error(`uuidv5: bad namespace uuid ${namespaceUuid}`);
  }
  const nsBytes = Buffer.from(nsHex, 'hex');
  const nameBytes = Buffer.from(String(name), 'utf-8');
  const digest = createHash('sha1').update(Buffer.concat([nsBytes, nameBytes])).digest();
  const out = Buffer.from(digest.subarray(0, 16));
  out[6] = (out[6] & 0x0f) | 0x50; // version 5
  out[8] = (out[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = out.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Pinned GHL trial namespace (SPEC A4: pin the computed literal + assert in test).
export const NAMESPACE_GHL = uuidv5(POLICY_TRIAL_V1_URI, NAMESPACE_URL);
export const NAMESPACE_GHL_PINNED = '639e6922-8cd2-5f67-807d-f2759a14ad20';

/** trial_id = uuidv5(NAMESPACE_GHL, canonical_record_hash + "|" + policy_id) (SPEC A4; no verdict_context_tag). */
export function computeTrialId(canonicalRecordHash, policyId) {
  return uuidv5(`${canonicalRecordHash}|${policyId}`, NAMESPACE_GHL);
}

// --------------------------------------------------------------------------- //
// Path defense for artifact-deref (SPEC §1.3 channel 2).
//
// `resolveSymlinksAllowingMissing` is reproduced VERBATIM from the FROZEN 1b
// import_facts.mjs (CODE-SSOT). It is module-private there and cannot be
// exported without modifying a frozen Phase-1b artifact (Hard NO), so the
// proven dangling-symlink defense is reproduced here. DO NOT diverge; if the 1b
// implementation changes, sync this copy. (1b adversarial finding #1: a naive
// realpath walk treats a dangling-outside symlink as a safe missing leaf and
// lets it escape; this resolver follows the link TEXT even when the target is
// missing, so 1c/1d dereferencing consumers inherit the same trust boundary.)
// --------------------------------------------------------------------------- //

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
 * Resolve a repo-relative artifact path within the engine repo. Lexical strict
 * regex always; realpath must stay within the engine repo (symlink-escape
 * defense). Returns the resolved absolute path if safe, else null.
 */
function resolveArtifactWithinRepo(engineRepoReal, relPath) {
  if (!engineRepoReal || typeof relPath !== 'string' || !STRICT_PATH_RE.test(relPath)) return null;
  const abs = resolve(engineRepoReal, relPath);
  const real = resolveSymlinksAllowingMissing(abs);
  if (real !== engineRepoReal && !real.startsWith(engineRepoReal + sep)) return null; // escape
  return real;
}

// --------------------------------------------------------------------------- //
// Schema validation (ajv Draft-07; matches 1b: strict off, no format).
// policy_trial_v1 references operator_feedback_v1 via a relative $ref; ajv must
// have that schema registered under the resolved absolute URI before compile.
// --------------------------------------------------------------------------- //

export function buildTrialValidator(projectRoot = PROJECT_ROOT) {
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
  const opSchema = parseYaml(readFileSync(
    join(projectRoot, '_meta/contracts/learning/operator_feedback_v1.schema.yaml'), 'utf-8'));
  const trialSchema = parseYaml(readFileSync(
    join(projectRoot, '_meta/contracts/learning/policy_trial_v1.schema.yaml'), 'utf-8'));
  // Resolved base of the relative $ref `operator_feedback_v1.schema.yaml#`
  // against the policy_trial.v1 $id (last path segment replaced).
  ajv.addSchema(opSchema, 'https://liye.com/contracts/learning/operator_feedback_v1.schema.yaml');
  return ajv.compile(trialSchema);
}

function firstError(validate) {
  const e = validate.errors && validate.errors[0];
  if (!e) return 'schema invalid';
  return `${e.instancePath || '<root>'} ${e.message}`;
}

// --------------------------------------------------------------------------- //
// Policy binding index: trace_id -> Set<policy_id> (SPEC §1.3 channel 1).
// --------------------------------------------------------------------------- //

export function buildPolicyTraceIndex(policiesDirAbs) {
  const index = new Map();
  if (!existsSync(policiesDirAbs)) return index;
  for (const status of POLICY_STATUS_DIRS) {
    const statusDir = join(policiesDirAbs, status);
    if (!existsSync(statusDir)) continue;
    let names;
    try { names = readdirSync(statusDir); } catch { continue; }
    for (const name of names) {
      if (!name.endsWith('.yaml') && !name.endsWith('.yml')) continue;
      let doc;
      try { doc = parseYaml(readFileSync(join(statusDir, name), 'utf-8')); } catch { continue; }
      if (!doc || typeof doc.policy_id !== 'string' || !Array.isArray(doc.evidence)) continue;
      for (const ev of doc.evidence) {
        if (ev && typeof ev.trace_id === 'string') {
          if (!index.has(ev.trace_id)) index.set(ev.trace_id, new Set());
          index.get(ev.trace_id).add(doc.policy_id);
        }
      }
    }
  }
  return index;
}

// --------------------------------------------------------------------------- //
// Verdict + provenance overlay derivation (SPEC §1.4 / §1.6).
// --------------------------------------------------------------------------- //

/**
 * 情形2 verdict reason codes = [duplicate_conflict] + provenance overlay.
 *   - source_dirty: from the INCOMING event field (SPEC §1.4 "incoming ... source_dirty").
 *   - manifest_validator_failed: from the ORIGINAL stored record's provenance
 *     (the only place manifest_validator_status exists; the raw incoming event
 *     has no validator status, which the importer computes at ingest time).
 * Returns { reasonCodes, provenanceReasons, provenanceDirty }.
 */
export function deriveVerdictReasonCodes(incomingObj, originalObj) {
  const reasonCodes = [REASON_DUPLICATE_CONFLICT];
  const provenanceReasons = [];

  if (incomingObj && incomingObj.source_dirty === true) {
    reasonCodes.push(REASON_SOURCE_DIRTY);
    provenanceReasons.push('source_dirty');
  }

  const validatorStatus = originalObj && originalObj.provenance
    ? originalObj.provenance.manifest_validator_status : undefined;
  if (validatorStatus !== undefined && validatorStatus !== 'PASS') {
    reasonCodes.push(REASON_MANIFEST_VALIDATOR_FAILED);
    provenanceReasons.push(`manifest_validator_status=${validatorStatus}`);
  }

  const originalDirty = !!(originalObj && originalObj.provenance
    && originalObj.provenance.provenance_dirty === true);
  const provenanceDirty = provenanceReasons.length > 0 || originalDirty;
  if (provenanceDirty && provenanceReasons.length === 0) {
    provenanceReasons.push('original_record_provenance_dirty');
  }
  return { reasonCodes, provenanceReasons, provenanceDirty };
}

/**
 * evidence_origin derivation (SPEC §1.7 / A8):
 *   regression_replay_result -> golden_regression; else default
 *   (production_observed; test seam may pass `synthetic`).
 */
export function deriveEvidenceOrigin(incomingObj, evidenceOriginDefault) {
  if (incomingObj && incomingObj.artifact_type === 'regression_replay_result') {
    return 'golden_regression';
  }
  return evidenceOriginDefault || 'production_observed';
}

// --------------------------------------------------------------------------- //
// Sinks (live-mode only). Trials append; evidence-ledger O_EXCL append-once.
// --------------------------------------------------------------------------- //

function nowIso() { return new Date().toISOString(); } // ...Z == +00:00 offset

/** Write a file with O_CREAT|O_EXCL (append-once). Returns true if written, false if it already existed. */
function writeExclusive(filePath, data) {
  let fd;
  try { fd = openSync(filePath, 'wx'); }
  catch (err) { if (err.code === 'EEXIST') return false; throw err; }
  try { writeSync(fd, data); } finally { closeSync(fd); }
  return true;
}

/**
 * Serialize the evidence-ledger side-car (hand-built, mirrors 1b conflict_meta style).
 * String scalars sourced from event / policy inputs are emitted via JSON.stringify,
 * which produces a valid YAML 1.2 double-quoted scalar (YAML and JSON share the
 * same escaping for ", \, control chars, and U+2028/U+2029). A hostile or corrupt
 * trace_id / policy_id / validator-status string therefore cannot break the YAML
 * or inject keys -- the importer is the trust boundary, but the evaluator must not
 * assume its inputs are YAML-safe. bound_via and provenance_dirty are controlled
 * module values (enum constant / boolean).
 */
function ledgerToYaml(ledger) {
  const q = (v) => JSON.stringify(String(v));
  const reasons = ledger.provenance_reasons.map((r) => q(r)).join(', ');
  return [
    `trial_id: ${q(ledger.trial_id)}`,
    `policy_id: ${q(ledger.policy_id)}`,
    `canonical_record_hash: ${q(ledger.canonical_record_hash)}`,
    `source_event_identity_key: ${q(ledger.source_event_identity_key)}`,
    `trace_id: ${q(ledger.trace_id)}`,
    `bound_via: ${ledger.bound_via}`,
    `provenance_dirty: ${ledger.provenance_dirty ? 'true' : 'false'}`,
    `provenance_reasons: [${reasons}]`,
    `conflict_dir: ${q(ledger.conflict_dir)}`,
    `evaluated_at: ${q(ledger.evaluated_at)}`,
    '',
  ].join('\n');
}

// --------------------------------------------------------------------------- //
// Engine repo resolution (artifact-deref realpath base).
// --------------------------------------------------------------------------- //

function resolveEngineRepo(explicit, rootDir) {
  if (explicit) return existsSync(explicit) ? realpathSync(explicit) : null;
  const sibling = join(rootDir, '..', 'amazon-growth-engine');
  return existsSync(sibling) ? realpathSync(sibling) : null;
}

// --------------------------------------------------------------------------- //
// Idempotency: rebuild the seen trial_id set from policy_trials.jsonl (SPEC A2;
// single SSOT, no separate cursor file -> full-re-run idempotent).
// --------------------------------------------------------------------------- //

export function buildSeenTrialIds(trialsOutAbs) {
  const seen = new Set();
  if (!existsSync(trialsOutAbs)) return seen;
  for (const line of readFileSync(trialsOutAbs, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try { obj = JSON.parse(trimmed); } catch { continue; }
    if (obj && typeof obj.trial_id === 'string') seen.add(obj.trial_id);
  }
  return seen;
}

// --------------------------------------------------------------------------- //
// Conflict iteration (fact_conflicts/<source_system>/<identityHex>/).
// --------------------------------------------------------------------------- //

function listConflictDirs(conflictsBaseAbs) {
  const out = [];
  if (!existsSync(conflictsBaseAbs)) return out;
  let systems;
  try { systems = readdirSync(conflictsBaseAbs, { withFileTypes: true }); } catch { return out; }
  for (const sys of systems.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!sys.isDirectory()) continue;
    const sysDir = join(conflictsBaseAbs, sys.name);
    let ids;
    try { ids = readdirSync(sysDir, { withFileTypes: true }); } catch { continue; }
    for (const id of ids.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (!id.isDirectory()) continue;
      out.push({ sourceSystem: sys.name, identityHex: id.name, dir: join(sysDir, id.name) });
    }
  }
  return out;
}

// --------------------------------------------------------------------------- //
// Core: process one conflict (情形2 -> NEEDS_HUMAN trial(s)).
// --------------------------------------------------------------------------- //

function processConflict(ctx, conflictInfo) {
  const { report } = ctx;
  const incomingPath = join(conflictInfo.dir, 'incoming.json');
  const originalPath = join(conflictInfo.dir, 'original.json');
  if (!existsSync(incomingPath)) {
    report.fail_closed += 1;
    report.per_fail_closed.push({ reason: 'conflict missing incoming.json', conflict_dir: conflictInfo.dir });
    return;
  }
  report.conflicts_scanned += 1;

  const incomingText = readFileSync(incomingPath, 'utf-8');
  let incomingAst;
  try { incomingAst = parseCanonical(incomingText); }
  catch (err) {
    report.fail_closed += 1;
    report.per_fail_closed.push({ reason: `incoming canonicalization failed: ${err.message}`, conflict_dir: conflictInfo.dir });
    return;
  }
  const incomingObj = astToValue(incomingAst);
  const traceId = typeof incomingObj.trace_id === 'string' ? incomingObj.trace_id : null;
  // canonical_record_hash of the incoming event (1b invariant; token-preserving).
  const canonicalRecordHash = hashCanonical(incomingAst);

  let originalObj = null;
  if (existsSync(originalPath)) {
    try { originalObj = JSON.parse(readFileSync(originalPath, 'utf-8')); } catch { originalObj = null; }
  }

  // Binding (A6 explicit-reference-only): trace_id -> policy_id(s).
  const policyIds = (traceId && ctx.policyIndex.has(traceId))
    ? [...ctx.policyIndex.get(traceId)].sort()
    : [];
  if (policyIds.length === 0) {
    report.unbound += 1;
    return; // no explicit reference -> no trial (fail-closed, expected bind=0)
  }
  report.bound += 1;
  report.metrics.bound_via_distribution[BOUND_VIA_CONFLICT_TRACE] += 1;

  const overlay = deriveVerdictReasonCodes(incomingObj, originalObj);
  const evidenceOrigin = deriveEvidenceOrigin(incomingObj, ctx.evidenceOriginDefault);
  const conflictDirRel = relative(ctx.rootDir, conflictInfo.dir);

  for (const policyId of policyIds) {
    emitPolicyTrial(ctx, {
      canonicalRecordHash,
      policyId,
      traceId,
      eventIdentityKey: typeof incomingObj.event_identity_key === 'string' ? incomingObj.event_identity_key : '',
      reasonCodes: overlay.reasonCodes,
      provenanceReasons: overlay.provenanceReasons,
      provenanceDirty: overlay.provenanceDirty,
      evidenceOrigin,
      boundVia: BOUND_VIA_CONFLICT_TRACE,
      conflictDirRel,
    });
  }
}

function emitPolicyTrial(ctx, p) {
  const { report } = ctx;
  const trialId = computeTrialId(p.canonicalRecordHash, p.policyId);

  if (ctx.seenTrialIds.has(trialId)) {
    report.trials_skipped_idempotent += 1;
    return;
  }

  const policyTrial = {
    trial_id: trialId,
    policy_id: p.policyId,
    system_verdict: 'NEEDS_HUMAN',
    system_verdict_reason_codes: p.reasonCodes,
    evidence_origin: p.evidenceOrigin,
    evaluated_at: nowIso(),
    schema_version: SCHEMA_VERSION,
  };

  if (!ctx.validateTrial(policyTrial)) {
    report.fail_closed += 1;
    report.per_fail_closed.push({ trial_id: trialId, policy_id: p.policyId, reason: `trial schema-invalid: ${firstError(ctx.validateTrial)}` });
    return; // fail-closed: never write a half-baked trial
  }

  const ledgerRelPath = join(EVIDENCE_LEDGER_DIR, `${trialId}.yaml`);
  const ledger = {
    trial_id: trialId,
    policy_id: p.policyId,
    canonical_record_hash: p.canonicalRecordHash,
    source_event_identity_key: p.eventIdentityKey,
    trace_id: p.traceId || '',
    bound_via: p.boundVia,
    provenance_dirty: p.provenanceDirty,
    provenance_reasons: p.provenanceReasons,
    conflict_dir: p.conflictDirRel,
    evaluated_at: policyTrial.evaluated_at,
  };

  // Register before write so repeated identities within the same run skip
  // (full-re-run idempotent semantics; applies to dry_run and live alike).
  ctx.seenTrialIds.add(trialId);

  report.trials_new += 1;
  report.needs_human += 1;
  report.metrics.verdict_distribution.NEEDS_HUMAN = (report.metrics.verdict_distribution.NEEDS_HUMAN || 0) + 1;
  report.metrics.evidence_origin_distribution[p.evidenceOrigin] =
    (report.metrics.evidence_origin_distribution[p.evidenceOrigin] || 0) + 1;
  report.per_trial.push({
    trial_id: trialId,
    policy_id: p.policyId,
    system_verdict: 'NEEDS_HUMAN',
    system_verdict_reason_codes: p.reasonCodes,
    evidence_origin: p.evidenceOrigin,
    bound_via: p.boundVia,
    evidence_ledger_path: ledgerRelPath,
  });

  if (ctx.mode === 'live') {
    mkdirSync(dirname(ctx.trialsOutAbs), { recursive: true });
    appendFileSync(ctx.trialsOutAbs, JSON.stringify(policyTrial) + '\n');
    const ledgerDir = join(ctx.rootDir, EVIDENCE_LEDGER_DIR);
    mkdirSync(ledgerDir, { recursive: true });
    writeExclusive(join(ledgerDir, `${trialId}.yaml`), ledgerToYaml(ledger));
  }

  // Phase 2a-β F2 + F3: trial-consequence application for the bound policy (compute
  // confidence -> report in both modes; trial_history + confidence write-back only in live,
  // only to compliant GHL sandbox/candidate). "先 trial 后 history": the trial is already
  // written above; a history write-back failure does NOT roll back the trial (trial = SSOT,
  // history = derived index rebuildable from policy_trials.jsonl, SPEC §1 F3 partial-write).
  applyTrialConsequences(ctx, p.policyId, trialId);
}

// --------------------------------------------------------------------------- //
// Records scan: metrics + artifact-deref binding REHEARSAL (forward-carrying;
// produces NO trial in 1c -- SPEC §1.2 / §1.3 channel 2 "implemented but 0 fire").
// --------------------------------------------------------------------------- //

function processRecords(ctx, recordsAbs) {
  const { report } = ctx;
  if (!existsSync(recordsAbs)) return;
  const text = readFileSync(recordsAbs, 'utf-8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ast;
    try { ast = parseCanonical(trimmed); } // token-preserving (no JSON.parse->Number)
    catch { report.records_malformed += 1; continue; }
    report.records_scanned += 1;

    const artifactTypeNode = getEntry(ast, 'artifact_type');
    const artifactType = artifactTypeNode && artifactTypeNode.t === 'str' ? artifactTypeNode.value : null;
    if (artifactType !== 'policy_suggestions_json') continue; // only this type drives artifact-deref

    const refNode = getEntry(ast, 'raw_payload_ref');
    const rawPayloadRef = refNode && refNode.t === 'str' ? refNode.value : null;
    const policyId = derefPolicySuggestion(ctx, rawPayloadRef);
    if (policyId) {
      report.bound += 1;
      report.metrics.bound_via_distribution[BOUND_VIA_ARTIFACT_DEREF] += 1;
      // NOTE: artifact-deref is forward-carrying for 1d/2a; it does NOT fire a
      // trial in 1c (the only 1c fire path is duplicate_conflict 情形2).
    } else {
      report.unbound += 1;
    }
  }
}

function derefPolicySuggestion(ctx, rawPayloadRef) {
  const real = resolveArtifactWithinRepo(ctx.engineRepoReal, rawPayloadRef);
  if (!real || !existsSync(real)) return null;
  let artifact;
  try { artifact = JSON.parse(readFileSync(real, 'utf-8')); } catch { return null; }
  if (artifact && typeof artifact.policy_id === 'string') return artifact.policy_id;
  return null;
}

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

function absUnder(rootDir, p) {
  return p.startsWith('/') ? p : join(rootDir, p);
}

/**
 * Phase 2a-α `--mode live` authorization二次门 (SPEC §2a.3 / §0.1-6, ship≠activation §0.1-8).
 * In live mode the evaluator writes only when the heartbeat live state has been
 * operator-flipped into a strict trialing posture. Four fail-closed conditions, all ->
 * not_authorized_for_live (0 trial written):
 *   1. live state file absent (merge-but-not-yet-activated; the default idle posture);
 *   2. shape error: unparseable JSON (try/catch-wrapped so a parse throw maps to
 *      not_authorized / exit 2, NOT a propagated exit 1, red-team L5-1), version !== 2
 *      (STRICT integer; "2"/missing/other denies, no type coercion, red-team L3-5), or
 *      missing current_phase;
 *   3. trial_write_enabled !== true;
 *   4. current_phase !== 'trialing' (defense-in-depth vs an operator-hand-written state
 *      where trial_write=true but candidate_write=true would derive candidate_writing,
 *      not trialing -- conditions 3/4 are non-redundant, red-team L3-4).
 * Read-only: this never spawns or imports the heartbeat runner; it only reads the JSON.
 */
function authorizeLiveWrite(rootDir) {
  const liveStatePath = join(rootDir, LIVE_STATE_REL);
  if (!existsSync(liveStatePath)) {
    return { authorized: false, detail: `heartbeat live state absent (${LIVE_STATE_REL}); run bootstrap + operator flip per RUNBOOK §2.2` };
  }
  let state;
  try {
    state = JSON.parse(readFileSync(liveStatePath, 'utf-8'));
  } catch (err) {
    return { authorized: false, detail: `heartbeat live state unparseable: ${err.message}` };
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { authorized: false, detail: 'heartbeat live state is not a JSON object' };
  }
  if (state.version !== 2) {
    return { authorized: false, detail: `heartbeat live state version !== 2 (got ${JSON.stringify(state.version)})` };
  }
  if (typeof state.current_phase !== 'string') {
    return { authorized: false, detail: 'heartbeat live state missing current_phase' };
  }
  if (state.trial_write_enabled !== true) {
    return { authorized: false, detail: `trial_write_enabled !== true (got ${JSON.stringify(state.trial_write_enabled)})` };
  }
  if (state.current_phase !== 'trialing') {
    return { authorized: false, detail: `current_phase !== 'trialing' (got ${JSON.stringify(state.current_phase)})` };
  }
  return { authorized: true, detail: null };
}

// --------------------------------------------------------------------------- //
// Phase 2a-β F2 (confidence) + F3 (trial_history write-back). evaluator carve-out.
// --------------------------------------------------------------------------- //

/**
 * policy_id -> { absPath, status } over the lifecycle dirs (SPEC §1 F3/F2 write target).
 * Distinct from buildPolicyTraceIndex (which maps trace_id -> policy_id and discards the
 * file location); F3/F2 need the file path + status to write back / guard production.
 */
export function buildPolicyFileIndex(policiesDirAbs) {
  const index = new Map();
  if (!existsSync(policiesDirAbs)) return index;
  for (const status of POLICY_STATUS_DIRS) {
    const statusDir = join(policiesDirAbs, status);
    if (!existsSync(statusDir)) continue;
    let names;
    try { names = readdirSync(statusDir); } catch { continue; }
    for (const name of names) {
      if (!name.endsWith('.yaml') && !name.endsWith('.yml')) continue;
      const absPath = join(statusDir, name);
      let doc;
      try { doc = parseYaml(readFileSync(absPath, 'utf-8')); } catch { continue; }
      if (!doc || typeof doc.policy_id !== 'string') continue;
      // First-writer-wins on duplicate policy_id; binding already requires uniqueness upstream.
      if (!index.has(doc.policy_id)) index.set(doc.policy_id, { absPath, status });
    }
  }
  return index;
}

/** Load the FROZEN ghl_confidence_v1 formula contract (read-only). Returns the formula object. */
export function loadConfidenceFormula(projectRoot = PROJECT_ROOT) {
  const doc = parseYaml(readFileSync(join(projectRoot, CONFIDENCE_FORMULAS_REL), 'utf-8'));
  const formula = doc && doc.formulas && doc.formulas.ghl_confidence_v1;
  if (!formula || !formula.inputs || !formula.weights) {
    throw new Error('confidence_formulas.yaml: ghl_confidence_v1 inputs/weights missing');
  }
  return formula;
}

/** Resolve a "$.a.b" JSON-pointer-style path against a plain object. Returns undefined if absent. */
function resolveDollarPath(doc, path) {
  if (typeof path !== 'string' || !path.startsWith('$.')) return undefined;
  let cur = doc;
  for (const seg of path.slice(2).split('.')) {
    if (cur === null || typeof cur !== 'object' || !(seg in cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/**
 * Compute confidence via the FROZEN ghl_confidence_v1 contract (faithful interpreter; no
 * hardcoded weights). Honors missing_input_policy: fail_closed and boundary_output_policy.
 * Returns one of:
 *   { status: 'ok', value, boundary_review, divergence_warn }
 *   { status: 'unavailable', reason }   (a required input missing/non-number -> fail_closed)
 */
export function computeGhlConfidence(doc, formula) {
  let sum = 0;
  for (const [key, path] of Object.entries(formula.inputs)) {
    const v = resolveDollarPath(doc, path);
    if (typeof v !== 'number' || Number.isNaN(v)) {
      return { status: 'unavailable', reason: `missing/non-numeric input ${key} (${path})` };
    }
    const w = formula.weights[key];
    if (typeof w !== 'number') return { status: 'unavailable', reason: `missing weight ${key}` };
    sum += w * v;
  }
  // boundary_output_policy: 0.0 / 1.0 -> requires_review (NOT auto-accept).
  const boundaryValues = (formula.boundary_output_policy && formula.boundary_output_policy.values) || [];
  const boundary_review = boundaryValues.some((b) => b === sum);
  // legacy_alias divergence (>5% over 30d; instantaneous proxy here — history not available).
  let divergence_warn = false;
  const aliases = formula.legacy_aliases || {};
  const canonical = resolveDollarPath(doc, formula.inputs.operator_agreement_rate);
  for (const aliasPath of Object.values(aliases)) {
    const legacy = resolveDollarPath(doc, aliasPath);
    if (typeof canonical === 'number' && typeof legacy === 'number'
      && Math.abs(canonical - legacy) > LEGACY_ALIAS_DIVERGENCE_THRESHOLD) {
      divergence_warn = true;
    }
  }
  return { status: 'ok', value: sum, boundary_review, divergence_warn };
}

/** ajv validator for learned_policy_ghl_v1 (inline schema, no $ref). Matches 1b ajv flags. */
export function buildGhlPolicyValidator(projectRoot = PROJECT_ROOT) {
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
  const schema = parseYaml(readFileSync(join(projectRoot, GHL_POLICY_SCHEMA_REL), 'utf-8'));
  return ajv.compile(schema);
}

/**
 * F2 + F3 consequence application for one bound policy after its trial was emitted
 * (SPEC §1 F2/F3). Compute confidence (readiness, both modes -> report). Write trial_history
 * append + recomputed confidence back ONLY in live mode AND only to a compliant GHL instance
 * in a writable lifecycle dir (sandbox/candidate). production/disabled/quarantine and legacy
 * (missing confidence_basis) instances are SKIPPED (report-only; production 0-diff + no legacy
 * YAML rewrite, §1 F3/F2 guards). The in-place write re-validates against learned_policy_ghl_v1
 * before persisting (fail-closed: never write a half-baked policy doc).
 */
function applyTrialConsequences(ctx, policyId, trialId) {
  const { report } = ctx;
  const entry = ctx.policyFileIndex.get(policyId);
  if (!entry) {
    // Bound via trace index but file vanished mid-run — observability only, not a write target.
    report.trial_history_skipped.push({ policy_id: policyId, trial_id: trialId, reason: 'policy file not found' });
    return;
  }
  let doc;
  try { doc = parseYaml(readFileSync(entry.absPath, 'utf-8')); }
  catch (err) {
    report.fail_closed += 1;
    report.per_fail_closed.push({ policy_id: policyId, reason: `policy YAML unreadable: ${err.message}` });
    return;
  }

  const isGhl = doc && typeof doc.confidence_basis === 'object' && doc.confidence_basis !== null;

  // F2 — confidence (forward-only; legacy missing confidence_basis -> fail_closed skip).
  if (!isGhl) {
    // missing_input_policy: fail_closed (confidence_formulas) -> report confidence_unavailable + non-zero exit.
    // NOT an in-place legacy YAML rewrite (D-β3 forward-only); backfill is a deferred sidecar option.
    report.per_confidence.push({ policy_id: policyId, status: 'unavailable', reason: 'legacy: confidence_basis absent' });
    report.confidence_unavailable += 1;
    report.fail_closed += 1;
    report.per_fail_closed.push({ policy_id: policyId, reason: 'confidence_unavailable' });
    report.trial_history_skipped.push({ policy_id: policyId, trial_id: trialId, reason: 'legacy_missing_confidence_basis' });
    return;
  }

  const conf = computeGhlConfidence(doc, ctx.confidenceFormula);
  report.per_confidence.push({ policy_id: policyId, ...conf });
  if (conf.status === 'unavailable') {
    report.confidence_unavailable += 1;
    report.fail_closed += 1;
    report.per_fail_closed.push({ policy_id: policyId, reason: `confidence_unavailable: ${conf.reason}` });
    report.trial_history_skipped.push({ policy_id: policyId, trial_id: trialId, reason: 'confidence_unavailable' });
    return;
  }
  if (conf.boundary_review) report.confidence_boundary_review.push({ policy_id: policyId, confidence: conf.value });
  if (conf.divergence_warn) report.confidence_divergence_warn.push({ policy_id: policyId });

  // F3 — trial_history write-back guard: only sandbox/candidate; production/disabled/quarantine skip.
  if (!TRIAL_HISTORY_WRITABLE_STATUS.includes(entry.status)) {
    report.trial_history_skipped.push({ policy_id: policyId, trial_id: trialId, reason: `status=${entry.status} not writable (production 0-diff)` });
    return;
  }

  // dry_run: readiness preview only (0 disk write) — report intent.
  if (ctx.mode !== 'live') {
    report.trial_history_pending.push({ policy_id: policyId, trial_id: trialId });
    return;
  }

  // live: in-place YAML mutation (preserve formatting/comments via Document API).
  // idempotency: append trial_id only if not already present.
  let outerDoc;
  try { outerDoc = parseDocument(readFileSync(entry.absPath, 'utf-8')); }
  catch (err) {
    report.fail_closed += 1;
    report.per_fail_closed.push({ policy_id: policyId, reason: `policy doc unparseable for write-back: ${err.message}` });
    return;
  }
  const history = Array.isArray(doc.trial_history) ? doc.trial_history : [];
  const alreadyPresent = history.includes(trialId);
  const nextHistory = alreadyPresent ? history : [...history, trialId];
  outerDoc.setIn(['trial_history'], nextHistory);
  outerDoc.setIn(['confidence'], conf.value);

  // re-validate the would-be-written doc against learned_policy_ghl_v1 BEFORE persisting.
  const candidateDoc = outerDoc.toJSON();
  if (!ctx.validateGhlPolicy(candidateDoc)) {
    report.fail_closed += 1;
    report.per_fail_closed.push({ policy_id: policyId, reason: `trial_history write-back re-validation failed: ${firstError(ctx.validateGhlPolicy)}` });
    report.trial_history_skipped.push({ policy_id: policyId, trial_id: trialId, reason: 're-validation_failed' });
    return; // fail-closed: never persist an invalid policy doc
  }
  writeFileSync(entry.absPath, String(outerDoc));
  if (alreadyPresent) {
    report.trial_history_idempotent_skip += 1;
  } else {
    report.trial_history_written.push({ policy_id: policyId, trial_id: trialId });
  }
}

/**
 * Evaluate policy trials from 1b importer output. In dry_run (default) NOTHING is
 * written to disk (binding + verdict + build + validate + would-write only).
 *
 * @param {object} options
 * @param {string} [options.records]    records.jsonl path (default state/memory/facts/...)
 * @param {string} [options.conflicts]  fact_conflicts dir (default state/runtime/learning/fact_conflicts)
 * @param {string} [options.policies]   policies dir (default state/memory/learned/policies)
 * @param {string} [options.trialsOut]  policy_trials.jsonl out (default state/runtime/learning/...)
 * @param {string|null} [options.since] ISO8601 convenience filter (non-correctness)
 * @param {'dry_run'|'live'} [options.mode] default 'dry_run'
 * @param {string|null} [options.engineRepo] AGE repo root (artifact-deref realpath); default sibling clone
 * @param {string} [options.evidenceOriginDefault] default evidence_origin (test seam -> 'synthetic')
 * @param {string} [options.rootDir]    liye_os root for data I/O (test seam); default PROJECT_ROOT
 * @returns {object} EvalReport
 */
export function evaluatePolicyTrials(options = {}) {
  const mode = options.mode === 'live' ? 'live' : 'dry_run';
  const rootDir = options.rootDir ? realpathSync(options.rootDir) : PROJECT_ROOT;
  const recordsAbs = absUnder(rootDir, options.records || DEFAULT_RECORDS);
  const conflictsAbs = absUnder(rootDir, options.conflicts || DEFAULT_CONFLICTS);
  const policiesAbs = absUnder(rootDir, options.policies || DEFAULT_POLICIES);
  const trialsOutAbs = absUnder(rootDir, options.trialsOut || DEFAULT_TRIALS_OUT);
  const windowStart = nowIso();

  const ctx = {
    mode,
    rootDir,
    trialsOutAbs,
    evidenceOriginDefault: options.evidenceOriginDefault || 'production_observed',
    engineRepoReal: resolveEngineRepo(options.engineRepo, rootDir),
    validateTrial: buildTrialValidator(PROJECT_ROOT),
    policyIndex: buildPolicyTraceIndex(policiesAbs),
    // Phase 2a-β F2/F3: file-location index + frozen confidence formula + GHL validator.
    policyFileIndex: buildPolicyFileIndex(policiesAbs),
    confidenceFormula: loadConfidenceFormula(PROJECT_ROOT),
    validateGhlPolicy: buildGhlPolicyValidator(PROJECT_ROOT),
    seenTrialIds: buildSeenTrialIds(trialsOutAbs),
    report: null,
  };

  const report = {
    mode,
    records_scanned: 0,
    conflicts_scanned: 0,
    records_malformed: 0,
    bound: 0,
    unbound: 0,
    trials_new: 0,
    trials_skipped_idempotent: 0,
    needs_human: 0,
    fail_closed: 0,
    metrics: {
      verdict_distribution: {},
      evidence_origin_distribution: {},
      bound_via_distribution: { conflict_trace_evidence: 0, artifact_deref: 0 },
    },
    per_trial: [],
    per_fail_closed: [],
    // Phase 2a-β F2/F3 observability (back-reference + confidence readiness).
    trial_history_written: [],      // [{policy_id, trial_id}] persisted in live
    trial_history_skipped: [],      // [{policy_id, trial_id, reason}] production/legacy/non-writable
    trial_history_pending: [],      // [{policy_id, trial_id}] dry_run would-write preview
    trial_history_idempotent_skip: 0,
    per_confidence: [],             // [{policy_id, status, value?, boundary_review?, divergence_warn?, reason?}]
    confidence_unavailable: 0,
    confidence_boundary_review: [], // [{policy_id, confidence}] requires_review sink (machine-checkable)
    confidence_divergence_warn: [], // [{policy_id}] legacy_alias >5% divergence WARN
    live_authorized: true,
    trials_out: trialsOutAbs,
    evidence_ledger_dir: join(rootDir, EVIDENCE_LEDGER_DIR),
    window_start: windowStart,
    window_end: null,
  };
  ctx.report = report;

  // 0) Up-front live authorization二次门 (SPEC §2a.3, ship≠activation): in live mode,
  //    require an operator-flipped trialing heartbeat posture BEFORE processing or
  //    writing any trial. Fail-closed (0 trial) otherwise. dry_run does not authorize
  //    (it writes nothing; 1c behavior preserved).
  if (mode === 'live') {
    const auth = authorizeLiveWrite(rootDir);
    if (!auth.authorized) {
      report.live_authorized = false;
      report.fail_closed += 1;
      report.per_fail_closed.push({ reason: 'not_authorized_for_live', detail: auth.detail });
      report.window_end = nowIso();
      return report; // exit 2 via main() (report.fail_closed > 0); 0 trial written
    }
  }

  // 1) Conflicts = the only trial production source (情形2).
  for (const conflictInfo of listConflictDirs(conflictsAbs)) {
    processConflict(ctx, conflictInfo);
  }
  // 2) Records = metrics + artifact-deref binding rehearsal (0 trials in 1c).
  processRecords(ctx, recordsAbs);

  report.window_end = nowIso();
  return report;
}

/** Class wrapper (whitelisted compound name) around the functional core. */
export class PolicyTrialEvaluator {
  constructor(options = {}) { this.options = options; }
  run() { return evaluatePolicyTrials(this.options); }
}

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //

const HELP = `policy_trial_evaluator.mjs - Phase 1c GHL policy-trial evaluator (dry-run-first)

Usage:
  node policy_trial_evaluator.mjs [options]

Options:
  --records <path>      records.jsonl (default state/memory/facts/fact_run_outcome_records.jsonl)
  --conflicts <dir>     fact_conflicts dir (default state/runtime/learning/fact_conflicts)
  --policies <dir>      learned policies dir (default state/memory/learned/policies)
  --trials-out <path>   policy_trials.jsonl out (default state/runtime/learning/policy_trials.jsonl)
  --since <ISO8601>     Convenience filter (non-correctness)
  --mode <dry_run|live> Default dry_run (0 disk writes). live writes only when the heartbeat
                        live state is operator-flipped to trialing (Phase 2a-α二次门; else
                        fail-closed not_authorized_for_live, exit 2)
  --engine-repo <dir>   Local AGE repo root (artifact-deref realpath); default sibling clone
  --json                Print the EvalReport as JSON on stdout
  --help                Show this help and exit 0

Exit codes:
  0  success (0 fail-closed)
  2  >= 1 trial schema-invalid / canonicalization failure (fail-closed; nothing half-written)
  1  unexpected error
`;

function parseArgs(argv) {
  const opts = {
    records: null, conflicts: null, policies: null, trialsOut: null,
    since: null, mode: 'dry_run', engineRepo: null, json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--records') opts.records = argv[++i];
    else if (a === '--conflicts') opts.conflicts = argv[++i];
    else if (a === '--policies') opts.policies = argv[++i];
    else if (a === '--trials-out') opts.trialsOut = argv[++i];
    else if (a === '--since') opts.since = argv[++i];
    else if (a === '--mode') opts.mode = argv[++i];
    else if (a === '--engine-repo') opts.engineRepo = argv[++i];
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
  let report;
  try {
    report = evaluatePolicyTrials(opts);
  } catch (err) {
    process.stderr.write(`[policy_trial_evaluator] unexpected error: ${err.stack || err.message}\n`);
    return EXIT.UNEXPECTED;
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(
      `[policy_trial_evaluator] mode=${report.mode} conflicts=${report.conflicts_scanned} ` +
      `records=${report.records_scanned} bound=${report.bound} unbound=${report.unbound} ` +
      `trials_new=${report.trials_new} skip=${report.trials_skipped_idempotent} fail_closed=${report.fail_closed}\n`);
    for (const f of report.per_fail_closed) process.stderr.write(`  fail-closed: ${f.reason || JSON.stringify(f)}\n`);
  }
  return report.fail_closed > 0 ? EXIT.FAIL_CLOSED : EXIT.SUCCESS;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) process.exit(main());
