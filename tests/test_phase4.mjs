#!/usr/bin/env node
/**
 * test_phase4.mjs - Phase-4 execute_limited entry gate test suite (node:test).
 * SSOT: tests/test_phase4.mjs
 *
 * Covers Phase-4 SPEC .planning/phase-4/SPEC.md v1.0 (blob a3ea7a8) §7 test matrix:
 *   fail-safe (D-P4-4) · soft/hard override (D-P4-2) · attestation 5-dim · date gates (SA-1/5)
 *   · four-state aggregation (incl. idle) · fence (no --window / 0 prod write) · gate count
 *   · frozen anchors (git-blob sha-pin in suite) · untrusted-row (FS-01..04) · override binding
 *   (SO-1/04/05) · fail-safe generalization (#1/#2/#3/#8) · per-prereq discriminator.
 *
 * Self-contained: synthetic fixtures under os.tmpdir(); real γ + attestation schemas are used
 * for ajv re-validation (read-only). 0 network, 0 cross-repo writes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

import {
  checkPhase4EntryGate,
  evaluateGammaAvailability,
  evaluateRunbookAbort,
  evaluateAdr,
  findValidAttestation,
  aggregateVerdict,
} from '../.claude/scripts/learning/phase4_entry_gate_check.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ROLLING_SCHEMA = join(REPO_ROOT, '_meta/contracts/learning/d11_rolling_30d_v1.schema.yaml');
const ATTEST_SCHEMA = join(REPO_ROOT, '_meta/contracts/learning/phase4_prereq_attestation_v1.schema.yaml');
const GATE_SRC = join(REPO_ROOT, '.claude/scripts/learning/phase4_entry_gate_check.mjs');

const MS_PER_DAY = 86400000;
const H = `sha256:${'a'.repeat(64)}`;

// --------------------------------------------------------------------------- //
// UTC helpers (mirror the gate)
// --------------------------------------------------------------------------- //
function addDays(date, n) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * MS_PER_DAY).toISOString().slice(0, 10);
}
function windowDays(asof, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(asof, -i));
  return out;
}

// --------------------------------------------------------------------------- //
// ajv validators (compiled once from the real schemas; used by the pure-core tests)
// --------------------------------------------------------------------------- //
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';
function validator(path) {
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
  return ajv.compile(parseYaml(readFileSync(path, 'utf-8')));
}
const validateRolling = validator(ROLLING_SCHEMA);
const validateAttest = validator(ATTEST_SCHEMA);

// --------------------------------------------------------------------------- //
// Fixture builders
// --------------------------------------------------------------------------- //
function gammaRow(asof, { rate = 0.8, critical = 0, d11 = null, overrides = {} } = {}) {
  const body = d11 || {
    operator_agreement_rate_30d: rate,
    agreement_agree_count_30d: 8,
    agreement_eligible_count_30d: 10,
    critical_false_negative_count_30d: critical,
    operator_reason_codes: { unsafe_reuse: 0, weak_evidence: 0, business_context_changed: 0, regression_failed: 0, acceptable: 10 },
    kpi_unavailable_reasons: [],
  };
  return {
    schema_version: '1.0.0',
    generator_version: 'd11_rolling_30d_producer@1.0.0',
    generated_at_utc: `${asof}T02:00:00Z`,
    write_mode: 'persist',
    root_mode: 'default_root',
    window_sufficient: true,
    window_start_utc: addDays(asof, -29),
    window_end_utc: asof,
    window_days: 30,
    days_present: 30,
    rolling_record_hash: `sha256:${'0'.repeat(64)}`,
    d11_rolling: body,
    provenance: {
      input_sources: [],
      producer_invocation: { write_mode: 'persist', root_mode: 'default_root' },
      aggregation_window: `${addDays(asof, -29)}..${asof}`,
    },
    ...overrides,
  };
}
const UNAVAILABLE_D11 = {
  operator_agreement_rate_30d: null,
  agreement_agree_count_30d: null,
  agreement_eligible_count_30d: null,
  critical_false_negative_count_30d: null,
  operator_reason_codes: { unsafe_reuse: 0, weak_evidence: 0, business_context_changed: 0, regression_failed: 0, acceptable: 0 },
  kpi_unavailable_reasons: ['insufficient_window'],
};

function metricsRow(date, { clean = true, dup = 0, rejects = 0, prodObserved = 0 } = {}) {
  return {
    date_utc: date,
    counts: { fact_rejects_total: rejects },
    policy_trials_breakdown: { by_evidence_origin: { production_observed: prodObserved } },
    phase_1_exit_signals: {
      c1_manifest_validator: { per_source: { 'amazon-growth-engine': clean ? { pass: 1, warn: 0, fail: 0 } : { pass: 0, warn: 0, fail: 1 } } },
      c2_duplicate_conflict_count: dup,
    },
  };
}
function cleanWindow(asof, extra = {}) {
  const days = windowDays(asof, 30);
  return days.map((d, i) => metricsRow(d, { clean: true, dup: 0, rejects: 0, prodObserved: i === days.length - 1 ? 1 : 0, ...extra }));
}

function attestation(prereqId, asof, { attested_at = null, extra = {} } = {}) {
  const at = attested_at || `${asof}T03:00:00Z`;
  const base = { schema_version: '1.0.0', attestation_type: prereqId === 'soft_agreement_override' ? 'soft_override' : 'prereq_attestation', prereq_id: prereqId, attested_at: at, reviewer_id_hash: H, statement: 'attested', evidence_refs: ['ref'] };
  const perPrereq = {
    kill_switch_drill: { drill_record_ref: 'drills/2026.json', drill_outcome: 'passed' },
    negative_learning_production_validated: { evidence_ledger_ref: 'led:42', production_observed_ref: 'po:7' },
    pilot1_nongoal_review: { review_resolution_ref: 'rev/1.md', review_date: asof },
    soft_agreement_override: { target_prereq: 'operator_agreement_rate_30d', override_reason: 'startup_low_volume', cited_measured_value: 0.62, cited_window_end_utc: asof },
  };
  return { ...base, ...perPrereq[prereqId], ...extra };
}

const RUNBOOK_WITH_ABORT = `# GHL Runbook
## 5. Phase-4 execute_limited abort
To abort execute_limited mid-run, disable the flag and re-run the heartbeat. execute_limited halts.
## 6. Next
`;
const ADR_ACCEPTED = '**Status**: Accepted\n**Date**: 2026-05-14\n**Accepted-Date**: 2026-05-19\n';

// Write a full fixture set into a fresh tmp dir; return option overrides (absolute paths).
function fixtureSet({ asof, metrics = [], rolling = [], attests = [], runbook = RUNBOOK_WITH_ABORT, adr = ADR_ACCEPTED }) {
  const dir = mkdtempSync(join(tmpdir(), 'p4gate-'));
  const lj = (arr) => arr.map((o) => JSON.stringify(o)).join('\n') + (arr.length ? '\n' : '');
  const mp = join(dir, 'metrics.jsonl'); writeFileSync(mp, lj(metrics));
  const rp = join(dir, 'rolling.jsonl'); writeFileSync(rp, lj(rolling));
  const ap = join(dir, 'attest.jsonl'); writeFileSync(ap, lj(attests));
  const rbp = join(dir, 'runbook.md'); writeFileSync(rbp, runbook);
  const adrp = join(dir, 'adr.md'); writeFileSync(adrp, adr);
  return {
    asof,
    metrics: mp, rolling: rp, attestations: ap, runbook: rbp, adr: adrp,
    rollingSchema: ROLLING_SCHEMA, attestSchema: ATTEST_SCHEMA,
  };
}

// ========================================================================= //
// 1. γ UNTRUSTED row re-validation (FS-01) + freshness (FS-02/03/04)
// ========================================================================= //
test('gamma available: valid fresh row -> available with rate+critical', () => {
  const g = evaluateGammaAvailability({ lines: [gammaRow('2026-09-01', { rate: 0.8, critical: 0 })], file_present: true, io_error: false }, '2026-09-01', validateRolling);
  assert.equal(g.available, true);
  assert.equal(g.rate, 0.8);
  assert.equal(g.critical, 0);
});

test('FS-01 broken-coupling (critical=0 + rate=null + reasons=[]) -> totality_violation', () => {
  const d11 = { operator_agreement_rate_30d: null, agreement_agree_count_30d: null, agreement_eligible_count_30d: null, critical_false_negative_count_30d: 0, operator_reason_codes: { unsafe_reuse: 0, weak_evidence: 0, business_context_changed: 0, regression_failed: 0, acceptable: 0 }, kpi_unavailable_reasons: [] };
  const g = evaluateGammaAvailability({ lines: [gammaRow('2026-09-01', { d11 })], file_present: true, io_error: false }, '2026-09-01', validateRolling);
  assert.equal(g.available, false);
  assert.equal(g.reason, 'gamma_totality_violation');
});

test('FS-01 symmetric (reasons non-empty + critical=0 not-all-null) -> totality_violation', () => {
  const d11 = { ...UNAVAILABLE_D11, critical_false_negative_count_30d: 0 };
  const g = evaluateGammaAvailability({ lines: [gammaRow('2026-09-01', { d11 })], file_present: true, io_error: false }, '2026-09-01', validateRolling);
  assert.equal(g.available, false);
  assert.equal(g.reason, 'gamma_totality_violation');
});

test('kpi_unavailable (all null + reasons) -> gamma_kpi_unavailable (not 0)', () => {
  const g = evaluateGammaAvailability({ lines: [gammaRow('2026-09-01', { d11: UNAVAILABLE_D11 })], file_present: true, io_error: false }, '2026-09-01', validateRolling);
  assert.equal(g.available, false);
  assert.equal(g.reason, 'gamma_kpi_unavailable');
});

test('FS-01 ajv-invalid row (missing required field) -> gamma_row_ajv_invalid', () => {
  const bad = gammaRow('2026-09-01'); delete bad.rolling_record_hash;
  const g = evaluateGammaAvailability({ lines: [bad], file_present: true, io_error: false }, '2026-09-01', validateRolling);
  assert.equal(g.available, false);
  assert.equal(g.reason, 'gamma_row_ajv_invalid');
});

test('FS-02/03 stale window_end -> stale ; future -> future (bidirectional)', () => {
  const stale = evaluateGammaAvailability({ lines: [gammaRow('2026-08-31')], file_present: true, io_error: false }, '2026-09-01', validateRolling);
  assert.equal(stale.reason, 'gamma_window_stale');
  const future = evaluateGammaAvailability({ lines: [gammaRow('2026-09-02')], file_present: true, io_error: false }, '2026-09-01', validateRolling);
  assert.equal(future.reason, 'gamma_window_future');
});

test('FS-02 multi-row selects MAX window_end_utc', () => {
  const rows = [gammaRow('2026-08-30', { critical: 5 }), gammaRow('2026-09-01', { critical: 0 }), gammaRow('2026-08-29')];
  const g = evaluateGammaAvailability({ lines: rows, file_present: true, io_error: false }, '2026-09-01', validateRolling);
  assert.equal(g.available, true);
  assert.equal(g.window_end_utc, '2026-09-01');
  assert.equal(g.critical, 0);
});

test('FS-04 window_sufficient=true is NOT a shortcut: stale still BLOCKED', () => {
  const row = gammaRow('2026-08-25', { overrides: { window_sufficient: true } });
  const g = evaluateGammaAvailability({ lines: [row], file_present: true, io_error: false }, '2026-09-01', validateRolling);
  assert.equal(g.available, false);
  assert.equal(g.reason, 'gamma_window_stale');
});

test('gamma absent / unreadable', () => {
  assert.equal(evaluateGammaAvailability({ lines: [], file_present: false, io_error: false }, '2026-09-01', validateRolling).reason, 'gamma_row_absent');
  assert.equal(evaluateGammaAvailability({ lines: [], file_present: true, io_error: true }, '2026-09-01', validateRolling).reason, 'gamma_source_unreadable');
});

// ========================================================================= //
// 2. #5 fail-safe (D-P4-4) via full gate
// ========================================================================= //
test('#5 fail-safe: kpi_unavailable -> #5 BLOCKED (never 0=PASS)', () => {
  const asof = '2026-09-01';
  const opts = fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { d11: UNAVAILABLE_D11 })], attests: [attestation('kill_switch_drill', asof), attestation('negative_learning_production_validated', asof), attestation('pilot1_nongoal_review', asof)] });
  const r = checkPhase4EntryGate(opts);
  assert.equal(r.prereqs['5'].state, 'BLOCKED');
  assert.equal(r.verdict, 'BLOCKED');
});

test('#5 fail-safe: critical=3 -> #5 BLOCKED', () => {
  const asof = '2026-09-01';
  const opts = fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { critical: 3 })] });
  const r = checkPhase4EntryGate(opts);
  assert.equal(r.prereqs['5'].state, 'BLOCKED');
  assert.equal(r.prereqs['5'].reason, 'critical_false_negative_present');
});

test('#5: real critical=0 available -> PASS', () => {
  const asof = '2026-09-01';
  const opts = fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { critical: 0 })] });
  assert.equal(checkPhase4EntryGate(opts).prereqs['5'].state, 'PASS');
});

// ========================================================================= //
// 3. #4 soft / hard + override binding (D-P4-2 / SO-1/04/05)
// ========================================================================= //
test('#4 rate>=0.7 -> PASS', () => {
  const asof = '2026-09-01';
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { rate: 0.8 })] }));
  assert.equal(r.prereqs['4'].state, 'PASS');
});

test('#4 rate<0.7 no override -> BLOCKED', () => {
  const asof = '2026-09-01';
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { rate: 0.62 })] }));
  assert.equal(r.prereqs['4'].state, 'BLOCKED');
});

test('#4 rate<0.7 + valid bound override -> PASS_WITH_OVERRIDE', () => {
  const asof = '2026-09-01';
  const att = attestation('soft_agreement_override', asof, { extra: { cited_measured_value: 0.62, cited_window_end_utc: asof } });
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { rate: 0.62 })], attests: [att, attestation('kill_switch_drill', asof), attestation('negative_learning_production_validated', asof), attestation('pilot1_nongoal_review', asof)] }));
  assert.equal(r.prereqs['4'].state, 'PASS_WITH_OVERRIDE');
  assert.equal(r.verdict, 'PASS_WITH_OVERRIDE');
});

test('SO-1 override cited_measured_value mismatch -> BLOCKED', () => {
  const asof = '2026-09-01';
  const att = attestation('soft_agreement_override', asof, { extra: { cited_measured_value: 0.99, cited_window_end_utc: asof } });
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { rate: 0.62 })], attests: [att] }));
  assert.equal(r.prereqs['4'].state, 'BLOCKED');
  assert.equal(r.prereqs['4'].reason, 'override_cited_value_mismatch');
});

test('SO-5 override cited_window_end_utc mismatch -> BLOCKED', () => {
  const asof = '2026-09-01';
  const att = attestation('soft_agreement_override', asof, { extra: { cited_measured_value: 0.62, cited_window_end_utc: '2026-08-15' } });
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { rate: 0.62 })], attests: [att] }));
  assert.equal(r.prereqs['4'].reason, 'override_cited_window_mismatch');
});

test('#4 gamma unavailable -> BLOCKED (cannot override without cited value)', () => {
  const asof = '2026-09-01';
  const att = attestation('soft_agreement_override', asof);
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { d11: UNAVAILABLE_D11 })], attests: [att] }));
  assert.equal(r.prereqs['4'].state, 'BLOCKED');
});

test('hard #5 not bypassable: critical!=0 + soft override present -> still BLOCKED', () => {
  const asof = '2026-09-01';
  const att = attestation('soft_agreement_override', asof, { extra: { cited_measured_value: 0.62, cited_window_end_utc: asof } });
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { rate: 0.62, critical: 4 })], attests: [att] }));
  assert.equal(r.prereqs['5'].state, 'BLOCKED');
  assert.equal(r.verdict, 'BLOCKED');
});

// ========================================================================= //
// 4. Attestation 5-dim (presence / schema / signature / freshness / per-prereq)
// ========================================================================= //
test('#6 attestation absent -> BLOCKED', () => {
  const asof = '2026-09-01';
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof)] }));
  assert.equal(r.prereqs['6'].state, 'BLOCKED');
  assert.equal(r.prereqs['6'].reason, 'attestation_absent');
});

test('attestation schema-invalid (missing drill_record_ref) -> invalid', () => {
  const asof = '2026-09-01';
  const bad = attestation('kill_switch_drill', asof); delete bad.drill_record_ref;
  const res = findValidAttestation({ lines: [bad], io_error: false }, 'kill_switch_drill', asof, validateAttest);
  assert.equal(res.valid, false);
  assert.equal(res.reason, 'attestation_schema_invalid');
});

// Red-team fold (P4-CRIT-01 / P4-GAP-01): attestation source corruption / IO error fail-closed,
// exercised END-TO-END through checkPhase4EntryGate (not just findValidAttestation in isolation).
test('attestation source corrupted (malformed line) -> attestation prereqs BLOCKED end-to-end', () => {
  const asof = '2026-09-01';
  // hand-write the attestations file: 1 valid kill_switch line + 1 malformed line.
  const dir = mkdtempSync(join(tmpdir(), 'p4gate-corrupt-'));
  const ap = join(dir, 'attest.jsonl');
  writeFileSync(ap, `${JSON.stringify(attestation('kill_switch_drill', asof))}\n{ this is : not json\n`);
  writeFileSync(join(dir, 'metrics.jsonl'), cleanWindow(asof).map((o) => JSON.stringify(o)).join('\n') + '\n');
  writeFileSync(join(dir, 'rolling.jsonl'), `${JSON.stringify(gammaRow(asof))}\n`);
  writeFileSync(join(dir, 'runbook.md'), RUNBOOK_WITH_ABORT);
  writeFileSync(join(dir, 'adr.md'), ADR_ACCEPTED);
  const r = checkPhase4EntryGate({
    asof, metrics: join(dir, 'metrics.jsonl'), rolling: join(dir, 'rolling.jsonl'), attestations: ap,
    runbook: join(dir, 'runbook.md'), adr: join(dir, 'adr.md'), rollingSchema: ROLLING_SCHEMA, attestSchema: ATTEST_SCHEMA,
  });
  assert.equal(r.malformed.attestations, 1);
  // even the otherwise-valid kill_switch line is rejected: corrupted source = fail-closed.
  assert.equal(r.prereqs['6'].state, 'BLOCKED');
  assert.equal(r.prereqs['6'].reason, 'attestation_source_corrupted');
  assert.equal(r.verdict, 'BLOCKED');
});

test('attestation source unreadable (IO error) -> attestation prereqs BLOCKED end-to-end', () => {
  const asof = '2026-09-01';
  const dir = mkdtempSync(join(tmpdir(), 'p4gate-ioerr-'));
  const attDir = join(dir, 'attest_is_a_dir'); mkdirSync(attDir); // readFileSync on a dir throws EISDIR
  writeFileSync(join(dir, 'metrics.jsonl'), cleanWindow(asof).map((o) => JSON.stringify(o)).join('\n') + '\n');
  writeFileSync(join(dir, 'rolling.jsonl'), `${JSON.stringify(gammaRow(asof))}\n`);
  writeFileSync(join(dir, 'runbook.md'), RUNBOOK_WITH_ABORT);
  writeFileSync(join(dir, 'adr.md'), ADR_ACCEPTED);
  const r = checkPhase4EntryGate({
    asof, metrics: join(dir, 'metrics.jsonl'), rolling: join(dir, 'rolling.jsonl'), attestations: attDir,
    runbook: join(dir, 'runbook.md'), adr: join(dir, 'adr.md'), rollingSchema: ROLLING_SCHEMA, attestSchema: ATTEST_SCHEMA,
  });
  assert.equal(r.prereqs['6'].state, 'BLOCKED');
  assert.equal(r.prereqs['6'].reason, 'attestation_source_unreadable');
  // asof (2026-09-01) >= floor (2026-08-26) so #11's floor IS reached -> it consults the attestation
  // source, which is unreadable -> BLOCKED (IO error fails closed even past the date floor).
  assert.equal(r.prereqs['11'].state, 'BLOCKED');
  assert.equal(r.prereqs['11'].reason, 'attestation_source_unreadable');
  assert.equal(r.verdict, 'BLOCKED');
});

test('attestation reviewer_id_hash malformed -> schema invalid', () => {
  const asof = '2026-09-01';
  const bad = attestation('kill_switch_drill', asof, { extra: { reviewer_id_hash: 'nothash' } });
  const res = findValidAttestation({ lines: [bad], io_error: false }, 'kill_switch_drill', asof, validateAttest);
  assert.equal(res.valid, false);
});

test('SO-4 attestation stale (> max-age) -> stale ; future -> rejected', () => {
  const asof = '2026-09-01';
  const stale = attestation('kill_switch_drill', asof, { attested_at: `${addDays(asof, -45)}T00:00:00Z` }); // >30d
  assert.equal(findValidAttestation({ lines: [stale], io_error: false }, 'kill_switch_drill', asof, validateAttest).reason, 'attestation_stale');
  const future = attestation('kill_switch_drill', asof, { attested_at: `${addDays(asof, 2)}T00:00:00Z` });
  assert.equal(findValidAttestation({ lines: [future], io_error: false }, 'kill_switch_drill', asof, validateAttest).reason, 'attestation_future');
});

test('soft_override freshness must be the asof UTC day', () => {
  const asof = '2026-09-01';
  const yesterday = attestation('soft_agreement_override', asof, { attested_at: `${addDays(asof, -1)}T00:00:00Z` });
  assert.equal(findValidAttestation({ lines: [yesterday], io_error: false }, 'soft_agreement_override', asof, validateAttest).reason, 'attestation_stale');
  const sameDay = attestation('soft_agreement_override', asof, { attested_at: `${asof}T10:00:00Z` });
  assert.equal(findValidAttestation({ lines: [sameDay], io_error: false }, 'soft_agreement_override', asof, validateAttest).valid, true);
});

// ========================================================================= //
// 5. Date gates (#10 ADR / #11 Pilot-1 floor)
// ========================================================================= //
test('#11 floor not reached -> INDETERMINATE', () => {
  const asof = '2026-08-25'; // < 2026-08-26
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof)] }));
  assert.equal(r.prereqs['11'].state, 'INDETERMINATE');
  assert.equal(r.prereqs['11'].detail.floor, '2026-08-26');
});

test('#11 floor reached + valid attestation -> PASS ; missing -> BLOCKED', () => {
  const asof = '2026-08-26';
  const pass = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof)], attests: [attestation('pilot1_nongoal_review', asof)] }));
  assert.equal(pass.prereqs['11'].state, 'PASS');
  const block = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof)] }));
  assert.equal(block.prereqs['11'].state, 'BLOCKED');
});

test('#10 ADR Accepted + cooling elapsed -> PASS ; not accepted -> BLOCKED', () => {
  assert.equal(evaluateAdr(ADR_ACCEPTED, '2026-06-01').state, 'PASS');
  assert.equal(evaluateAdr('**Status**: Proposed\n**Accepted-Date**: 2026-05-19\n', '2026-06-01').state, 'BLOCKED');
  // cooling not elapsed (accepted same day as asof)
  assert.equal(evaluateAdr('**Status**: Accepted\n**Accepted-Date**: 2026-06-01\n', '2026-06-01').state, 'BLOCKED');
});

// ========================================================================= //
// 6. Four-state aggregation (BLOCKED priority, idle, full PASS)
// ========================================================================= //
test('aggregate: BLOCKED priority over INDETERMINATE', () => {
  assert.equal(aggregateVerdict({ 1: { state: 'INDETERMINATE' }, 5: { state: 'BLOCKED' } }), 'BLOCKED');
  assert.equal(aggregateVerdict({ 1: { state: 'INDETERMINATE' }, 5: { state: 'PASS' } }), 'INDETERMINATE');
  assert.equal(aggregateVerdict({ 4: { state: 'PASS_WITH_OVERRIDE' }, 5: { state: 'PASS' } }), 'PASS_WITH_OVERRIDE');
  assert.equal(aggregateVerdict({ 4: { state: 'PASS' }, 5: { state: 'PASS' } }), 'PASS');
});

test('idle (all sources absent) -> BLOCKED', () => {
  const asof = '2026-09-01';
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: [], rolling: [], attests: [], runbook: '# empty\n', adr: ADR_ACCEPTED }));
  assert.equal(r.verdict, 'BLOCKED');
});

test('full healthy + attestations + floor reached -> PASS (exit-eligible)', () => {
  const asof = '2026-09-01'; // >= floor
  const r = checkPhase4EntryGate(fixtureSet({
    asof,
    metrics: cleanWindow(asof),
    rolling: [gammaRow(asof, { rate: 0.85, critical: 0 })],
    attests: [attestation('kill_switch_drill', asof), attestation('negative_learning_production_validated', asof), attestation('pilot1_nongoal_review', asof)],
  }));
  assert.equal(r.verdict, 'PASS', JSON.stringify(Object.fromEntries(Object.entries(r.prereqs).filter(([, v]) => v.state !== 'PASS'))));
});

test('healthy except #11 floor (asof<floor) -> INDETERMINATE', () => {
  const asof = '2026-08-20';
  const r = checkPhase4EntryGate(fixtureSet({
    asof,
    metrics: cleanWindow(asof),
    rolling: [gammaRow(asof, { rate: 0.85, critical: 0 })],
    attests: [attestation('kill_switch_drill', asof), attestation('negative_learning_production_validated', asof)],
  }));
  assert.equal(r.verdict, 'INDETERMINATE');
});

// ========================================================================= //
// 7. fail-safe generalization #1/#2/#3/#8 (NEW-FAILSAFE-8)
// ========================================================================= //
test('#1 manifest break -> BLOCKED ; ramp -> INDETERMINATE', () => {
  const asof = '2026-09-01';
  const broken = cleanWindow(asof); broken[10] = metricsRow(broken[10].date_utc, { clean: false });
  assert.equal(checkPhase4EntryGate(fixtureSet({ asof, metrics: broken, rolling: [gammaRow(asof)] })).prereqs['1'].state, 'BLOCKED');
  const ramp = cleanWindow(asof).slice(20); // only last 10 days present
  assert.equal(checkPhase4EntryGate(fixtureSet({ asof, metrics: ramp, rolling: [gammaRow(asof)] })).prereqs['1'].state, 'INDETERMINATE');
});

test('#2 unresolved duplicate conflict -> BLOCKED', () => {
  const asof = '2026-09-01';
  const m = cleanWindow(asof); m[5] = metricsRow(m[5].date_utc, { dup: 2, prodObserved: 0 });
  assert.equal(checkPhase4EntryGate(fixtureSet({ asof, metrics: m, rolling: [gammaRow(asof)] })).prereqs['2'].state, 'BLOCKED');
});

test('#3 fail-closed rejects present -> BLOCKED', () => {
  const asof = '2026-09-01';
  const m = cleanWindow(asof); m[7] = metricsRow(m[7].date_utc, { rejects: 1 });
  assert.equal(checkPhase4EntryGate(fixtureSet({ asof, metrics: m, rolling: [gammaRow(asof)] })).prereqs['3'].state, 'BLOCKED');
});

test('#8 metrics trail gap / stale -> BLOCKED ; #2/#3 incomplete coverage -> BLOCKED', () => {
  const asof = '2026-09-01';
  const gap = cleanWindow(asof); gap.splice(15, 1); // remove an internal day
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: gap, rolling: [gammaRow(asof)] }));
  assert.equal(r.prereqs['8'].state, 'BLOCKED');
  assert.equal(r.prereqs['2'].state, 'BLOCKED');
  assert.equal(r.prereqs['3'].state, 'BLOCKED');
  // stale trail (latest < asof)
  const stale = cleanWindow(addDays(asof, -3));
  assert.equal(checkPhase4EntryGate(fixtureSet({ asof, metrics: stale, rolling: [gammaRow(asof)] })).prereqs['8'].reason, 'metrics_trail_stale');
});

test('#9 0 production_observed -> INDETERMINATE ; hits but no attestation -> BLOCKED', () => {
  const asof = '2026-09-01';
  const noHits = windowDays(asof, 30).map((d) => metricsRow(d, { prodObserved: 0 }));
  assert.equal(checkPhase4EntryGate(fixtureSet({ asof, metrics: noHits, rolling: [gammaRow(asof)] })).prereqs['9'].state, 'INDETERMINATE');
  const hits = cleanWindow(asof); // last day prodObserved=1
  assert.equal(checkPhase4EntryGate(fixtureSet({ asof, metrics: hits, rolling: [gammaRow(asof)] })).prereqs['9'].state, 'BLOCKED');
});

// ========================================================================= //
// 8. #7 RUNBOOK abort existence predicate
// ========================================================================= //
test('#7 abort section present -> PASS ; absent -> BLOCKED ; empty -> BLOCKED', () => {
  assert.equal(evaluateRunbookAbort(RUNBOOK_WITH_ABORT).present, true);
  assert.equal(evaluateRunbookAbort('# r\n## 2. Daily\nstuff\n').present, false);
  assert.equal(evaluateRunbookAbort('## Phase-4 abort\n## next\n').present, false); // no execute_limited body
});

test('real repo RUNBOOK currently has NO Phase-4 abort section (#7 BLOCKED is correct idle)', () => {
  const text = readFileSync(join(REPO_ROOT, '_meta/docs/GHL-RUNBOOK.md'), 'utf-8');
  assert.equal(evaluateRunbookAbort(text).present, false);
});

// ========================================================================= //
// 9. Fence (R-P4-1/R-P4-2): no --window, 0 production write, no abort impl
// ========================================================================= //
test('fence: gate source has NO --window flag', () => {
  const src = readFileSync(GATE_SRC, 'utf-8');
  assert.equal(/--window\b/.test(src.replace(/no --window|each prereq owns/gi, '')), false);
});

test('fence: gate performs 0 candidate/promotion/production write', () => {
  const src = readFileSync(GATE_SRC, 'utf-8');
  // No writeFileSync (only appendFileSync for the gitignored audit line); no production write paths.
  assert.equal(/writeFileSync/.test(src), false);
  assert.equal(/state\/memory\/learned\/policies\/production/.test(src), false);
  assert.equal(/promotion_log|candidate_writ|production_writ(?!e_enabled)/.test(src.replace(/production write|production unlock/gi, '')), false);
});

// ========================================================================= //
// 10. Gate-count carve-out (D-P4-6): attestation schema registered (20->21)
// ========================================================================= //
test('attestation schema is registered in validate-contracts schemaFiles', () => {
  const v = readFileSync(join(REPO_ROOT, '_meta/contracts/scripts/validate-contracts.mjs'), 'utf-8');
  assert.equal(v.includes('phase4_prereq_attestation_v1.schema.yaml'), true);
});

// ========================================================================= //
// 11. Frozen anchors (N-1..N-7): git-blob sha1 pinned in suite
// ========================================================================= //
function gitBlobSha1(absPath) {
  const buf = readFileSync(absPath);
  const h = createHash('sha1');
  h.update(Buffer.from(`blob ${buf.length}\0`));
  h.update(buf);
  return h.digest('hex');
}
test('frozen 7 sealed anchors 0-diff (git-blob sha-pin)', () => {
  const anchors = [
    ['_meta/contracts/learning/d11_rolling_30d_v1.schema.yaml', '535935c4'],
    ['.claude/scripts/learning/d11_rolling_30d_producer.mjs', '96285406'],
    ['.claude/scripts/learning/phase_1_exit_gate_check.mjs', 'a510fb14'],
    ['.claude/scripts/learning/trial_observation_predicate.mjs', 'dfbde771'],
    ['.claude/scripts/learning/heartbeat_runner.mjs', '54944884'],
    ['.claude/scripts/learning/metrics_daily_producer.mjs', '036ace6b'],
    ['scripts/heartbeat_runner.mjs', 'e63cf86c'],
  ];
  for (const [rel, expect] of anchors) {
    assert.equal(gitBlobSha1(join(REPO_ROOT, rel)).slice(0, 8), expect, `frozen anchor changed: ${rel}`);
  }
});

// ========================================================================= //
// 12. --asof replay self-consistency (FS-04)
// ========================================================================= //
test('--asof historical day: freshness self-consistent (row window_end==asof passes)', () => {
  const asof = '2026-07-15';
  const r = checkPhase4EntryGate(fixtureSet({ asof, metrics: cleanWindow(asof), rolling: [gammaRow(asof, { critical: 0 })] }));
  assert.equal(r.gamma_availability.available, true);
  assert.equal(r.prereqs['5'].state, 'PASS');
});
