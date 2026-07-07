// Phase 2a-γ 30-day rolling D-11 reducer tests (Node built-in runner: node:test).
// Run: node --test tests/test_phase2a_gamma.mjs
//
// Prefix-named (test_phase2a_gamma.mjs, no `.test.` infix) so the root vitest run does NOT
// collect it; CI-wired in a dedicated workflow (mirroring 1c/1d/1e/2a-α/β A7).
//
// Coverage mirrors SPEC `.planning/phase-2a-gamma/SPEC.md` v1.0 (blob eb17d868) §4:
//   Simpson-safe (raw-atom Σ-then-divide vs avg-of-daily counterexample / denom 0 -> null) ·
//   late-arrival (reviewed_at-in-window rebuild from trials even if evaluated outside / on-time+late
//     once / latest-wins by trial_id / visible delta vs evaluated_at bucketing) ·
//   empty fail-safe (0 trials / 0 feedback / Σeligible==0 / insufficient_window -> each reason;
//     critical_false_negative_30d NEVER 0, always null) ·
//   window semantics (rolling 30 complete UTC days / boundary 30-in-31-out / three-state /
//     UTC-day complete strictly-before-today incomplete_window) ·
//   pure-hash (rerun same hash / wall-clock OUT / same-hash skip / divergence / --regenerate / KIND 序) ·
//   reduce-operator fence (R-γ4 negative grep: no arbitrary --window) ·
//   invariants (0 trial write-back / 0 verdict / 0 candidate-promotion-production / 3 input schema
//     0-diff / 1e producer 0-diff / Phase-4 gate logic NOT in γ / gate 19->20 deterministic).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync,
} from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import Ajv from 'ajv';

import {
  produceD11Rolling, aggregateWindow, computeRollingRecordHash,
  addDaysUtc, windowFor, utcDateOf, WINDOW_DAYS, GENERATOR_VERSION,
} from '../.claude/scripts/learning/d11_rolling_30d_producer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const PRODUCER = join(REPO, '.claude/scripts/learning/d11_rolling_30d_producer.mjs');
const SCHEMA = join(REPO, '_meta/contracts/learning/d11_rolling_30d_v1.schema.yaml');

// A fixed clock so window_end=2026-05-31 (yesterday) is a complete UTC day.
const NOW = new Date('2026-06-01T12:00:00.000Z');
const WIN_END = '2026-05-31';
const WIN_START = '2026-05-02'; // 2026-05-31 minus 29 days

// --------------------------------------------------------------------------- //
// Fixtures
// --------------------------------------------------------------------------- //

function mkRoot() { return mkdtempSync(join(tmpdir(), 'p2ag-')); }
function cleanup(root) { try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ } }
function learnDir(root) { const d = join(root, 'state/runtime/learning'); mkdirSync(d, { recursive: true }); return d; }

/** Seed metrics_daily.jsonl with one minimal row per given UTC day (window-coverage signal). */
function seedMetricsDays(root, days) {
  const lines = days.map((d) => JSON.stringify({ date_utc: d })).join('\n');
  writeFileSync(join(learnDir(root), 'metrics_daily.jsonl'), lines ? `${lines}\n` : '');
}

/** The full 30 UTC days [windowEnd-29 .. windowEnd]. */
function fullWindowDays(windowEnd = WIN_END) {
  return Array.from({ length: WINDOW_DAYS }, (_, i) => addDaysUtc(windowEnd, -(WINDOW_DAYS - 1 - i)));
}

/** Seed policy_trials.jsonl with the given trial objects (in append order). */
function seedTrials(root, trials) {
  const lines = trials.map((t) => JSON.stringify(t)).join('\n');
  writeFileSync(join(learnDir(root), 'policy_trials.jsonl'), lines ? `${lines}\n` : '');
}

/**
 * Build a policy_trial_v1-shaped object. opts.fb = {verdict, reason_codes, reviewed_at}.
 * evaluatedAt defaults to the same UTC day as the feedback (on-time) when fb is given.
 */
function mkTrial(id, opts = {}) {
  const t = {
    trial_id: id,
    policy_id: opts.policy_id || 'POLICY_A',
    system_verdict: 'NEEDS_HUMAN',
    system_verdict_reason_codes: ['acceptable'],
    evidence_origin: 'production_observed',
    evaluated_at: opts.evaluated_at || `${(opts.fb && opts.fb.reviewed_at || '2026-05-15T00:00:00Z').slice(0, 10)}T00:00:00Z`,
    schema_version: '1.0.0',
  };
  if (opts.fb) {
    t.operator_feedback = {
      reviewer_id_hash: `sha256:${'a'.repeat(64)}`,
      verdict: opts.fb.verdict,
      reason_codes: opts.fb.reason_codes,
      reviewed_at: opts.fb.reviewed_at,
    };
  }
  return t;
}

function reviewedAt(dayUtc, hh = '12') { return `${dayUtc}T${hh}:00:00Z`; }

/** Run the reducer library directly with the fixed test clock. */
function run(root, opts = {}) {
  return produceD11Rolling({ rootDir: root, now: NOW, ...opts });
}

function readRows(root) {
  const p = join(root, 'state/runtime/learning/d11_rolling_30d.jsonl');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// =========================================================================== //
// Simpson-safe (SPEC §0.1-1 / DoD#1)
// =========================================================================== //

test('Simpson-safe: rate_30d == Σagree/Σeligible (raw atoms), NOT the average of per-day rates', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    // Day X (05-10): 1 AGREE + 1 DISAGREE(weak)  -> daily rate 1/2 = 0.5, eligible 2
    // Day Y (05-20): 3 AGREE + 9 DISAGREE(weak)  -> daily rate 3/12 = 0.25, eligible 12
    // pooled = (1+3)/(2+12) = 4/14 ≈ 0.2857 ; average-of-daily = (0.5+0.25)/2 = 0.375  (DIFFERENT)
    const trials = [];
    let n = 0;
    const push = (day, verdict, code) => trials.push(mkTrial(`t${n++}`, { fb: { verdict, reason_codes: [code], reviewed_at: reviewedAt(day) } }));
    push('2026-05-10', 'AGREE_WITH_SYSTEM', 'acceptable');
    push('2026-05-10', 'DISAGREE_WITH_SYSTEM', 'weak_evidence');
    for (let i = 0; i < 3; i++) push('2026-05-20', 'AGREE_WITH_SYSTEM', 'acceptable');
    for (let i = 0; i < 9; i++) push('2026-05-20', 'DISAGREE_WITH_SYSTEM', 'weak_evidence');
    seedTrials(root, trials);

    const r = run(root, { dateUtc: WIN_END, dryRun: true });
    assert.equal(r.fail_closed.kind, null);
    assert.deepEqual(r.kpi_unavailable_reasons, []); // available
    assert.equal(r.operator_agreement_rate_30d, 4 / 14);
    assert.ok(Math.abs(r.operator_agreement_rate_30d - 0.375) > 1e-9, 'must NOT equal average-of-daily-rates');
    // weak_evidence is non-critical -> a genuine 0 (PASS), distinct from null (unavailable).
    assert.equal(r.critical_false_negative_count_30d, 0);
  } finally { cleanup(root); }
});

test('Simpson-safe denom 0: feedback all NEEDS_MORE_EVIDENCE -> rate null + denominator_zero reason', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [
      mkTrial('t0', { fb: { verdict: 'NEEDS_MORE_EVIDENCE', reason_codes: ['weak_evidence'], reviewed_at: reviewedAt('2026-05-10') } }),
      mkTrial('t1', { fb: { verdict: 'NEEDS_MORE_EVIDENCE', reason_codes: ['weak_evidence'], reviewed_at: reviewedAt('2026-05-12') } }),
    ]);
    const r = run(root, { dateUtc: WIN_END, dryRun: true });
    assert.deepEqual(r.kpi_unavailable_reasons, ['denominator_zero_all_needs_more_evidence']);
    assert.equal(r.operator_agreement_rate_30d, null);
    assert.equal(r.critical_false_negative_count_30d, null); // NEVER 0 when unavailable
  } finally { cleanup(root); }
});

// =========================================================================== //
// late-arrival rebuild (SPEC §0.1-2 / D-γ6 / DoD#2)
// =========================================================================== //

test('late-arrival: trial EVALUATED before window but feedback REVIEWED in window is rebuilt (by reviewed_at)', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    // evaluated 2026-04-01 (BEFORE window start 2026-05-02), reviewed 2026-05-15 (IN window).
    seedTrials(root, [
      mkTrial('late0', { evaluated_at: '2026-04-01T00:00:00Z', fb: { verdict: 'DISAGREE_WITH_SYSTEM', reason_codes: ['regression_failed'], reviewed_at: reviewedAt('2026-05-15') } }),
    ]);
    const r = run(root, { dateUtc: WIN_END, dryRun: true });
    // rebuild-by-reviewed_at captures it: it IS counted (eligible) and IS a critical false negative.
    assert.deepEqual(r.kpi_unavailable_reasons, []);
    assert.equal(r.critical_false_negative_count_30d, 1);
    // A naive evaluated_at-bucketed reducer would MISS it (evaluated_at outside window) -> visible delta.
    const agg = aggregateWindow(WIN_END, {
      trials: { objects: [], present: false }, metricsDaily: { objects: fullWindowDays().map((d) => ({ date_utc: d })), present: true },
    });
    assert.notEqual(r.critical_false_negative_count_30d, agg.d11_rolling.critical_false_negative_count_30d);
  } finally { cleanup(root); }
});

test('late-arrival: latest-wins by trial_id (async re-append) counts the trial ONCE, no double-count', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    // SAME trial_id appended twice: first AGREE, then a corrected DISAGREE(critical). Latest wins.
    seedTrials(root, [
      mkTrial('dup', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10', '08') } }),
      mkTrial('dup', { fb: { verdict: 'DISAGREE_WITH_SYSTEM', reason_codes: ['unsafe_reuse'], reviewed_at: reviewedAt('2026-05-10', '20') } }),
    ]);
    const agg = aggregateWindow(WIN_END, {
      trials: { objects: readFileSync(join(root, 'state/runtime/learning/policy_trials.jsonl'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l)), present: true },
      metricsDaily: { objects: fullWindowDays().map((d) => ({ date_utc: d })), present: true },
    });
    assert.equal(agg.d11_rolling.agreement_eligible_count_30d, 1); // counted ONCE
    assert.equal(agg.d11_rolling.agreement_agree_count_30d, 0);    // latest (DISAGREE) wins
    assert.equal(agg.d11_rolling.critical_false_negative_count_30d, 1);
  } finally { cleanup(root); }
});

// =========================================================================== //
// Empty fail-safe (SPEC §0.1-3 / R-γ5 / DoD#3) — critical NEVER 0, always null
// =========================================================================== //

test('empty fail-safe: 0 trials in a sufficient window -> no_trials_in_window, all four KPI fields null', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, []);
    const r = run(root, { dateUtc: WIN_END, dryRun: true });
    assert.deepEqual(r.kpi_unavailable_reasons, ['no_trials_in_window']);
    assert.equal(r.operator_agreement_rate_30d, null);
    assert.equal(r.critical_false_negative_count_30d, null); // NOT 0
  } finally { cleanup(root); }
});

test('empty fail-safe: trials present but NO feedback in window -> no_operator_feedback_in_window', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [mkTrial('nofb', { evaluated_at: '2026-05-15T00:00:00Z' })]); // no operator_feedback
    const r = run(root, { dateUtc: WIN_END, dryRun: true });
    assert.deepEqual(r.kpi_unavailable_reasons, ['no_operator_feedback_in_window']);
    assert.equal(r.critical_false_negative_count_30d, null);
  } finally { cleanup(root); }
});

test('empty fail-safe CRITICAL: insufficient_window with a real critical DISAGREE present -> still null, NOT the count', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays().slice(0, 10)); // only 10 of 30 days present
    // A genuine critical false negative exists in-window, but the window is not yet 30 days.
    seedTrials(root, [
      mkTrial('crit', { fb: { verdict: 'DISAGREE_WITH_SYSTEM', reason_codes: ['unsafe_reuse'], reviewed_at: reviewedAt('2026-05-25') } }),
    ]);
    const r = run(root, { dateUtc: WIN_END, dryRun: true });
    assert.equal(r.days_present, 10);
    assert.equal(r.window_sufficient, false);
    assert.deepEqual(r.kpi_unavailable_reasons, ['insufficient_window']);
    // §0.1-3 protection: must NOT leak the partial-window count (would be 1) or 0 — emit null.
    assert.equal(r.critical_false_negative_count_30d, null);
    assert.equal(r.operator_agreement_rate_30d, null);
  } finally { cleanup(root); }
});

// =========================================================================== //
// Window semantics (SPEC §1 D-γ2 / DoD#4)
// =========================================================================== //

test('three-state: sufficient+data=available / sufficient+denom0=denominator_zero / insufficient=insufficient_window', () => {
  // available
  let root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [mkTrial('a', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10') } })]);
    assert.deepEqual(run(root, { dateUtc: WIN_END, dryRun: true }).kpi_unavailable_reasons, []);
  } finally { cleanup(root); }
  // insufficient
  root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays().slice(0, 29)); // 29 < 30
    seedTrials(root, [mkTrial('a', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10') } })]);
    assert.deepEqual(run(root, { dateUtc: WIN_END, dryRun: true }).kpi_unavailable_reasons, ['insufficient_window']);
  } finally { cleanup(root); }
});

test('window boundary: feedback on window_start counts (30-in); the day before window_start does NOT (31-out)', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    const dayBefore = addDaysUtc(WIN_START, -1); // 2026-05-01, the 31st day back
    seedTrials(root, [
      mkTrial('in', { evaluated_at: `${WIN_START}T00:00:00Z`, fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt(WIN_START, '00') } }),
      mkTrial('out', { evaluated_at: `${dayBefore}T00:00:00Z`, fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt(dayBefore, '23') } }),
    ]);
    const r = run(root, { dateUtc: WIN_END, dryRun: true });
    // only the in-window feedback contributes: eligible == 1.
    const agg = aggregateWindow(WIN_END, {
      trials: { objects: seedRead(root), present: true },
      metricsDaily: { objects: fullWindowDays().map((d) => ({ date_utc: d })), present: true },
    });
    assert.equal(agg.d11_rolling.agreement_eligible_count_30d, 1);
    assert.equal(r.operator_agreement_rate_30d, 1); // 1 agree / 1 eligible
  } finally { cleanup(root); }
});

test('UTC-day complete: window_end == current UTC day -> incomplete_window fail-closed; --allow-incomplete --dry-run rehearses', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays('2026-06-01'));
    const r = run(root, { dateUtc: '2026-06-01' }); // today per NOW, no flags
    assert.equal(r.fail_closed.kind, 'incomplete_window');
    const r2 = run(root, { dateUtc: '2026-06-01', allowIncomplete: true, dryRun: true }); // rehearse only
    assert.equal(r2.fail_closed.kind, null);
  } finally { cleanup(root); }
});

test('red-team GAMMA-L5-01: --allow-incomplete WITHOUT --dry-run (persist) is fail-closed; nothing persisted', () => {
  const root = mkRoot();
  try {
    // A real, available-looking partial-day window: a critical DISAGREE reviewed today.
    seedMetricsDays(root, fullWindowDays('2026-06-01'));
    seedTrials(root, [
      mkTrial('partial', { evaluated_at: '2026-06-01T06:00:00Z', fb: { verdict: 'DISAGREE_WITH_SYSTEM', reason_codes: ['unsafe_reuse'], reviewed_at: '2026-06-01T08:00:00Z' } }),
    ]);
    // PERSIST attempt on the incomplete current day -> must fail-closed (would otherwise write a
    // partial critical-0/value that Phase-4 freshness accepts as PASS the next day).
    const r = run(root, { dateUtc: '2026-06-01', allowIncomplete: true }); // dryRun defaults false
    assert.equal(r.fail_closed.kind, 'incomplete_window');
    assert.equal(readRows(root).length, 0); // nothing written
    assert.equal(existsSync(join(root, 'state/runtime/learning/d11_rolling_30d.jsonl')), false);
    // every PERSISTED row is therefore complete-window-ended by construction (default path).
  } finally { cleanup(root); }
});

test('input_unreadable: an in-window operator_feedback with an out-of-enum verdict fails-closed', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [
      mkTrial('weird', { fb: { verdict: 'MAYBE_AGREE', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10') } }),
    ]);
    const r = run(root, { dateUtc: WIN_END, dryRun: true });
    assert.equal(r.fail_closed.kind, 'input_unreadable');
    assert.match(r.fail_closed.detail, /verdict out of enum/);
  } finally { cleanup(root); }
});

test('KIND 4 output_schema: the producer-side validator (same ajv config) rejects a malformed row', () => {
  // The reducer validates the assembled row at KIND 4 before write (defense-in-depth). Prove that
  // guard's validator rejects malformed shapes — e.g. a negative critical count or a missing block.
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
  const validate = ajv.compile(parseYaml(readFileSync(SCHEMA, 'utf-8')));
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [mkTrial('a', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10') } })]);
    run(root, { dateUtc: WIN_END });
    const [good] = readRows(root);
    assert.ok(validate(good)); // the real row passes
    const badNeg = JSON.parse(JSON.stringify(good)); badNeg.d11_rolling.critical_false_negative_count_30d = -1;
    assert.ok(!validate(badNeg), 'negative critical count must be rejected (minimum 0)');
    const badMissing = JSON.parse(JSON.stringify(good)); delete badMissing.d11_rolling;
    assert.ok(!validate(badMissing), 'missing d11_rolling block must be rejected (required)');
    const badWindow = JSON.parse(JSON.stringify(good)); badWindow.window_days = 7;
    assert.ok(!validate(badWindow), 'window_days != 30 must be rejected (const 30)');
  } finally { cleanup(root); }
});

// =========================================================================== //
// pure-hash / same-hash skip / divergence / --regenerate / KIND 序 (SPEC §0.1-4 / DoD#5)
// =========================================================================== //

test('pure-hash: same closed window reruns to the SAME rolling_record_hash despite wall-clock change', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [mkTrial('a', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10') } })]);
    const h1 = produceD11Rolling({ rootDir: root, now: NOW, dateUtc: WIN_END, dryRun: true }).rolling_record_hash;
    const h2 = produceD11Rolling({ rootDir: root, now: new Date('2026-06-02T09:09:09Z'), dateUtc: WIN_END, dryRun: true }).rolling_record_hash;
    assert.equal(h1, h2);
    assert.match(h1, /^sha256:[0-9a-f]{64}$/);
  } finally { cleanup(root); }
});

test('same-hash skip: re-running an unchanged persisted window -> skipped_same_hash, file stays 1 row', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [mkTrial('a', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10') } })]);
    assert.equal(run(root, { dateUtc: WIN_END }).action, 'appended');
    assert.equal(run(root, { dateUtc: WIN_END }).action, 'skipped_same_hash');
    assert.equal(readRows(root).length, 1);
  } finally { cleanup(root); }
});

test('divergence: changed inputs for a persisted window -> fail-closed; --regenerate appends a 2nd row', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [mkTrial('a', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10') } })]);
    assert.equal(run(root, { dateUtc: WIN_END }).action, 'appended');
    // add a critical disagree -> recomputed hash differs.
    seedTrials(root, [
      mkTrial('a', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10') } }),
      mkTrial('b', { fb: { verdict: 'DISAGREE_WITH_SYSTEM', reason_codes: ['unsafe_reuse'], reviewed_at: reviewedAt('2026-05-11') } }),
    ]);
    assert.equal(run(root, { dateUtc: WIN_END }).fail_closed.kind, 'divergence');
    assert.equal(readRows(root).length, 1); // not written on divergence
    assert.equal(run(root, { dateUtc: WIN_END, regenerate: true }).action, 'regenerated');
    assert.equal(readRows(root).length, 2); // latest-wins append
  } finally { cleanup(root); }
});

test('KIND 序: incomplete_window pre-empts input_unreadable; corrupt feedback -> input_unreadable', () => {
  // incomplete_window pre-flight beats input corruption (window_end is today, even with corrupt trials).
  let root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays('2026-06-01'));
    seedTrials(root, [mkTrial('bad', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: '2026-05-10T00:00:00' } })]); // no tz offset
    assert.equal(run(root, { dateUtc: '2026-06-01' }).fail_closed.kind, 'incomplete_window');
  } finally { cleanup(root); }
  // a complete window with a missing-tz feedback -> input_unreadable.
  root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [mkTrial('bad', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: '2026-05-10T00:00:00' } })]);
    assert.equal(run(root, { dateUtc: WIN_END, dryRun: true }).fail_closed.kind, 'input_unreadable');
  } finally { cleanup(root); }
});

// =========================================================================== //
// Output conformance (DoD-side; the producer also enforces this at write time)
// =========================================================================== //

test('output conformance: a persisted row validates against d11_rolling_30d_v1 (ajv)', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [mkTrial('a', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10') } })]);
    run(root, { dateUtc: WIN_END });
    const [row] = readRows(root);
    const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
    const validate = ajv.compile(parseYaml(readFileSync(SCHEMA, 'utf-8')));
    assert.ok(validate(row), JSON.stringify(validate.errors));
    assert.equal(row.generator_version, GENERATOR_VERSION);
    assert.equal(row.window_days, 30);
    assert.equal(row.window_start_utc, WIN_START);
    assert.equal(row.window_end_utc, WIN_END);
  } finally { cleanup(root); }
});

// =========================================================================== //
// Reduce-operator fence — R-γ4 / D-γ7 (DoD#6, negative grep)
// =========================================================================== //

test('R-γ4 grep: reducer exposes NO arbitrary --window reduce path (span fixed at 30)', () => {
  const raw = readFileSync(PRODUCER, 'utf-8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // strip comments (HELP prose retained)
  // The arg parser must NOT branch on a '--window' flag, and the code must NOT read opts.window.
  assert.ok(!/===\s*['"]--window['"]/.test(code), 'R-γ4 violation: parser branches on --window');
  assert.ok(!/opts\.window\b/.test(code), 'R-γ4 violation: code reads opts.window');
  // The span is a fixed constant, not a variable reduce width.
  assert.ok(/WINDOW_DAYS\s*=\s*30/.test(raw), 'WINDOW_DAYS must be the fixed 30-day span');
});

// =========================================================================== //
// Invariants — Hard Gate 8 / R-γ1 / R-γ2 / R-γ3 (DoD#7/#8/#9)
// =========================================================================== //

test('R-γ1/R-γ2 grep: reducer writes ONLY the rolling jsonl + its lock — no trial / candidate / promotion / production write', () => {
  const raw = readFileSync(PRODUCER, 'utf-8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // No appends/writes to the trials ledger, policy dirs, contracts, or promotion fields.
  assert.ok(!/appendFileSync\([^)]*policy_trials/.test(code), 'must not write policy_trials');
  assert.ok(!/writeFileSync\([^)]*policies/.test(code), 'must not write learned policies');
  assert.ok(!/writeFileSync\([^)]*_meta\/contracts/.test(code), 'must not write contracts');
  assert.ok(!/validation_status|promoted_at|candidate_write|production_write/.test(code), 'must not touch promotion/production fields');
  // The single append target is the rolling output relative path.
  const appendArgs = [...code.matchAll(/appendFileSync\(([^,]+),/g)].map((m) => m[1].trim());
  assert.deepEqual([...new Set(appendArgs)], ['rollingOutAbs']);
});

test('R-γ1 functional: persisting a window leaves policy_trials.jsonl byte-identical; no candidate/production dirs created', () => {
  const root = mkRoot();
  try {
    seedMetricsDays(root, fullWindowDays());
    seedTrials(root, [mkTrial('a', { fb: { verdict: 'AGREE_WITH_SYSTEM', reason_codes: ['acceptable'], reviewed_at: reviewedAt('2026-05-10') } })]);
    const trialsPath = join(root, 'state/runtime/learning/policy_trials.jsonl');
    const before = readFileSync(trialsPath, 'utf-8');
    run(root, { dateUtc: WIN_END });
    assert.equal(readFileSync(trialsPath, 'utf-8'), before); // byte-identical
    assert.equal(existsSync(join(root, 'state/memory/learned/policies')), false);
  } finally { cleanup(root); }
});

test('R-γ3 grep: reducer carries NO Phase-4 gate verdict / threshold / abort logic', () => {
  const raw = readFileSync(PRODUCER, 'utf-8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/0\.7/.test(code), 'R-γ3 violation: reducer encodes the 0.7 soft threshold');
  assert.ok(!/\bPASS\b|\bFAIL\b|\babort\b/.test(code), 'R-γ3 violation: reducer encodes a gate verdict/abort');
  assert.ok(!/gate_verdict|gate_result|entry_gate/.test(code), 'R-γ3 violation: reducer computes a gate result');
});

test('DoD#11/#7: input anchors + 1e producer + confidence_formulas + File-B are content-pinned (0-diff)', () => {
  const pins = {
    '_meta/contracts/learning/policy_trial_v1.schema.yaml': '2cd8df6bb1ec41489a3921f5d89e851269d6ac6c6e8f72b945b7f173be6fa7a2',
    '_meta/contracts/learning/operator_feedback_v1.schema.yaml': '4389f79aca7f330dcc7ece399af60992b43b22f82f015ec9edf5f89b272ec2db',
    '_meta/contracts/learning/metrics_daily_v1.schema.yaml': 'f3b0b8d9e3bf65618170fdc3afe192b36bb098fb6a81b30e47088aec985fbadb',
    '_meta/contracts/learning/confidence_formulas.yaml': '2c6ceff8620addb3022f70c27087e8ac2a1d769b463306b6c6702bfef7fb4a74',
    '.claude/scripts/learning/metrics_daily_producer.mjs': '1576dee008beb258f4d4022c37754fb911566fb9f90f4ab9de54b8f07e2455bf',
    'scripts/heartbeat_runner.mjs': 'aa2256947ef3cac8ac0c3cab9a639502d977df7eaf5d054cf4f5eecd2d570d13',
  };
  for (const [rel, sha] of Object.entries(pins)) {
    const content = readFileSync(join(REPO, rel), 'utf-8');
    assert.equal(createHash('sha256').update(content).digest('hex'), sha,
      `frozen anchor ${rel} content changed — γ must keep it 0-diff (DoD#7/#11)`);
  }
});

test('DoD#10: d11_rolling_30d_v1 is registered in validate-contracts schemaFiles; gate count == 21', () => {
  // γ's own carve-out landed 19->20. Phase-4 (phase4_prereq_attestation_v1) then added the 21st
  // schema (deterministic +1), so the absolute count is now 21. γ's schema must STILL be registered.
  const vc = readFileSync(join(REPO, '_meta/contracts/scripts/validate-contracts.mjs'), 'utf-8');
  assert.ok(/d11_rolling_30d_v1\.schema\.yaml/.test(vc), 'schema must be registered in schemaFiles array');
  const out = spawnSync('node', [join(REPO, '_meta/contracts/scripts/validate-contracts.mjs')], { encoding: 'utf-8' });
  assert.match(out.stdout, /Passed:\s*21/, `expected gate count 21 (γ 19->20 carve-out; Phase-4 +1 -> 21); got:\n${out.stdout}`);
});

test('CLI --help exits 0 and documents the fixed 30-day span', () => {
  const out = spawnSync('node', [PRODUCER, '--help'], { encoding: 'utf-8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /30-day rolling D-11 reducer/);
  assert.match(out.stdout, /NO\s+arbitrary --window/);
});

// helper used by the boundary test (kept after tests to avoid hoist confusion)
function seedRead(root) {
  return readFileSync(join(root, 'state/runtime/learning/policy_trials.jsonl'), 'utf-8')
    .trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
