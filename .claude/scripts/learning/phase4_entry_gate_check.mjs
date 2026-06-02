#!/usr/bin/env node
/**
 * phase4_entry_gate_check.mjs - GHL Phase-4 execute_limited ENTRY GATE (liye_os, NEW file).
 * SSOT: .claude/scripts/learning/phase4_entry_gate_check.mjs (learning domain).
 *
 * Normative: Phase-4 SPEC .planning/phase-4/SPEC.md v1.0 (blob a3ea7a8) — the constitution.
 *
 * WHAT THIS IS (D-P4-0 / D-P4-5, R-P4-1..R-P4-6):
 *   An on-demand, PURE READ-ONLY aggregation gate. It verifies the 11 plan §6 Phase-4
 *   hard prerequisites and emits one discrete operator-facing verdict
 *     PASS | PASS_WITH_OVERRIDE | BLOCKED | INDETERMINATE
 *   feeding the operator's go/no-go decision for execute_limited. It does NOT unlock
 *   anything: 0 production write, Hard Gate 8 STAYS LOCKED. The execute_limited write
 *   body + abort runtime are a separate downstream exec SPEC (this gate only checks that a
 *   RUNBOOK Phase-4 abort section EXISTS — it does not implement abort, R-P4-2).
 *
 * THREE CORRECTNESS SURFACES THAT MUST NOT BE WEAKENED (red-team folds):
 *   A. γ row is UNTRUSTED across the file+process boundary (FS-01 / D-P4-4, §0.1-7):
 *      before consuming ANY γ field the gate (a) ajv-RE-VALIDATES the row against the γ
 *      schema, (b) independently asserts the totality double-condition
 *      (kpi_unavailable_reasons==[] AND all four numeric fields non-null), and (c) NEVER
 *      uses window_sufficient / days_present as an availability proxy / PASS-shortcut.
 *      A `critical=0` is a PASS value ONLY when the row independently passes (a)+(b)+freshness.
 *      The gate NEVER reads null/malformed as 0 (catastrophic-false-negative protection).
 *   B. Freshness is exact + bidirectional (D-P4-3 / FS-02/03/04, §0.1-8): the gate selects
 *      the row with the MAX window_end_utc (tie-break: latest generated_at_utc), then
 *      requires window_end_utc == asof. STALE (earlier) AND FUTURE (later, clock-skew /
 *      forgery) both => unavailable => #5 BLOCKED.
 *   C. soft-override is governed + bound (D-P4-2 / SO-1/04/05, §0.1-4): only #4 is
 *      override-able; the override attestation must cite the measured rate AND the window it
 *      overrides, and the gate cross-checks both against the γ row it itself read this run.
 *      Any HARD prereq / γ-freshness / #5 fail-safe is NEVER override-able.
 *
 * ⚠ ASOF / FRESHNESS RECONCILIATION (documented SPEC resolution): SPEC §0.1-8 writes the
 * freshness rule as `window_end_utc == asof − 1` while SPEC §1 F1 sets `--asof default =
 * yesterday (last complete UTC day)` and the γ schema (535935c4 L124) requires a fresh row
 * to have `window_end_utc == current UTC day − 1 == yesterday`. Those are mutually
 * inconsistent: asof=yesterday AND window_end==asof−1 would demand window_end=day-before-
 * yesterday (STALE), making the gate reject every genuinely-fresh γ row. We resolve this by
 * honoring the γ contract + the α exit-gate convention (N-3: asof = the LAST COMPLETE UTC
 * day, default yesterday): the operative freshness rule is `window_end_utc == asof` (both
 * denote "the last complete UTC day"). The freshness SEMANTICS are unchanged — the row must
 * describe the last complete UTC day; stale-past and future are both BLOCKED. (Surfaced for
 * red-team review.)
 *
 * WHAT THIS DOES NOT DO (R-P4-1..R-P4-3, §8):
 *   - No production/candidate/promotion write. No verdict write-back to any upstream. No
 *     KPI recompute (γ already produced them). No abort runtime. No --window (each prereq
 *     owns its window/anchor). The ONLY optional write is a local, gitignored, NON-governed,
 *     never-read-back audit line (--audit), which is NOT a candidate/promotion/production
 *     write and does not affect any verdict.
 *
 * Usage:
 *   node phase4_entry_gate_check.mjs [--asof <YYYY-MM-DD>] [--json] [--audit] [--help]
 */

import { readFileSync, existsSync, realpathSync, appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// --------------------------------------------------------------------------- //
// Locked constants
// --------------------------------------------------------------------------- //

const DEFAULT_METRICS_REL = 'state/runtime/learning/metrics_daily.jsonl';
const DEFAULT_ROLLING_REL = 'state/runtime/learning/d11_rolling_30d.jsonl';
const DEFAULT_ATTEST_REL = 'state/runtime/learning/phase4_attestations.jsonl';
const DEFAULT_AUDIT_REL = 'state/runtime/learning/phase4_gate_audit.jsonl';
const ROLLING_SCHEMA_REL = '_meta/contracts/learning/d11_rolling_30d_v1.schema.yaml';
const ATTEST_SCHEMA_REL = '_meta/contracts/learning/phase4_prereq_attestation_v1.schema.yaml';
const ADR_REL = '_meta/adr/ADR-Governed-Heuristic-Learning.md';
const RUNBOOK_REL = '_meta/docs/GHL-RUNBOOK.md';

// #1/#2/#3/#8 read metrics_daily; criterion-1 source = Pilot-1's only enabled source.
const DEFAULT_SOURCE = 'amazon-growth-engine';
const WINDOW_DAYS = 30; // #1 streak / #2 dedupe / #3 anomaly / #9 recency all use a trailing 30 UTC-day window.
const MS_PER_DAY = 86400000;

// #4 soft threshold + binding tolerance.
const AGREEMENT_SOFT_THRESHOLD = 0.7;
const RATE_TOLERANCE = 1e-9;

// #11 Pilot-1 floor (SA-1, operator-pinned): anchor = v4.1-final landing 2026-05-28; floor = +90d.
const PILOT1_ANCHOR_UTC = '2026-05-28';
const PILOT1_FLOOR_DAYS = 90;

// #10 ADR cooling (SA-5): ADR lifecycle "24h cooling".
const ADR_COOLING_DAYS = 1; // 24h == 1 UTC day.

// Attestation freshness max-age per prereq (SO-4, anti-replay). soft_override == same UTC day as asof.
const ATTEST_MAX_AGE_DAYS = {
  kill_switch_drill: 30,
  pilot1_nongoal_review: 90,
  negative_learning_production_validated: 90,
  // soft_agreement_override handled specially: attested_at UTC date must == asof.
};

// Four-state gate verdict (extends α three-state with PASS_WITH_OVERRIDE).
const VERDICT = {
  PASS: 'PASS',
  PASS_WITH_OVERRIDE: 'PASS_WITH_OVERRIDE',
  BLOCKED: 'BLOCKED',
  INDETERMINATE: 'INDETERMINATE',
};

// Per-prereq state (the soft #4 also yields PASS_WITH_OVERRIDE).
const STATE = {
  PASS: 'PASS',
  PASS_WITH_OVERRIDE: 'PASS_WITH_OVERRIDE',
  BLOCKED: 'BLOCKED',
  INDETERMINATE: 'INDETERMINATE',
};

// exit 0 = PASS/PASS_WITH_OVERRIDE (eligible); 2 = fail-closed do-not-unlock (BLOCKED/INDETERMINATE);
// 1 = unexpected (bad args). Mirrors the α / 1c-1e taxonomy.
const EXIT = { ELIGIBLE: 0, FAIL_CLOSED: 2, UNEXPECTED: 1 };

const HARD_PREREQS = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11];
const SOFT_PREREQ = 4;

// --------------------------------------------------------------------------- //
// UTC-day helpers (mirror α phase_1_exit_gate_check / 1e producer: ISO slice(0,10)).
// --------------------------------------------------------------------------- //

function nowIso() { return new Date().toISOString(); }

/** Default --asof = yesterday (last complete UTC day), matching α + the 1e producer. */
function yesterdayUtc(now = new Date()) {
  return new Date(now.getTime() - MS_PER_DAY).toISOString().slice(0, 10);
}

/** Validate a YYYY-MM-DD string and return its UTC-midnight epoch ms (throws on malformed). */
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

/** dateUtc + n days, as YYYY-MM-DD. */
function addDaysUtc(dateUtc, n) {
  return new Date(dayStartMs(dateUtc) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole UTC days from a -> b (b - a). Negative if b precedes a. */
function diffDaysUtc(aDate, bDate) {
  return Math.round((dayStartMs(bDate) - dayStartMs(aDate)) / MS_PER_DAY);
}

/** The `window` trailing UTC day strings [asof-(window-1) .. asof] chronological. */
function windowDays(asofUtc, window) {
  const endMs = dayStartMs(asofUtc);
  const out = [];
  for (let i = window - 1; i >= 0; i--) out.push(new Date(endMs - i * MS_PER_DAY).toISOString().slice(0, 10));
  return out;
}

/** UTC calendar date (YYYY-MM-DD) of an ISO date-time string; null if unparseable. */
function utcDateOf(iso) {
  if (typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

// --------------------------------------------------------------------------- //
// ajv (Draft-07, strict off, formats off — matches the γ/1e producer convention).
// --------------------------------------------------------------------------- //

function compileValidator(schemaPath) {
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
  return ajv.compile(parseYaml(readFileSync(schemaPath, 'utf-8')));
}

// --------------------------------------------------------------------------- //
// Read helpers (read-only; never throw to the caller — IO errors surface as flags).
// --------------------------------------------------------------------------- //

/** Read a .jsonl file -> { lines: [obj...], malformed, file_present, io_error }. */
function readJsonl(path) {
  if (!existsSync(path)) return { lines: [], malformed: 0, file_present: false, io_error: false };
  let text;
  try { text = readFileSync(path, 'utf-8'); }
  catch { return { lines: [], malformed: 0, file_present: true, io_error: true }; }
  const lines = [];
  let malformed = 0;
  for (const raw of text.split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    try { lines.push(JSON.parse(t)); } catch { malformed += 1; }
  }
  return { lines, malformed, file_present: true, io_error: false };
}

/** Read a text file -> { text, file_present, io_error }. */
function readText(path) {
  if (!existsSync(path)) return { text: '', file_present: false, io_error: false };
  try { return { text: readFileSync(path, 'utf-8'), file_present: true, io_error: false }; }
  catch { return { text: '', file_present: true, io_error: true }; }
}

// --------------------------------------------------------------------------- //
// γ availability (Surface A + B) — the single source of γ truth for #4 and #5.
// --------------------------------------------------------------------------- //

/**
 * Resolve whether the γ d11_rolling_30d row is AVAILABLE + FRESH for `asof`, treating the
 * row as UNTRUSTED (FS-01). Pure (no I/O): operates on already-read rows + a compiled
 * validator. Returns:
 *   { available, reason, window_end_utc, rate, critical, selected }
 * available === true ONLY when a row passes ajv re-validation + the totality double-condition
 * + exact freshness. Otherwise available === false and reason explains why (=> #4/#5 NOT-PASS).
 */
export function evaluateGammaAvailability(rollingRead, asof, validateRolling) {
  if (rollingRead.io_error) return { available: false, reason: 'gamma_source_unreadable' };
  if (!rollingRead.file_present || rollingRead.lines.length === 0) {
    return { available: false, reason: 'gamma_row_absent' };
  }

  // (B) row-selection: MAX window_end_utc, tie-break latest generated_at_utc. Only rows whose
  // window_end_utc is a well-formed date are selectable; an all-malformed set => unavailable.
  let selected = null;
  for (const row of rollingRead.lines) {
    const we = row && typeof row === 'object' ? row.window_end_utc : undefined;
    if (typeof we !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(we)) continue;
    if (!selected) { selected = row; continue; }
    if (we > selected.window_end_utc) selected = row;
    else if (we === selected.window_end_utc) {
      const a = typeof row.generated_at_utc === 'string' ? row.generated_at_utc : '';
      const b = typeof selected.generated_at_utc === 'string' ? selected.generated_at_utc : '';
      if (a > b) selected = row;
    }
  }
  if (!selected) return { available: false, reason: 'gamma_row_no_valid_window_end' };

  // (A.a) ajv RE-VALIDATION against the γ schema (do not trust producer write-time invariant).
  if (!validateRolling(selected)) {
    return { available: false, reason: 'gamma_row_ajv_invalid', window_end_utc: selected.window_end_utc, selected };
  }

  // (B) freshness: window_end_utc == asof (exact, bidirectional). See ASOF reconciliation note.
  if (selected.window_end_utc !== asof) {
    const reason = selected.window_end_utc < asof ? 'gamma_window_stale' : 'gamma_window_future';
    return { available: false, reason, window_end_utc: selected.window_end_utc, selected };
  }

  // (A.b) totality double-condition (independent of producer): available IFF
  // kpi_unavailable_reasons == [] AND all four numeric fields are non-null. window_sufficient /
  // days_present are NEVER consulted (A.c).
  const r = selected.d11_rolling || {};
  const reasons = r.kpi_unavailable_reasons;
  const four = [
    r.operator_agreement_rate_30d,
    r.agreement_agree_count_30d,
    r.agreement_eligible_count_30d,
    r.critical_false_negative_count_30d,
  ];
  const reasonsEmpty = Array.isArray(reasons) && reasons.length === 0;
  const reasonsNonEmpty = Array.isArray(reasons) && reasons.length > 0;
  const allNull = four.every((v) => v === null);
  const allReal = four.every((v) => typeof v === 'number');

  if (reasonsNonEmpty) {
    // Declared-unavailable window. Totality must hold (all four null); otherwise MALFORMED.
    if (!allNull) {
      return { available: false, reason: 'gamma_totality_violation', window_end_utc: selected.window_end_utc, selected };
    }
    return { available: false, reason: 'gamma_kpi_unavailable', window_end_utc: selected.window_end_utc, selected };
  }
  if (!reasonsEmpty) {
    // kpi_unavailable_reasons absent / not an array => malformed.
    return { available: false, reason: 'gamma_totality_violation', window_end_utc: selected.window_end_utc, selected };
  }
  // reasons == []: every numeric field MUST be a real number (broken-coupling row caught here).
  if (!allReal) {
    return { available: false, reason: 'gamma_totality_violation', window_end_utc: selected.window_end_utc, selected };
  }

  return {
    available: true,
    reason: null,
    window_end_utc: selected.window_end_utc,
    rate: r.operator_agreement_rate_30d,
    critical: r.critical_false_negative_count_30d,
    selected,
  };
}

// --------------------------------------------------------------------------- //
// Attestation validation (presence / schema / signature / freshness / binding).
// --------------------------------------------------------------------------- //

/**
 * Find the freshest VALID attestation for `prereqId`. Validity = ajv schema-valid +
 * reviewer_id_hash shape (covered by schema) + attested_at within the per-prereq max-age of
 * asof (and not in the future). Binding (soft_override only) is checked by the caller against
 * the γ row. Returns { found, valid, entry, reason }.
 */
export function findValidAttestation(attestRead, prereqId, asof, validateAttest) {
  if (attestRead.io_error) return { found: false, valid: false, reason: 'attestation_source_unreadable' };
  const candidates = attestRead.lines.filter(
    (e) => e && typeof e === 'object' && e.prereq_id === prereqId,
  );
  if (candidates.length === 0) return { found: false, valid: false, reason: 'attestation_absent' };

  let best = null;
  let lastReason = 'attestation_invalid';
  for (const e of candidates) {
    if (!validateAttest(e)) { lastReason = 'attestation_schema_invalid'; continue; }
    const d = utcDateOf(e.attested_at);
    if (!d) { lastReason = 'attestation_bad_attested_at'; continue; }
    const age = diffDaysUtc(d, asof); // asof - attested
    if (age < 0) { lastReason = 'attestation_future'; continue; } // future-dated => reject
    if (prereqId === 'soft_agreement_override') {
      if (age !== 0) { lastReason = 'attestation_stale'; continue; } // must be the asof UTC day
    } else {
      const maxAge = ATTEST_MAX_AGE_DAYS[prereqId];
      if (typeof maxAge === 'number' && age > maxAge) { lastReason = 'attestation_stale'; continue; }
    }
    // Freshest valid wins.
    if (!best || (utcDateOf(best.attested_at) || '') < d) best = e;
  }
  if (!best) return { found: true, valid: false, reason: lastReason };
  return { found: true, valid: true, entry: best, reason: null };
}

// --------------------------------------------------------------------------- //
// metrics_daily window analysis (#1/#2/#3/#8/#9 source).
// --------------------------------------------------------------------------- //

function asCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Index metrics_daily lines by date_utc (latest-wins, mirroring α / 1e --regenerate). */
function indexMetrics(metricsRead) {
  const byDate = new Map();
  for (const obj of metricsRead.lines) {
    if (obj && typeof obj === 'object' && typeof obj.date_utc === 'string') byDate.set(obj.date_utc, obj);
  }
  return byDate;
}

/** Manifest-day classification for #1 (clean / break / indeterminate), α paradigm (N-3). */
function classifyManifestDay(row, source) {
  const sig = row && typeof row === 'object' ? row.phase_1_exit_signals : undefined;
  const per = sig && sig.c1_manifest_validator && sig.c1_manifest_validator.per_source
    ? sig.c1_manifest_validator.per_source[source] : undefined;
  const c1 = per && typeof per === 'object'
    ? { pass: asCount(per.pass), warn: asCount(per.warn), fail: asCount(per.fail) } : null;
  // break: an explicit manifest failure/warn.
  if (c1 && ((c1.fail !== null && c1.fail > 0) || (c1.warn !== null && c1.warn > 0))) return 'break';
  const complete = c1 && c1.pass !== null && c1.fail !== null && c1.warn !== null;
  if (!row || !sig || !complete || (c1.pass === 0 && c1.fail === 0 && c1.warn === 0)) return 'indeterminate';
  if (c1.pass >= 1 && c1.fail === 0 && c1.warn === 0) return 'clean';
  return 'indeterminate';
}

// --------------------------------------------------------------------------- //
// Per-prereq evaluators. Each returns { state, reason, detail } (state ∈ STATE).
// --------------------------------------------------------------------------- //

/** #1 manifest validator 30-day continuous PASS streak. */
function prereq1(metricsRead, byDate, asof, source) {
  if (metricsRead.io_error) return { state: STATE.BLOCKED, reason: 'metrics_source_unreadable' };
  const days = windowDays(asof, WINDOW_DAYS);
  const cls = days.map((d) => classifyManifestDay(byDate.get(d), source));
  if (cls.includes('break')) return { state: STATE.BLOCKED, reason: 'manifest_break_in_window' };
  const cleanAll = cls.every((c) => c === 'clean');
  if (cleanAll) return { state: STATE.PASS, reason: null, detail: { clean_days: WINDOW_DAYS } };
  // No break, but not all-30 clean => ramp / source not yet emitting => not-yet-eligible.
  return { state: STATE.INDETERMINATE, reason: 'manifest_streak_incomplete', detail: { clean_days: cls.filter((c) => c === 'clean').length } };
}

/** Shared: 30d full-coverage check (every window day has a metrics row). */
function coverageComplete(byDate, asof) {
  return windowDays(asof, WINDOW_DAYS).every((d) => byDate.has(d));
}

/** #2 dedupe stable: 0 unresolved DUPLICATE_CONFLICT over the full window. */
function prereq2(metricsRead, byDate, asof) {
  if (metricsRead.io_error) return { state: STATE.BLOCKED, reason: 'metrics_source_unreadable' };
  if (!coverageComplete(byDate, asof)) return { state: STATE.BLOCKED, reason: 'metrics_coverage_incomplete' };
  let sum = 0;
  for (const d of windowDays(asof, WINDOW_DAYS)) {
    const row = byDate.get(d);
    const c = row && row.phase_1_exit_signals ? asCount(row.phase_1_exit_signals.c2_duplicate_conflict_count) : null;
    if (c === null) return { state: STATE.BLOCKED, reason: 'dedupe_signal_unreadable' };
    sum += c;
  }
  if (sum > 0) return { state: STATE.BLOCKED, reason: 'unresolved_duplicate_conflicts', detail: { count: sum } };
  return { state: STATE.PASS, reason: null };
}

/** #3 0 major anomalies (fail-closed rejects) over the full window (SA-4 conservative). */
function prereq3(metricsRead, byDate, asof) {
  if (metricsRead.io_error) return { state: STATE.BLOCKED, reason: 'metrics_source_unreadable' };
  if (!coverageComplete(byDate, asof)) return { state: STATE.BLOCKED, reason: 'metrics_coverage_incomplete' };
  let sum = 0;
  for (const d of windowDays(asof, WINDOW_DAYS)) {
    const row = byDate.get(d);
    const c = row && row.counts ? asCount(row.counts.fact_rejects_total) : null;
    if (c === null) return { state: STATE.BLOCKED, reason: 'anomaly_signal_unreadable' };
    sum += c;
  }
  if (sum > 0) return { state: STATE.BLOCKED, reason: 'fail_closed_rejects_present', detail: { count: sum } };
  return { state: STATE.PASS, reason: null };
}

/** #4 operator_agreement_rate >= 0.7 (SOFT, override-able). */
function prereq4(gamma, attestRead, asof, validateAttest) {
  if (!gamma.available) return { state: STATE.BLOCKED, reason: `gamma_unavailable:${gamma.reason}` };
  if (gamma.rate >= AGREEMENT_SOFT_THRESHOLD) {
    return { state: STATE.PASS, reason: null, detail: { rate: gamma.rate } };
  }
  // rate < 0.7 -> block-by-default unless a valid + bound soft_override lifts it.
  const att = findValidAttestation(attestRead, 'soft_agreement_override', asof, validateAttest);
  if (!att.valid) return { state: STATE.BLOCKED, reason: `soft_block:${att.reason || 'no_valid_override'}`, detail: { rate: gamma.rate } };
  // Binding (Surface C / SO-1/SO-5): cited value + window must match the γ row read THIS run.
  const e = att.entry;
  const citedRate = typeof e.cited_measured_value === 'number' ? e.cited_measured_value : null;
  if (citedRate === null || Math.abs(citedRate - gamma.rate) > RATE_TOLERANCE) {
    return { state: STATE.BLOCKED, reason: 'override_cited_value_mismatch', detail: { rate: gamma.rate, cited: citedRate } };
  }
  if (e.cited_window_end_utc !== gamma.window_end_utc) {
    return { state: STATE.BLOCKED, reason: 'override_cited_window_mismatch', detail: { window_end_utc: gamma.window_end_utc, cited: e.cited_window_end_utc } };
  }
  return { state: STATE.PASS_WITH_OVERRIDE, reason: null, detail: { rate: gamma.rate, override_reason: e.override_reason } };
}

/** #5 critical_false_negative_count == 0 (HARD, fail-safe core; NEVER override-able). */
function prereq5(gamma) {
  if (!gamma.available) return { state: STATE.BLOCKED, reason: `fail_safe:${gamma.reason}` };
  if (gamma.critical !== 0) return { state: STATE.BLOCKED, reason: 'critical_false_negative_present', detail: { count: gamma.critical } };
  return { state: STATE.PASS, reason: null };
}

/** #6 kill_switch drill (HARD; operator attestation). */
function prereq6(attestRead, asof, validateAttest) {
  const att = findValidAttestation(attestRead, 'kill_switch_drill', asof, validateAttest);
  if (!att.valid) return { state: STATE.BLOCKED, reason: att.reason || 'attestation_invalid' };
  if (att.entry.drill_outcome !== 'passed') return { state: STATE.BLOCKED, reason: 'drill_not_passed' };
  return { state: STATE.PASS, reason: null };
}

/** #7 RUNBOOK Phase-4 abort section EXISTS (HARD; existence only, not implementation). */
export function evaluateRunbookAbort(text) {
  if (typeof text !== 'string' || text.length === 0) return { present: false, reason: 'runbook_absent' };
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,4})\s+(.*)$/);
    if (!m) continue;
    const title = m[2];
    const isAbortHeading = (/phase[\s-]?4/i.test(title) && /abort/i.test(title))
      || (/execute_limited/i.test(title) && /abort/i.test(title));
    if (!isAbortHeading) continue;
    // Capture body until the next heading of same-or-higher level.
    const level = m[1].length;
    let body = '';
    for (let j = i + 1; j < lines.length; j++) {
      const hm = lines[j].match(/^(#{1,6})\s+/);
      if (hm && hm[1].length <= level) break;
      body += `${lines[j]}\n`;
    }
    if (body.trim().length > 0 && /execute_limited/i.test(body)) return { present: true, reason: null };
    return { present: false, reason: 'runbook_abort_section_empty_or_incomplete' };
  }
  return { present: false, reason: 'runbook_abort_section_absent' };
}

function prereq7(runbookRead) {
  if (runbookRead.io_error) return { state: STATE.BLOCKED, reason: 'runbook_unreadable' };
  const r = evaluateRunbookAbort(runbookRead.text);
  return r.present ? { state: STATE.PASS, reason: null } : { state: STATE.BLOCKED, reason: r.reason };
}

/** #8 metrics_daily.jsonl traceable: present + contiguous + current (latest == asof). */
function prereq8(metricsRead, byDate, asof) {
  if (metricsRead.io_error) return { state: STATE.BLOCKED, reason: 'metrics_source_unreadable' };
  if (!metricsRead.file_present || byDate.size === 0) return { state: STATE.BLOCKED, reason: 'metrics_trail_absent' };
  const dates = [...byDate.keys()].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (dates.length === 0) return { state: STATE.BLOCKED, reason: 'metrics_trail_absent' };
  const max = dates[dates.length - 1];
  if (max !== asof) return { state: STATE.BLOCKED, reason: max < asof ? 'metrics_trail_stale' : 'metrics_trail_future', detail: { latest: max } };
  // contiguity: no internal gap between min and max.
  const span = diffDaysUtc(dates[0], max) + 1;
  if (span !== dates.length) return { state: STATE.BLOCKED, reason: 'metrics_trail_gap', detail: { span, present: dates.length } };
  return { state: STATE.PASS, reason: null };
}

/** #9 >=1 negative-learning case production-validated (HARD; machine recency + attestation). */
function prereq9(metricsRead, byDate, asof, attestRead, validateAttest) {
  if (metricsRead.io_error) return { state: STATE.BLOCKED, reason: 'metrics_source_unreadable' };
  let hits = 0;
  for (const d of windowDays(asof, WINDOW_DAYS)) {
    const row = byDate.get(d);
    const c = row && row.policy_trials_breakdown && row.policy_trials_breakdown.by_evidence_origin
      ? asCount(row.policy_trials_breakdown.by_evidence_origin.production_observed) : null;
    if (c !== null) hits += c;
  }
  if (hits === 0) return { state: STATE.INDETERMINATE, reason: 'no_production_observed_in_window' };
  const att = findValidAttestation(attestRead, 'negative_learning_production_validated', asof, validateAttest);
  if (!att.valid) return { state: STATE.BLOCKED, reason: att.reason || 'attestation_invalid', detail: { hits } };
  return { state: STATE.PASS, reason: null, detail: { hits } };
}

/** #10 ADR sealed (Accepted) + cooling elapsed (HARD; date gate). */
export function evaluateAdr(text, asof) {
  if (typeof text !== 'string' || text.length === 0) return { state: STATE.BLOCKED, reason: 'adr_absent' };
  const status = text.match(/^\*\*Status\*\*:\s*(.+?)\s*$/m);
  const accepted = text.match(/^\*\*Accepted-Date\*\*:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
  if (!status || status[1].trim() !== 'Accepted') return { state: STATE.BLOCKED, reason: 'adr_not_accepted' };
  if (!accepted) return { state: STATE.BLOCKED, reason: 'adr_accepted_date_missing' };
  let elapsed;
  try { elapsed = diffDaysUtc(accepted[1], asof); } catch { return { state: STATE.BLOCKED, reason: 'adr_accepted_date_invalid' }; }
  if (elapsed < ADR_COOLING_DAYS) return { state: STATE.BLOCKED, reason: 'adr_cooling_not_elapsed', detail: { accepted: accepted[1], elapsed_days: elapsed } };
  return { state: STATE.PASS, reason: null, detail: { accepted: accepted[1] } };
}

function prereq10(adrRead, asof) {
  if (adrRead.io_error) return { state: STATE.BLOCKED, reason: 'adr_unreadable' };
  return evaluateAdr(adrRead.text, asof);
}

/** #11 Pilot-1 non-goal review (HARD; date floor + operator attestation). */
function prereq11(asof, attestRead, validateAttest) {
  const floor = addDaysUtc(PILOT1_ANCHOR_UTC, PILOT1_FLOOR_DAYS); // 2026-08-26
  if (diffDaysUtc(floor, asof) < 0) {
    return { state: STATE.INDETERMINATE, reason: 'pilot1_floor_not_reached', detail: { floor } };
  }
  const att = findValidAttestation(attestRead, 'pilot1_nongoal_review', asof, validateAttest);
  if (!att.valid) return { state: STATE.BLOCKED, reason: att.reason || 'attestation_invalid', detail: { floor } };
  return { state: STATE.PASS, reason: null, detail: { floor } };
}

// --------------------------------------------------------------------------- //
// Aggregation (four-state, BLOCKED priority, fail-closed).
// --------------------------------------------------------------------------- //

/** Aggregate per-prereq states -> gate verdict. Pure. */
export function aggregateVerdict(states) {
  const all = Object.values(states).map((s) => s.state);
  if (all.includes(STATE.BLOCKED)) return VERDICT.BLOCKED;
  if (all.includes(STATE.INDETERMINATE)) return VERDICT.INDETERMINATE;
  if (states[SOFT_PREREQ] && states[SOFT_PREREQ].state === STATE.PASS_WITH_OVERRIDE) return VERDICT.PASS_WITH_OVERRIDE;
  return VERDICT.PASS;
}

// --------------------------------------------------------------------------- //
// Pure evaluation core (the unit-testable heart; no I/O, no wall-clock in verdict).
// --------------------------------------------------------------------------- //

/**
 * Evaluate the gate from already-read inputs. PURE (no I/O). Returns the full report
 * (sans generated_at_utc, which the caller stamps).
 *
 * @param {object} inputs { metricsRead, byDate, rollingRead, attestRead, adrRead, runbookRead, validateRolling, validateAttest }
 * @param {object} opts   { asof, source }
 */
export function evaluateGate(inputs, opts) {
  const asof = opts.asof;
  const source = opts.source || DEFAULT_SOURCE;
  const { metricsRead, byDate, rollingRead, attestRead, adrRead, runbookRead, validateRolling, validateAttest } = inputs;

  const gamma = evaluateGammaAvailability(rollingRead, asof, validateRolling);

  const states = {
    1: prereq1(metricsRead, byDate, asof, source),
    2: prereq2(metricsRead, byDate, asof),
    3: prereq3(metricsRead, byDate, asof),
    4: prereq4(gamma, attestRead, asof, validateAttest),
    5: prereq5(gamma),
    6: prereq6(attestRead, asof, validateAttest),
    7: prereq7(runbookRead),
    8: prereq8(metricsRead, byDate, asof),
    9: prereq9(metricsRead, byDate, asof, attestRead, validateAttest),
    10: prereq10(adrRead, asof),
    11: prereq11(asof, attestRead, validateAttest),
  };

  const verdict = aggregateVerdict(states);
  return {
    verdict,
    valid_for_asof: asof,
    source,
    gamma_availability: { available: gamma.available, reason: gamma.reason, window_end_utc: gamma.window_end_utc || null },
    prereqs: Object.fromEntries(
      Object.entries(states).map(([k, v]) => [k, {
        prereq: Number(k),
        hard: HARD_PREREQS.includes(Number(k)),
        state: v.state,
        reason: v.reason,
        detail: v.detail || null,
      }]),
    ),
  };
}

// --------------------------------------------------------------------------- //
// Public API (does the I/O, then calls the pure core).
// --------------------------------------------------------------------------- //

export function checkPhase4EntryGate(options = {}) {
  const rootDir = options.rootDir ? realpathSync(options.rootDir) : PROJECT_ROOT;
  const rel = (p, d) => (p ? (p.startsWith('/') ? p : join(rootDir, p)) : join(rootDir, d));

  const metricsPath = rel(options.metrics, DEFAULT_METRICS_REL);
  const rollingPath = rel(options.rolling, DEFAULT_ROLLING_REL);
  const attestPath = rel(options.attestations, DEFAULT_ATTEST_REL);
  const adrPath = rel(options.adr, ADR_REL);
  const runbookPath = rel(options.runbook, RUNBOOK_REL);
  const rollingSchemaPath = rel(options.rollingSchema, ROLLING_SCHEMA_REL);
  const attestSchemaPath = rel(options.attestSchema, ATTEST_SCHEMA_REL);

  const asof = options.asof || yesterdayUtc();
  // Validate asof shape early (throws -> caller maps to EXIT.UNEXPECTED).
  dayStartMs(asof);

  const metricsRead = readJsonl(metricsPath);
  const rollingRead = readJsonl(rollingPath);
  const attestRead = readJsonl(attestPath);
  const adrRead = readText(adrPath);
  const runbookRead = readText(runbookPath);
  const validateRolling = compileValidator(rollingSchemaPath);
  const validateAttest = compileValidator(attestSchemaPath);

  const byDate = indexMetrics(metricsRead);

  const report = evaluateGate(
    { metricsRead, byDate, rollingRead, attestRead, adrRead, runbookRead, validateRolling, validateAttest },
    { asof, source: options.source },
  );
  report.generated_at_utc = nowIso();
  report.paths = { metrics: metricsPath, rolling: rollingPath, attestations: attestPath, adr: adrPath, runbook: runbookPath };
  report.malformed = {
    metrics: metricsRead.malformed,
    rolling: rollingRead.malformed,
    attestations: attestRead.malformed,
  };
  return report;
}

/** Optional, NON-governed, never-read-back local audit line (R-P4-1). Best-effort. */
function writeAuditLine(rootDir, report) {
  try {
    const path = join(rootDir, DEFAULT_AUDIT_REL);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify({
      generated_at_utc: report.generated_at_utc,
      valid_for_asof: report.valid_for_asof,
      verdict: report.verdict,
    })}\n`);
  } catch { /* audit is best-effort; never affect the verdict or exit code */ }
}

// --------------------------------------------------------------------------- //
// Class wrapper (whitelisted compound name) around the functional core.
// --------------------------------------------------------------------------- //

export class Phase4EntryGateChecker {
  constructor(options = {}) { this.options = options; }
  run() { return checkPhase4EntryGate(this.options); }
}

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //

const HELP = `phase4_entry_gate_check.mjs - GHL Phase-4 execute_limited entry gate (read-only)

Usage:
  node phase4_entry_gate_check.mjs [options]

Options:
  --asof <YYYY-MM-DD>   evaluation day = last complete UTC day (default = yesterday)
  --json                print the full report as JSON on stdout
  --audit               append one local, gitignored, NON-governed audit line (best-effort)
  --help                show this help and exit 0

Verdict / exit codes:
  PASS               0  all 11 prereqs satisfied (operator eligible to start execute_limited)
  PASS_WITH_OVERRIDE 0  all HARD satisfied; soft #4 lifted by a bound governed override
  BLOCKED            2  >=1 HARD prereq blocked (incl. #5 fail-safe / invalid attestation) -- fix first
  INDETERMINATE      2  no HARD block, but >=1 not-yet-eligible (#1 ramp / #9 0-hits / #11 floor) -- wait
  (unexpected)       1  bad arguments / unexpected error

This gate performs 0 production write. Hard Gate 8 stays LOCKED (D-P4-0 / R-P4-1).
`;

function parseArgs(argv) {
  const opts = { asof: null, json: false, audit: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--audit') opts.audit = true;
    else if (a === '--asof') opts.asof = argv[++i];
    else process.stderr.write(`unknown argument: ${a}\n`);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { process.stdout.write(HELP); return EXIT.ELIGIBLE; }

  let report;
  try {
    report = checkPhase4EntryGate({ asof: opts.asof || undefined });
  } catch (err) {
    process.stderr.write(`[phase4_entry_gate_check] ${err.name || 'Error'}: ${err.message}\n`);
    return EXIT.UNEXPECTED;
  }

  if (opts.audit) writeAuditLine(PROJECT_ROOT, report);

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const blocked = Object.values(report.prereqs).filter((p) => p.state === STATE.BLOCKED).map((p) => p.prereq);
    const indet = Object.values(report.prereqs).filter((p) => p.state === STATE.INDETERMINATE).map((p) => p.prereq);
    process.stdout.write(
      `[phase4_entry_gate_check] verdict=${report.verdict} asof=${report.valid_for_asof} `
      + `gamma_available=${report.gamma_availability.available} `
      + `blocked=[${blocked.join(',')}] indeterminate=[${indet.join(',')}]\n`);
  }

  return (report.verdict === VERDICT.PASS || report.verdict === VERDICT.PASS_WITH_OVERRIDE)
    ? EXIT.ELIGIBLE : EXIT.FAIL_CLOSED;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) process.exit(main());
