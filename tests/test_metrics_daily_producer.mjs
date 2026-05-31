#!/usr/bin/env node
/**
 * test_metrics_daily_producer.mjs - Phase 1e node:test suite for the daily metrics
 * roll-up producer (.claude/scripts/learning/metrics_daily_producer.mjs).
 *
 * Prefix-named (no `.test.` infix) so vitest's default include glob does NOT collect
 * it; run explicitly with:
 *   node --test tests/test_metrics_daily_producer.mjs
 *
 * Covers SPEC .planning/phase-1e/SPEC.md v1.0 (blob 843f0750) §4 matrix:
 *   bind=0 graceful-empty, single/multi-day UTC bucketing, F2 day-selection, F3
 *   idempotency + hash stability (H1), four-kind fail-closed, output_schema enforce,
 *   D-11 atoms, system/operator reason namespaces, manifest strict PASS-only,
 *   criterion-4 path_unsafe, criterion-2 half-blind stamp, decoy non-read,
 *   late-arrival ledger, getPhaseWindowAge reuse, append-only + lock, --dry-run
 *   no-persist, path isolation, zero-self-implement, contracts-gate negative.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';

import {
  produceMetricsDaily, aggregateDay, computeMetricRecordHash, MetricsDailyProducer,
  GENERATOR_VERSION, utcDateOf, computeDefaultDate, isCompleteDay,
} from '../.claude/scripts/learning/metrics_daily_producer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const PRODUCER = join(REPO, '.claude/scripts/learning/metrics_daily_producer.mjs');
const METRICS_SCHEMA = join(REPO, '_meta/contracts/learning/metrics_daily_v1.schema.yaml');
const RECORD_SCHEMA = join(REPO, '_meta/contracts/learning/fact_run_outcome_record_v1.schema.yaml');
const VALIDATE_CONTRACTS = join(REPO, '_meta/contracts/scripts/validate-contracts.mjs');
const COMMITTED_FIXTURES = join(REPO, 'tests/fixtures/metrics_daily');
const GOLDEN_HASH = join(COMMITTED_FIXTURES, 'golden/2026-01-01.hash');

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

function freshRoot() { return mkdtempSync(join(tmpdir(), 'md1e-test-')); }
function learnDir(root) { return join(root, 'state/runtime/learning'); }
function recordsPath(root) { return join(root, 'state/memory/facts/fact_run_outcome_records.jsonl'); }
function trialsPath(root) { return join(learnDir(root), 'policy_trials.jsonl'); }
function transitionsPath(root) { return join(learnDir(root), 'heartbeat_phase_transitions.jsonl'); }
function liveStatePath(root) { return join(learnDir(root), 'heartbeat_learning_state.json'); }
function outPath(root) { return join(learnDir(root), 'metrics_daily.jsonl'); }
function latePath(root) { return join(learnDir(root), 'metrics_daily_late_arrivals.jsonl'); }
function lockPath(root) { return join(learnDir(root), 'metrics_daily.lock'); }

function writeLines(p, objs) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${objs.map((o) => JSON.stringify(o)).join('\n')}\n`);
}
function readRows(root) {
  if (!existsSync(outPath(root))) return [];
  return readFileSync(outPath(root), 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

let _hex = 0;
function hex64() { return ((++_hex) % 256).toString(16).padStart(2, '0').repeat(32); }

function fullRecord(overrides = {}) {
  return {
    source_system: 'amazon-growth-engine', source_repo: 'amazon-growth-engine',
    source_commit_sha: '1111111111111111111111111111111111111111', source_branch: 'main',
    source_worktree_id: 'wt', source_dirty: false, manifest_hash: `sha256:${hex64()}`,
    emitted_at: '2026-01-01T10:00:00+00:00', trace_id: 't', artifact_type: 'verification_json',
    artifact_path: 'out/x.json', playbook_ref: 'pb', step_id: 's', raw_payload_ref: 'out/x.json',
    raw_payload_hash: `sha256:${hex64()}`, raw_payload_summary: { k: 'v' },
    redaction_status: 'no_sensitive_fields_detected', event_identity_key: `sha256:${hex64()}`,
    event_content_hash: `sha256:${hex64()}`, schema_version: '1.0.0',
    ingested_at: '2026-01-02T00:00:00+00:00', importer_version: 'discover_new_runs@2.0.0',
    canonical_record_hash: `sha256:${hex64()}`,
    provenance: { manifest_validator_status: 'PASS', provenance_dirty: false },
    ...overrides,
  };
}
function policyTrial(overrides = {}) {
  return {
    trial_id: 'tid-default', policy_id: 'P1', system_verdict: 'NEEDS_HUMAN',
    system_verdict_reason_codes: ['duplicate_conflict'], evidence_origin: 'production_observed',
    evaluated_at: '2026-01-01T12:00:00+00:00', schema_version: '1.0.0', ...overrides,
  };
}
function v2State(overrides = {}) {
  return {
    version: 2, enabled: true, evaluator_enabled: true, trial_write_enabled: false,
    candidate_write_enabled: false, candidate_write_target_status: 'sandbox',
    promotion_enabled: false, production_write_enabled: false,
    source_allowlist: ['amazon-growth-engine'], max_trials_per_day: 50, kill_switch_required: true,
    cooldown_minutes: 30, _runtime_owned_fields: ['current_phase', 'current_phase_derived_at', 'last_run_at'],
    current_phase: 'evaluating_metrics_only', current_phase_derived_at: '2026-01-01T08:00:00+00:00',
    last_run_at: '2026-01-01T08:00:00+00:00', ...overrides,
  };
}
function writeConflict(root, source, hex, detectedAt) {
  const d = join(learnDir(root), 'fact_conflicts', source, hex);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'conflict_meta.yaml'), `detected_at: "${detectedAt}"\nevent_identity_key: "sha256:${hex}"\n`);
}
function writeReject(root, segment, sha, reason, detectedAt) {
  const d = join(learnDir(root), 'fact_rejects', segment, sha);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'reject_meta.yaml'), `reason: "${reason}"\ndetected_at: "${detectedAt}"\nraw_sidecar_sha256: "sha256:${sha}"\n`);
}

// --------------------------------------------------------------------------- //
// Pure helpers
// --------------------------------------------------------------------------- //

test('utcDateOf: tz conversion + missing-offset fail-closed', () => {
  assert.equal(utcDateOf('2026-01-01T10:00:00+00:00'), '2026-01-01');
  assert.equal(utcDateOf('2026-01-01T23:30:00+08:00'), '2026-01-01'); // UTC 15:30 same day
  assert.equal(utcDateOf('2026-01-02T07:00:00+08:00'), '2026-01-01'); // UTC 23:00 prior day
  assert.equal(utcDateOf('2026-01-01T00:00:00.000Z'), '2026-01-01');
  assert.throws(() => utcDateOf('2026-01-01T10:00:00'), /tz offset/);
});

test('computeDefaultDate = yesterday; isCompleteDay boundary', () => {
  const now = new Date('2026-01-15T12:00:00Z');
  assert.equal(computeDefaultDate(now), '2026-01-14');
  assert.equal(isCompleteDay('2026-01-14', now), true);
  assert.equal(isCompleteDay('2026-01-15', now), false);
});

test('computeMetricRecordHash is deterministic + key-order-independent + sha256-prefixed', () => {
  const h1 = computeMetricRecordHash({ date_utc: '2026-01-01', a: 1, b: [1, 2] });
  const h2 = computeMetricRecordHash({ b: [1, 2], a: 1, date_utc: '2026-01-01' });
  assert.equal(h1, h2);
  assert.match(h1, /^sha256:[0-9a-f]{64}$/);
});

test('aggregateDay is pure: empty inputs -> zeroed + no_trials', () => {
  const agg = aggregateDay('2026-01-01', {
    records: { objects: [] }, trials: { objects: [] }, transitions: { objects: [] },
    conflicts: { metas: [] }, rejects: { metas: [] }, liveState: null, liveStatePresent: false,
  });
  assert.equal(agg.counts.fact_records_total, 0);
  assert.equal(agg.d11_kpis.operator_agreement_rate_today, null);
  assert.deepEqual(agg.d11_kpis.kpi_unavailable_reasons, ['no_trials']);
});

// --------------------------------------------------------------------------- //
// bind=0 graceful-empty
// --------------------------------------------------------------------------- //

test('bind=0: 6 inputs absent -> zeroed row + inputs_present all false + exit 0', () => {
  const root = freshRoot();
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r.fail_closed.kind, null);
  assert.equal(r.action, 'appended');
  assert.deepEqual(r.counts, {
    fact_records_total: 0, fact_conflicts_total: 0, fact_rejects_total: 0,
    policy_trials_total: 0, transitions_total: 0,
  });
  assert.deepEqual(Object.values(r.inputs_present), [false, false, false, false, false, false]);
  const [row] = readRows(root);
  assert.deepEqual(row.d11_kpis.kpi_unavailable_reasons, ['no_trials']);
  assert.equal(row.heartbeat_snapshot, null);
  assert.equal(row.current_phase, null);
  rmSync(root, { recursive: true, force: true });
});

test('present-but-empty file == absent (graceful)', () => {
  const root = freshRoot();
  mkdirSync(dirname(recordsPath(root)), { recursive: true });
  writeFileSync(recordsPath(root), '');
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root, dryRun: true });
  assert.equal(r.fail_closed.kind, null);
  assert.equal(r.counts.fact_records_total, 0);
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// Committed-fixtures aggregation + golden
// --------------------------------------------------------------------------- //

test('committed fixtures: day-1 counts (cross-day records/transitions excluded)', () => {
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: COMMITTED_FIXTURES, dryRun: true });
  assert.equal(r.fail_closed.kind, null);
  assert.deepEqual(r.counts, {
    fact_records_total: 2, fact_conflicts_total: 1, fact_rejects_total: 2,
    policy_trials_total: 2, transitions_total: 1,
  });
  assert.equal(r.current_phase, 'evaluating_metrics_only');
});

test('committed fixtures: full row breakdowns + pinned golden hash', () => {
  const root = freshRoot();
  cpSync(COMMITTED_FIXTURES, root, { recursive: true });
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r.action, 'appended');
  const [row] = readRows(root);
  assert.deepEqual(row.fact_records_breakdown.by_manifest_validator_status, { PASS: 1, WARN: 1, FAIL: 0 });
  assert.deepEqual(row.fact_records_breakdown.by_redaction_status, { redacted: 1, no_sensitive_fields_detected: 1, unknown: 0 });
  assert.deepEqual(row.fact_records_breakdown.source_dirty, { true_count: 1, false_count: 1 });
  assert.deepEqual(row.phase_1_exit_signals.c1_manifest_validator.per_source['amazon-growth-engine'], { pass: 1, warn: 1, fail: 0 });
  assert.equal(row.phase_1_exit_signals.c2_dedupe_hit_rate, 'unobservable_from_disk');
  assert.equal(row.phase_1_exit_signals.c2_duplicate_conflict_count, 1);
  assert.equal(row.phase_1_exit_signals.c4_path_unsafe_reject_count, 1);
  assert.equal(row.d11_kpis.operator_agreement_rate_today, 0.5);
  assert.equal(row.d11_kpis.critical_false_negative_count_today, 1);
  assert.deepEqual(row.d11_kpis.kpi_unavailable_reasons, []);
  assert.equal(row.heartbeat_snapshot.flags.production_write_enabled, false);
  const golden = readFileSync(GOLDEN_HASH, 'utf-8').trim();
  assert.equal(r.metric_record_hash, golden, 'hash matches pinned golden (edit fixtures -> update golden/2026-01-01.hash)');
  rmSync(root, { recursive: true, force: true });
});

test('committed fixture records are valid against the frozen record_v1 schema', () => {
  const v = new Ajv({ strict: false, allErrors: true, validateFormats: false })
    .compile(parseYaml(readFileSync(RECORD_SCHEMA, 'utf-8')));
  const lines = readFileSync(join(COMMITTED_FIXTURES, 'state/memory/facts/fact_run_outcome_records.jsonl'), 'utf-8')
    .trim().split('\n').filter(Boolean);
  for (const l of lines) assert.equal(v(JSON.parse(l)), true, `record valid: ${v.errors ? JSON.stringify(v.errors[0]) : ''}`);
});

// --------------------------------------------------------------------------- //
// UTC bucketing
// --------------------------------------------------------------------------- //

test('multi-day: emitted_at 23:30+08:00 buckets to prior UTC day; only target day counted', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [
    fullRecord({ emitted_at: '2026-01-01T23:30:00+08:00' }), // UTC 2026-01-01 15:30 -> day-1
    fullRecord({ emitted_at: '2026-01-02T10:00:00+00:00' }), // day-2 -> excluded
  ]);
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root, dryRun: true });
  assert.equal(r.counts.fact_records_total, 1);
  rmSync(root, { recursive: true, force: true });
});

test('M3: conflicts/rejects bucket on detected_at (not emitted_at); unknown/ segment enumerated', () => {
  const root = freshRoot();
  writeConflict(root, 'amazon-growth-engine', 'a'.repeat(64), '2026-01-01T09:00:00+00:00');
  writeConflict(root, 'amazon-growth-engine', 'b'.repeat(64), '2026-01-02T09:00:00+00:00'); // day-2 excluded
  writeReject(root, 'amazon-growth-engine', 'c'.repeat(64), 'PATH_UNSAFE', '2026-01-01T09:00:00+00:00');
  writeReject(root, 'unknown', 'd'.repeat(64), 'SCHEMA_INVALID', '2026-01-01T09:30:00+00:00'); // unknown/ segment
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  const [row] = readRows(root);
  assert.equal(row.counts.fact_conflicts_total, 1, 'only day-1 conflict (detected_at) counted');
  assert.equal(row.phase_1_exit_signals.c2_duplicate_conflict_count, 1);
  assert.equal(row.fact_rejects_breakdown.by_reason.PATH_UNSAFE, 1);
  assert.equal(row.fact_rejects_breakdown.by_reason.SCHEMA_INVALID, 1, 'unknown/ segment enumerated');
  assert.equal(row.phase_1_exit_signals.c4_path_unsafe_reject_count, 1);
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// F2 day-selection
// --------------------------------------------------------------------------- //

test('F2: default --date = yesterday (injected now)', () => {
  const root = freshRoot();
  const r = produceMetricsDaily({ rootDir: root, dryRun: true, now: new Date('2026-01-15T12:00:00Z') });
  assert.equal(r.date_utc, '2026-01-14');
  assert.equal(r.complete_day, true);
  rmSync(root, { recursive: true, force: true });
});

test('F2: current UTC day WITHOUT --allow-incomplete -> kind=incomplete_day, no write', () => {
  const root = freshRoot();
  const r = produceMetricsDaily({ dateUtc: '2026-01-15', rootDir: root, now: new Date('2026-01-15T12:00:00Z') });
  assert.equal(r.fail_closed.kind, 'incomplete_day');
  assert.ok(!existsSync(outPath(root)), 'no row on incomplete_day');
  rmSync(root, { recursive: true, force: true });
});

test('F2: current UTC day WITH --allow-incomplete -> complete_day:false, appended', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord({ emitted_at: '2026-01-15T08:00:00+00:00' })]);
  const r = produceMetricsDaily({ dateUtc: '2026-01-15', rootDir: root, allowIncomplete: true, now: new Date('2026-01-15T12:00:00Z') });
  assert.equal(r.fail_closed.kind, null);
  assert.equal(r.complete_day, false);
  assert.equal(r.action, 'appended');
  assert.equal(r.counts.fact_records_total, 1);
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// F3 idempotency + hash stability (H1)
// --------------------------------------------------------------------------- //

test('F3: same-hash rerun -> skipped_same_hash, no new line', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord()]);
  const r1 = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r1.action, 'appended');
  assert.equal(readRows(root).length, 1);
  const r2 = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r2.action, 'skipped_same_hash');
  assert.equal(readRows(root).length, 1);
  assert.equal(r1.metric_record_hash, r2.metric_record_hash);
  rmSync(root, { recursive: true, force: true });
});

test('F3: divergence (input changed) -> kind=divergence, jsonl unchanged', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord()]);
  produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  writeLines(recordsPath(root), [fullRecord(), fullRecord()]); // 2 records now -> different aggregate
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r.fail_closed.kind, 'divergence');
  assert.equal(readRows(root).length, 1, 'no new row on divergence');
  rmSync(root, { recursive: true, force: true });
});

test('F3: --regenerate appends a new row (latest-wins), old preserved', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord()]);
  produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  writeLines(recordsPath(root), [fullRecord(), fullRecord()]);
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root, regenerate: true });
  assert.equal(r.action, 'regenerated');
  const rows = readRows(root);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].counts.fact_records_total, 2, 'latest row reflects mutated input');
  rmSync(root, { recursive: true, force: true });
});

test('H1: mutating the live heartbeat snapshot does NOT change the hash -> no spurious divergence', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord()]);
  mkdirSync(dirname(liveStatePath(root)), { recursive: true });
  writeFileSync(liveStatePath(root), JSON.stringify(v2State({ current_phase: 'evaluating_metrics_only' })));
  const r1 = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r1.action, 'appended');
  // advance the control-plane snapshot: phase + flags + last_run_at all move
  writeFileSync(liveStatePath(root), JSON.stringify(v2State({
    current_phase: 'ingesting_only', evaluator_enabled: false, last_run_at: '2026-02-01T00:00:00+00:00',
  })));
  const r2 = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r2.metric_record_hash, r1.metric_record_hash, 'snapshot is hash-OUT (H1)');
  assert.equal(r2.action, 'skipped_same_hash', 'no divergence on snapshot advance');
  assert.equal(r2.current_phase, 'ingesting_only', 'snapshot still reflected in the report');
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// Four-kind fail-closed (incomplete_day covered above)
// --------------------------------------------------------------------------- //

test('input_unreadable: a record emitted_at missing tz offset -> kind=input_unreadable', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord({ emitted_at: '2026-01-01T10:00:00' })]);
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r.fail_closed.kind, 'input_unreadable');
  assert.ok(!existsSync(outPath(root)));
  rmSync(root, { recursive: true, force: true });
});

test('input_unreadable: a corrupt reject_meta.yaml -> kind=input_unreadable', () => {
  const root = freshRoot();
  const d = join(learnDir(root), 'fact_rejects/unknown/aa');
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'reject_meta.yaml'), 'reason: "unterminated\n  - ][');
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r.fail_closed.kind, 'input_unreadable');
  rmSync(root, { recursive: true, force: true });
});

test('single malformed jsonl line is skipped (NOT input_unreadable)', () => {
  const root = freshRoot();
  mkdirSync(dirname(recordsPath(root)), { recursive: true });
  writeFileSync(recordsPath(root), `${JSON.stringify(fullRecord())}\n{ not json\n`);
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root, dryRun: true });
  assert.equal(r.fail_closed.kind, null);
  assert.equal(r.counts.fact_records_total, 1);
  rmSync(root, { recursive: true, force: true });
});

test('output_schema: a row that violates the registered schema -> kind=output_schema (producer-side enforce)', () => {
  const orig = readFileSync(METRICS_SCHEMA, 'utf-8');
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord()]);
  try {
    const broken = orig.replace('  - schema_version\n  - generator_version', '  - __never_emitted__\n  - schema_version\n  - generator_version');
    assert.notEqual(broken, orig, 'injection applied');
    writeFileSync(METRICS_SCHEMA, broken);
    let status = 0; let stdout = '';
    try { stdout = execSync(`node ${PRODUCER} --date 2026-01-01 --fixtures ${root} --json`, { encoding: 'utf-8' }); }
    catch (e) { status = e.status; stdout = e.stdout || ''; }
    assert.equal(status, 2, 'fail-closed exit');
    assert.equal(JSON.parse(stdout).fail_closed.kind, 'output_schema');
  } finally {
    writeFileSync(METRICS_SCHEMA, orig);
    assert.equal(readFileSync(METRICS_SCHEMA, 'utf-8'), orig, 'schema restored byte-identical');
    rmSync(root, { recursive: true, force: true });
  }
});

// --------------------------------------------------------------------------- //
// D-11 atoms + reason namespaces + manifest strict PASS-only
// --------------------------------------------------------------------------- //

test('D-11: all on-time feedback NEEDS_MORE_EVIDENCE -> rate null + denominator_zero reason', () => {
  const root = freshRoot();
  writeLines(trialsPath(root), [
    policyTrial({ trial_id: 'nm-1', operator_feedback: { reviewer_id_hash: `sha256:${'bb'.repeat(32)}`, verdict: 'NEEDS_MORE_EVIDENCE', reason_codes: ['weak_evidence'], reviewed_at: '2026-01-01T13:00:00+00:00' } }),
  ]);
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  const [row] = readRows(root);
  assert.equal(row.d11_kpis.operator_agreement_rate_today, null);
  assert.deepEqual(row.d11_kpis.kpi_unavailable_reasons, ['denominator_zero_all_needs_more_evidence']);
  assert.equal(row.policy_trials_breakdown.with_operator_feedback_count, 1);
  rmSync(root, { recursive: true, force: true });
});

test('D-11: critical_false_negative = DISAGREE_WITH_SYSTEM ∩ {unsafe_reuse,regression_failed,business_context_changed}', () => {
  const root = freshRoot();
  writeLines(trialsPath(root), [
    policyTrial({ trial_id: 'cfn-1', system_verdict: 'FAIL', operator_feedback: { reviewer_id_hash: `sha256:${'cc'.repeat(32)}`, verdict: 'DISAGREE_WITH_SYSTEM', reason_codes: ['unsafe_reuse'], reviewed_at: '2026-01-01T13:00:00+00:00' } }),
    policyTrial({ trial_id: 'cfn-2', system_verdict: 'PASS', operator_feedback: { reviewer_id_hash: `sha256:${'dd'.repeat(32)}`, verdict: 'DISAGREE_WITH_SYSTEM', reason_codes: ['weak_evidence'], reviewed_at: '2026-01-01T13:30:00+00:00' } }),
  ]);
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  const [row] = readRows(root);
  assert.equal(row.d11_kpis.critical_false_negative_count_today, 1, 'only the unsafe_reuse DISAGREE counts');
  assert.equal(row.d11_kpis.agreement_eligible_count, 2);
  assert.equal(row.d11_kpis.agreement_agree_count, 0);
  rmSync(root, { recursive: true, force: true });
});

test('system vs operator reason namespaces are independent (both contain "acceptable")', () => {
  const root = freshRoot();
  writeLines(trialsPath(root), [
    policyTrial({ trial_id: 'ns-1', system_verdict: 'PASS', system_verdict_reason_codes: ['acceptable'], operator_feedback: { reviewer_id_hash: `sha256:${'ee'.repeat(32)}`, verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: '2026-01-01T13:00:00+00:00' } }),
  ]);
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  const [row] = readRows(root);
  assert.equal(row.policy_trials_breakdown.system_reason_codes.acceptable, 1);
  assert.equal(row.d11_kpis.operator_reason_codes.acceptable, 1);
  rmSync(root, { recursive: true, force: true });
});

test('manifest strict PASS-only: a WARN record is NOT counted as a c1 pass', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [
    fullRecord({ provenance: { manifest_validator_status: 'PASS', provenance_dirty: false } }),
    fullRecord({ provenance: { manifest_validator_status: 'WARN', provenance_dirty: true } }),
  ]);
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  const [row] = readRows(root);
  assert.deepEqual(row.phase_1_exit_signals.c1_manifest_validator.per_source['amazon-growth-engine'], { pass: 1, warn: 1, fail: 0 });
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// Late-arrival ledger (N4)
// --------------------------------------------------------------------------- //

test('late-arrival: off-day feedback -> ledger, day-N atom excludes it, rerun dedups', () => {
  const root = freshRoot();
  writeLines(trialsPath(root), [
    policyTrial({ trial_id: 'late-1', operator_feedback: { reviewer_id_hash: `sha256:${'aa'.repeat(32)}`, verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: '2026-01-04T10:00:00+00:00' } }),
  ]);
  const r1 = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r1.action, 'appended');
  assert.equal(r1.late_arrivals_appended, 1);
  const [row] = readRows(root);
  assert.equal(row.policy_trials_breakdown.with_operator_feedback_count, 0, 'late feedback excluded from day-N atom');
  assert.deepEqual(row.d11_kpis.kpi_unavailable_reasons, ['no_operator_feedback']);
  assert.equal(readFileSync(latePath(root), 'utf-8').trim().split('\n').length, 1);
  const r2 = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r2.action, 'skipped_same_hash', 'closed row unchanged');
  assert.equal(r2.late_arrivals_appended, 0, 'dedup: no re-append');
  assert.equal(readFileSync(latePath(root), 'utf-8').trim().split('\n').length, 1);
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// Decoy non-read + pre-v2 tolerance + getPhaseWindowAge reuse
// --------------------------------------------------------------------------- //

test('decoy: a pre-v2 file under proactive/ is never read -> current_phase null', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord()]);
  const decoyDir = join(root, 'state/runtime/proactive');
  mkdirSync(decoyDir, { recursive: true });
  writeFileSync(join(decoyDir, 'heartbeat_learning_state.json'), JSON.stringify({ version: 1, enabled: false, current_phase: 'trialing' }));
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root, dryRun: true });
  assert.equal(r.fail_closed.kind, null);
  assert.equal(r.current_phase, null, 'proactive/ decoy never read');
  assert.equal(r.inputs_present.live_state, false);
  rmSync(root, { recursive: true, force: true });
});

test('pre-v2 live state under learning/ is tolerated -> current_phase null (not input_unreadable)', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord()]);
  mkdirSync(dirname(liveStatePath(root)), { recursive: true });
  writeFileSync(liveStatePath(root), JSON.stringify({ version: 1, enabled: false }));
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root, dryRun: true });
  assert.equal(r.fail_closed.kind, null);
  assert.equal(r.current_phase, null);
  assert.equal(r.inputs_present.live_state, true, 'physically present, but pre-v2 -> null snapshot');
  rmSync(root, { recursive: true, force: true });
});

test('getPhaseWindowAge reuse: null without transitions, number with', () => {
  const root = freshRoot();
  const r1 = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root, dryRun: true });
  assert.equal(r1.phase_window_age_seconds, null);
  writeLines(transitionsPath(root), [
    { transition_at: '2026-01-01T08:00:00+00:00', from: null, to: 'evaluating_metrics_only', reason: 'bootstrap', actor: 'runtime' },
  ]);
  writeFileSync(liveStatePath(root), JSON.stringify(v2State()));
  const r2 = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root, dryRun: true });
  assert.equal(typeof r2.phase_window_age_seconds, 'number');
  assert.ok(r2.phase_window_age_seconds >= 0);
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// Append-only + lock + dry-run + isolation + report shape
// --------------------------------------------------------------------------- //

test('lock: an O_EXCL lock already held -> produceMetricsDaily throws (single-flight)', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord()]);
  mkdirSync(learnDir(root), { recursive: true });
  writeFileSync(lockPath(root), 'held');
  assert.throws(() => produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root }), /lock/i);
  rmSync(root, { recursive: true, force: true });
});

test('--dry-run persists nothing (no metrics_daily / late_arrivals / lock)', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord()]);
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root, dryRun: true });
  assert.equal(r.write_mode, 'rehearse');
  assert.ok(!existsSync(outPath(root)) && !existsSync(latePath(root)) && !existsSync(lockPath(root)), 'nothing persisted');
  rmSync(root, { recursive: true, force: true });
});

test('path isolation: --fixtures rootDir -> outputs under rootDir/state/runtime/learning', () => {
  const root = freshRoot();
  writeLines(recordsPath(root), [fullRecord()]);
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  assert.equal(r.root_mode, 'fixtures_root');
  assert.ok(existsSync(outPath(root)) && outPath(root).startsWith(join(root, 'state/runtime/learning')));
  rmSync(root, { recursive: true, force: true });
});

test('MetricsDailyReport shape (§1.1) is complete', () => {
  const root = freshRoot();
  const r = produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root, dryRun: true });
  assert.deepEqual(Object.keys(r).sort(), [
    'action', 'complete_day', 'counts', 'current_phase', 'date_utc', 'fail_closed',
    'generated_at_utc', 'inputs_present', 'late_arrivals_appended', 'metric_record_hash',
    'phase_window_age_seconds', 'root_mode', 'write_mode',
  ].sort());
  rmSync(root, { recursive: true, force: true });
});

test('generator_version + schema_version are the locked tokens', () => {
  assert.equal(GENERATOR_VERSION, 'metrics_daily_producer@1.0.0');
  const root = freshRoot();
  produceMetricsDaily({ dateUtc: '2026-01-01', rootDir: root });
  const [row] = readRows(root);
  assert.equal(row.generator_version, 'metrics_daily_producer@1.0.0');
  assert.equal(row.schema_version, '1.0.0');
  rmSync(root, { recursive: true, force: true });
});

test('MetricsDailyProducer.run() delegates to produceMetricsDaily', () => {
  const root = freshRoot();
  const r = new MetricsDailyProducer({ dateUtc: '2026-01-01', rootDir: root, dryRun: true }).run();
  assert.equal(r.date_utc, '2026-01-01');
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// Reuse / standalone (N3) source assertions
// --------------------------------------------------------------------------- //

test('reuse: producer imports getPhaseWindowAge + hashCanonical, no inline canonicalization, no sibling-CLI invoke', () => {
  const src = readFileSync(PRODUCER, 'utf-8');
  assert.match(src, /import\s*\{[^}]*getPhaseWindowAge[^}]*\}\s*from\s*'\.\/heartbeat_runner\.mjs'/);
  assert.match(src, /import\s*\{[^}]*hashCanonical[^}]*\}\s*from\s*'\.\/canonical_json\.mjs'/);
  assert.ok(!src.includes('function emitCanonical'), 'no inline canonical emitter');
  assert.ok(!src.includes('sort_keys'), 'no reimplemented canonicalization');
  assert.match(src, /LIVE_STATE_REL = 'state\/runtime\/learning\/heartbeat_learning_state\.json'/, 'reads learning/, not proactive/');
  assert.ok(!src.includes('policy_trial_evaluator'), 'no evaluator module reference (standalone, N3)');
  assert.ok(!src.includes('import_facts.mjs'), 'no importer module reference (standalone, N3)');
  assert.ok(!/\bspawnSync?\s*\(/.test(src), 'no spawn');
  assert.ok(!/\bexecSync\s*\(/.test(src), 'no execSync');
});

// --------------------------------------------------------------------------- //
// CLI smoke (DoD #2)
// --------------------------------------------------------------------------- //

test('CLI: --help exits 0 and prints usage', () => {
  const out = execSync(`node ${PRODUCER} --help`, { encoding: 'utf-8' });
  assert.match(out, /Usage:/);
});

test('CLI: --date --dry-run --json --fixtures exits 0 with a valid report', () => {
  const root = freshRoot();
  const out = execSync(`node ${PRODUCER} --date 2026-01-01 --dry-run --json --fixtures ${root}`, { encoding: 'utf-8' });
  const r = JSON.parse(out);
  assert.equal(r.write_mode, 'rehearse');
  assert.equal(r.action, 'appended');
  rmSync(root, { recursive: true, force: true });
});

test('CLI: bad --date format -> exit 1 (UNEXPECTED)', () => {
  let status = 0;
  try { execSync(`node ${PRODUCER} --date not-a-date --json`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (e) { status = e.status; }
  assert.equal(status, 1);
});

// --------------------------------------------------------------------------- //
// Contracts-gate registration + negative (DoD #3)
// --------------------------------------------------------------------------- //

test('contracts gate: metrics_daily_v1 schema is registered (not silently skipped)', () => {
  const src = readFileSync(VALIDATE_CONTRACTS, 'utf-8');
  assert.match(src, /metrics_daily_v1\.schema\.yaml/);
});

test('contracts gate negative: corrupting the registered metrics schema turns the gate RED', () => {
  const orig = readFileSync(METRICS_SCHEMA, 'utf-8');
  try {
    writeFileSync(METRICS_SCHEMA, 'broken: "unterminated\n  - ][');
    let out = '';
    try { out = execSync(`node ${VALIDATE_CONTRACTS}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (e) { out = `${e.stdout || ''}${e.stderr || ''}`; }
    assert.match(out, /metrics_daily_v1\.schema\.yaml/, 'gate processes the registered schema');
    assert.match(out, /metrics_daily_v1[\s\S]*?(Failed to parse|not found)/, 'gate errors on the corrupt registered schema');
  } finally {
    writeFileSync(METRICS_SCHEMA, orig);
    assert.equal(readFileSync(METRICS_SCHEMA, 'utf-8'), orig, 'schema restored byte-identical');
  }
});
