#!/usr/bin/env node
/**
 * metrics_daily_producer.mjs - Phase 1e GHL daily metrics roll-up producer (liye_os, NEW file).
 * SSOT: .claude/scripts/learning/metrics_daily_producer.mjs (learning domain).
 *
 * Normative: SPEC .planning/phase-1e/SPEC.md v1.0 (blob 843f0750), CONTRACT-AUTHORITATIVE.
 * Output contract (NEW 1e): _meta/contracts/learning/metrics_daily_v1.schema.yaml.
 *
 * WHAT THIS DOES (standalone downstream observability aggregator, N3):
 *   - Reads 6 frozen on-disk 1b/1c/1d outputs (records / conflicts / rejects / trials /
 *     transitions / live heartbeat state), buckets by UTC calendar day, and appends one
 *     well-formed row per UTC day to state/runtime/learning/metrics_daily.jsonl.
 *   - The row field-pins the Phase-1 exit criteria as per-day OBSERVABLE atoms so they
 *     become machine-traceable (KPI#8). It does NOT compute the gate verdict, the 7-day
 *     PASS streak, or the 30-day rolling D-11 reducer — those are the Phase 2a entry
 *     check (SPEC §6 / N1 / N2).
 *
 * WHAT THIS DOES NOT DO (deferred - SPEC §6 / Hard NO):
 *   - Does NOT spawn/import the importer / evaluator / heartbeat runner (read-only on disk, N3).
 *     It reuses ONLY two pure functions at the module level: getPhaseWindowAge (1d) and
 *     hashCanonical/parseCanonical (1b). No CLI/subprocess of any sibling is invoked.
 *   - Does NOT write trials / candidates / policies / production artifacts (Hard Gate 8).
 *   - No scheduler (manual CLI / library trigger only, Pilot-1 invariant).
 *   - Does NOT self-report E3 "持续输出" (no metrics_emitted flag, N1).
 *
 * Two orthogonal axes (SPEC §1.1, red-team M2):
 *   - --dry-run = WRITE axis: rehearse (aggregate + validate + report), persist nothing.
 *     This is NOT the importer/heartbeat system dry_run posture; it is producer-local.
 *   - --fixtures DIR = ROOT axis: inject rootDir so all 6 inputs + outputs isolate under DIR.
 *   They compose (--dry-run --fixtures /tmp/x = rehearse on a fixtures root).
 *
 * Four fail-closed kinds, checked in this order (SPEC §1.5 / N5), exit 2, no half-baked row:
 *   incomplete_day -> input_unreadable -> divergence -> output_schema.
 *
 * metric_record_hash is a PURE function of (date_utc + window + the 6-input aggregate),
 * EXCLUDING every snapshot / wall-clock / invocation field, so re-running a closed day
 * never spuriously diverges as the control-plane advances (SPEC §1.5 / red-team H1).
 *
 * Usage:
 *   node metrics_daily_producer.mjs [--date YYYY-MM-DD] [--allow-incomplete] [--regenerate]
 *                                   [--dry-run] [--fixtures <dir>] [--json] [--help]
 */

import {
  readFileSync, readdirSync, existsSync, mkdirSync,
  openSync, writeSync, closeSync, appendFileSync, unlinkSync, realpathSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';

import { parseCanonical, hashCanonical } from './canonical_json.mjs';
import { getPhaseWindowAge } from './heartbeat_runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// --------------------------------------------------------------------------- //
// Locked constants
// --------------------------------------------------------------------------- //

// SSOT version token (mirrors importer_version convention; hash-OUT).
export const GENERATOR_VERSION = 'metrics_daily_producer@1.0.0';
const SCHEMA_VERSION = '1.0.0';

const METRICS_SCHEMA_PATH = join(PROJECT_ROOT, '_meta/contracts/learning/metrics_daily_v1.schema.yaml');

// 6 input sources (frozen, read-only) + 3 outputs (gitignored under .gitignore:330).
const RECORDS_REL = 'state/memory/facts/fact_run_outcome_records.jsonl';
const CONFLICTS_BASE_REL = 'state/runtime/learning/fact_conflicts';
const REJECTS_BASE_REL = 'state/runtime/learning/fact_rejects';
const TRIALS_REL = 'state/runtime/learning/policy_trials.jsonl';
const TRANSITIONS_REL = 'state/runtime/learning/heartbeat_phase_transitions.jsonl';
// learning/, NOT proactive/ decoy (SPEC §0.1-6; the proactive/ file is pre-GHL v1).
const LIVE_STATE_REL = 'state/runtime/learning/heartbeat_learning_state.json';

const METRICS_OUT_REL = 'state/runtime/learning/metrics_daily.jsonl';
const LATE_ARRIVALS_REL = 'state/runtime/learning/metrics_daily_late_arrivals.jsonl';
const LOCK_REL = 'state/runtime/learning/metrics_daily.lock';

// Enum vocabularies, aligned to the frozen input schemas' full tokens (red-team M8).
const SOURCE_SYSTEMS = ['amazon-growth-engine', 'chaming', 'loamwise'];
const MANIFEST_STATUSES = ['PASS', 'WARN', 'FAIL'];
const REDACTION_STATUSES = ['redacted', 'no_sensitive_fields_detected', 'unknown'];
const REJECT_REASON_KEYS = [
  'SCHEMA_INVALID', 'NUMERIC_NOT_STRING', 'PATH_UNSAFE', 'FILENAME_MISMATCH',
  'IDENTITY_MISMATCH', 'CONTENT_MISMATCH', 'SIDECAR_LOG_MISMATCH',
];
const SYSTEM_VERDICTS = ['PASS', 'FAIL', 'DOWNGRADED', 'NEEDS_HUMAN'];
const EVIDENCE_ORIGINS = ['production_observed', 'historical_replay', 'golden_regression', 'synthetic'];
const SYSTEM_REASON_CODES = [
  'duplicate_conflict', 'golden_pack_stale', 'data_safety_unknown', 'regression_failure_severe',
  'confidence_below_threshold', 'evidence_origin_insufficient', 'manifest_validator_failed',
  'source_dirty', 'sample_size_insufficient', 'boundary_confidence_value', 'acceptable',
];
const OPERATOR_VERDICT_AGREE = 'AGREE_WITH_SYSTEM';
const OPERATOR_VERDICT_DISAGREE = 'DISAGREE_WITH_SYSTEM';
const OPERATOR_REASON_CODES = ['unsafe_reuse', 'weak_evidence', 'business_context_changed', 'regression_failed', 'acceptable'];
// D-11 critical false-negative codes (operator vocabulary), per operator_feedback_v1 + D-12.
const CRITICAL_OPERATOR_CODES = ['unsafe_reuse', 'regression_failed', 'business_context_changed'];
const HEARTBEAT_FLAG_KEYS = [
  'enabled', 'evaluator_enabled', 'trial_write_enabled', 'candidate_write_enabled',
  'candidate_write_target_status', 'promotion_enabled', 'production_write_enabled',
];

const EXIT = { SUCCESS: 0, FAIL_CLOSED: 2, UNEXPECTED: 1 };

// Distinct error kinds: lock contention -> exit 1 (UNEXPECTED); input corruption ->
// fail-closed (exit 2) kind=input_unreadable.
class MetricsLockError extends Error { constructor(m) { super(m); this.name = 'MetricsLockError'; } }
class InputUnreadableError extends Error { constructor(m) { super(m); this.name = 'InputUnreadableError'; } }

// --------------------------------------------------------------------------- //
// ajv (Draft-07, strict off, formats off — matches the 1b/1c/1d convention).
// --------------------------------------------------------------------------- //

let _validator = null;
function getMetricsValidator() {
  if (!_validator) {
    const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
    _validator = ajv.compile(parseYaml(readFileSync(METRICS_SCHEMA_PATH, 'utf-8')));
  }
  return _validator;
}

function firstError(validate) {
  const e = validate.errors && validate.errors[0];
  if (!e) return 'schema invalid';
  return `${e.instancePath || '<root>'} ${e.message}`;
}

// --------------------------------------------------------------------------- //
// Time + UTC-day helpers
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

/** Default --date = yesterday (last complete UTC day, F2). */
export function computeDefaultDate(now) {
  const base = now instanceof Date ? now : new Date();
  return new Date(base.getTime() - 86400000).toISOString().slice(0, 10);
}

function currentUtcDay(now) { return (now instanceof Date ? now : new Date()).toISOString().slice(0, 10); }

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

function windowFor(dateUtc) {
  return {
    start_utc: `${dateUtc}T00:00:00.000Z`,
    end_utc: new Date(Date.parse(`${dateUtc}T00:00:00Z`) + 86400000).toISOString(),
  };
}

// --------------------------------------------------------------------------- //
// Histograms
// --------------------------------------------------------------------------- //

function zeroHist(keys) { const o = {}; for (const k of keys) o[k] = 0; return o; }

/** Increment a fixed-key histogram; out-of-enum value -> input_unreadable (corrupt input). */
function bump(hist, key) {
  if (!Object.prototype.hasOwnProperty.call(hist, key)) {
    throw new InputUnreadableError(`value out of enum: ${JSON.stringify(key)}`);
  }
  hist[key] += 1;
}

/**
 * Coerce a reason-code field to an array. null/undefined -> []; a non-array
 * (corrupt shape, schema-invalid upstream) -> input_unreadable fail-closed (exit 2),
 * consistent with bump()'s out-of-enum handling (NOT an exit-1 UNEXPECTED throw).
 */
function asCodeArray(v) {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v;
  throw new InputUnreadableError(`reason_codes must be an array, got ${typeof v}`);
}

function sumHist(hist) { return Object.values(hist).reduce((a, b) => a + b, 0); }

function assertSum(hist, total, label) {
  if (sumHist(hist) !== total) {
    throw new Error(`invariant violated: ${label} sum ${sumHist(hist)} != total ${total}`);
  }
}

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

/** Scan a 2-level conflict/reject dir tree (<segment>/<leaf>/<metaFilename>). */
function scanMetaDirs(baseAbs, metaFilename) {
  if (!existsSync(baseAbs)) return { present: false, metas: [] };
  const metas = [];
  let segments;
  try { segments = readdirSync(baseAbs, { withFileTypes: true }); }
  catch (e) { throw new InputUnreadableError(`cannot scan ${baseAbs}: ${e.message}`); }
  for (const seg of segments) {
    if (!seg.isDirectory()) continue;
    const segDir = join(baseAbs, seg.name);
    let leaves;
    try { leaves = readdirSync(segDir, { withFileTypes: true }); } catch { continue; }
    for (const leaf of leaves) {
      if (!leaf.isDirectory()) continue;
      const metaPath = join(segDir, leaf.name, metaFilename);
      if (!existsSync(metaPath)) continue; // incomplete dir (partial write): skip
      let meta;
      try { meta = parseYaml(readFileSync(metaPath, 'utf-8')); }
      catch (e) { throw new InputUnreadableError(`corrupt ${metaPath}: ${e.message}`); }
      if (!meta || typeof meta !== 'object') {
        throw new InputUnreadableError(`corrupt ${metaPath}: not a mapping`);
      }
      metas.push({ segment: seg.name, meta });
    }
  }
  return { present: true, metas };
}

function loadInputs(rootDir) {
  const records = readJsonl(join(rootDir, RECORDS_REL));
  const trials = readJsonl(join(rootDir, TRIALS_REL));
  const transitions = readJsonl(join(rootDir, TRANSITIONS_REL));
  const conflicts = scanMetaDirs(join(rootDir, CONFLICTS_BASE_REL), 'conflict_meta.yaml');
  const rejects = scanMetaDirs(join(rootDir, REJECTS_BASE_REL), 'reject_meta.yaml');

  const liveStatePath = join(rootDir, LIVE_STATE_REL);
  let liveState = null;
  const liveStatePresent = existsSync(liveStatePath);
  if (liveStatePresent) {
    let raw;
    try { raw = readFileSync(liveStatePath, 'utf-8'); }
    catch (e) { throw new InputUnreadableError(`cannot read live state: ${e.message}`); }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { throw new InputUnreadableError(`live state not parseable: ${e.message}`); }
    // Tolerate pre-v2 / decoy-shape (version != 2 or no current_phase) -> null snapshot, NOT a fail.
    if (parsed && parsed.version === 2 && typeof parsed.current_phase === 'string') liveState = parsed;
  }

  return { records, trials, transitions, conflicts, rejects, liveState, liveStatePresent };
}

// --------------------------------------------------------------------------- //
// Aggregation (pure over already-loaded inputs; exported for unit coverage).
// --------------------------------------------------------------------------- //

/**
 * Aggregate one UTC day from already-loaded inputs. Returns the hash-body blocks
 * (counts + breakdowns + d11 + exit signals + input_sources + window) plus the
 * late-arrival candidates. Pure: throws InputUnreadableError on a corrupt scalar
 * (missing tz offset / out-of-enum) so the caller fail-closes input_unreadable.
 */
export function aggregateDay(dateUtc, inputs) {
  const dayRecords = inputs.records.objects.filter((r) => utcDateOf(r.emitted_at) === dateUtc);

  // 1c trials: latest-wins by trial_id (async feedback may re-append the trial object).
  const trialById = new Map();
  for (const obj of inputs.trials.objects) {
    if (obj && typeof obj.trial_id === 'string') trialById.set(obj.trial_id, obj);
  }
  const dayTrials = [...trialById.values()].filter((t) => utcDateOf(t.evaluated_at) === dateUtc);

  const dayConflicts = inputs.conflicts.metas.filter((c) => utcDateOf(c.meta.detected_at) === dateUtc);
  const dayRejects = inputs.rejects.metas.filter((r) => utcDateOf(r.meta.detected_at) === dateUtc);
  const dayTransitions = inputs.transitions.objects.filter((tr) => utcDateOf(tr.transition_at) === dateUtc);

  // --- fact_records_breakdown + c1 per-source ---
  const by_source_system = zeroHist(SOURCE_SYSTEMS);
  const by_manifest_validator_status = zeroHist(MANIFEST_STATUSES);
  const by_redaction_status = zeroHist(REDACTION_STATUSES);
  const perSource = {};
  for (const s of SOURCE_SYSTEMS) perSource[s] = { pass: 0, warn: 0, fail: 0 };
  let sdTrue = 0; let sdFalse = 0; let pdTrue = 0; let pdFalse = 0; let recDrift = 0;

  for (const r of dayRecords) {
    bump(by_source_system, r.source_system);
    const mv = r.provenance && r.provenance.manifest_validator_status;
    bump(by_manifest_validator_status, mv);
    bump(by_redaction_status, r.redaction_status);
    if (r.source_dirty === true) sdTrue += 1; else sdFalse += 1;
    const pDirty = r.provenance && r.provenance.provenance_dirty;
    if (pDirty === true) pdTrue += 1; else pdFalse += 1;
    if (r.schema_version !== '1.0.0') recDrift += 1;
    // c1 per-source (strict PASS-only judged downstream; here we keep raw pass/warn/fail).
    if (mv === 'PASS') perSource[r.source_system].pass += 1;
    else if (mv === 'WARN') perSource[r.source_system].warn += 1;
    else perSource[r.source_system].fail += 1;
  }

  // --- fact_rejects_breakdown + c4 ---
  const by_reason = zeroHist(REJECT_REASON_KEYS);
  let c4PathUnsafe = 0;
  for (const rj of dayRejects) {
    const reason = rj.meta.reason;
    bump(by_reason, reason);
    if (reason === 'PATH_UNSAFE') c4PathUnsafe += 1;
  }

  // --- policy_trials_breakdown + d11 atoms (on-time feedback only) + late arrivals ---
  const by_system_verdict = zeroHist(SYSTEM_VERDICTS);
  const by_evidence_origin = zeroHist(EVIDENCE_ORIGINS);
  const system_reason_codes = zeroHist(SYSTEM_REASON_CODES);
  const operator_reason_codes = zeroHist(OPERATOR_REASON_CODES);
  let trialDrift = 0;
  let withOperatorFeedback = 0;
  let agree = 0; let eligible = 0; let criticalFalseNegative = 0;
  const lateArrivalsCandidates = [];

  for (const t of dayTrials) {
    bump(by_system_verdict, t.system_verdict);
    bump(by_evidence_origin, t.evidence_origin);
    for (const code of asCodeArray(t.system_verdict_reason_codes)) bump(system_reason_codes, code);
    if (t.schema_version !== '1.0.0') trialDrift += 1;

    const fb = t.operator_feedback;
    if (fb && typeof fb === 'object') {
      const fbDate = utcDateOf(fb.reviewed_at);
      if (fbDate === dateUtc) {
        // ON-TIME feedback -> counts toward the day-N atom (hash-stable).
        withOperatorFeedback += 1;
        if (fb.verdict === OPERATOR_VERDICT_AGREE) { agree += 1; eligible += 1; }
        else if (fb.verdict === OPERATOR_VERDICT_DISAGREE) {
          eligible += 1;
          if (asCodeArray(fb.reason_codes).some((c) => CRITICAL_OPERATOR_CODES.includes(c))) criticalFalseNegative += 1;
        }
        // NEEDS_MORE_EVIDENCE -> neither numerator nor denominator.
        for (const code of asCodeArray(fb.reason_codes)) bump(operator_reason_codes, code);
      } else {
        // LATE arrival -> evidence-ledger side-car, NOT the day-N atom (N4).
        lateArrivalsCandidates.push({
          trial_id: t.trial_id,
          trial_evaluated_date_utc: dateUtc,
          feedback_reviewed_at: fb.reviewed_at,
          operator_verdict: fb.verdict,
          operator_reason_codes: fb.reason_codes || [],
        });
      }
    }
  }

  const kpiUnavailableReasons = [];
  if (dayTrials.length === 0) kpiUnavailableReasons.push('no_trials');
  else if (withOperatorFeedback === 0) kpiUnavailableReasons.push('no_operator_feedback');
  else if (eligible === 0) kpiUnavailableReasons.push('denominator_zero_all_needs_more_evidence');
  const rate = eligible > 0 ? agree / eligible : null;

  const counts = {
    fact_records_total: dayRecords.length,
    fact_conflicts_total: dayConflicts.length,
    fact_rejects_total: dayRejects.length,
    policy_trials_total: dayTrials.length,
    transitions_total: dayTransitions.length,
  };

  // Internal invariants (sum of each guaranteed-complete breakdown == its total).
  assertSum(by_source_system, counts.fact_records_total, 'by_source_system');
  assertSum(by_manifest_validator_status, counts.fact_records_total, 'by_manifest_validator_status');
  assertSum(by_redaction_status, counts.fact_records_total, 'by_redaction_status');
  if (sdTrue + sdFalse !== counts.fact_records_total) throw new Error('invariant: source_dirty');
  if (pdTrue + pdFalse !== counts.fact_records_total) throw new Error('invariant: provenance_dirty');
  assertSum(by_reason, counts.fact_rejects_total, 'reject by_reason');
  assertSum(by_system_verdict, counts.policy_trials_total, 'by_system_verdict');
  assertSum(by_evidence_origin, counts.policy_trials_total, 'by_evidence_origin');

  const input_sources = [
    { path: RECORDS_REL, records_consumed: dayRecords.length },
    { path: CONFLICTS_BASE_REL, records_consumed: dayConflicts.length },
    { path: REJECTS_BASE_REL, records_consumed: dayRejects.length },
    { path: TRIALS_REL, records_consumed: dayTrials.length },
    { path: TRANSITIONS_REL, records_consumed: dayTransitions.length },
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return {
    window: windowFor(dateUtc),
    counts,
    fact_records_breakdown: {
      by_source_system,
      by_manifest_validator_status,
      by_redaction_status,
      source_dirty: { true_count: sdTrue, false_count: sdFalse },
      provenance_dirty: { true_count: pdTrue, false_count: pdFalse },
      schema_version_drift_count: recDrift,
    },
    fact_rejects_breakdown: { by_reason },
    policy_trials_breakdown: {
      by_system_verdict,
      by_evidence_origin,
      system_reason_codes,
      with_operator_feedback_count: withOperatorFeedback,
      schema_version_drift_count: trialDrift,
    },
    d11_kpis: {
      agreement_agree_count: agree,
      agreement_eligible_count: eligible,
      operator_agreement_rate_today: rate,
      critical_false_negative_count_today: criticalFalseNegative,
      operator_reason_codes,
      kpi_unavailable_reasons: kpiUnavailableReasons,
    },
    phase_1_exit_signals: {
      c1_manifest_validator: { per_source: perSource },
      c2_duplicate_conflict_count: dayConflicts.length,
      c2_dedupe_hit_rate: 'unobservable_from_disk',
      c4_path_unsafe_reject_count: c4PathUnsafe,
    },
    input_sources,
    lateArrivalsCandidates,
  };
}

/**
 * metric_record_hash = hashCanonical over the PURE (date_utc + window + 6-input
 * aggregate) body. Reuses parseCanonical + hashCanonical (zero canonicalization
 * reimplementation). Snapshot / wall-clock / invocation fields are NOT in the body
 * (red-team H1), so a closed day's hash is stable across reruns.
 */
export function computeMetricRecordHash(body) {
  return hashCanonical(parseCanonical(JSON.stringify(body)));
}

function buildHashBody(dateUtc, agg) {
  return {
    date_utc: dateUtc,
    window: agg.window,
    counts: agg.counts,
    fact_records_breakdown: agg.fact_records_breakdown,
    fact_rejects_breakdown: agg.fact_rejects_breakdown,
    policy_trials_breakdown: agg.policy_trials_breakdown,
    d11_kpis: agg.d11_kpis,
    phase_1_exit_signals: agg.phase_1_exit_signals,
    input_sources: agg.input_sources,
  };
}

function buildHeartbeatSnapshot(liveState) {
  if (!liveState) return null;
  const flags = {};
  for (const k of HEARTBEAT_FLAG_KEYS) flags[k] = liveState[k];
  return {
    current_phase: liveState.current_phase,
    flags,
    max_trials_per_day: liveState.max_trials_per_day,
    kill_switch_required: liveState.kill_switch_required,
    last_run_at: liveState.last_run_at ?? null,
    state_version: liveState.version,
    source_allowlist_count: Array.isArray(liveState.source_allowlist) ? liveState.source_allowlist.length : 0,
  };
}

function assembleRow(ctx) {
  return {
    schema_version: SCHEMA_VERSION,
    generator_version: GENERATOR_VERSION,
    date_utc: ctx.dateUtc,
    generated_at_utc: ctx.generatedAt,
    window: ctx.agg.window,
    write_mode: ctx.writeMode,
    root_mode: ctx.rootMode,
    complete_day: ctx.completeDay,
    metric_record_hash: ctx.hash,
    current_phase: ctx.currentPhase,
    phase_window_age_seconds: ctx.windowAge,
    counts: ctx.agg.counts,
    fact_records_breakdown: ctx.agg.fact_records_breakdown,
    fact_rejects_breakdown: ctx.agg.fact_rejects_breakdown,
    policy_trials_breakdown: ctx.agg.policy_trials_breakdown,
    d11_kpis: ctx.agg.d11_kpis,
    phase_1_exit_signals: ctx.agg.phase_1_exit_signals,
    heartbeat_snapshot: ctx.snapshot,
    provenance: {
      input_sources: ctx.agg.input_sources,
      producer_invocation: { write_mode: ctx.writeMode, root_mode: ctx.rootMode },
      aggregation_window: ctx.dateUtc,
    },
    late_arrivals_ref: { ledger_path: LATE_ARRIVALS_REL, appended_this_run: ctx.lateAppended },
  };
}

// --------------------------------------------------------------------------- //
// Disk-state readers for the write guards (F3 + late-arrival dedup).
// --------------------------------------------------------------------------- //

function buildSeenByDate(metricsOutAbs) {
  const map = new Map(); // date_utc -> metric_record_hash (latest line wins)
  if (!existsSync(metricsOutAbs)) return map;
  for (const line of readFileSync(metricsOutAbs, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try { obj = JSON.parse(t); } catch { continue; }
    if (obj && typeof obj.date_utc === 'string' && typeof obj.metric_record_hash === 'string') {
      map.set(obj.date_utc, obj.metric_record_hash);
    }
  }
  return map;
}

function buildSeenLateArrivals(lateAbs) {
  const set = new Set(); // `${trial_id}|${feedback_reviewed_at}`
  if (!existsSync(lateAbs)) return set;
  for (const line of readFileSync(lateAbs, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try { obj = JSON.parse(t); } catch { continue; }
    if (obj && obj.trial_id && obj.feedback_reviewed_at) set.add(`${obj.trial_id}|${obj.feedback_reviewed_at}`);
  }
  return set;
}

// --------------------------------------------------------------------------- //
// Lock + dir helpers (mirror 1d).
// --------------------------------------------------------------------------- //

function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

function acquireLock(lockPath) {
  ensureDir(dirname(lockPath));
  let fd;
  try { fd = openSync(lockPath, 'wx'); } // O_CREAT | O_EXCL
  catch (err) {
    if (err.code === 'EEXIST') throw new MetricsLockError(`metrics_daily lock held: ${lockPath}`);
    throw err;
  }
  try { writeSync(fd, `${nowIso()} pid=${process.pid}\n`); } finally { closeSync(fd); }
}

function releaseLock(lockPath) { try { unlinkSync(lockPath); } catch { /* already gone */ } }

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

/**
 * Produce (or rehearse) one UTC day's metrics roll-up row.
 *
 * @param {object} [options]
 * @param {string} [options.dateUtc]            target UTC day YYYY-MM-DD; default = yesterday (F2)
 * @param {boolean} [options.allowIncomplete]   allow producing the current (un-elapsed) UTC day
 * @param {boolean} [options.regenerate]        override the divergence guard (append a new row)
 * @param {boolean} [options.dryRun=false]      WRITE axis: rehearse only, persist nothing
 * @param {string}  [options.rootDir]           ROOT axis: state I/O root (--fixtures); default PROJECT_ROOT
 * @param {Date}    [options.now]               clock injection (test seam); default new Date()
 * @returns {object} MetricsDailyReport (audit; NOT the metrics row)
 */
export function produceMetricsDaily(options = {}) {
  const dryRun = options.dryRun === true;
  const rootDir = options.rootDir ? realpathSync(options.rootDir) : PROJECT_ROOT;
  const rootMode = options.rootDir ? 'fixtures_root' : 'default_root';
  const writeMode = dryRun ? 'rehearse' : 'persist';
  const allowIncomplete = options.allowIncomplete === true;
  const regenerate = options.regenerate === true;
  const now = options.now instanceof Date ? options.now : new Date();
  const generatedAt = now.toISOString();

  // --date resolution (bad format -> throw -> exit 1 UNEXPECTED).
  let dateUtc;
  if (options.dateUtc) { validateDateFormat(options.dateUtc); dateUtc = options.dateUtc; }
  else dateUtc = computeDefaultDate(now);

  const report = {
    write_mode: writeMode,
    root_mode: rootMode,
    date_utc: dateUtc,
    complete_day: null,
    action: 'none',
    metric_record_hash: null,
    current_phase: null,
    phase_window_age_seconds: null,
    counts: null,
    inputs_present: null,
    late_arrivals_appended: 0,
    fail_closed: { kind: null, detail: null },
    generated_at_utc: generatedAt,
  };

  const completeDay = isCompleteDay(dateUtc, now);
  report.complete_day = completeDay;

  // KIND 1: incomplete_day (pre-flight, no I/O).
  if (!completeDay && !allowIncomplete) {
    report.fail_closed = {
      kind: 'incomplete_day',
      detail: `date_utc=${dateUtc} is the current/future UTC day; pass --allow-incomplete to produce it`,
    };
    return report;
  }

  const metricsOutAbs = join(rootDir, METRICS_OUT_REL);
  const lateAbs = join(rootDir, LATE_ARRIVALS_REL);
  const lockPath = join(rootDir, LOCK_REL);
  const transitionsAbs = join(rootDir, TRANSITIONS_REL);

  // KIND 2: input_unreadable (load + aggregate; corrupt scalar/file -> fail-closed).
  let agg; let snapshot; let currentPhase; let windowAge;
  try {
    const inputs = loadInputs(rootDir);
    report.inputs_present = {
      records: inputs.records.present,
      conflicts: inputs.conflicts.present,
      rejects: inputs.rejects.present,
      trials: inputs.trials.present,
      transitions: inputs.transitions.present,
      live_state: inputs.liveStatePresent,
    };
    agg = aggregateDay(dateUtc, inputs);
    snapshot = buildHeartbeatSnapshot(inputs.liveState);
    currentPhase = inputs.liveState ? inputs.liveState.current_phase : null;
    windowAge = getPhaseWindowAge(transitionsAbs, currentPhase); // 1d reuse; wall-clock -> hash-OUT
  } catch (err) {
    if (err instanceof InputUnreadableError) {
      report.fail_closed = { kind: 'input_unreadable', detail: err.message };
      return report;
    }
    throw err; // invariant / logic error -> exit 1 UNEXPECTED
  }

  report.counts = agg.counts;
  report.current_phase = currentPhase;
  report.phase_window_age_seconds = windowAge;

  const hash = computeMetricRecordHash(buildHashBody(dateUtc, agg));
  report.metric_record_hash = hash;

  // KIND 3: divergence (compute hash done; decide before write).
  const existingHash = buildSeenByDate(metricsOutAbs).get(dateUtc);
  let action;
  if (existingHash === undefined) action = 'appended';
  else if (existingHash === hash) action = 'skipped_same_hash';
  else if (regenerate) action = 'regenerated';
  else {
    report.fail_closed = {
      kind: 'divergence',
      detail: `date_utc=${dateUtc} existing hash ${existingHash} != recomputed ${hash}; pass --regenerate to append a new row`,
    };
    return report;
  }

  // Late-arrival candidates deduped against the existing ledger.
  const seenLate = buildSeenLateArrivals(lateAbs);
  const newLate = agg.lateArrivalsCandidates.filter((c) => !seenLate.has(`${c.trial_id}|${c.feedback_reviewed_at}`));

  const row = assembleRow({
    dateUtc, agg, hash, writeMode, rootMode, completeDay, currentPhase, windowAge, snapshot,
    lateAppended: newLate.length, generatedAt,
  });

  // KIND 4: output_schema (defense-in-depth, producer-side enforce, before write).
  const v = getMetricsValidator();
  if (!v(row)) {
    report.fail_closed = { kind: 'output_schema', detail: firstError(v) };
    return report;
  }

  report.action = action;
  report.late_arrivals_appended = newLate.length;

  // Persist (skipped entirely under --dry-run). The metrics row write is gated by
  // action; the late-arrival ledger is an independent deduped append (so late feedback
  // is captured even when the day's row is skipped_same_hash).
  if (!dryRun) {
    const needRowWrite = action === 'appended' || action === 'regenerated';
    if (needRowWrite || newLate.length > 0) {
      acquireLock(lockPath);
      try {
        if (needRowWrite) {
          ensureDir(dirname(metricsOutAbs));
          appendFileSync(metricsOutAbs, `${JSON.stringify(row)}\n`);
        }
        if (newLate.length > 0) {
          ensureDir(dirname(lateAbs));
          for (const c of newLate) appendFileSync(lateAbs, `${JSON.stringify(c)}\n`);
        }
      } finally {
        releaseLock(lockPath);
      }
    }
  }

  return report;
}

/** Class wrapper (whitelisted compound name) around the functional core. */
export class MetricsDailyProducer {
  constructor(options = {}) { this.options = options; }
  run() { return produceMetricsDaily(this.options); }
}

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //

const HELP = `metrics_daily_producer.mjs - Phase 1e GHL daily metrics roll-up producer

Usage:
  node metrics_daily_producer.mjs [options]

Options:
  --date <YYYY-MM-DD>  Target UTC calendar day. Default: yesterday (last complete UTC day).
  --allow-incomplete   Allow producing the current (un-elapsed) UTC day (else fail-closed incomplete_day).
  --regenerate         Override the divergence guard: append a new row when the recomputed
                       hash differs from the existing same-day row (latest-wins).
  --dry-run            WRITE axis: rehearse (aggregate + validate + report), persist nothing.
  --fixtures <dir>     ROOT axis: isolate all 6 inputs + outputs under <dir> (test/runbook seam).
  --json               Print the MetricsDailyReport as JSON on stdout.
  --help               Show this help and exit 0.

Exit codes:
  0  success (appended / skipped_same_hash / regenerated, or --dry-run rehearsed)
  2  fail-closed: incomplete_day / input_unreadable / divergence / output_schema
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
    report = produceMetricsDaily({
      dateUtc: opts.dateUtc || undefined,
      allowIncomplete: opts.allowIncomplete,
      regenerate: opts.regenerate,
      dryRun: opts.dryRun,
      rootDir: opts.rootDir || undefined,
    });
  } catch (err) {
    process.stderr.write(`[metrics_daily_producer] ${err.name === 'MetricsLockError' ? err.message : `unexpected error: ${err.stack || err.message}`}\n`);
    return EXIT.UNEXPECTED;
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (report.fail_closed.kind) {
    process.stderr.write(`[metrics_daily_producer] FAIL_CLOSED (${report.fail_closed.kind}): ${report.fail_closed.detail}\n`);
  } else {
    process.stdout.write(
      `[metrics_daily_producer] date=${report.date_utc} action=${report.action} `
      + `records=${report.counts.fact_records_total} conflicts=${report.counts.fact_conflicts_total} `
      + `rejects=${report.counts.fact_rejects_total} trials=${report.counts.policy_trials_total} `
      + `transitions=${report.counts.transitions_total} late=${report.late_arrivals_appended}\n`);
  }
  return report.fail_closed.kind ? EXIT.FAIL_CLOSED : EXIT.SUCCESS;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) process.exit(main());
