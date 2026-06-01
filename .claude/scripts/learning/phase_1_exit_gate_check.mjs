#!/usr/bin/env node
/**
 * phase_1_exit_gate_check.mjs - Phase 2a-α Phase-1 exit-gate entry checker (liye_os, NEW file).
 * SSOT: .claude/scripts/learning/phase_1_exit_gate_check.mjs (learning domain).
 *
 * Normative: SPEC .planning/phase-2a/SPEC.md v1.0 (blob e74f205f) §2a.1 / §0.1-5.
 * Consumes (READ-ONLY): state/runtime/learning/metrics_daily.jsonl (1e producer output,
 *   metrics_daily_v1 sealed schema). Computes the Phase-1 exit-gate verdict that 1e's
 *   producer deliberately deferred (per-day atoms only; the 7-day streak + gate verdict
 *   are the Phase 2a entry check, NOT the producer).
 *
 * WHAT THIS DOES (SPEC §2a.1 scope - read-only entry check):
 *   - Reads metrics_daily.jsonl, indexes rows by date_utc (latest-wins, mirroring the
 *     1e --regenerate append semantics).
 *   - Over a trailing window of `window` complete UTC days ending at --asof, classifies
 *     each day into one of three states (short-circuit, BLOCKED judged first):
 *       BLOCKED-day       : explicit failure (c1 fail/warn > 0, OR c2 duplicate > 0,
 *                           OR c4 path-unsafe reject > 0). Hard-stops the flip.
 *       INDETERMINATE-day : no explicit failure but data missing/insufficient (row absent,
 *                           phase_1_exit_signals absent/partial, OR c1 all-zero = source
 *                           did not emit that day). Streak resets; NOT a block.
 *       STREAK-contrib    : clean qualifying day (c1 pass>=1 AND fail==0 AND warn==0,
 *                           c2 dup==0, c4 path_unsafe==0).
 *   - window -> verdict (fail-closed; any non-PASS exits 2):
 *       BLOCKED       (exit 2, highest priority) : any BLOCKED-day in the window.
 *       PASS          (exit 0)                   : all-of-window STREAK-contrib (0 BLOCKED,
 *                                                  days_present==window).
 *       INDETERMINATE (exit 2)                   : 0 BLOCKED-day AND >=1 INDETERMINATE-day.
 *
 * WHAT THIS DOES NOT DO (SPEC §0.1-10 / Hard NO):
 *   - Does NOT spawn/import heartbeat / evaluator / importer / producer (standalone).
 *   - Does NOT read d11_kpis (operator-agreement KPIs are the Phase-4 30d gate input,
 *     structurally unobservable at 2a-entry: 0 real trials before the flip; SPEC §0.1-5).
 *   - Does NOT mutate any state or trigger the flip. The flip is the operator-driven
 *     RUNBOOK §2.2 activation playbook, never this checker.
 *
 * Usage:
 *   node phase_1_exit_gate_check.mjs [--metrics <path>] [--source <name>] \
 *       [--asof <YYYY-MM-DD>] [--window <N>] [--json] [--help]
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
// criterion-1 target source: Pilot-1's only enabled source (learning_sources.yaml).
const DEFAULT_SOURCE = 'amazon-growth-engine';
const DEFAULT_WINDOW = 7; // Phase-1 criterion-1 "continuous 7 days".

const VERDICT = { PASS: 'PASS', BLOCKED: 'BLOCKED', INDETERMINATE: 'INDETERMINATE' };
const DAY = { STREAK: 'STREAK-contrib', BLOCKED: 'BLOCKED-day', INDETERMINATE: 'INDETERMINATE-day' };

// exit 0 = PASS (flip-eligible); exit 2 = fail-closed "do not flip" (BLOCKED or
// INDETERMINATE); exit 1 = unexpected (bad args / I/O). Mirrors the 1c/1d/1e taxonomy.
const EXIT = { PASS: 0, FAIL_CLOSED: 2, UNEXPECTED: 1 };

// --------------------------------------------------------------------------- //
// UTC-day helpers (mirrors 1e producer: ISO slice(0,10), 86400000ms stride).
// --------------------------------------------------------------------------- //

function nowIso() { return new Date().toISOString(); } // ...Z == +00:00 offset

/** Default --asof = yesterday (last complete UTC day), matching the 1e producer F2 default. */
function yesterdayUtc(now = new Date()) {
  return new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
}

/** Validate a YYYY-MM-DD string and return its UTC midnight epoch ms (throws on malformed). */
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

/** The `window` trailing UTC day strings [asof-(window-1) .. asof] in chronological order. */
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

/**
 * Index metrics_daily.jsonl by date_utc, latest line wins (1e --regenerate appends a
 * fresh row for a regenerated day). Returns { rows: Map<date_utc, row>, malformed: N }.
 * A missing file yields an empty map (caller resolves to INDETERMINATE).
 */
export function indexMetricsByDate(metricsPath) {
  const rows = new Map();
  let malformed = 0;
  if (!existsSync(metricsPath)) return { rows, malformed, file_present: false };
  const text = readFileSync(metricsPath, 'utf-8');
  for (const line of text.split('\n')) {
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
// Per-day three-state classification (SPEC §0.1-5 short-circuit; BLOCKED judged first).
// --------------------------------------------------------------------------- //

/** Coerce a value to a non-negative integer, else null (defensive read of hand-rolled rows). */
function asCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/**
 * Classify one UTC day for `source`. `row` may be undefined (row-absent). Returns a
 * per_day entry: { date_utc, classification, row_present, c1, c2_duplicate_conflict_count,
 * c4_path_unsafe_reject_count, blocked_criteria }. Pure + defensive (optional-chaining
 * reads tolerate hand-rolled / pre-1e rows that lack the phase_1_exit_signals block).
 *
 * Order (first hit wins): BLOCKED-day -> INDETERMINATE-day -> STREAK-contrib (SPEC §0.1-5).
 */
export function classifyDayForSource(dateUtc, row, source) {
  const entry = {
    date_utc: dateUtc,
    classification: null,
    row_present: !!row,
    c1: null,
    c2_duplicate_conflict_count: null,
    c4_path_unsafe_reject_count: null,
    blocked_criteria: [],
  };

  const signals = row && typeof row === 'object' ? row.phase_1_exit_signals : undefined;
  const perSource = signals
    && signals.c1_manifest_validator
    && signals.c1_manifest_validator.per_source
    ? signals.c1_manifest_validator.per_source[source]
    : undefined;

  const c1 = perSource && typeof perSource === 'object'
    ? { pass: asCount(perSource.pass), warn: asCount(perSource.warn), fail: asCount(perSource.fail) }
    : null;
  const dup = signals ? asCount(signals.c2_duplicate_conflict_count) : null;
  const pathUnsafe = signals ? asCount(signals.c4_path_unsafe_reject_count) : null;

  entry.c1 = c1;
  entry.c2_duplicate_conflict_count = dup;
  entry.c4_path_unsafe_reject_count = pathUnsafe;

  // 1) BLOCKED-day (explicit failure, judged first). Any present-and-positive signal.
  const blocked = [];
  if (c1 && ((c1.fail !== null && c1.fail > 0) || (c1.warn !== null && c1.warn > 0))) blocked.push('c1');
  if (dup !== null && dup > 0) blocked.push('c2');
  if (pathUnsafe !== null && pathUnsafe > 0) blocked.push('c4');
  if (blocked.length > 0) {
    entry.classification = DAY.BLOCKED;
    entry.blocked_criteria = blocked;
    return entry;
  }

  // 2) INDETERMINATE-day (no explicit failure AND data missing/insufficient).
  //    - row absent / phase_1_exit_signals absent / c1 absent or partial
  //    - c1 all-zero (source did not emit that day) = pass==0 AND fail==0 AND warn==0
  const c1Complete = c1 && c1.pass !== null && c1.fail !== null && c1.warn !== null;
  if (!row || !signals || !c1Complete || (c1.pass === 0 && c1.fail === 0 && c1.warn === 0)) {
    entry.classification = DAY.INDETERMINATE;
    return entry;
  }

  // 3) STREAK-contrib (clean qualifying day). c2/c4 absent treated as 0 (target).
  if (c1.pass >= 1 && c1.fail === 0 && c1.warn === 0
    && (dup === null || dup === 0) && (pathUnsafe === null || pathUnsafe === 0)) {
    entry.classification = DAY.STREAK;
    return entry;
  }

  // Fallback (should be unreachable): treat as INDETERMINATE (fail-closed toward "do not flip").
  entry.classification = DAY.INDETERMINATE;
  return entry;
}

// --------------------------------------------------------------------------- //
// Window -> verdict (pure; the unit-testable core).
// --------------------------------------------------------------------------- //

/**
 * Evaluate a window of already-indexed rows. Pure function (no I/O).
 *
 * @param {Map<string,object>} rowsByDate  date_utc -> metrics row
 * @param {object} opts  { source, asof, window }
 * @returns {object} Phase1ExitGateReport (sans generated_at_utc; the caller stamps it)
 */
export function evaluateWindow(rowsByDate, opts = {}) {
  const source = opts.source || DEFAULT_SOURCE;
  const window = Number.isInteger(opts.window) && opts.window > 0 ? opts.window : DEFAULT_WINDOW;
  const asof = opts.asof || yesterdayUtc();
  const days = windowDays(asof, window);

  const perDay = days.map((d) => classifyDayForSource(d, rowsByDate.get(d), source));

  const daysMissing = perDay.filter((d) => !d.row_present).map((d) => d.date_utc);
  const daysPresent = window - daysMissing.length;
  const blockedDays = perDay.filter((d) => d.classification === DAY.BLOCKED).map((d) => d.date_utc);
  const failedCriteria = [...new Set(perDay.flatMap((d) => d.blocked_criteria))].sort();

  // streak_len (DIAGNOSTIC ONLY): trailing consecutive STREAK-contrib days at the window end.
  let streakLen = 0;
  for (let i = perDay.length - 1; i >= 0; i--) {
    if (perDay[i].classification === DAY.STREAK) streakLen += 1;
    else break;
  }

  // window -> verdict (fail-closed; BLOCKED has highest priority).
  let verdict;
  if (blockedDays.length > 0) {
    verdict = VERDICT.BLOCKED;
  } else if (daysPresent === window && perDay.every((d) => d.classification === DAY.STREAK)) {
    verdict = VERDICT.PASS; // all-of-window (NOT streak_len>=window; single source of truth)
  } else {
    verdict = VERDICT.INDETERMINATE;
  }

  return {
    verdict,
    source,
    window: {
      start_utc: days[0],
      end_utc: days[days.length - 1],
      length: window,
    },
    days_present: daysPresent,
    days_missing: daysMissing,
    per_day: perDay.map((d) => ({
      date_utc: d.date_utc,
      classification: d.classification,
      row_present: d.row_present,
      c1: d.c1,
      c2_duplicate_conflict_count: d.c2_duplicate_conflict_count,
      c4_path_unsafe_reject_count: d.c4_path_unsafe_reject_count,
    })),
    blocked_days: blockedDays,
    streak_len: streakLen,
    failed_criteria: failedCriteria,
  };
}

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

/**
 * Read metrics_daily.jsonl and compute the Phase-1 exit-gate verdict.
 *
 * @param {object} [options]
 * @param {string} [options.metrics]  metrics_daily.jsonl path (default under rootDir)
 * @param {string} [options.source]   criterion-1 target source (default amazon-growth-engine)
 * @param {string} [options.asof]     window right edge YYYY-MM-DD (default = yesterday)
 * @param {number} [options.window]   streak length (default 7)
 * @param {string} [options.rootDir]  liye_os root for default metrics path (test seam)
 * @returns {object} Phase1ExitGateReport (with verdict + per_day + generated_at_utc)
 */
export function checkPhase1ExitGate(options = {}) {
  const rootDir = options.rootDir ? realpathSync(options.rootDir) : PROJECT_ROOT;
  const metricsPath = options.metrics
    ? (options.metrics.startsWith('/') ? options.metrics : join(rootDir, options.metrics))
    : join(rootDir, DEFAULT_METRICS_REL);

  const { rows, malformed, file_present } = indexMetricsByDate(metricsPath);
  const report = evaluateWindow(rows, {
    source: options.source,
    asof: options.asof,
    window: options.window,
  });
  report.metrics_path = metricsPath;
  report.file_present = file_present;
  report.malformed_lines = malformed;
  report.generated_at_utc = nowIso();
  return report;
}

/** Class wrapper (whitelisted compound name) around the functional core. */
export class Phase1ExitGateChecker {
  constructor(options = {}) { this.options = options; }
  run() { return checkPhase1ExitGate(this.options); }
}

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //

const HELP = `phase_1_exit_gate_check.mjs - Phase 2a-α Phase-1 exit-gate entry checker (read-only)

Usage:
  node phase_1_exit_gate_check.mjs [options]

Options:
  --metrics <path>      metrics_daily.jsonl (default state/runtime/learning/metrics_daily.jsonl)
  --source <name>       criterion-1 target source (default amazon-growth-engine)
  --asof <YYYY-MM-DD>   window right edge, inclusive (default = yesterday, last complete UTC day)
  --window <N>          streak length (default 7 = Phase-1 criterion "continuous 7 days")
  --json                Print the Phase1ExitGateReport as JSON on stdout
  --help                Show this help and exit 0

Verdict / exit codes:
  PASS          0  all-of-window clean (flip-eligible; operator may proceed to RUNBOOK §2.2)
  BLOCKED       2  >=1 explicit-failure day (c1 fail/warn, c2 duplicate, c4 path-unsafe) -- needs a fix
  INDETERMINATE 2  no explicit failure but data insufficient (ramp-up / source not yet emitting) -- wait
  (unexpected)  1  bad arguments / I/O error
`;

function parseArgs(argv) {
  const opts = { metrics: null, source: null, asof: null, window: null, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--metrics') opts.metrics = argv[++i];
    else if (a === '--source') opts.source = argv[++i];
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
    report = checkPhase1ExitGate({
      metrics: opts.metrics || undefined,
      source: opts.source || undefined,
      asof: opts.asof || undefined,
      window,
    });
  } catch (err) {
    process.stderr.write(`[phase_1_exit_gate_check] ${err.name || 'Error'}: ${err.message}\n`);
    return EXIT.UNEXPECTED;
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `[phase_1_exit_gate_check] verdict=${report.verdict} source=${report.source} ` +
      `window=${report.window.start_utc}..${report.window.end_utc} ` +
      `days_present=${report.days_present}/${report.window.length} streak_len=${report.streak_len} ` +
      `blocked_days=${report.blocked_days.length} failed_criteria=[${report.failed_criteria.join(',')}]\n`);
  }
  return report.verdict === VERDICT.PASS ? EXIT.PASS : EXIT.FAIL_CLOSED;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) process.exit(main());
