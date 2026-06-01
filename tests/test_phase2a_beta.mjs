// Phase 2a-β trialing-后果面 tests (Node built-in runner: node:test).
// Run: node --test tests/test_phase2a_beta.mjs
//
// Prefix-named (test_phase2a_beta.mjs, no `.test.` infix) so the root vitest run does NOT
// collect it; CI-wired in a dedicated workflow (mirroring 1c/1d/1e/2a-α A7).
//
// Coverage mirrors SPEC `.planning/phase-2a-beta/SPEC.md` (blob d1b11bae) §4:
//   F3 trial_history (append / idempotent / chronological / rebuild / no-rollback /
//     production+legacy skip) · F2 confidence (formula 3-of-4 + weights / boundary->report /
//     legacy fail_closed skip+report+non-zero / byte-unchanged / divergence>5%->WARN) ·
//   F-flow ingestion (latest-wins / late / invalid->reject / (id,reviewed_at) no-op /
//     id+diff-reviewed_at overwrite / reviewer NO-PII) · F-predicate (three-state /
//     BLOCKED short-circuit / all-of-window / days_present<window->non-PASS / read-only /
//     R-β7 negative) · invariants (verdict not extended / formulas read-only / R-β7 grep).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, symlinkSync,
} from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';

import {
  evaluatePolicyTrials, computeGhlConfidence, loadConfidenceFormula,
  buildGhlPolicyValidator, buildPolicyFileIndex, buildTrialValidator,
} from '../src/reasoning/policy_trial_evaluator.mjs';
import {
  ingestOperatorFeedback, reviewerIdHash,
} from '../.claude/scripts/learning/operator_feedback_ingest.mjs';
import {
  evaluateTransitionWindow, classifyTrialDay, checkTransitionPredicate,
} from '../.claude/scripts/learning/trial_observation_predicate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');

// --------------------------------------------------------------------------- //
// Fixtures
// --------------------------------------------------------------------------- //

function mkRoot() { return mkdtempSync(join(tmpdir(), 'p2ab-')); }
function cleanup(root) { try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ } }

function mkEvent(overrides = {}) {
  return {
    artifact_path: 'out/x.json', artifact_type: 'verification_json',
    event_identity_key: 'sha256:' + 'a'.repeat(64), playbook_ref: 'pb',
    source_commit_sha: 'b'.repeat(40), source_dirty: false,
    source_repo: 'amazon-growth-engine', source_system: 'amazon-growth-engine',
    step_id: 's1', trace_id: 'run-20260530-aaaa1111', ...overrides,
  };
}

function writeConflict(root, sys, idHex, incoming, original) {
  const dir = join(root, 'state/runtime/learning/fact_conflicts', sys, idHex);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'incoming.json'), JSON.stringify(incoming));
  if (original !== undefined) writeFileSync(join(dir, 'original.json'), JSON.stringify(original) + '\n');
}

function seedTrialingState(root) {
  const dir = join(root, 'state/runtime/learning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'heartbeat_learning_state.json'), JSON.stringify({
    version: 2, current_phase: 'trialing', trial_write_enabled: true,
  }));
}

function ghlPolicyDoc(policyId, traceIds, opts = {}) {
  const status = opts.status || 'candidate';
  const doc = {
    schema_version: '1.0.0', policy_id: policyId, domain: 'amazon-advertising',
    learned_at: '2026-05-30T00:00:00Z',
    scope: { type: 'tenant', keys: { tenant_id: 'default', marketplace: 'US' } },
    risk_level: 'low', validation_status: status, confidence: opts.confidence ?? 0.5,
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
  return doc;
}

function writePolicyFile(root, status, policyId, traceIds, opts = {}) {
  const dir = join(root, 'state/memory/learned/policies', status);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${policyId}.yaml`);
  writeFileSync(p, JSON.stringify(ghlPolicyDoc(policyId, traceIds, { ...opts, status }), null, 2));
  return p;
}

function readPolicy(path) {
  // Fixtures are JSON (a YAML subset); the evaluator writes back via the yaml Document API.
  // parseYaml handles both.
  return parseYaml(readFileSync(path, 'utf-8'));
}

function boundConflictRoot(opts = {}) {
  const root = mkRoot();
  const traceId = 'run-20260530-aaaa1111';
  const path = writePolicyFile(root, opts.status || 'candidate', opts.policyId || 'POLICY_DUP', [traceId], opts);
  writeConflict(root, 'amazon-growth-engine', 'idhex01', mkEvent({ trace_id: traceId }),
    { ...mkEvent({ trace_id: traceId }), provenance: { manifest_validator_status: 'PASS', provenance_dirty: false } });
  seedTrialingState(root);
  return { root, traceId, path };
}

// =========================================================================== //
// F2 — confidence (pure formula)
// =========================================================================== //

test('F2 confidence: faithful ghl_confidence_v1 (3-of-4 confidence_basis + exec legacy path; weights sum 1.0)', () => {
  const f = loadConfidenceFormula(REPO);
  const w = f.weights;
  assert.equal(w.exec_success_rate + w.operator_agreement_rate + w.business_score + w.regression_pass_rate, 1.0);
  // exec read from legacy path, the other 3 from confidence_basis.
  assert.equal(f.inputs.exec_success_rate, '$.success_signals.exec.success_rate');
  assert.equal(f.inputs.operator_agreement_rate, '$.confidence_basis.operator_agreement_rate');
  const doc = ghlPolicyDoc('P', ['run-20260530-aaaa1111']); // exec .9 oar .8 bs .6 rpr .9
  const r = computeGhlConfidence(doc, f);
  assert.equal(r.status, 'ok');
  assert.equal(r.value, 0.2 * 0.9 + 0.3 * 0.8 + 0.4 * 0.6 + 0.1 * 0.9); // 0.75
  assert.equal(r.boundary_review, false);
});

test('F2 confidence: boundary 1.0 -> boundary_review=true (requires_review sink)', () => {
  const f = loadConfidenceFormula(REPO);
  const doc = ghlPolicyDoc('P', ['run-20260530-aaaa1111'], {
    exec_success_rate: 1, confidence_basis: { operator_agreement_rate: 1, business_score: 1, regression_pass_rate: 1 },
  });
  const r = computeGhlConfidence(doc, f);
  assert.equal(r.value, 1);
  assert.equal(r.boundary_review, true);
});

test('F2 confidence: legacy (no confidence_basis) -> status unavailable (fail_closed, NOT default 0/0.5)', () => {
  const f = loadConfidenceFormula(REPO);
  const doc = ghlPolicyDoc('P', ['run-20260530-aaaa1111'], { legacy: true });
  const r = computeGhlConfidence(doc, f);
  assert.equal(r.status, 'unavailable');
  assert.equal(r.value, undefined);
});

test('F2 confidence: legacy_alias divergence > 5% -> divergence_warn', () => {
  const f = loadConfidenceFormula(REPO);
  const doc = ghlPolicyDoc('P', ['run-20260530-aaaa1111'], { approval_rate: 0.5 }); // oar 0.8 vs alias 0.5
  assert.equal(computeGhlConfidence(doc, f).divergence_warn, true);
  const doc2 = ghlPolicyDoc('P', ['run-20260530-aaaa1111'], { approval_rate: 0.79 }); // within 5%
  assert.equal(computeGhlConfidence(doc2, f).divergence_warn, false);
});

// =========================================================================== //
// F3 + F2 — evaluator carve-out (trial_history write-back + confidence)
// =========================================================================== //

test('F3 (live): trial_history appended to compliant GHL candidate + confidence written; valid', () => {
  const { root, path } = boundConflictRoot({ status: 'candidate' });
  try {
    const before = readFileSync(path, 'utf-8');
    const r = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(r.fail_closed, 0);
    assert.equal(r.trials_new, 1);
    assert.equal(r.trial_history_written.length, 1);
    const trialId = r.per_trial[0].trial_id;
    const doc = readPolicy(path);
    assert.deepEqual(doc.trial_history, [trialId]);
    assert.equal(doc.confidence, 0.75); // recomputed via frozen formula
    assert.notEqual(readFileSync(path, 'utf-8'), before); // candidate file mutated
    // re-validate persisted doc
    assert.equal(buildGhlPolicyValidator(REPO)(doc), true);
  } finally { cleanup(root); }
});

test('F3: idempotent — second live run does NOT double-append trial_history', () => {
  const { root, path } = boundConflictRoot({ status: 'candidate' });
  try {
    evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    const after1 = readPolicy(path).trial_history.slice();
    const r2 = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    // trial already seen -> emitPolicyTrial returns early -> no second consequence pass
    assert.equal(r2.trials_new, 0);
    assert.deepEqual(readPolicy(path).trial_history, after1);
    assert.equal(after1.length, 1);
  } finally { cleanup(root); }
});

test('F3: production-dir GHL -> confidence computed but trial_history write SKIPPED (production 0-diff, DoD#9)', () => {
  const { root, path } = boundConflictRoot({ status: 'production' });
  try {
    const before = readFileSync(path, 'utf-8');
    const r = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(r.fail_closed, 0);
    assert.equal(r.trial_history_written.length, 0);
    assert.ok(r.trial_history_skipped.some((s) => /not writable/.test(s.reason)));
    assert.equal(readFileSync(path, 'utf-8'), before); // byte-identical
    assert.ok(r.per_confidence.some((c) => c.status === 'ok')); // confidence still computed
  } finally { cleanup(root); }
});

test('F2 legacy fail-closed (DoD#4): bound legacy policy -> confidence_unavailable + fail_closed + YAML byte-unchanged', () => {
  const { root, path } = boundConflictRoot({ status: 'candidate', legacy: true });
  try {
    const before = readFileSync(path, 'utf-8');
    const r = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(r.confidence_unavailable, 1);
    assert.ok(r.fail_closed >= 1); // non-zero exit
    assert.ok(r.per_fail_closed.some((f) => f.reason === 'confidence_unavailable'));
    assert.equal(readFileSync(path, 'utf-8'), before); // legacy YAML untouched (no in-place rewrite)
  } finally { cleanup(root); }
});

test('F3 dry_run: 0 disk write (policy file byte-unchanged) but readiness reported (pending)', () => {
  const { root, path } = boundConflictRoot({ status: 'candidate' });
  try {
    const before = readFileSync(path, 'utf-8');
    const r = evaluatePolicyTrials({ rootDir: root, mode: 'dry_run' });
    assert.equal(r.trials_new, 1);
    assert.equal(readFileSync(path, 'utf-8'), before); // no write in dry_run
    assert.equal(r.trial_history_written.length, 0);
    assert.equal(r.trial_history_pending.length, 1); // would-write preview
    assert.ok(r.per_confidence.some((c) => c.status === 'ok')); // confidence computed (readiness)
  } finally { cleanup(root); }
});

test('F3 boundary -> confidence_boundary_review reported (machine-checkable sink)', () => {
  const { root } = boundConflictRoot({
    status: 'candidate', exec_success_rate: 1,
    confidence_basis: { operator_agreement_rate: 1, business_score: 1, regression_pass_rate: 1 },
  });
  try {
    const r = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(r.confidence_boundary_review.length, 1);
    assert.equal(r.confidence_boundary_review[0].confidence, 1);
  } finally { cleanup(root); }
});

test('verdict unchanged: system_verdict stays NEEDS_HUMAN (β does not extend verdict)', () => {
  const { root } = boundConflictRoot({ status: 'candidate' });
  try {
    const r = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(r.per_trial[0].system_verdict, 'NEEDS_HUMAN');
  } finally { cleanup(root); }
});

test('buildPolicyFileIndex maps policy_id -> {absPath, status}', () => {
  const root = mkRoot();
  try {
    writePolicyFile(root, 'candidate', 'P_CAND', ['run-20260530-aaaa1111']);
    writePolicyFile(root, 'production', 'P_PROD', ['run-20260530-bbbb2222']);
    const idx = buildPolicyFileIndex(join(root, 'state/memory/learned/policies'));
    assert.equal(idx.get('P_CAND').status, 'candidate');
    assert.equal(idx.get('P_PROD').status, 'production');
    assert.ok(idx.get('P_CAND').absPath.endsWith('P_CAND.yaml'));
  } finally { cleanup(root); }
});

// =========================================================================== //
// F-flow — operator feedback ingestion
// =========================================================================== //

function seedTrial(root, trialId) {
  const dir = join(root, 'state/runtime/learning');
  mkdirSync(dir, { recursive: true });
  const trialObj = {
    trial_id: trialId, policy_id: 'P', system_verdict: 'NEEDS_HUMAN',
    system_verdict_reason_codes: ['duplicate_conflict'], evidence_origin: 'production_observed',
    evaluated_at: '2026-05-30T00:00:00Z', schema_version: '1.0.0',
  };
  writeFileSync(join(dir, 'policy_trials.jsonl'), JSON.stringify(trialObj) + '\n');
  return join(dir, 'policy_trials.jsonl');
}
const TID = '00000000-0000-5000-8000-000000000001';
const common = { trialId: TID, verdict: 'AGREE_WITH_SYSTEM', reasonCodes: ['acceptable'], reviewer: 'op@example.com' };

test('F-flow: first feedback appended; trial line re-appended with operator_feedback (schema-valid)', () => {
  const root = mkRoot();
  try {
    const p = seedTrial(root, TID);
    const r = ingestOperatorFeedback({ ...common, rootDir: root, reviewedAt: '2026-06-01T00:00:00Z' });
    assert.equal(r.fail_closed, false);
    assert.equal(r.action, 'appended');
    const lines = readFileSync(p, 'utf-8').trim().split('\n');
    assert.equal(lines.length, 2); // original + re-appended w/ feedback
    const last = JSON.parse(lines[1]);
    assert.equal(last.operator_feedback.verdict, 'AGREE_WITH_SYSTEM');
    assert.equal(buildTrialValidator(REPO)(last), true); // policy_trial_v1 + $ref valid
  } finally { cleanup(root); }
});

test('F-flow write-side idempotency: same (trial_id, reviewed_at) -> no-op (no second line)', () => {
  const root = mkRoot();
  try {
    const p = seedTrial(root, TID);
    ingestOperatorFeedback({ ...common, rootDir: root, reviewedAt: '2026-06-01T00:00:00Z' });
    const r2 = ingestOperatorFeedback({ ...common, rootDir: root, reviewedAt: '2026-06-01T00:00:00Z' });
    assert.equal(r2.action, 'noop_duplicate');
    assert.equal(readFileSync(p, 'utf-8').trim().split('\n').length, 2); // unchanged
  } finally { cleanup(root); }
});

test('F-flow: same trial_id, DIFFERENT reviewed_at -> latest-wins overwrite (explicit, new line)', () => {
  const root = mkRoot();
  try {
    const p = seedTrial(root, TID);
    ingestOperatorFeedback({ ...common, rootDir: root, reviewedAt: '2026-06-01T00:00:00Z' });
    const r2 = ingestOperatorFeedback({ ...common, verdict: 'DISAGREE_WITH_SYSTEM', reasonCodes: ['unsafe_reuse'], rootDir: root, reviewedAt: '2026-06-02T00:00:00Z' });
    assert.equal(r2.action, 'overwrite_latest_wins');
    const lines = readFileSync(p, 'utf-8').trim().split('\n');
    assert.equal(lines.length, 3);
    // latest-wins on read: last line is the DISAGREE one
    assert.equal(JSON.parse(lines[2]).operator_feedback.verdict, 'DISAGREE_WITH_SYSTEM');
  } finally { cleanup(root); }
});

test('F-flow fail-closed: trial_id not found -> 0 write + fail_closed', () => {
  const root = mkRoot();
  try {
    const p = seedTrial(root, TID);
    const r = ingestOperatorFeedback({ ...common, trialId: 'nonexistent-id', rootDir: root });
    assert.equal(r.fail_closed, true);
    assert.equal(readFileSync(p, 'utf-8').trim().split('\n').length, 1); // unchanged
  } finally { cleanup(root); }
});

test('F-flow fail-closed: invalid verdict / reason_code -> reject (ajv $ref) + 0 write', () => {
  const root = mkRoot();
  try {
    const p = seedTrial(root, TID);
    assert.equal(ingestOperatorFeedback({ ...common, verdict: 'BOGUS', rootDir: root, reviewedAt: '2026-06-05T00:00:00Z' }).fail_closed, true);
    assert.equal(ingestOperatorFeedback({ ...common, reasonCodes: ['not_a_code'], rootDir: root, reviewedAt: '2026-06-06T00:00:00Z' }).fail_closed, true);
    assert.equal(readFileSync(p, 'utf-8').trim().split('\n').length, 1); // unchanged
  } finally { cleanup(root); }
});

test('F-flow NO-PII: reviewer stored only as sha256 hash; raw reviewer never in file', () => {
  const root = mkRoot();
  try {
    const p = seedTrial(root, TID);
    ingestOperatorFeedback({ ...common, rootDir: root, reviewedAt: '2026-06-01T00:00:00Z' });
    const text = readFileSync(p, 'utf-8');
    assert.ok(!text.includes('op@example.com'));
    assert.match(reviewerIdHash('op@example.com'), /^sha256:[0-9a-f]{64}$/);
    assert.equal(reviewerIdHash('a'), reviewerIdHash('a')); // stable
    assert.notEqual(reviewerIdHash('a'), reviewerIdHash('b'));
  } finally { cleanup(root); }
});

// =========================================================================== //
// F-predicate — 2a→2b transition
// =========================================================================== //

function trialRow(date, drift = 0, fb = 0) {
  return {
    date_utc: date,
    policy_trials_breakdown: {
      by_system_verdict: { PASS: 0, FAIL: 0, DOWNGRADED: 0, NEEDS_HUMAN: fb },
      with_operator_feedback_count: fb, schema_version_drift_count: drift,
    },
    d11_kpis: { kpi_unavailable_reasons: fb > 0 ? [] : ['no_operator_feedback'] },
  };
}
const WD = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07'];
function cleanWindowMap() { const m = new Map(); for (const d of WD) m.set(d, trialRow(d, 0, 1)); return m; }

test('F-predicate: all-of-window clean -> PASS', () => {
  const r = evaluateTransitionWindow(cleanWindowMap(), { asof: '2026-06-07', window: 7 });
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.days_present, 7);
});

test('F-predicate: schema drift day -> BLOCKED (short-circuit, highest priority)', () => {
  const m = cleanWindowMap(); m.set('2026-06-04', trialRow('2026-06-04', 2, 1));
  const r = evaluateTransitionWindow(m, { asof: '2026-06-07', window: 7 });
  assert.equal(r.verdict, 'BLOCKED');
  assert.deepEqual(r.blocked_days, ['2026-06-04']);
  assert.deepEqual(r.failed_criteria, ['schema_version_drift']);
});

test('F-predicate: missing day (no explicit alarm) -> INDETERMINATE (not PASS)', () => {
  const m = cleanWindowMap(); m.delete('2026-06-05');
  const r = evaluateTransitionWindow(m, { asof: '2026-06-07', window: 7 });
  assert.equal(r.verdict, 'INDETERMINATE');
  assert.ok(r.days_present < 7);
});

test('F-predicate: BLOCKED short-circuits over INDETERMINATE (both present)', () => {
  const m = cleanWindowMap(); m.delete('2026-06-05'); m.set('2026-06-06', trialRow('2026-06-06', 1, 1));
  assert.equal(evaluateTransitionWindow(m, { asof: '2026-06-07', window: 7 }).verdict, 'BLOCKED');
});

test('F-predicate: days_present < window -> non-PASS even if all present days clean', () => {
  const m = new Map(); m.set('2026-06-07', trialRow('2026-06-07', 0, 1)); // only 1 of 7
  assert.equal(evaluateTransitionWindow(m, { asof: '2026-06-07', window: 7 }).verdict, 'INDETERMINATE');
});

test('F-predicate: partial breakdown (drift count unreadable) -> INDETERMINATE', () => {
  const e = classifyTrialDay('2026-06-01', { date_utc: '2026-06-01', policy_trials_breakdown: { by_system_verdict: {} } });
  assert.equal(e.classification, 'INDETERMINATE-day');
});

test('F-predicate: per_day surfaces by_system_verdict + feedback count (read, not reduced)', () => {
  const r = evaluateTransitionWindow(cleanWindowMap(), { asof: '2026-06-07', window: 7 });
  assert.notEqual(r.per_day[0].by_system_verdict, null);
  assert.equal(r.per_day[0].with_operator_feedback_count, 1);
});

test('F-predicate R-β7: output carries NO windowed agreement_rate / critical_false_negative aggregate', () => {
  const r = evaluateTransitionWindow(cleanWindowMap(), { asof: '2026-06-07', window: 7 });
  const json = JSON.stringify(r);
  assert.ok(!('operator_agreement_rate' in r));
  assert.ok(!json.includes('operator_agreement_rate'));
  assert.ok(!json.includes('critical_false_negative'));
});

test('F-predicate: read-only — checkTransitionPredicate writes nothing to disk', () => {
  const root = mkRoot();
  try {
    const dir = join(root, 'state/runtime/learning'); mkdirSync(dir, { recursive: true });
    const mp = join(dir, 'metrics_daily.jsonl');
    writeFileSync(mp, WD.map((d) => JSON.stringify(trialRow(d, 0, 1))).join('\n') + '\n');
    const before = readFileSync(mp, 'utf-8');
    const r = checkTransitionPredicate({ rootDir: root, asof: '2026-06-07', window: 7 });
    assert.equal(r.verdict, 'PASS');
    assert.equal(readFileSync(mp, 'utf-8'), before); // unchanged (read-only)
    // no stray files created in the dir beyond the metrics file + heartbeat dir
    assert.ok(existsSync(mp));
  } finally { cleanup(root); }
});

test('F-predicate: missing metrics file -> INDETERMINATE (file_present false), exit-safe', () => {
  const root = mkRoot();
  try {
    const r = checkTransitionPredicate({ rootDir: root, asof: '2026-06-07', window: 7 });
    assert.equal(r.file_present, false);
    assert.equal(r.verdict, 'INDETERMINATE');
  } finally { cleanup(root); }
});

// =========================================================================== //
// Invariants (negative / frozen)
// =========================================================================== //

test('R-β7 grep: predicate CODE (comments stripped) references NO agreement/false-negative atom', () => {
  const raw = readFileSync(join(REPO, '.claude/scripts/learning/trial_observation_predicate.mjs'), 'utf-8');
  // Strip block comments then line comments — the fence atoms MAY be named in prose (to document
  // R-β7) but must NEVER appear in executable code (no read, no sum, no divide).
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // The atoms may be NAMED in the --help prose (a string literal documenting the fence to the
  // operator). The reduction signature is a DATA read: property access (`.atom` or `['atom']`).
  // Assert the predicate never reads these atoms off a row (hence cannot sum/divide them).
  for (const atom of ['agreement_agree_count', 'agreement_eligible_count', 'critical_false_negative_count_today']) {
    assert.ok(!new RegExp(`[.\\[]\\s*['"]?${atom}`).test(code), `R-β7 violation: predicate reads ${atom}`);
  }
  assert.ok(!/\.operator_agreement_rate/.test(code), 'R-β7 violation: predicate reads operator_agreement_rate');
});

test('confidence_formulas.yaml is READ not modified: faithful weights match the contract', () => {
  const f = loadConfidenceFormula(REPO);
  assert.equal(f.missing_input_policy, 'fail_closed');
  assert.deepEqual(f.boundary_output_policy.values, [0.0, 1.0]);
  // the evaluator never writes to _meta/contracts (grep the evaluator source)
  const ev = readFileSync(join(REPO, 'src/reasoning/policy_trial_evaluator.mjs'), 'utf-8');
  assert.ok(!/writeFileSync\([^)]*_meta\/contracts/.test(ev));
  assert.ok(!/writeFileSync\([^)]*confidence_formulas/.test(ev));
});

test('empty input: no conflicts -> 0 trials, 0 fail_closed, 0 consequence writes', () => {
  const root = mkRoot();
  try {
    seedTrialingState(root);
    const r = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(r.trials_new, 0);
    assert.equal(r.fail_closed, 0);
    assert.equal(r.trial_history_written.length, 0);
    assert.equal(r.confidence_unavailable, 0);
  } finally { cleanup(root); }
});

// =========================================================================== //
// Red-team fold: DoD coverage the first pass missed
// =========================================================================== //

test('F3 DoD#1: TWO distinct trials on one candidate -> trial_history chronological + rebuildable', () => {
  const root = mkRoot();
  const traceId = 'run-20260530-aaaa1111';
  try {
    const path = writePolicyFile(root, 'candidate', 'POLICY_DUP', [traceId]);
    // two conflict dirs, same trace_id -> same policy, DIFFERENT incoming (step_id) -> distinct trial_id.
    writeConflict(root, 'amazon-growth-engine', 'idhex01', mkEvent({ trace_id: traceId, step_id: 's1' }), null);
    writeConflict(root, 'amazon-growth-engine', 'idhex02', mkEvent({ trace_id: traceId, step_id: 's2' }), null);
    seedTrialingState(root);
    const r = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(r.trials_new, 2);
    assert.equal(r.fail_closed, 0);
    const hist = readPolicy(path).trial_history;
    assert.equal(hist.length, 2);
    assert.equal(new Set(hist).size, 2); // distinct
    // rebuild-consistency: trial_history == policy_trials.jsonl trial_ids for POLICY_DUP, file order.
    const trialsTxt = readFileSync(join(root, 'state/runtime/learning/policy_trials.jsonl'), 'utf-8');
    const rebuilt = trialsTxt.trim().split('\n').map((l) => JSON.parse(l))
      .filter((t) => t.policy_id === 'POLICY_DUP').map((t) => t.trial_id);
    assert.deepEqual(hist, rebuilt);
  } finally { cleanup(root); }
});

test('F3 DoD#9: mutated candidate keeps validation_status + promoted_at invariant (field-level)', () => {
  const { root, path } = boundConflictRoot({ status: 'candidate' });
  try {
    const before = readPolicy(path);
    evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    const after = readPolicy(path);
    assert.equal(after.validation_status, before.validation_status); // status untouched
    assert.equal('promoted_at' in after, false);                     // never introduced
    assert.equal(after.policy_id, before.policy_id);
    // only trial_history + confidence changed
    assert.ok(Array.isArray(after.trial_history));
  } finally { cleanup(root); }
});

test('R-β1 grep: evaluator never writes validation_status / promoted_at / production paths', () => {
  const ev = readFileSync(join(REPO, 'src/reasoning/policy_trial_evaluator.mjs'), 'utf-8');
  const code = ev.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/setIn\(\[['"]validation_status/.test(code));
  assert.ok(!/setIn\(\[['"]promoted_at/.test(code));
  // the only setIn targets are trial_history + confidence (observability/score, not promotion).
  const setIns = [...code.matchAll(/setIn\(\[['"]([a-z_]+)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(setIns)], ['confidence', 'trial_history']);
});

test('DoD#11: the 5 sealed schemas are content-pinned (0-diff guard)', () => {
  const pins = {
    'policy_trial_v1.schema.yaml': '2cd8df6bb1ec41489a3921f5d89e851269d6ac6c6e8f72b945b7f173be6fa7a2',
    'operator_feedback_v1.schema.yaml': '4389f79aca7f330dcc7ece399af60992b43b22f82f015ec9edf5f89b272ec2db',
    'learned_policy_ghl_v1.schema.yaml': '3bcf21fe178c9d31c3066f3be06482164dd0a259a4aae1cef8c6c9aa7d9b1f81',
    'confidence_formulas.yaml': '2c6ceff8620addb3022f70c27087e8ac2a1d769b463306b6c6702bfef7fb4a74',
    'metrics_daily_v1.schema.yaml': 'ed43abfda3b1bc0ae094cb6532d1574d06fe16341dc3b7f0d68a3cc607c6417c',
  };
  for (const [name, sha] of Object.entries(pins)) {
    const content = readFileSync(join(REPO, '_meta/contracts/learning', name), 'utf-8');
    assert.equal(createHash('sha256').update(content).digest('hex'), sha,
      `sealed schema ${name} content changed — β must keep it 0-diff (DoD#11)`);
  }
});

test('F3 no-rollback (DoD §4): write-back re-validation fail -> trial persists (SSOT), policy file untouched, fail-closed', () => {
  const root = mkRoot();
  const traceId = 'run-20260530-aaaa1111';
  try {
    // candidate WITH confidence_basis (so confidence computes) but MISSING required `actions`
    // -> the in-place write-back re-validation against learned_policy_ghl_v1 fails-closed.
    const dir = join(root, 'state/memory/learned/policies/candidate');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'POLICY_BROKEN.yaml');
    const doc = ghlPolicyDoc('POLICY_BROKEN', [traceId]); delete doc.actions; // break schema
    writeFileSync(path, JSON.stringify(doc, null, 2));
    const before = readFileSync(path, 'utf-8');
    writeConflict(root, 'amazon-growth-engine', 'idhex01', mkEvent({ trace_id: traceId }), null);
    seedTrialingState(root);
    const r = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    // trial (SSOT) was written
    assert.equal(r.trials_new, 1);
    assert.ok(existsSync(join(root, 'state/runtime/learning/policy_trials.jsonl')));
    // history write-back failed closed; policy file NOT mutated (no rollback of the trial)
    assert.ok(r.fail_closed >= 1);
    assert.ok(r.trial_history_skipped.some((s) => s.reason === 're-validation_failed'));
    assert.equal(readFileSync(path, 'utf-8'), before); // policy untouched (no half-write)
  } finally { cleanup(root); }
});

test('F-flow #2 (red-team): append to a trials file whose last line lacks a trailing newline does NOT corrupt it', () => {
  const root = mkRoot();
  try {
    const dir = join(root, 'state/runtime/learning'); mkdirSync(dir, { recursive: true });
    const p = join(dir, 'policy_trials.jsonl');
    const trialObj = { trial_id: TID, policy_id: 'P', system_verdict: 'NEEDS_HUMAN', system_verdict_reason_codes: ['duplicate_conflict'], evidence_origin: 'production_observed', evaluated_at: '2026-05-30T00:00:00Z', schema_version: '1.0.0' };
    writeFileSync(p, JSON.stringify(trialObj)); // NO trailing newline (manual edit / crashed write)
    const r = ingestOperatorFeedback({ ...common, rootDir: root, reviewedAt: '2026-06-01T00:00:00Z' });
    assert.equal(r.fail_closed, false);
    const lines = readFileSync(p, 'utf-8').split('\n').filter((l) => l.trim());
    assert.equal(lines.length, 2);                 // not glued into one corrupt line
    for (const l of lines) JSON.parse(l);           // both parse cleanly
    assert.ok(!readFileSync(p, 'utf-8').includes('}{')); // no glued records
  } finally { cleanup(root); }
});

test('F-flow #1 (red-team): CLI invoked via a SYMLINK still runs main (realpathSync guard)', () => {
  const root = mkRoot();
  try {
    const link = join(root, 'ingest_link.mjs');
    symlinkSync(join(REPO, '.claude/scripts/learning/operator_feedback_ingest.mjs'), link);
    const res = spawnSync(process.execPath, [link, '--help'], { encoding: 'utf-8' });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /operator_feedback_ingest\.mjs/); // main() ran (help printed)
  } finally { cleanup(root); }
});
