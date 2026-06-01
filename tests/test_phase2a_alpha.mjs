#!/usr/bin/env node
/**
 * test_phase2a_alpha.mjs - Phase 2a-α node:test suite (flip-readiness surface).
 *
 * Prefix-named (no `.test.` infix) so vitest's default include glob does NOT collect
 * it; run explicitly with:  node --test tests/test_phase2a_alpha.mjs
 *
 * Covers SPEC .planning/phase-2a/SPEC.md v1.0 (blob e74f205f) §4 matrix:
 *   - exit-gate three-state verdict + per-day classification (BLOCKED/INDETERMINATE/
 *     STREAK-contrib), strict PASS-only c1, c2/c4 criteria, latest-wins, missing/bad
 *     metrics, defensive partial-row read, exit codes, empty-day != BLOCKED (OQ-1);
 *   - ceiling relax (trial_write derives trialing; candidate/promotion/production still
 *     ceiling) + operator_rollback / flip / negative reason guards;
 *   - evaluator --mode live二次门: 5 fail-closed classes (exit 2 not 1) + 放行 + ship≠
 *     activation e2e (2 substates) + dry_run no-regress.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

import {
  checkPhase1ExitGate, evaluateWindow, classifyDayForSource,
  indexMetricsByDate, Phase1ExitGateChecker,
} from '../.claude/scripts/learning/phase_1_exit_gate_check.mjs';
import { evaluatePolicyTrials } from '../src/reasoning/policy_trial_evaluator.mjs';
import { runHeartbeat, deriveCurrentPhase, checkCeiling } from '../.claude/scripts/learning/heartbeat_runner.mjs';
import { parseCanonical, hashCanonical } from '../.claude/scripts/learning/canonical_json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const GATE = join(REPO, '.claude/scripts/learning/phase_1_exit_gate_check.mjs');
const FIXTURES = join(REPO, 'tests/fixtures/phase2a_alpha');
const SOURCE = 'amazon-growth-engine';

// Deterministic window: asof 2026-06-08, window 7 => 2026-06-02 .. 2026-06-08.
const ASOF = '2026-06-08';
const WINDOW_DAYS = ['2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08'];

// --------------------------------------------------------------------------- //
// Fixture helpers
// --------------------------------------------------------------------------- //

function mkRoot() { return mkdtempSync(join(tmpdir(), 'p2a-')); }
function cleanup(root) { try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ } }

/** A phase_1_exit_signals block for `SOURCE`. pass/warn/fail target the source's c1. */
function mkSignals({ pass = 5, warn = 0, fail = 0, dup = 0, pathUnsafe = 0 } = {}) {
  return {
    c1_manifest_validator: {
      per_source: {
        'amazon-growth-engine': { pass, warn, fail },
        chaming: { pass: 0, warn: 0, fail: 0 },
        loamwise: { pass: 0, warn: 0, fail: 0 },
      },
    },
    c2_duplicate_conflict_count: dup,
    c2_dedupe_hit_rate: 'unobservable_from_disk',
    c4_path_unsafe_reject_count: pathUnsafe,
  };
}

function mkRow(dateUtc, signalsOpts) {
  return { date_utc: dateUtc, phase_1_exit_signals: mkSignals(signalsOpts) };
}

/** Write a metrics_daily.jsonl from an array of row objects (raw strings allowed). */
function writeMetrics(root, rows) {
  const p = join(root, 'metrics.jsonl');
  writeFileSync(p, rows.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n') + '\n');
  return p;
}

/** A clean 7-day window with optional per-day overrides keyed by date. */
function cleanWindowRows(overrides = {}) {
  return WINDOW_DAYS.map((d) => (d in overrides ? overrides[d] : mkRow(d)));
}

function gateVerdict(root, rows, opts = {}) {
  const metrics = writeMetrics(root, rows);
  return checkPhase1ExitGate({ metrics, source: SOURCE, asof: ASOF, window: 7, ...opts });
}

// Full 16-key heartbeat v2 state (mirrors the frozen schema; current_phase is the
// stored prev-phase label, recomputed by the runner from the flags).
function makeState(overrides = {}) {
  return {
    version: 2, enabled: true, evaluator_enabled: true, trial_write_enabled: false,
    candidate_write_enabled: false, candidate_write_target_status: 'sandbox',
    promotion_enabled: false, production_write_enabled: false,
    source_allowlist: ['amazon-growth-engine'], max_trials_per_day: 50,
    kill_switch_required: true, cooldown_minutes: 30,
    _runtime_owned_fields: ['current_phase', 'current_phase_derived_at', 'last_run_at'],
    current_phase: 'evaluating_metrics_only',
    current_phase_derived_at: '2026-05-30T00:00:00.000Z',
    last_run_at: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

function hbPaths(root) {
  const dir = join(root, 'state/runtime/learning');
  return { dir, live: join(dir, 'heartbeat_learning_state.json'), transitions: join(dir, 'heartbeat_phase_transitions.jsonl') };
}

function seedHbState(root, stateObj) {
  const { dir, live } = hbPaths(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(live, JSON.stringify(stateObj, null, 2));
}

function lastTransition(root) {
  const lines = readFileSync(hbPaths(root).transitions, 'utf-8').trim().split('\n').filter(Boolean);
  return JSON.parse(lines[lines.length - 1]);
}

/** Write an arbitrary heartbeat_learning_state.json (for the evaluator二次门 reads). */
function seedEvalLiveState(root, obj) {
  const dir = join(root, 'state/runtime/learning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'heartbeat_learning_state.json'),
    typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}

// 1c conflict + policy writers (minimal; bound conflict drives the only live trial path).
function writePolicy(root, status, policyId, traceIds) {
  const dir = join(root, 'state/memory/learned/policies', status);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${policyId}.yaml`),
    JSON.stringify({ policy_id: policyId, evidence: traceIds.map((t) => ({ trace_id: t, summary: 's' })) }, null, 2));
}
function writeConflict(root, sys, idHex, incoming, original) {
  const dir = join(root, 'state/runtime/learning/fact_conflicts', sys, idHex);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'incoming.json'), JSON.stringify(incoming));
  if (original) writeFileSync(join(dir, 'original.json'), JSON.stringify(original) + '\n');
}
function mkEvent(overrides = {}) {
  return {
    artifact_path: 'out/x.json', artifact_type: 'verification_json',
    event_identity_key: 'sha256:' + 'a'.repeat(64), playbook_ref: 'pb',
    source_commit_sha: 'b'.repeat(40), source_dirty: false,
    source_repo: 'amazon-growth-engine', source_system: 'amazon-growth-engine',
    step_id: 's1', trace_id: 'run-20260530-aaaa1111', ...overrides,
  };
}
function trialsOutPath(root) { return join(root, 'state/runtime/learning/policy_trials.jsonl'); }

// --------------------------------------------------------------------------- //
// §4.1 exit-gate three-state verdict + per-day classification
// --------------------------------------------------------------------------- //

test('exit-gate: 7 clean days -> PASS (exit 0), streak_len=7 all-of-window', () => {
  const root = mkRoot();
  try {
    const r = gateVerdict(root, cleanWindowRows());
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.days_present, 7);
    assert.equal(r.streak_len, 7);
    assert.equal(r.blocked_days.length, 0);
    assert.ok(r.per_day.every((d) => d.classification === 'STREAK-contrib'));
  } finally { cleanup(root); }
});

test('exit-gate: committed golden fixture -> PASS', () => {
  const r = checkPhase1ExitGate({
    metrics: join(FIXTURES, 'metrics_pass_7day.jsonl'), source: SOURCE, asof: ASOF, window: 7,
  });
  assert.equal(r.verdict, 'PASS');
});

for (const variant of [
  { name: 'c1 fail>0', day: '2026-06-05', sig: { fail: 2 }, crit: 'c1' },
  { name: 'c1 warn>0', day: '2026-06-04', sig: { warn: 1 }, crit: 'c1' },
  { name: 'c2 duplicate>0', day: '2026-06-06', sig: { dup: 1 }, crit: 'c2' },
  { name: 'c4 path_unsafe>0', day: '2026-06-03', sig: { pathUnsafe: 1 }, crit: 'c4' },
]) {
  test(`exit-gate: a ${variant.name} day -> BLOCKED (exit 2) + blocked_days + failed_criteria`, () => {
    const root = mkRoot();
    try {
      const rows = cleanWindowRows({ [variant.day]: mkRow(variant.day, variant.sig) });
      const r = gateVerdict(root, rows);
      assert.equal(r.verdict, 'BLOCKED');
      assert.deepEqual(r.blocked_days, [variant.day]);
      assert.ok(r.failed_criteria.includes(variant.crit));
      const bd = r.per_day.find((d) => d.date_utc === variant.day);
      assert.equal(bd.classification, 'BLOCKED-day');
    } finally { cleanup(root); }
  });
}

test('exit-gate: an empty day (pass==0,fail==0,warn==0) -> INDETERMINATE, NOT BLOCKED (OQ-1)', () => {
  const root = mkRoot();
  try {
    const rows = cleanWindowRows({ '2026-06-05': mkRow('2026-06-05', { pass: 0 }) });
    const r = gateVerdict(root, rows);
    assert.equal(r.verdict, 'INDETERMINATE');
    assert.equal(r.blocked_days.length, 0);
    const d = r.per_day.find((x) => x.date_utc === '2026-06-05');
    assert.equal(d.classification, 'INDETERMINATE-day');
    assert.equal(d.row_present, true);
  } finally { cleanup(root); }
});

test('exit-gate: BLOCKED has priority over INDETERMINATE (mixed empty + explicit-fail day)', () => {
  const root = mkRoot();
  try {
    const rows = cleanWindowRows({
      '2026-06-04': mkRow('2026-06-04', { pass: 0 }),  // INDETERMINATE-day
      '2026-06-06': mkRow('2026-06-06', { fail: 1 }),  // BLOCKED-day
    });
    const r = gateVerdict(root, rows);
    assert.equal(r.verdict, 'BLOCKED', 'any explicit-failure day wins over data-insufficiency');
  } finally { cleanup(root); }
});

test('exit-gate: a missing row -> INDETERMINATE + days_missing (C3 continuity)', () => {
  const root = mkRoot();
  try {
    const rows = cleanWindowRows().filter((row) => row.date_utc !== '2026-06-05');
    const r = gateVerdict(root, rows);
    assert.equal(r.verdict, 'INDETERMINATE');
    assert.deepEqual(r.days_missing, ['2026-06-05']);
    assert.equal(r.days_present, 6);
    const d = r.per_day.find((x) => x.date_utc === '2026-06-05');
    assert.equal(d.row_present, false);
    assert.equal(d.classification, 'INDETERMINATE-day');
  } finally { cleanup(root); }
});

test('exit-gate: c1 strict PASS-only — a 4th-day warn breaks the streak (BLOCKED)', () => {
  const root = mkRoot();
  try {
    const r = gateVerdict(root, cleanWindowRows({ '2026-06-05': mkRow('2026-06-05', { pass: 3, warn: 1 }) }));
    assert.equal(r.verdict, 'BLOCKED');
  } finally { cleanup(root); }
});

test('exit-gate: latest-wins per date_utc (1e --regenerate append semantics)', () => {
  const root = mkRoot();
  try {
    // First write 2026-06-05 as a fail day, then re-append it clean: latest line wins.
    const rows = [
      ...cleanWindowRows({ '2026-06-05': mkRow('2026-06-05', { fail: 9 }) }),
      mkRow('2026-06-05', { pass: 5 }), // regenerated clean row, appended last
    ];
    const r = gateVerdict(root, rows);
    assert.equal(r.verdict, 'PASS', 'the later clean row supersedes the earlier fail row');
  } finally { cleanup(root); }
});

test('exit-gate: missing metrics file -> INDETERMINATE (no data)', () => {
  const r = checkPhase1ExitGate({ metrics: join(tmpdir(), `nope-${process.pid}.jsonl`), source: SOURCE, asof: ASOF, window: 7 });
  assert.equal(r.verdict, 'INDETERMINATE');
  assert.equal(r.file_present, false);
  assert.equal(r.days_present, 0);
});

test('exit-gate: malformed lines are skipped + counted (still PASS on the clean rows)', () => {
  const root = mkRoot();
  try {
    const rows = [...cleanWindowRows(), '{ not json', '   ', '42'];
    const r = gateVerdict(root, rows);
    assert.equal(r.verdict, 'PASS');
    assert.ok(r.malformed_lines >= 2);
  } finally { cleanup(root); }
});

test('exit-gate: defensive read — row present but phase_1_exit_signals absent/partial -> INDETERMINATE, no crash (L4-6)', () => {
  const root = mkRoot();
  try {
    const rows = cleanWindowRows({
      '2026-06-04': { date_utc: '2026-06-04' },                                   // no signals block
      '2026-06-05': { date_utc: '2026-06-05', phase_1_exit_signals: {} },         // empty signals
      '2026-06-06': { date_utc: '2026-06-06', phase_1_exit_signals: { c1_manifest_validator: { per_source: {} } } }, // no source
    });
    const r = gateVerdict(root, rows);
    assert.equal(r.verdict, 'INDETERMINATE');
    for (const day of ['2026-06-04', '2026-06-05', '2026-06-06']) {
      const d = r.per_day.find((x) => x.date_utc === day);
      assert.equal(d.classification, 'INDETERMINATE-day');
      assert.equal(d.row_present, true);
    }
  } finally { cleanup(root); }
});

test('exit-gate: <window complete days -> INDETERMINATE (ramp-up steady state)', () => {
  const root = mkRoot();
  try {
    // only the last 3 days have rows
    const rows = WINDOW_DAYS.slice(4).map((d) => mkRow(d));
    const r = gateVerdict(root, rows);
    assert.equal(r.verdict, 'INDETERMINATE');
    assert.equal(r.days_present, 3);
  } finally { cleanup(root); }
});

test('exit-gate: pure evaluateWindow + classifyDayForSource units', () => {
  const map = new Map(WINDOW_DAYS.map((d) => [d, mkRow(d)]));
  const r = evaluateWindow(map, { source: SOURCE, asof: ASOF, window: 7 });
  assert.equal(r.verdict, 'PASS');
  // classifier direct
  assert.equal(classifyDayForSource('2026-06-05', mkRow('2026-06-05', { fail: 1 }), SOURCE).classification, 'BLOCKED-day');
  assert.equal(classifyDayForSource('2026-06-05', mkRow('2026-06-05', { pass: 0 }), SOURCE).classification, 'INDETERMINATE-day');
  assert.equal(classifyDayForSource('2026-06-05', undefined, SOURCE).classification, 'INDETERMINATE-day');
  assert.equal(classifyDayForSource('2026-06-05', mkRow('2026-06-05', { pass: 2 }), SOURCE).classification, 'STREAK-contrib');
});

test('exit-gate: indexMetricsByDate latest-wins map + class wrapper', () => {
  const root = mkRoot();
  try {
    const metrics = writeMetrics(root, [...cleanWindowRows(), mkRow('2026-06-08', { pass: 99 })]);
    const idx = indexMetricsByDate(metrics);
    assert.equal(idx.rows.get('2026-06-08').phase_1_exit_signals.c1_manifest_validator.per_source['amazon-growth-engine'].pass, 99);
    const r = new Phase1ExitGateChecker({ metrics, source: SOURCE, asof: ASOF, window: 7 }).run();
    assert.equal(r.verdict, 'PASS');
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// §4.1 exit-gate CLI exit codes (PASS 0 / non-PASS 2 / bad-arg 1)
// --------------------------------------------------------------------------- //

function runGateCli(args) {
  try {
    const stdout = execFileSync('node', [GATE, ...args], { encoding: 'utf-8' });
    return { status: 0, stdout };
  } catch (e) {
    return { status: e.status, stdout: e.stdout || '' };
  }
}

test('exit-gate CLI: PASS exit 0, BLOCKED/INDETERMINATE exit 2, --help exit 0, bad --window exit 1', () => {
  const root = mkRoot();
  try {
    const pass = writeMetrics(root, cleanWindowRows());
    assert.equal(runGateCli(['--metrics', pass, '--asof', ASOF, '--window', '7', '--source', SOURCE]).status, 0);

    const blockedMetrics = writeMetrics(root, cleanWindowRows({ '2026-06-05': mkRow('2026-06-05', { fail: 1 }) }));
    assert.equal(runGateCli(['--metrics', blockedMetrics, '--asof', ASOF, '--window', '7', '--source', SOURCE]).status, 2);

    assert.equal(runGateCli(['--help']).status, 0);
    assert.equal(runGateCli(['--metrics', pass, '--window', '-3']).status, 1);
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// §4.2 ceiling relax + operator_rollback / flip / negative reason guards (e2e runner)
// --------------------------------------------------------------------------- //

test('ceiling relax: trial_write=true ∧ evaluator=true ∧ candidate=false derives trialing (not ceiling)', () => {
  assert.equal(checkCeiling({ trial_write_enabled: true, candidate_write_enabled: false, promotion_enabled: false, production_write_enabled: false }).hit, false);
  assert.equal(deriveCurrentPhase({ enabled: true, source_allowlist: ['x'], evaluator_enabled: true, trial_write_enabled: true, candidate_write_enabled: false }), 'trialing');
});

for (const flag of ['candidate_write_enabled', 'promotion_enabled', 'production_write_enabled']) {
  test(`ceiling still locks ${flag}`, () => {
    assert.equal(checkCeiling({ trial_write_enabled: true, candidate_write_enabled: false, promotion_enabled: false, production_write_enabled: false, [flag]: true }).hit, true);
  });
}

test('operator_rollback: trialing -> evaluating_metrics_only ⇒ reason=operator_rollback', () => {
  const root = mkRoot();
  try {
    // stored prev-phase=trialing, but operator just flipped trial_write down -> derives evaluating.
    seedHbState(root, makeState({ current_phase: 'trialing', trial_write_enabled: false, evaluator_enabled: true }));
    const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
    assert.equal(r.fail_closed.kind, null);
    assert.equal(r.current_phase, 'evaluating_metrics_only');
    assert.equal(lastTransition(root).reason, 'operator_rollback');
    assert.equal(lastTransition(root).actor, 'operator');
  } finally { cleanup(root); }
});

test('flip: evaluating_metrics_only -> trialing ⇒ reason=operator (NOT rollback)', () => {
  const root = mkRoot();
  try {
    seedHbState(root, makeState({ current_phase: 'evaluating_metrics_only', trial_write_enabled: true, evaluator_enabled: true, candidate_write_enabled: false }));
    const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
    assert.equal(r.fail_closed.kind, null, 'ceiling relax lets the flip through');
    assert.equal(r.current_phase, 'trialing');
    assert.equal(lastTransition(root).reason, 'operator');
  } finally { cleanup(root); }
});

test('rollback negative guard: ingesting_only -> evaluating_metrics_only ⇒ reason=operator (not rollback)', () => {
  const root = mkRoot();
  try {
    seedHbState(root, makeState({ current_phase: 'ingesting_only', trial_write_enabled: false, evaluator_enabled: true }));
    const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
    assert.equal(r.current_phase, 'evaluating_metrics_only');
    assert.equal(lastTransition(root).reason, 'operator');
  } finally { cleanup(root); }
});

test('rollback ≠ kill_switch: enabled=false -> paused stays reason=kill_switch', () => {
  const root = mkRoot();
  try {
    seedHbState(root, makeState({ current_phase: 'trialing', enabled: false, evaluator_enabled: false, trial_write_enabled: false }));
    const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
    assert.equal(r.current_phase, 'paused');
    assert.equal(lastTransition(root).reason, 'kill_switch');
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// §4.3 evaluator --mode live二次门: 5 fail-closed classes (exit 2 not 1) + 放行
// --------------------------------------------------------------------------- //

const DENY_CASES = [
  { name: 'live state absent', seed: null },
  { name: 'unparseable JSON', seed: '{ not valid json' },
  { name: 'version !== 2 (string "2")', seed: { version: '2', current_phase: 'trialing', trial_write_enabled: true } },
  { name: 'version missing', seed: { current_phase: 'trialing', trial_write_enabled: true } },
  { name: 'missing current_phase', seed: { version: 2, trial_write_enabled: true } },
  { name: 'trial_write_enabled=false', seed: { version: 2, current_phase: 'evaluating_metrics_only', trial_write_enabled: false } },
  { name: 'current_phase!=trialing (candidate_writing)', seed: { version: 2, current_phase: 'candidate_writing', trial_write_enabled: true } },
];

for (const c of DENY_CASES) {
  test(`二次门 fail-closed: ${c.name} -> not_authorized_for_live, 0 trial, no throw (exit 2 not 1)`, () => {
    const root = mkRoot();
    try {
      if (c.seed !== null) seedEvalLiveState(root, c.seed);
      // a bound conflict is present, but the gate must short-circuit BEFORE processing it.
      const traceId = 'run-20260530-aaaa1111';
      writePolicy(root, 'candidate', 'POLICY_DUP', [traceId]);
      writeConflict(root, 'amazon-growth-engine', 'idhex01', mkEvent({ trace_id: traceId }), null);

      let report; let threw = false;
      try { report = evaluatePolicyTrials({ rootDir: root, mode: 'live' }); } catch { threw = true; }
      assert.equal(threw, false, 'parse/shape errors are caught, not thrown (would mis-map to exit 1)');
      assert.equal(report.live_authorized, false);
      assert.ok(report.fail_closed > 0, 'fail_closed>0 maps to exit 2 in main()');
      assert.equal(report.per_fail_closed[0].reason, 'not_authorized_for_live');
      assert.equal(report.trials_new, 0);
      assert.equal(report.conflicts_scanned, 0, 'gate short-circuits before the conflict loop');
      assert.equal(existsSync(trialsOutPath(root)), false, '0 trial written');
    } finally { cleanup(root); }
  });
}

test('二次门 放行: operator-flipped trialing live state -> live write succeeds', () => {
  const root = mkRoot();
  try {
    seedEvalLiveState(root, { version: 2, current_phase: 'trialing', trial_write_enabled: true });
    const traceId = 'run-20260530-aaaa1111';
    writePolicy(root, 'candidate', 'POLICY_DUP', [traceId]);
    writeConflict(root, 'amazon-growth-engine', 'idhex01', mkEvent({ trace_id: traceId }), null);

    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(report.live_authorized, true);
    assert.equal(report.fail_closed, 0);
    assert.equal(report.trials_new, 1);
    assert.equal(report.needs_human, 1, 'verdict stays NEEDS_HUMAN');
    assert.ok(existsSync(trialsOutPath(root)), 'policy_trials.jsonl written via the existing :489 path');
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// §4.3 ship ≠ activation (2 substates, L3-9) + dry_run no-regress
// --------------------------------------------------------------------------- //

test('ship≠activation (a): merged but no live state at all -> 0 trial write', () => {
  const root = mkRoot();
  try {
    const traceId = 'run-20260530-aaaa1111';
    writePolicy(root, 'candidate', 'POLICY_DUP', [traceId]);
    writeConflict(root, 'amazon-growth-engine', 'idhex01', mkEvent({ trace_id: traceId }), null);
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(report.live_authorized, false);
    assert.equal(existsSync(trialsOutPath(root)), false);
  } finally { cleanup(root); }
});

test('ship≠activation (b): bootstrapped evaluating_metrics_only (trial_write=false) -> 0 trial write', () => {
  const root = mkRoot();
  try {
    seedEvalLiveState(root, { version: 2, current_phase: 'evaluating_metrics_only', trial_write_enabled: false });
    const traceId = 'run-20260530-aaaa1111';
    writePolicy(root, 'candidate', 'POLICY_DUP', [traceId]);
    writeConflict(root, 'amazon-growth-engine', 'idhex01', mkEvent({ trace_id: traceId }), null);
    const report = evaluatePolicyTrials({ rootDir: root, mode: 'live' });
    assert.equal(report.live_authorized, false);
    assert.equal(existsSync(trialsOutPath(root)), false);
  } finally { cleanup(root); }
});

test('dry_run no-regress: default mode never reads live state, 0 write, live_authorized stays true', () => {
  const root = mkRoot();
  try {
    // NO live state seeded; dry_run must NOT fail-closed on its absence.
    const traceId = 'run-20260530-aaaa1111';
    writePolicy(root, 'candidate', 'POLICY_DUP', [traceId]);
    writeConflict(root, 'amazon-growth-engine', 'idhex01', mkEvent({ trace_id: traceId }), null);
    const report = evaluatePolicyTrials({ rootDir: root }); // default dry_run
    assert.equal(report.mode, 'dry_run');
    assert.equal(report.live_authorized, true, 'dry_run does not authorize (no gate)');
    assert.equal(report.trials_new, 1, 'dry_run still produces the trial in-report');
    assert.equal(existsSync(trialsOutPath(root)), false, 'dry_run writes nothing');
  } finally { cleanup(root); }
});

// --------------------------------------------------------------------------- //
// §4 sanity: canonical_record_hash invariant reused (gate fixtures are realistic)
// --------------------------------------------------------------------------- //

test('sanity: a synthetic metrics row round-trips through canonical hashing without error', () => {
  const ast = parseCanonical(JSON.stringify(mkRow('2026-06-08')));
  assert.match(hashCanonical(ast), /^sha256:[0-9a-f]{64}$/);
});
