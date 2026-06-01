#!/usr/bin/env node
/**
 * d11_rolling_30d_producer.mjs - Phase 2a-γ GHL 30-day rolling D-11 reducer (liye_os, NEW file).
 * SSOT: .claude/scripts/learning/d11_rolling_30d_producer.mjs (learning domain).
 *
 * Normative: SPEC .planning/phase-2a-gamma/SPEC.md v1.0 (blob eb17d868), CONTRACT-AUTHORITATIVE.
 * Output contract (NEW 2a-γ): _meta/contracts/learning/d11_rolling_30d_v1.schema.yaml.
 *
 * WHAT THIS DOES (Phase-4-prep rolling reducer; pure read + aggregate, R-γ1):
 *   - Rebuilds the two 30-day rolling D-11 KPIs the Phase-4 entry gate consumes:
 *       operator_agreement_rate_30d        (#4, ≥0.7 soft)
 *       critical_false_negative_count_30d  (#5, =0 hard)
 *   - REBUILD-ALL-FROM-TRIALS (SPEC §0.1-2 / D-γ6, red-team fold): numerator /
 *     denominator / critical are rebuilt DIRECTLY from the sealed policy_trials.jsonl
 *     (policy_trial_v1, blob 21f225d6), bucketing each operator_feedback.reviewed_at by
 *     UTC date into the 30-day window. On-time AND late feedback are counted once,
 *     uniformly — no ⊎, no separate late extraction, ZERO double-count. d11_kpis in
 *     metrics_daily.jsonl is NOT a numerator source; metrics_daily rows are read ONLY for
 *     window coverage (days_present): a UTC day "counts" iff the 1e producer emitted a row
 *     for it (α all-of-window analog). insufficient_window ⟺ days_present < 30.
 *   - Appends one well-formed row per produced window to
 *     state/runtime/learning/d11_rolling_30d.jsonl (append-only, gitignored), latest-wins
 *     by window_end_utc + same-hash skip.
 *
 * WHAT THIS DOES NOT DO (deferred - SPEC §6 / Hard NO):
 *   - Does NOT compute the Phase-4 gate verdict / PASS-FAIL / thresholds / abort logic
 *     (R-γ3). It emits KPI VALUES + their availability envelope only. Phase-4 reads this
 *     row, applies ≥0.7 (soft) / =0 (hard), and MUST verify window_end_utc freshness.
 *   - Does NOT write/rewrite trials / candidates / policies / production / verdicts
 *     (Hard Gate 8, R-γ2). It does NOT touch the evaluator / heartbeat / 1e producer.
 *   - Exposes NO arbitrary --window (R-γ4 / D-γ7): the span is fixed at 30 days. --date
 *     only moves the right boundary (window_end_utc), keeping a fixed 30-day span,
 *     mirroring the α exit-gate --asof — NOT a general query surface.
 *   - No scheduler (manual CLI / library trigger only, Pilot-1 invariant, R-γ1).
 *
 * SIMPSON-SAFE (SPEC §0.1-1): operator_agreement_rate_30d = Σ agree / Σ eligible over RAW
 * per-feedback atoms, NOT the average of per-day rates.
 *
 * FAIL-SAFE TOTALITY (SPEC §0.1-3 / R-γ5): critical_false_negative_count_30d == 0 is the
 * Phase-4 hard-gate PASS value, so an empty / insufficient window NEVER emits 0 — it emits
 * null + a kpi_unavailable_reason. To stop the gate ("uses raw atoms") from reconstructing a
 * passing rate from a partial window, ALL FOUR numeric KPI fields are null together when
 * unavailable: kpi_unavailable_reasons non-empty ⟺ all four numeric fields == null.
 *
 * rolling_record_hash is a PURE function of (window_start_utc + window_end_utc + window_days
 * + days_present + d11_rolling + input_sources), EXCLUDING every snapshot / wall-clock /
 * invocation field, so re-running a closed window never spuriously diverges (SPEC §0.1-4).
 *
 * Two orthogonal axes (mirroring metrics_daily_producer):
 *   --dry-run = WRITE axis: rehearse (aggregate + validate + report), persist nothing.
 *   --fixtures DIR = ROOT axis: inject rootDir so inputs + outputs isolate under DIR.
 *
 * Four fail-closed kinds, checked in this order (SPEC §0.1-4 KIND 序), exit 2, no partial row:
 *   incomplete_window -> input_unreadable -> divergence -> output_schema.
 *
 * Usage:
 *   node d11_rolling_30d_producer.mjs [--date YYYY-MM-DD] [--allow-incomplete] [--regenerate]
 *                                     [--dry-run] [--fixtures <dir>] [--json] [--help]
 */

import {
  readFileSync, existsSync, mkdirSync,
  openSync, writeSync, closeSync, appendFileSync, unlinkSync, realpathSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';

import { parseCanonical, hashCanonical } from './canonical_json.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// --------------------------------------------------------------------------- //
// Locked constants
// --------------------------------------------------------------------------- //

// SSOT version token (mirrors generator_version convention; hash-OUT).
export const GENERATOR_VERSION = 'd11_rolling_30d_producer@1.0.0';
const SCHEMA_VERSION = '1.0.0';

// Fixed rolling span. The reducer exposes NO arbitrary --window (R-γ4 / D-γ7).
export const WINDOW_DAYS = 30;
const MS_PER_DAY = 86400000;

const ROLLING_SCHEMA_PATH = join(PROJECT_ROOT, '_meta/contracts/learning/d11_rolling_30d_v1.schema.yaml');

// Inputs (frozen, read-only). policy_trials = REBUILD source; metrics_daily = window coverage.
const TRIALS_REL = 'state/runtime/learning/policy_trials.jsonl';
const METRICS_DAILY_REL = 'state/runtime/learning/metrics_daily.jsonl';

// Output (gitignored under .gitignore:330 sibling) + lock.
const ROLLING_OUT_REL = 'state/runtime/learning/d11_rolling_30d.jsonl';
const LOCK_REL = 'state/runtime/learning/d11_rolling_30d.lock';

// Operator vocabularies, aligned to the frozen operator_feedback_v1 schema tokens.
const OPERATOR_VERDICT_AGREE = 'AGREE_WITH_SYSTEM';
const OPERATOR_VERDICT_DISAGREE = 'DISAGREE_WITH_SYSTEM';
// NEEDS_MORE_EVIDENCE -> neither numerator nor denominator.
const OPERATOR_REASON_CODES = ['unsafe_reuse', 'weak_evidence', 'business_context_changed', 'regression_failed', 'acceptable'];
// D-11 critical false-negative codes (operator vocabulary), per operator_feedback_v1 + D-12.
const CRITICAL_OPERATOR_CODES = ['unsafe_reuse', 'regression_failed', 'business_context_changed'];

const EXIT = { SUCCESS: 0, FAIL_CLOSED: 2, UNEXPECTED: 1 };

// Distinct error kinds: lock contention -> exit 1 (UNEXPECTED); input corruption ->
// fail-closed (exit 2) kind=input_unreadable (mirrors metrics_daily_producer).
class RollingLockError extends Error { constructor(m) { super(m); this.name = 'RollingLockError'; } }
class InputUnreadableError extends Error { constructor(m) { super(m); this.name = 'InputUnreadableError'; } }

// --------------------------------------------------------------------------- //
// ajv (Draft-07, strict off, formats off — matches the 1b/1c/1d/1e convention).
// --------------------------------------------------------------------------- //

let _validator = null;
function getRollingValidator() {
  if (!_validator) {
    const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
    _validator = ajv.compile(parseYaml(readFileSync(ROLLING_SCHEMA_PATH, 'utf-8')));
  }
  return _validator;
}

function firstError(validate) {
  const e = validate.errors && validate.errors[0];
  if (!e) return 'schema invalid';
  return `${e.instancePath || '<root>'} ${e.message}`;
}

// --------------------------------------------------------------------------- //
// Time + UTC-day helpers (mirror metrics_daily_producer)
// --------------------------------------------------------------------------- //

function nowIso() { return new Date().toISOString(); } // ...Z == +00:00 offset

// ISO 8601 must carry a tz offset (Z or +/-HH:MM); EV2-I-01 fail-closed if missing.
const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/;

/** UTC date (YYYY-MM-DD) of an ISO datetime; throws InputUnreadableError if no offset. */
export function utcDateOf(iso) {
  if (typeof iso !== 'string' || !OFFSET_RE.test(iso.trim())) {
    throw new InputUnreadableError(`datetime missing tz offset (EV2-I-01): ${JSON.stringify(iso)}`);
  }
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new InputUnreadableError(`unparseable datetime: ${JSON.stringify(iso)}`);
  return new Date(ms).toISOString().slice(0, 10);
}

function currentUtcDay(now) { return (now instanceof Date ? now : new Date()).toISOString().slice(0, 10); }

/** Default window_end = yesterday (last complete UTC day). */
export function computeDefaultWindowEnd(now) {
  const base = now instanceof Date ? now : new Date();
  return new Date(base.getTime() - MS_PER_DAY).toISOString().slice(0, 10);
}

/** A UTC day is "complete" iff it is strictly before the current UTC day. */
export function isCompleteDay(dateUtc, now) { return dateUtc < currentUtcDay(now); }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function validateDateFormat(dateUtc) {
  if (!DATE_RE.test(dateUtc)) throw new Error(`invalid --date '${dateUtc}' (expected YYYY-MM-DD)`);
  const ms = Date.parse(`${dateUtc}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== dateUtc) {
    throw new Error(`invalid --date '${dateUtc}' (not a real calendar day)`);
  }
}

/** Add n calendar days to a YYYY-MM-DD (UTC). */
export function addDaysUtc(dateUtc, n) {
  return new Date(Date.parse(`${dateUtc}T00:00:00Z`) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The fixed 30-day window [start, end] (inclusive) ending at window_end_utc. */
export function windowFor(windowEndUtc) {
  const startUtc = addDaysUtc(windowEndUtc, -(WINDOW_DAYS - 1));
  return {
    window_start_utc: startUtc,
    window_end_utc: windowEndUtc,
    // The exact ISO bracket of the 30-day span (start 00:00:00 .. end+1 00:00:00).
    start_iso: `${startUtc}T00:00:00.000Z`,
    end_iso: new Date(Date.parse(`${windowEndUtc}T00:00:00Z`) + MS_PER_DAY).toISOString(),
  };
}

/** True iff dateUtc is within [startUtc, endUtc] inclusive (lexicographic compare is safe for YYYY-MM-DD). */
function inWindow(dateUtc, startUtc, endUtc) { return dateUtc >= startUtc && dateUtc <= endUtc; }

// --------------------------------------------------------------------------- //
// Input readers (existsSync-guarded; file-level corrupt -> input_unreadable)
// --------------------------------------------------------------------------- //

function readJsonl(absPath) {
  if (!existsSync(absPath)) return { present: false, objects: [], malformed: 0 };
  let text;
  try { text = readFileSync(absPath, 'utf-8'); }
  catch (e) { throw new InputUnreadableError(`cannot read ${absPath}: ${e.message}`); }
  const objects = [];
  let malformed = 0;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try { obj = JSON.parse(t); } catch { malformed += 1; continue; } // single malformed line: skip + count
    objects.push(obj);
  }
  return { present: true, objects, malformed };
}

/** Coerce a reason-code field to an array. null/undefined -> []; a non-array -> input_unreadable. */
function asCodeArray(v) {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v;
  throw new InputUnreadableError(`reason_codes must be an array, got ${typeof v}`);
}

function loadInputs(rootDir) {
  const trials = readJsonl(join(rootDir, TRIALS_REL));
  const metricsDaily = readJsonl(join(rootDir, METRICS_DAILY_REL));
  return { trials, metricsDaily };
}

// --------------------------------------------------------------------------- //
// Aggregation (pure over already-loaded inputs; exported for unit coverage).
// --------------------------------------------------------------------------- //

/** Distinct set of complete UTC days present in metrics_daily.jsonl (window-coverage signal). */
function metricsDaySet(metricsDaily) {
  const set = new Set();
  for (const row of metricsDaily.objects) {
    if (row && typeof row.date_utc === 'string') set.add(row.date_utc);
  }
  return set;
}

function zeroReasonCodes() {
  const o = {};
  for (const k of OPERATOR_REASON_CODES) o[k] = 0;
  return o;
}

/** Tally a reason code into the fixed-key histogram; out-of-enum -> input_unreadable. */
function tallyCode(hist, code) {
  if (!Object.prototype.hasOwnProperty.call(hist, code)) {
    throw new InputUnreadableError(`operator reason_code out of enum: ${JSON.stringify(code)}`);
  }
  hist[code] += 1;
}

/**
 * Rebuild the 30-day rolling D-11 KPIs over the window [windowStart, windowEnd] from the
 * sealed trials ledger + the metrics_daily coverage set. Pure: throws InputUnreadableError
 * on a corrupt scalar (missing tz offset / out-of-enum) so the caller fail-closes
 * input_unreadable. Returns the hash-body blocks + days_present + input_sources.
 *
 * REBUILD-ALL: each trial's operator_feedback is bucketed by reviewed_at UTC date — on-time
 * and late feedback enter the window identically (no double-count). trial.evaluated_at is
 * used ONLY to disambiguate no_trials_in_window vs no_operator_feedback_in_window (diagnostic;
 * never affects numerator/denominator).
 */
export function aggregateWindow(windowEndUtc, inputs) {
  const { window_start_utc: startUtc, window_end_utc: endUtc } = windowFor(windowEndUtc);

  // Window coverage (days_present): a UTC day counts iff metrics_daily emitted a row for it.
  const daySet = metricsDaySet(inputs.metricsDaily);
  let daysPresent = 0;
  for (let i = 0; i < WINDOW_DAYS; i++) {
    if (daySet.has(addDaysUtc(startUtc, i))) daysPresent += 1;
  }
  const windowSufficient = daysPresent === WINDOW_DAYS;

  // Trials: latest-wins by trial_id (async feedback re-appends the whole trial object, mirroring 1e).
  const trialById = new Map();
  for (const obj of inputs.trials.objects) {
    if (obj && typeof obj.trial_id === 'string') trialById.set(obj.trial_id, obj);
  }

  let agree = 0;
  let eligible = 0;
  let criticalFalseNegative = 0;
  let feedbackInWindow = 0;
  let trialsEvaluatedInWindow = 0;
  const operatorReasonCodes = zeroReasonCodes();
  const consumedTrialIds = new Set();

  for (const t of trialById.values()) {
    // Diagnostic axis (evaluated_at) — distinguishes "no trials" from "trials but no feedback".
    if (typeof t.evaluated_at === 'string' && inWindow(utcDateOf(t.evaluated_at), startUtc, endUtc)) {
      trialsEvaluatedInWindow += 1;
      consumedTrialIds.add(t.trial_id);
    }

    const fb = t.operator_feedback;
    if (fb && typeof fb === 'object') {
      const fbDate = utcDateOf(fb.reviewed_at);
      // Numerator/denominator axis (reviewed_at) — on-time + late counted once, uniformly.
      if (inWindow(fbDate, startUtc, endUtc)) {
        feedbackInWindow += 1;
        consumedTrialIds.add(t.trial_id);
        if (fb.verdict === OPERATOR_VERDICT_AGREE) { agree += 1; eligible += 1; }
        else if (fb.verdict === OPERATOR_VERDICT_DISAGREE) {
          eligible += 1;
          if (asCodeArray(fb.reason_codes).some((c) => CRITICAL_OPERATOR_CODES.includes(c))) criticalFalseNegative += 1;
        }
        // NEEDS_MORE_EVIDENCE -> neither numerator nor denominator (still tallied below).
        for (const code of asCodeArray(fb.reason_codes)) tallyCode(operatorReasonCodes, code);
      }
    }
  }

  // Availability + reason (mutually exclusive, in precedence order). insufficient_window
  // dominates regardless of data; then the data-emptiness reasons (SPEC §3 DoD#4).
  const kpiUnavailableReasons = [];
  if (!windowSufficient) {
    kpiUnavailableReasons.push('insufficient_window');
  } else if (feedbackInWindow === 0) {
    kpiUnavailableReasons.push(trialsEvaluatedInWindow === 0 ? 'no_trials_in_window' : 'no_operator_feedback_in_window');
  } else if (eligible === 0) {
    kpiUnavailableReasons.push('denominator_zero_all_needs_more_evidence');
  }
  const available = kpiUnavailableReasons.length === 0;

  // FAIL-SAFE TOTALITY: all four numeric fields null together when unavailable, so the gate
  // ("uses raw atoms") cannot reconstruct a passing rate from a partial/empty window.
  const d11_rolling = {
    operator_agreement_rate_30d: available ? agree / eligible : null,
    agreement_agree_count_30d: available ? agree : null,
    agreement_eligible_count_30d: available ? eligible : null,
    critical_false_negative_count_30d: available ? criticalFalseNegative : null,
    operator_reason_codes: operatorReasonCodes, // diagnostic tallies, always real
    kpi_unavailable_reasons: kpiUnavailableReasons,
  };

  const input_sources = [
    { path: TRIALS_REL, role: 'rebuild_source', records_consumed: consumedTrialIds.size },
    { path: METRICS_DAILY_REL, role: 'window_coverage', records_consumed: daysPresent },
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return {
    window_start_utc: startUtc,
    window_end_utc: endUtc,
    days_present: daysPresent,
    window_sufficient: windowSufficient,
    d11_rolling,
    input_sources,
  };
}

/**
 * rolling_record_hash = hashCanonical over the PURE body (window + days_present + d11_rolling
 * + input_sources). Reuses parseCanonical + hashCanonical (zero canonicalization
 * reimplementation). Snapshot / wall-clock / invocation fields are NOT in the body, so a
 * closed window's hash is stable across reruns (SPEC §0.1-4).
 */
export function computeRollingRecordHash(body) {
  return hashCanonical(parseCanonical(JSON.stringify(body)));
}

function buildHashBody(agg) {
  return {
    window_start_utc: agg.window_start_utc,
    window_end_utc: agg.window_end_utc,
    window_days: WINDOW_DAYS,
    days_present: agg.days_present,
    d11_rolling: agg.d11_rolling,
    input_sources: agg.input_sources,
  };
}

function assembleRow(ctx) {
  return {
    schema_version: SCHEMA_VERSION,
    generator_version: GENERATOR_VERSION,
    generated_at_utc: ctx.generatedAt,
    write_mode: ctx.writeMode,
    root_mode: ctx.rootMode,
    window_sufficient: ctx.agg.window_sufficient,
    window_start_utc: ctx.agg.window_start_utc,
    window_end_utc: ctx.agg.window_end_utc,
    window_days: WINDOW_DAYS,
    days_present: ctx.agg.days_present,
    rolling_record_hash: ctx.hash,
    d11_rolling: ctx.agg.d11_rolling,
    provenance: {
      input_sources: ctx.agg.input_sources,
      producer_invocation: { write_mode: ctx.writeMode, root_mode: ctx.rootMode },
      aggregation_window: `${ctx.agg.window_start_utc}..${ctx.agg.window_end_utc}`,
    },
  };
}

// --------------------------------------------------------------------------- //
// Disk-state readers for the write guards (same-hash skip / divergence).
// --------------------------------------------------------------------------- //

function buildSeenByWindowEnd(rollingOutAbs) {
  const map = new Map(); // window_end_utc -> rolling_record_hash (latest line wins)
  if (!existsSync(rollingOutAbs)) return map;
  for (const line of readFileSync(rollingOutAbs, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try { obj = JSON.parse(t); } catch { continue; }
    if (obj && typeof obj.window_end_utc === 'string' && typeof obj.rolling_record_hash === 'string') {
      map.set(obj.window_end_utc, obj.rolling_record_hash);
    }
  }
  return map;
}

// --------------------------------------------------------------------------- //
// Lock + dir helpers (mirror 1e).
// --------------------------------------------------------------------------- //

function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

function acquireLock(lockPath) {
  ensureDir(dirname(lockPath));
  let fd;
  try { fd = openSync(lockPath, 'wx'); } // O_CREAT | O_EXCL
  catch (err) {
    if (err.code === 'EEXIST') throw new RollingLockError(`d11_rolling_30d lock held: ${lockPath}`);
    throw err;
  }
  try { writeSync(fd, `${nowIso()} pid=${process.pid}\n`); } finally { closeSync(fd); }
}

function releaseLock(lockPath) { try { unlinkSync(lockPath); } catch { /* already gone */ } }

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

/**
 * Produce (or rehearse) one 30-day rolling D-11 KPI row.
 *
 * @param {object} [options]
 * @param {string}  [options.dateUtc]          window_end_utc YYYY-MM-DD; default = yesterday (last complete UTC day)
 * @param {boolean} [options.allowIncomplete]  allow a window_end that is the current (un-elapsed) UTC day
 * @param {boolean} [options.regenerate]       override the divergence guard (append a new row)
 * @param {boolean} [options.dryRun=false]     WRITE axis: rehearse only, persist nothing
 * @param {string}  [options.rootDir]          ROOT axis: state I/O root (--fixtures); default PROJECT_ROOT
 * @param {Date}    [options.now]              clock injection (test seam); default new Date()
 * @returns {object} D11RollingReport (audit; NOT the rolling row)
 */
export function produceD11Rolling(options = {}) {
  const dryRun = options.dryRun === true;
  const rootDir = options.rootDir ? realpathSync(options.rootDir) : PROJECT_ROOT;
  const rootMode = options.rootDir ? 'fixtures_root' : 'default_root';
  const writeMode = dryRun ? 'rehearse' : 'persist';
  const allowIncomplete = options.allowIncomplete === true;
  const regenerate = options.regenerate === true;
  const now = options.now instanceof Date ? options.now : new Date();
  const generatedAt = now.toISOString();

  // window_end resolution (bad format -> throw -> exit 1 UNEXPECTED).
  let windowEndUtc;
  if (options.dateUtc) { validateDateFormat(options.dateUtc); windowEndUtc = options.dateUtc; }
  else windowEndUtc = computeDefaultWindowEnd(now);

  const report = {
    write_mode: writeMode,
    root_mode: rootMode,
    window_end_utc: windowEndUtc,
    window_start_utc: null,
    window_complete: null,
    days_present: null,
    window_sufficient: null,
    action: 'none',
    rolling_record_hash: null,
    kpi_unavailable_reasons: null,
    operator_agreement_rate_30d: null,
    critical_false_negative_count_30d: null,
    inputs_present: null,
    fail_closed: { kind: null, detail: null },
    generated_at_utc: generatedAt,
  };

  const completeWindow = isCompleteDay(windowEndUtc, now);
  report.window_complete = completeWindow;

  // KIND 1: incomplete_window (pre-flight, no I/O). window_end must be a complete UTC day.
  if (!completeWindow && !allowIncomplete) {
    report.fail_closed = {
      kind: 'incomplete_window',
      detail: `window_end_utc=${windowEndUtc} is the current/future UTC day; pass --allow-incomplete to produce it`,
    };
    return report;
  }

  const rollingOutAbs = join(rootDir, ROLLING_OUT_REL);
  const lockPath = join(rootDir, LOCK_REL);

  // KIND 2: input_unreadable (load + aggregate; corrupt scalar/file -> fail-closed).
  let agg;
  try {
    const inputs = loadInputs(rootDir);
    report.inputs_present = {
      trials: inputs.trials.present,
      metrics_daily: inputs.metricsDaily.present,
    };
    agg = aggregateWindow(windowEndUtc, inputs);
  } catch (err) {
    if (err instanceof InputUnreadableError) {
      report.fail_closed = { kind: 'input_unreadable', detail: err.message };
      return report;
    }
    throw err; // invariant / logic error -> exit 1 UNEXPECTED
  }

  report.window_start_utc = agg.window_start_utc;
  report.days_present = agg.days_present;
  report.window_sufficient = agg.window_sufficient;
  report.kpi_unavailable_reasons = agg.d11_rolling.kpi_unavailable_reasons;
  report.operator_agreement_rate_30d = agg.d11_rolling.operator_agreement_rate_30d;
  report.critical_false_negative_count_30d = agg.d11_rolling.critical_false_negative_count_30d;

  const hash = computeRollingRecordHash(buildHashBody(agg));
  report.rolling_record_hash = hash;

  // KIND 3: divergence (compute hash done; decide before write).
  const existingHash = buildSeenByWindowEnd(rollingOutAbs).get(windowEndUtc);
  let action;
  if (existingHash === undefined) action = 'appended';
  else if (existingHash === hash) action = 'skipped_same_hash';
  else if (regenerate) action = 'regenerated';
  else {
    report.fail_closed = {
      kind: 'divergence',
      detail: `window_end_utc=${windowEndUtc} existing hash ${existingHash} != recomputed ${hash}; pass --regenerate to append a new row`,
    };
    return report;
  }

  const row = assembleRow({ agg, hash, writeMode, rootMode, generatedAt });

  // KIND 4: output_schema (defense-in-depth, producer-side enforce, before write).
  const v = getRollingValidator();
  if (!v(row)) {
    report.fail_closed = { kind: 'output_schema', detail: firstError(v) };
    return report;
  }

  report.action = action;

  // Persist (skipped entirely under --dry-run). Only appended / regenerated write a row.
  if (!dryRun && (action === 'appended' || action === 'regenerated')) {
    acquireLock(lockPath);
    try {
      ensureDir(dirname(rollingOutAbs));
      appendFileSync(rollingOutAbs, `${JSON.stringify(row)}\n`);
    } finally {
      releaseLock(lockPath);
    }
  }

  return report;
}

/** Class wrapper (whitelisted compound name) around the functional core. */
export class D11RollingProducer {
  constructor(options = {}) { this.options = options; }
  run() { return produceD11Rolling(this.options); }
}

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //

const HELP = `d11_rolling_30d_producer.mjs - Phase 2a-γ GHL 30-day rolling D-11 reducer

Usage:
  node d11_rolling_30d_producer.mjs [options]

Options:
  --date <YYYY-MM-DD>  window_end_utc (right boundary). Default: yesterday (last complete UTC day).
                       The span is ALWAYS 30 days (window_start = window_end - 29); there is NO
                       arbitrary --window (R-γ4). --date only moves the right boundary.
  --allow-incomplete   Allow a window_end that is the current (un-elapsed) UTC day (else
                       fail-closed incomplete_window).
  --regenerate         Override the divergence guard: append a new row when the recomputed
                       hash differs from the existing same-window row (latest-wins).
  --dry-run            WRITE axis: rehearse (aggregate + validate + report), persist nothing.
  --fixtures <dir>     ROOT axis: isolate inputs + outputs under <dir> (test/runbook seam).
  --json               Print the D11RollingReport as JSON on stdout.
  --help               Show this help and exit 0.

Exit codes:
  0  success (appended / skipped_same_hash / regenerated, or --dry-run rehearsed)
  2  fail-closed: incomplete_window / input_unreadable / divergence / output_schema
     (read report.fail_closed.kind to distinguish)
  1  unexpected: lock contention, bad --date format, missing schema, I/O throw
`;

function parseArgs(argv) {
  const opts = {
    dateUtc: null, allowIncomplete: false, regenerate: false,
    dryRun: false, rootDir: null, json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--allow-incomplete') opts.allowIncomplete = true;
    else if (a === '--regenerate') opts.regenerate = true;
    else if (a === '--date') opts.dateUtc = argv[++i];
    else if (a === '--fixtures') opts.rootDir = argv[++i];
    else process.stderr.write(`unknown argument: ${a}\n`);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { process.stdout.write(HELP); return EXIT.SUCCESS; }
  let report;
  try {
    report = produceD11Rolling({
      dateUtc: opts.dateUtc || undefined,
      allowIncomplete: opts.allowIncomplete,
      regenerate: opts.regenerate,
      dryRun: opts.dryRun,
      rootDir: opts.rootDir || undefined,
    });
  } catch (err) {
    process.stderr.write(`[d11_rolling_30d_producer] ${err.name === 'RollingLockError' ? err.message : `unexpected error: ${err.stack || err.message}`}\n`);
    return EXIT.UNEXPECTED;
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (report.fail_closed.kind) {
    process.stderr.write(`[d11_rolling_30d_producer] FAIL_CLOSED (${report.fail_closed.kind}): ${report.fail_closed.detail}\n`);
  } else {
    const reasons = report.kpi_unavailable_reasons && report.kpi_unavailable_reasons.length
      ? report.kpi_unavailable_reasons.join(',') : 'available';
    process.stdout.write(
      `[d11_rolling_30d_producer] window=${report.window_start_utc}..${report.window_end_utc} `
      + `action=${report.action} days_present=${report.days_present}/${WINDOW_DAYS} `
      + `agreement_rate_30d=${report.operator_agreement_rate_30d} `
      + `critical_false_negative_30d=${report.critical_false_negative_count_30d} `
      + `kpi=${reasons}\n`);
  }
  return report.fail_closed.kind ? EXIT.FAIL_CLOSED : EXIT.SUCCESS;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) process.exit(main());
