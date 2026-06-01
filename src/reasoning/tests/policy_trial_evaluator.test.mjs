// Phase 1c GHL policy_trial_evaluator tests (Node built-in runner: node:test).
// Run: node --test src/reasoning/tests/policy_trial_evaluator.test.mjs
//
// Excluded from vitest (vitest.config.ts) because this uses node:test.
//
// Coverage mirrors SPEC `.planning/phase-1c/SPEC.md` §4:
//   情形2 e2e / trial_id determinism+idempotency / provenance overlay /
//   binding fail-closed / artifact-deref forward (incl symlink-escape defense) /
//   evidence_origin derivation / sealed-schema validate fail-closed /
//   token-preserving canonical_record_hash invariant / empty input /
//   dry_run 0-write / module zero-reference assertion / uuidv5 vectors.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync,
  readdirSync, symlinkSync,
} from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

import {
  evaluatePolicyTrials, PolicyTrialEvaluator,
  uuidv5, computeTrialId, buildTrialValidator, buildPolicyTraceIndex,
  deriveVerdictReasonCodes, deriveEvidenceOrigin,
  NAMESPACE_GHL, NAMESPACE_GHL_PINNED, SCHEMA_VERSION, POLICY_TRIAL_V1_URI,
} from '../policy_trial_evaluator.mjs';

import {
  parseCanonical, emitCanonical, hashCanonical, sha256Prefixed,
} from '../../../.claude/scripts/learning/canonical_json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVALUATOR_SRC = join(__dirname, '..', 'policy_trial_evaluator.mjs');

// --------------------------------------------------------------------------- //
// Fixture helpers (tmp rootDir seam)
// --------------------------------------------------------------------------- //

function mkRoot() {
  return mkdtempSync(join(tmpdir(), 'pte-'));
}

function mkEvent(overrides = {}) {
  // Minimal raw event sidecar (the fields the evaluator reads). Canonical-ish;
  // hashCanonical re-canonicalizes regardless.
  return {
    artifact_path: 'out/x.json',
    artifact_type: 'verification_json',
    event_identity_key: 'sha256:' + 'a'.repeat(64),
    playbook_ref: 'pb',
    source_commit_sha: 'b'.repeat(40),
    source_dirty: false,
    source_repo: 'amazon-growth-engine',
    source_system: 'amazon-growth-engine',
    step_id: 's1',
    trace_id: 'run-20260530-aaaa1111',
    ...overrides,
  };
}

function mkRecord(overrides = {}) {
  // A stored 24-field-ish record (original.json). Only provenance + a few fields
  // are read by the evaluator.
  return {
    ...mkEvent(),
    ingested_at: '2026-05-30T00:00:00.000Z',
    importer_version: 'discover_new_runs@2.0.0',
    canonical_record_hash: 'sha256:' + 'c'.repeat(64),
    provenance: { manifest_validator_status: 'PASS', provenance_dirty: false },
    ...overrides,
  };
}

function writeConflict(root, sourceSystem, identityHex, incomingObj, originalObj) {
  const dir = join(root, 'state/runtime/learning/fact_conflicts', sourceSystem, identityHex);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'incoming.json'), JSON.stringify(incomingObj));
  if (originalObj !== undefined) {
    writeFileSync(join(dir, 'original.json'), JSON.stringify(originalObj) + '\n');
  }
  return dir;
}

function writeRawConflictIncoming(root, sourceSystem, identityHex, rawText) {
  const dir = join(root, 'state/runtime/learning/fact_conflicts', sourceSystem, identityHex);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'incoming.json'), rawText);
  return dir;
}

function writePolicy(root, status, policyId, traceIds) {
  const dir = join(root, 'state/memory/learned/policies', status);
  mkdirSync(dir, { recursive: true });
  const doc = {
    policy_id: policyId,
    evidence: traceIds.map((t) => ({ trace_id: t, summary: 's' })),
  };
  writeFileSync(join(dir, `${policyId}.yaml`), JSON.stringify(doc, null, 2));
}

function writeRecords(root, recordObjs) {
  const p = join(root, 'state/memory/facts/fact_run_outcome_records.jsonl');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, recordObjs.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

// Phase 2a-β: a minimal schema-VALID learned_policy_ghl_v1 instance (with confidence_basis)
// so F2/F3 trial-consequence application engages (confidence computable + trial_history
// writable). opts.confidence_basis overrides inputs; opts omits confidence_basis -> legacy.
function writeGhlPolicy(root, status, policyId, traceIds, opts = {}) {
  const dir = join(root, 'state/memory/learned/policies', status);
  mkdirSync(dir, { recursive: true });
  const doc = {
    schema_version: '1.0.0', policy_id: policyId, domain: 'amazon-advertising',
    learned_at: '2026-05-30T00:00:00Z',
    scope: { type: 'tenant', keys: { tenant_id: 'default', marketplace: 'US' } },
    risk_level: 'low', validation_status: status === 'sandbox' ? 'sandbox' : status,
    confidence: opts.confidence ?? 0.5,
    preconditions: { match_rules: [{ field: 'acos', operator: 'gt', value: 0.3 }] },
    actions: [{ action_type: 'bid_adjustment', parameters: { delta_pct: -10 }, dry_run_compatible: true }],
    constraints: { max_bid_change_pct: 20, max_actions_per_day: 5 },
    rollback_plan: { type: 'manual', steps: ['restore prior bid'] },
    success_signals: {
      exec: { count: 10, success_rate: opts.exec_success_rate ?? 0.9 },
      operator: { approval_count: 8, rejection_count: 2, approval_rate: opts.approval_rate ?? 0.8 },
      business: { metric_name: 'acos', baseline: 0.3, current: 0.25, improvement_pct: 16.7 },
    },
    evaluation_window_days: 14, expiry_at: '2026-12-31T00:00:00Z',
    evidence: traceIds.map((t) => ({ trace_id: t, summary: 's' })),
  };
  if (opts.legacy !== true) {
    doc.confidence_basis = opts.confidence_basis || {
      operator_agreement_rate: 0.8, business_score: 0.6, regression_pass_rate: 0.9,
    };
  }
  writeFileSync(join(dir, `${policyId}.yaml`), JSON.stringify(doc, null, 2));
  return join(dir, `${policyId}.yaml`);
}

// Seed a synthetic operator-flipped trialing heartbeat live state so the Phase 2a-α
// `--mode live` authorization二次门 (policy_trial_evaluator.mjs §2a.3) passes. 3-key
// partial is sufficient for the gate (version=2 ∧ current_phase=trialing ∧
// trial_write_enabled=true; SPEC §0.1-2(c) / red-team L4-8). dry_run tests do NOT call
// this (dry_run never authorizes). The dedicated negative cases (absent / unparseable /
// wrong version / wrong phase / trial_write=false) live in tests/test_phase2a_alpha.mjs.
function seedTrialingState(root) {
  const dir = join(root, 'state/runtime/learning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'heartbeat_learning_state.json'), JSON.stringify({
    version: 2, current_phase: 'trialing', trial_write_enabled: true,
  }, null, 2));
}

function trialsOutPath(root) {
  return join(root, 'state/runtime/learning/policy_trials.jsonl');
}
function evidenceDir(root) {
  return join(root, 'state/runtime/learning/policy_trials_evidence');
}
function cleanup(root) {
  try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
}

// --------------------------------------------------------------------------- //
// uuidv5 + namespace pin
// --------------------------------------------------------------------------- //

test('uuidv5 matches published RFC-4122 vectors', () => {
  const NS_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  assert.equal(uuidv5('python.org', NS_DNS), '886313e1-3b8a-5372-9b90-0c9aee199e5d');
  assert.equal(uuidv5('example.com', NS_DNS), 'cfbff0d1-9375-5685-968c-48ce8b15ae17');
});

test('NAMESPACE_GHL equals the pinned literal (SPEC A4)', () => {
  assert.equal(NAMESPACE_GHL, NAMESPACE_GHL_PINNED);
  assert.equal(NAMESPACE_GHL, uuidv5(POLICY_TRIAL_V1_URI, '6ba7b811-9dad-11d1-80b4-00c04fd430c8'));
});

test('computeTrialId is deterministic and version-5 shaped', () => {
  const h = 'sha256:' + 'd'.repeat(64);
  const a = computeTrialId(h, 'POLICY_X');
  const b = computeTrialId(h, 'POLICY_X');
  assert.equal(a, b);
  assert.notEqual(a, computeTrialId(h, 'POLICY_Y'));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

// --------------------------------------------------------------------------- //
// canonical_record_hash invariant (token-preserving; reuse canonical_json)
// --------------------------------------------------------------------------- //

test('canonical_record_hash == sha256(canonical(incoming event)); token-preserving (no Number folding)', () => {
  const text = JSON.stringify(mkEvent());
  const ast = parseCanonical(text);
  assert.equal(hashCanonical(ast), sha256Prefixed(emitCanonical(ast)));
  // 1.0 vs 1 must NOT fold to the same hash (proves no JSON.parse->Number).
  const a = parseCanonical('{"k":1.0}');
  const b = parseCanonical('{"k":1}');
  assert.notEqual(hashCanonical(a), hashCanonical(b));
});

// --------------------------------------------------------------------------- //
// Sealed-schema validation (fail-closed)
// --------------------------------------------------------------------------- //

test('buildTrialValidator: good trial valid; extra field + missing required rejected', () => {
  const v = buildTrialValidator();
  const good = {
    trial_id: '00000000-0000-5000-8000-000000000000',
    policy_id: 'POLICY_X',
    system_verdict: 'NEEDS_HUMAN',
    system_verdict_reason_codes: ['duplicate_conflict'],
    evidence_origin: 'production_observed',
    evaluated_at: '2026-05-30T00:00:00Z',
    schema_version: '1.0.0',
  };
  assert.equal(v(good), true);
  assert.equal(v({ ...good, extra_field: 1 }), false); // additionalProperties:false
  const missing = { ...good }; delete missing.evidence_origin;
  assert.equal(v(missing), false);
  // operator_feedback $ref resolves (valid sub-object accepted).
  assert.equal(v({ ...good, operator_feedback: {
    reviewer_id_hash: 'sha256:' + 'a'.repeat(64), verdict: 'AGREE_WITH_SYSTEM',
    reason_codes: ['acceptable'], reviewed_at: '2026-05-30T00:00:00Z',
  } }), true);
});

// --------------------------------------------------------------------------- //
// Binding index
// --------------------------------------------------------------------------- //

test('buildPolicyTraceIndex maps evidence trace_id -> policy_id across status dirs', () => {
  const root = mkRoot();
  try {
    writePolicy(root, 'candidate', 'POLICY_CAND', ['run-20260530-aaaa1111', 'run-20260530-bbbb2222']);
    writePolicy(root, 'production', 'POLICY_PROD', ['trace-20260208-sample1']);
    const idx = buildPolicyTraceIndex(join(root, 'state/memory/learned/policies'));
    assert.deepEqual([...idx.get('run-20260530-aaaa1111')], ['POLICY_CAND']);
    assert.deepEqual([...idx.get('trace-20260208-sample1')], ['POLICY_PROD']);
    assert.equal(idx.has('run-does-not-exist'), false);
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// 情形2 end-to-end (the only trial fire path)
// --------------------------------------------------------------------------- //

test('情形2 e2e (live): bound conflict -> NEEDS_HUMAN trial + evidence-ledger back-link', () => {
  const root = mkRoot();
  try {
    const traceId = 'run-20260530-aaaa1111';
    // Phase 2a-β: bound policy is a compliant GHL candidate (confidence_basis present) so the
    // F2/F3 trial-consequence pass does not fail-closed on a legacy-missing-confidence_basis
    // policy (DoD#4). Trial + ledger assertions below are unchanged (verdict stays NEEDS_HUMAN).
    writeGhlPolicy(root, 'candidate', 'POLICY_DUP', [traceId]);
    const incoming = mkEvent({ trace_id: traceId, source_dirty: true });
    const original = mkRecord({ trace_id: traceId, provenance: { manifest_validator_status: 'WARN', provenance_dirty: true } });
    writeConflict(root, 'amazon-growth-engine', 'idhex01', incoming, original);

    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c))
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(report.conflicts_scanned, 1);
    assert.equal(report.bound, 1);
    assert.equal(report.unbound, 0);
    assert.equal(report.trials_new, 1);
    assert.equal(report.needs_human, 1);
    assert.equal(report.fail_closed, 0);
    assert.equal(report.metrics.bound_via_distribution.conflict_trace_evidence, 1);

    const t = report.per_trial[0];
    assert.equal(t.policy_id, 'POLICY_DUP');
    assert.equal(t.system_verdict, 'NEEDS_HUMAN');
    // reason codes: duplicate_conflict + source_dirty (incoming) + manifest_validator_failed (original WARN)
    assert.deepEqual([...t.system_verdict_reason_codes].sort(),
      ['duplicate_conflict', 'manifest_validator_failed', 'source_dirty']);
    assert.equal(t.bound_via, 'conflict_trace_evidence');

    // trials.jsonl written + schema-valid
    const lines = readFileSync(trialsOutPath(root), 'utf-8').trim().split('\n');
    assert.equal(lines.length, 1);
    const policyTrial = JSON.parse(lines[0]);
    const v = buildTrialValidator();
    assert.equal(v(policyTrial), true);
    assert.equal(policyTrial.schema_version, SCHEMA_VERSION);

    // evidence-ledger back-link
    const ledgerFile = join(evidenceDir(root), `${policyTrial.trial_id}.yaml`);
    assert.ok(existsSync(ledgerFile), 'evidence-ledger file exists');
    const ledger = readFileSync(ledgerFile, 'utf-8');
    assert.match(ledger, /bound_via: conflict_trace_evidence/);
    assert.match(ledger, new RegExp(`trace_id: "${traceId}"`));
    assert.match(ledger, /provenance_dirty: true/);
    assert.match(ledger, /canonical_record_hash: "sha256:[0-9a-f]{64}"/);
    assert.match(ledger, /source_dirty/);
    assert.match(ledger, /manifest_validator_status=WARN/);
  } finally { cleanup(root); }
});

test('idempotency: second live run skips (trials.jsonl line count unchanged)', () => {
  const root = mkRoot();
  try {
    const traceId = 'run-20260530-aaaa1111';
    writePolicy(root, 'candidate', 'POLICY_DUP', [traceId]);
    writeConflict(root, 'amazon-growth-engine', 'idhex01',
      mkEvent({ trace_id: traceId }), mkRecord({ trace_id: traceId }));

    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c)); r2 reuses the seeded state
    const r1 = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(r1.trials_new, 1);
    const after1 = readFileSync(trialsOutPath(root), 'utf-8').trim().split('\n').length;

    const r2 = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(r2.trials_new, 0);
    assert.equal(r2.trials_skipped_idempotent, 1);
    const after2 = readFileSync(trialsOutPath(root), 'utf-8').trim().split('\n').length;
    assert.equal(after1, after2);
  } finally { cleanup(root); }
});

test('dry_run produces trial in report but writes NOTHING to disk', () => {
  const root = mkRoot();
  try {
    const traceId = 'run-20260530-aaaa1111';
    writePolicy(root, 'candidate', 'POLICY_DUP', [traceId]);
    writeConflict(root, 'amazon-growth-engine', 'idhex01',
      mkEvent({ trace_id: traceId }), mkRecord({ trace_id: traceId }));

    const report = evaluatePolicyTrials({ rootDir: root }); // default dry_run
    assert.equal(report.mode, 'dry_run');
    assert.equal(report.trials_new, 1);
    assert.equal(existsSync(trialsOutPath(root)), false, 'no policy_trials.jsonl in dry_run');
    assert.equal(existsSync(evidenceDir(root)), false, 'no evidence-ledger dir in dry_run');
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// Provenance overlay (per-clause)
// --------------------------------------------------------------------------- //

test('deriveVerdictReasonCodes: per-clause provenance overlay', () => {
  // clean: only duplicate_conflict
  let o = deriveVerdictReasonCodes(mkEvent({ source_dirty: false }),
    mkRecord({ provenance: { manifest_validator_status: 'PASS', provenance_dirty: false } }));
  assert.deepEqual(o.reasonCodes, ['duplicate_conflict']);
  assert.equal(o.provenanceDirty, false);

  // source_dirty from incoming
  o = deriveVerdictReasonCodes(mkEvent({ source_dirty: true }),
    mkRecord({ provenance: { manifest_validator_status: 'PASS', provenance_dirty: false } }));
  assert.deepEqual(o.reasonCodes.sort(), ['duplicate_conflict', 'source_dirty']);
  assert.ok(o.provenanceReasons.includes('source_dirty'));

  // manifest_validator_failed from original record (FAIL != PASS)
  o = deriveVerdictReasonCodes(mkEvent({ source_dirty: false }),
    mkRecord({ provenance: { manifest_validator_status: 'FAIL', provenance_dirty: true } }));
  assert.deepEqual(o.reasonCodes.sort(), ['duplicate_conflict', 'manifest_validator_failed']);
  assert.ok(o.provenanceReasons.some((r) => r.includes('manifest_validator_status=FAIL')));

  // no original.json -> only duplicate_conflict (manifest status unknown -> not appended)
  o = deriveVerdictReasonCodes(mkEvent({ source_dirty: false }), null);
  assert.deepEqual(o.reasonCodes, ['duplicate_conflict']);
});

// --------------------------------------------------------------------------- //
// evidence_origin derivation
// --------------------------------------------------------------------------- //

test('deriveEvidenceOrigin: production_observed default / golden_regression / synthetic seam', () => {
  assert.equal(deriveEvidenceOrigin(mkEvent(), undefined), 'production_observed');
  assert.equal(deriveEvidenceOrigin(mkEvent({ artifact_type: 'regression_replay_result' }), 'synthetic'), 'golden_regression');
  assert.equal(deriveEvidenceOrigin(mkEvent(), 'synthetic'), 'synthetic');
});

test('evidence_origin flows into trial + distribution (golden_regression via regression_replay_result)', () => {
  const root = mkRoot();
  try {
    const traceId = 'run-20260530-cccc3333';
    writePolicy(root, 'candidate', 'POLICY_REG', [traceId]);
    writeConflict(root, 'amazon-growth-engine', 'idhexreg',
      mkEvent({ trace_id: traceId, artifact_type: 'regression_replay_result' }),
      mkRecord({ trace_id: traceId }));
    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c))
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(report.per_trial[0].evidence_origin, 'golden_regression');
    assert.equal(report.metrics.evidence_origin_distribution.golden_regression, 1);
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// Binding fail-closed (no explicit reference -> unbound, 0 trial)
// --------------------------------------------------------------------------- //

test('binding fail-closed: trace mismatch -> unbound, 0 trial', () => {
  const root = mkRoot();
  try {
    writePolicy(root, 'candidate', 'POLICY_DUP', ['run-20260530-MATCHME']);
    writeConflict(root, 'amazon-growth-engine', 'idhex01',
      mkEvent({ trace_id: 'run-20260530-NOMATCH' }), mkRecord({ trace_id: 'run-20260530-NOMATCH' }));
    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c))
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(report.conflicts_scanned, 1);
    assert.equal(report.bound, 0);
    assert.equal(report.unbound, 1);
    assert.equal(report.trials_new, 0);
    assert.equal(existsSync(trialsOutPath(root)), false);
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// Empty input (today's posture: bind=0 by-design)
// --------------------------------------------------------------------------- //

test('empty input: no conflicts/records -> all-zero report, no writes', () => {
  const root = mkRoot();
  try {
    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c))
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(report.conflicts_scanned, 0);
    assert.equal(report.records_scanned, 0);
    assert.equal(report.bound, 0);
    assert.equal(report.trials_new, 0);
    assert.equal(report.fail_closed, 0);
    assert.equal(existsSync(trialsOutPath(root)), false);
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// Fail-closed: malformed incoming.json (canonicalization failure -> exit 2 path)
// --------------------------------------------------------------------------- //

test('fail-closed: malformed incoming.json -> fail_closed, no trial', () => {
  const root = mkRoot();
  try {
    writePolicy(root, 'candidate', 'POLICY_DUP', ['run-20260530-aaaa1111']);
    writeRawConflictIncoming(root, 'amazon-growth-engine', 'idbad', '{ not valid json ');
    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c))
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(report.fail_closed, 1);
    assert.equal(report.trials_new, 0);
    assert.equal(existsSync(trialsOutPath(root)), false);
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// Artifact-deref forward channel (implemented but 0 trial fire in 1c)
// --------------------------------------------------------------------------- //

test('artifact-deref: policy_suggestions_json record binds via deref but fires 0 trial', () => {
  const root = mkRoot();
  const engineRepo = mkdtempSync(join(tmpdir(), 'age-'));
  try {
    // synthetic artifact inside the engine repo
    mkdirSync(join(engineRepo, 'out'), { recursive: true });
    writeFileSync(join(engineRepo, 'out/suggestion.json'), JSON.stringify({ policy_id: 'POLICY_SUGGESTED' }));
    writeRecords(root, [
      mkRecord({ artifact_type: 'policy_suggestions_json', raw_payload_ref: 'out/suggestion.json' }),
    ]);
    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c))
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live', engineRepo });
    assert.equal(report.records_scanned, 1);
    assert.equal(report.bound, 1);
    assert.equal(report.metrics.bound_via_distribution.artifact_deref, 1);
    assert.equal(report.trials_new, 0, 'artifact-deref is forward-carrying; no 1c trial');
    assert.equal(existsSync(trialsOutPath(root)), false);
  } finally { cleanup(root); cleanup(engineRepo); }
});

test('artifact-deref symlink-escape defense: ref resolving outside engine repo -> unbound', () => {
  const root = mkRoot();
  const engineRepo = mkdtempSync(join(tmpdir(), 'age-'));
  const outside = mkdtempSync(join(tmpdir(), 'outside-'));
  try {
    writeFileSync(join(outside, 'secret.json'), JSON.stringify({ policy_id: 'LEAKED' }));
    // symlink inside the repo pointing OUTSIDE
    symlinkSync(join(outside, 'secret.json'), join(engineRepo, 'link.json'));
    writeRecords(root, [
      mkRecord({ artifact_type: 'policy_suggestions_json', raw_payload_ref: 'link.json' }),
    ]);
    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c))
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live', engineRepo });
    assert.equal(report.bound, 0, 'symlink escaping the repo must not bind');
    assert.equal(report.unbound, 1);
  } finally { cleanup(root); cleanup(engineRepo); cleanup(outside); }
});

test('artifact-deref path defense: ".." in raw_payload_ref -> unbound', () => {
  const root = mkRoot();
  const engineRepo = mkdtempSync(join(tmpdir(), 'age-'));
  try {
    writeRecords(root, [
      mkRecord({ artifact_type: 'policy_suggestions_json', raw_payload_ref: '../escape.json' }),
    ]);
    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c))
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live', engineRepo });
    assert.equal(report.bound, 0);
    assert.equal(report.unbound, 1);
  } finally { cleanup(root); cleanup(engineRepo); }
});

// --------------------------------------------------------------------------- //
// Class wrapper + multi-policy fan-out
// --------------------------------------------------------------------------- //

test('PolicyTrialEvaluator class wraps the functional core', () => {
  const root = mkRoot();
  try {
    const report = new PolicyTrialEvaluator({ rootDir: root }).run();
    assert.equal(report.mode, 'dry_run');
    assert.equal(report.trials_new, 0);
  } finally { cleanup(root); }
});

test('one conflict bound to two policies fans out to two distinct trials', () => {
  const root = mkRoot();
  try {
    const traceId = 'run-20260530-dddd4444';
    // Phase 2a-β: both GHL-compliant. POLICY_A (candidate) -> trial_history written;
    // POLICY_B (production) -> confidence computed but trial_history write SKIPPED
    // (production 0-diff guard, DoD#9). Neither fail-closes.
    const prodPath = writeGhlPolicy(root, 'production', 'POLICY_B', [traceId]);
    const prodBefore = readFileSync(prodPath, 'utf-8');
    writeGhlPolicy(root, 'candidate', 'POLICY_A', [traceId]);
    writeConflict(root, 'amazon-growth-engine', 'idmulti',
      mkEvent({ trace_id: traceId }), mkRecord({ trace_id: traceId }));
    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c))
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(report.bound, 1); // one conflict bound
    assert.equal(report.trials_new, 2); // two policies -> two trials
    assert.equal(report.fail_closed, 0); // both GHL-compliant -> no confidence fail-closed
    const ids = new Set(report.per_trial.map((t) => t.trial_id));
    assert.equal(ids.size, 2);
    // production policy file byte-identical (trial_history write skipped, DoD#9)
    assert.equal(readFileSync(prodPath, 'utf-8'), prodBefore);
    assert.ok(report.trial_history_skipped.some((s) => s.policy_id === 'POLICY_B'));
    assert.ok(report.trial_history_written.some((w) => w.policy_id === 'POLICY_A'));
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// Module zero-reference assertion (SPEC A5 guard)
// --------------------------------------------------------------------------- //

test('evidence-ledger is injection-safe: hostile trace_id/policy_id round-trip as valid YAML', () => {
  const root = mkRoot();
  try {
    // hostile values that would break a hand-built YAML if unescaped
    const evilTrace = 'run-x"\n  injected_key: pwned\nbad: :';
    const evilPolicy = 'P_INJECT"\n  also: bad';
    writePolicy(root, 'candidate', evilPolicy, [evilTrace]);
    writeConflict(root, 'amazon-growth-engine', 'idevil',
      mkEvent({ trace_id: evilTrace }), mkRecord({ trace_id: evilTrace }));

    seedTrialingState(root); // Phase 2a-α live二次门 (§0.1-2(c))
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(report.trials_new, 1);

    const trialId = report.per_trial[0].trial_id;
    const ledgerText = readFileSync(join(evidenceDir(root), `${trialId}.yaml`), 'utf-8');
    const parsed = parseYaml(ledgerText); // throws if the YAML is broken
    assert.equal(parsed.trace_id, evilTrace, 'trace_id round-trips exactly');
    assert.equal(parsed.policy_id, evilPolicy, 'policy_id round-trips exactly');
    assert.equal('injected_key' in parsed, false, 'no key injected via trace_id');
    assert.equal('also' in parsed, false, 'no key injected via policy_id');
    assert.equal(parsed.bound_via, 'conflict_trace_evidence');
  } finally { cleanup(root); }
});

test('evaluator module has ZERO reference to the 7 deferred reason codes + the all-clear code', () => {
  const src = readFileSync(EVALUATOR_SRC, 'utf-8');
  const forbidden = [
    'golden_pack_stale', 'data_safety_unknown', 'regression_failure_severe',
    'confidence_below_threshold', 'evidence_origin_insufficient',
    'sample_size_insufficient', 'boundary_confidence_value', 'acceptable',
  ];
  for (const code of forbidden) {
    assert.ok(!src.includes(code), `evaluator source must not reference "${code}"`);
  }
});
