#!/usr/bin/env node
/**
 * trial_observation_predicate.mjs — Phase 2a-β F-predicate: 2a→2b transition predicate
 * (liye_os, NEW file). SSOT: .claude/scripts/learning/trial_observation_predicate.mjs.
 *
 * Normative: SPEC `.planning/phase-2a-beta/SPEC.md` v1.0 (blob d1b11bae) §1 F-predicate / D-β6.
 *
 * WHAT THIS DOES (read-only gate-check; mirrors the 2a-α exit-gate three-state paradigm):
 *   Decides whether the trialing observation window is healthy/complete enough to EVALUATE the
 *   2a→2b transition (RUNBOOK §2.2 step7 placeholder predicate). CONSUMER = the operator running
 *   the §2.2 playbook; this checker NEVER advances the phase (read-only, 0 write; the flip is
 *   operator-driven). Over a trailing window of `window` complete UTC days ending at --asof, each
 *   day is classified (short-circuit, BLOCKED judged first), reading ONLY the sealed
 *   metrics_daily.jsonl (1e producer output, metrics_daily_v1):
 *     BLOCKED-day       : explicit integrity alarm — policy_trials_breakdown.schema_version_drift_count > 0
 *                         (trial records carrying a wrong schema_version). Hard-stops the transition.
 *     INDETERMINATE-day : no explicit alarm but data missing/insufficient (row absent OR
 *                         policy_trials_breakdown absent/partial). Not a block; "wait".
 *     contrib-day       : row present AND policy_trials_breakdown present AND drift == 0
 *                         (a clean observation day — the producer ran and recorded the trial roll-up).
 *   window -> verdict (fail-closed; any non-PASS exits 2):
 *     BLOCKED       (exit 2, highest) : any BLOCKED-day in the window.
 *     PASS          (exit 0)          : all-of-window contrib (0 BLOCKED, days_present==window).
 *     INDETERMINATE (exit 2)          : 0 BLOCKED-day AND >=1 INDETERMINATE-day.
 *
 * FIELD FENCE (SPEC §1 F-predicate / ⛔ R-β7): this checker reads, per day, the
 *   policy_trials_breakdown.by_system_verdict distribution + with_operator_feedback_count +
 *   d11_kpis.kpi_unavailable_reasons PRESENCE — and SURFACES them in per_day for the operator's
 *   own judgment. It MUST NOT (and does not) compute ANY windowed operator_agreement_rate or
 *   critical_false_negative aggregate over ANY window length — those derivations are γ-exclusive
 *   (Phase-4 30d gate). The classification uses only presence + the schema_version_drift_count
 *   integrity signal; it never sums agreement_agree_count / agreement_eligible_count /
 *   critical_false_negative_count_today. (R-β7 is grep-asserted in the test suite.)
 *
 * WHAT THIS DOES NOT DO (Hard NO):
 *   - Does NOT spawn/import heartbeat / evaluator / importer / producer (standalone, read-only).
 *   - Does NOT mutate any state, write any file, or trigger the 2a→2b transition.
 *   - Does NOT reduce d11_kpis agreement/false-negative atoms into a rate/count (R-β7).
 *
 * Usage:
 *   node trial_observation_predicate.mjs [--metrics <path>] [--asof <YYYY-MM-DD>] \
 *       [--window <N>] [--json] [--help]
 */

import { readFileSync, existsSync, realpathSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// --------------------------------------------------------------------------- //
// Locked constants
// --------------------------------------------------------------------------- //

const DEFAULT_METRICS_REL = 'state/runtime/learning/metrics_daily.jsonl';
// OQ-β1: the observation window is operator-supplied; the default is the RUNBOOK §2.2 step7
// MINIMUM (7-14 day range). A longer window MUST be set explicitly via --window (not guessed).
const DEFAULT_WINDOW = 7;

const VERDICT = { PASS: 'PASS', BLOCKED: 'BLOCKED', INDETERMINATE: 'INDETERMINATE' };
const DAY = { CONTRIB: 'contrib-day', BLOCKED: 'BLOCKED-day', INDETERMINATE: 'INDETERMINATE-day' };

// exit 0 = PASS (transition-eligible to evaluate 2b); exit 2 = fail-closed "do not transition"
// (BLOCKED / INDETERMINATE); exit 1 = unexpected. Mirrors the 1c/1d/1e/2a-α taxonomy.
const EXIT = { PASS: 0, FAIL_CLOSED: 2, UNEXPECTED: 1 };

// --------------------------------------------------------------------------- //
// UTC-day helpers (mirror 1e producer / 2a-α exit-gate: ISO slice(0,10), 86400000ms stride).
// --------------------------------------------------------------------------- //

function nowIso() { return new Date().toISOString(); }

function yesterdayUtc(now = new Date()) {
  return new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
}

function dayStartMs(dateUtc) {
  if (typeof dateUtc !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateUtc)) {
    throw new Error(`invalid date (expected YYYY-MM-DD): ${dateUtc}`);
  }
  const ms = Date.parse(`${dateUtc}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== dateUtc) {
    throw new Error(`invalid calendar date: ${dateUtc}`);
  }
  return ms;
}

function windowDays(asofUtc, window) {
  const endMs = dayStartMs(asofUtc);
  const out = [];
  for (let i = window - 1; i >= 0; i--) {
    out.push(new Date(endMs - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

// --------------------------------------------------------------------------- //
// metrics_daily.jsonl ingest (read-only; latest-wins per date_utc; bad lines skipped).
// --------------------------------------------------------------------------- //

export function indexMetricsByDate(metricsPath) {
  const rows = new Map();
  let malformed = 0;
  if (!existsSync(metricsPath)) return { rows, malformed, file_present: false };
  for (const line of readFileSync(metricsPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try { obj = JSON.parse(trimmed); } catch { malformed += 1; continue; }
    if (obj && typeof obj.date_utc === 'string') rows.set(obj.date_utc, obj);
    else malformed += 1;
  }
  return { rows, malformed, file_present: true };
}

// --------------------------------------------------------------------------- //
// Per-day three-state classification (BLOCKED judged first; mirrors 2a-α §0.1-5).
// --------------------------------------------------------------------------- //

function asCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/**
 * Classify one UTC day. `row` may be undefined (row-absent). PURE + defensive.
 * Reads policy_trials_breakdown (by_system_verdict + with_operator_feedback_count +
 * schema_version_drift_count) and d11_kpis.kpi_unavailable_reasons PRESENCE only.
 * NEVER reduces agreement/false-negative atoms (R-β7).
 */
export function classifyTrialDay(dateUtc, row) {
  const entry = {
    date_utc: dateUtc,
    classification: null,
    row_present: !!row,
    by_system_verdict: null,          // surfaced for operator judgment (read, NOT reduced)
    with_operator_feedback_count: null,
    schema_version_drift_count: null,
    kpi_unavailable: null,            // d11_kpis.kpi_unavailable_reasons (presence only)
    blocked_criteria: [],
  };

  const breakdown = row && typeof row === 'object' ? row.policy_trials_breakdown : undefined;
  if (breakdown && typeof breakdown === 'object') {
    entry.by_system_verdict = breakdown.by_system_verdict && typeof breakdown.by_system_verdict === 'object'
      ? { ...breakdown.by_system_verdict } : null;
    entry.with_operator_feedback_count = asCount(breakdown.with_operator_feedback_count);
    entry.schema_version_drift_count = asCount(breakdown.schema_version_drift_count);
  }
  const d11 = row && typeof row === 'object' ? row.d11_kpis : undefined;
  if (d11 && Array.isArray(d11.kpi_unavailable_reasons)) {
    entry.kpi_unavailable = d11.kpi_unavailable_reasons.slice();
  }

  // 1) BLOCKED-day: explicit integrity alarm (schema drift in trial records). Judged first.
  if (entry.schema_version_drift_count !== null && entry.schema_version_drift_count > 0) {
    entry.classification = DAY.BLOCKED;
    entry.blocked_criteria = ['schema_version_drift'];
    return entry;
  }

  // 2) INDETERMINATE-day: no alarm but data missing/insufficient.
  //    - row absent / policy_trials_breakdown absent or partial (drift count unreadable).
  const breakdownComplete = breakdown && typeof breakdown === 'object'
    && entry.schema_version_drift_count !== null;
  if (!row || !breakdownComplete) {
    entry.classification = DAY.INDETERMINATE;
    return entry;
  }

  // 3) contrib-day: clean observation day (producer ran, trial roll-up recorded, 0 drift).
  entry.classification = DAY.CONTRIB;
  return entry;
}

// --------------------------------------------------------------------------- //
// Window -> verdict (pure; unit-testable core).
// --------------------------------------------------------------------------- //

/**
 * Evaluate a window of already-indexed rows. PURE (no I/O, NO windowed agreement/FN reduce).
 *
 * @param {Map<string,object>} rowsByDate  date_utc -> metrics row
 * @param {object} opts  { asof, window }
 */
export function evaluateTransitionWindow(rowsByDate, opts = {}) {
  const window = Number.isInteger(opts.window) && opts.window > 0 ? opts.window : DEFAULT_WINDOW;
  const asof = opts.asof || yesterdayUtc();
  const days = windowDays(asof, window);

  const perDay = days.map((d) => classifyTrialDay(d, rowsByDate.get(d)));

  const daysMissing = perDay.filter((d) => !d.row_present).map((d) => d.date_utc);
  const daysPresent = window - daysMissing.length;
  const blockedDays = perDay.filter((d) => d.classification === DAY.BLOCKED).map((d) => d.date_utc);
  const failedCriteria = [...new Set(perDay.flatMap((d) => d.blocked_criteria))].sort();

  let verdict;
  if (blockedDays.length > 0) {
    verdict = VERDICT.BLOCKED;
  } else if (daysPresent === window && perDay.every((d) => d.classification === DAY.CONTRIB)) {
    verdict = VERDICT.PASS; // all-of-window (NOT a streak counter; single source of truth)
  } else {
    verdict = VERDICT.INDETERMINATE;
  }

  return {
    verdict,
    window: { start_utc: days[0], end_utc: days[days.length - 1], length: window },
    days_present: daysPresent,
    days_missing: daysMissing,
    per_day: perDay,
    blocked_days: blockedDays,
    failed_criteria: failedCriteria,
    // NOTE: deliberately NO operator_agreement_rate / critical_false_negative field (R-β7).
  };
}

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

/**
 * Read metrics_daily.jsonl and compute the 2a→2b transition predicate verdict.
 *
 * @param {object} [options]
 * @param {string} [options.metrics]  metrics_daily.jsonl path (default under rootDir)
 * @param {string} [options.asof]     window right edge YYYY-MM-DD (default = yesterday)
 * @param {number} [options.window]   observation window length (operator-supplied; default 7)
 * @param {string} [options.rootDir]  liye_os root for default metrics path (test seam)
 */
export function checkTransitionPredicate(options = {}) {
  const rootDir = options.rootDir ? realpathSync(options.rootDir) : PROJECT_ROOT;
  const metricsPath = options.metrics
    ? (options.metrics.startsWith('/') ? options.metrics : join(rootDir, options.metrics))
    : join(rootDir, DEFAULT_METRICS_REL);

  const { rows, malformed, file_present } = indexMetricsByDate(metricsPath);
  const report = evaluateTransitionWindow(rows, { asof: options.asof, window: options.window });
  report.metrics_path = metricsPath;
  report.file_present = file_present;
  report.malformed_lines = malformed;
  report.generated_at_utc = nowIso();
  return report;
}

/** Class wrapper (whitelisted compound name) around the functional core. */
export class TrialObservationPredicate {
  constructor(options = {}) { this.options = options; }
  run() { return checkTransitionPredicate(this.options); }
}

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //

const HELP = `trial_observation_predicate.mjs - Phase 2a-β 2a→2b transition predicate (read-only)

Usage:
  node trial_observation_predicate.mjs [options]

Options:
  --metrics <path>      metrics_daily.jsonl (default state/runtime/learning/metrics_daily.jsonl)
  --asof <YYYY-MM-DD>   window right edge, inclusive (default = yesterday, last complete UTC day)
  --window <N>          observation window length, operator-supplied (default 7 = RUNBOOK §2.2 min)
  --json                Print the report as JSON on stdout
  --help                Show this help and exit 0

Verdict / exit codes:
  PASS          0  all-of-window clean observation (operator may evaluate the 2a→2b transition)
  BLOCKED       2  >=1 day with trial schema-version drift (integrity alarm) -- needs a fix
  INDETERMINATE 2  no alarm but data insufficient (window not fully observed) -- wait
  (unexpected)  1  bad arguments / I/O error

This is a READ-ONLY operator aid. It NEVER advances the phase and NEVER computes a windowed
operator_agreement_rate / critical_false_negative aggregate (those are the γ Phase-4 30d gate).
`;

function parseArgs(argv) {
  const opts = { metrics: null, asof: null, window: null, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--metrics') opts.metrics = argv[++i];
    else if (a === '--asof') opts.asof = argv[++i];
    else if (a === '--window') opts.window = argv[++i];
    else process.stderr.write(`unknown argument: ${a}\n`);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { process.stdout.write(HELP); return EXIT.PASS; }

  let window;
  if (opts.window !== null) {
    window = Number(opts.window);
    if (!Number.isInteger(window) || window <= 0) {
      process.stderr.write(`invalid --window ${opts.window} (expected a positive integer)\n`);
      return EXIT.UNEXPECTED;
    }
  }

  let report;
  try {
    report = checkTransitionPredicate({
      metrics: opts.metrics || undefined,
      asof: opts.asof || undefined,
      window,
    });
  } catch (err) {
    process.stderr.write(`[trial_observation_predicate] ${err.name || 'Error'}: ${err.message}\n`);
    return EXIT.UNEXPECTED;
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `[trial_observation_predicate] verdict=${report.verdict} ` +
      `window=${report.window.start_utc}..${report.window.end_utc} ` +
      `days_present=${report.days_present}/${report.window.length} ` +
      `blocked_days=${report.blocked_days.length} failed_criteria=[${report.failed_criteria.join(',')}]\n`);
  }
  return report.verdict === VERDICT.PASS ? EXIT.PASS : EXIT.FAIL_CLOSED;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) process.exit(main());
