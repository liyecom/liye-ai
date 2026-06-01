#!/usr/bin/env node
/**
 * test_heartbeat_v2_runner.mjs - Phase 1d node:test suite for the heartbeat v2
 * control-plane state manager (.claude/scripts/learning/heartbeat_runner.mjs).
 *
 * Prefix-named (no `.test.` infix) so vitest's default include glob for
 * `.test.`/`.spec.` files does NOT collect it; run explicitly with:
 *   node --test tests/test_heartbeat_v2_runner.mjs
 *
 * Covers SPEC .planning/phase-1d/SPEC.md v1.0 (blob a5349b52) §4 matrix:
 *   9-phase derivation (reachable e2e + future @pilot2-reachable unit),
 *   6 invalid-combos, Pilot-1 ceiling, runtime-owned guard, schema fail-closed,
 *   bootstrap env-gate, committed-template posture, window anchor, transition
 *   append/rollback, --dry-run no-persist, three-layer path isolation, advisory
 *   placement, evaluator zero-reference, lock, contracts-gate negative.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';

import {
  runHeartbeat, deriveCurrentPhase, checkInvalidCombos, checkCeiling,
  validateHeartbeatState, getPhaseWindowAge, LearningHeartbeatRunner,
} from '../.claude/scripts/learning/heartbeat_runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const RUNNER = join(REPO, '.claude/scripts/learning/heartbeat_runner.mjs');
const COMMITTED_TEMPLATE = join(REPO, '_meta/contracts/learning/heartbeat_state_v2.bootstrap.json');
const TRANSITION_SCHEMA = join(REPO, '_meta/contracts/learning/heartbeat_phase_transition_v1.schema.yaml');
const VALIDATE_CONTRACTS = join(REPO, '_meta/contracts/scripts/validate-contracts.mjs');

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

function freshRoot() { return mkdtempSync(join(tmpdir(), 'hb1d-test-')); }

function paths(root) {
  const dir = join(root, 'state/runtime/learning');
  return {
    dir,
    live: join(dir, 'heartbeat_learning_state.json'),
    sidecar: join(dir, 'heartbeat_learning_runtime.json'),
    transitions: join(dir, 'heartbeat_phase_transitions.jsonl'),
    lock: join(dir, 'heartbeat.lock'),
  };
}

const BASE_TEMPLATE = {
  enabled: true, evaluator_enabled: true, trial_write_enabled: false,
  candidate_write_enabled: false, candidate_write_target_status: 'sandbox',
  promotion_enabled: false, production_write_enabled: false,
  source_allowlist: ['amazon-growth-engine'], max_trials_per_day: 50,
  kill_switch_required: true, cooldown_minutes: 30,
};

function writeTemplate(root, overrides = {}) {
  const p = join(root, 'tmpl.json');
  writeFileSync(p, JSON.stringify({ ...BASE_TEMPLATE, ...overrides }));
  return p;
}

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

function seedLiveState(root, stateObj) {
  const { dir, live } = paths(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(live, JSON.stringify(stateObj, null, 2));
}

function lastTransition(root) {
  const lines = readFileSync(paths(root).transitions, 'utf-8').trim().split('\n').filter(Boolean);
  return JSON.parse(lines[lines.length - 1]);
}

function transitionCount(root) {
  if (!existsSync(paths(root).transitions)) return 0;
  return readFileSync(paths(root).transitions, 'utf-8').trim().split('\n').filter(Boolean).length;
}

// --------------------------------------------------------------------------- //
// Bootstrap + posture (DoD #3 / #10 / #11 / Gate 7)
// --------------------------------------------------------------------------- //

test('bootstrap: confirmed first boot -> evaluating_metrics_only, three layers written, transition appended', () => {
  const root = freshRoot();
  const r = runHeartbeat({ rootDir: root, templatePath: writeTemplate(root), bootstrapConfirm: true });
  assert.equal(r.fail_closed.kind, null);
  assert.equal(r.current_phase, 'evaluating_metrics_only');
  assert.equal(r.flags.trial_write_enabled, false, 'Hard Gate 7: trial_write_enabled MUST be false');
  assert.equal(r.mode, 'persist');
  assert.equal(r.transition_appended, true);
  const p = paths(root);
  assert.ok(existsSync(p.live) && existsSync(p.sidecar) && existsSync(p.transitions), 'three layers persisted');
  const live = JSON.parse(readFileSync(p.live, 'utf-8'));
  assert.equal(Object.keys(live).length, 16, '16-key v2 state');
  assert.equal(validateHeartbeatState(live), true, 'live state passes frozen v2 schema');
  const entry = lastTransition(root);
  assert.deepEqual(
    { from: entry.from, to: entry.to, reason: entry.reason, actor: entry.actor },
    { from: null, to: 'evaluating_metrics_only', reason: 'bootstrap', actor: 'runtime' });
  rmSync(root, { recursive: true, force: true });
});

test('bootstrap env-gate: first boot WITHOUT confirm -> fail-closed bootstrap_unconfirmed, nothing written', () => {
  const root = freshRoot();
  const r = runHeartbeat({ rootDir: root, templatePath: writeTemplate(root), bootstrapConfirm: false });
  assert.equal(r.fail_closed.kind, 'bootstrap_unconfirmed');
  const p = paths(root);
  assert.ok(!existsSync(p.live) && !existsSync(p.transitions) && !existsSync(p.lock), 'no persistence on unconfirmed boot');
  rmSync(root, { recursive: true, force: true });
});

test('committed bootstrap template posture self-test (catches drift)', () => {
  const root = freshRoot();
  const r = runHeartbeat({ rootDir: root, templatePath: COMMITTED_TEMPLATE, bootstrapConfirm: true });
  assert.equal(r.fail_closed.kind, null);
  assert.equal(r.current_phase, 'evaluating_metrics_only', 'committed template MUST bootstrap to evaluating_metrics_only');
  assert.equal(r.flags.trial_write_enabled, false);
  assert.equal(r.flags.production_write_enabled, false);
  rmSync(root, { recursive: true, force: true });
});

test('bootstrap empty allowlist -> paused_no_active_source; getPhaseWindowAge(evaluating)=null', () => {
  const root = freshRoot();
  const r = runHeartbeat({ rootDir: root, templatePath: writeTemplate(root, { source_allowlist: [] }), bootstrapConfirm: true });
  assert.equal(r.current_phase, 'paused_no_active_source');
  assert.equal(lastTransition(root).to, 'paused_no_active_source');
  assert.equal(getPhaseWindowAge(paths(root).transitions, 'evaluating_metrics_only'), null, 'no evaluating window established');
  assert.ok(getPhaseWindowAge(paths(root).transitions, 'paused_no_active_source') >= 0, 'current phase has a window');
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// 9-phase derivation (DoD #5)
// --------------------------------------------------------------------------- //

test('deriveCurrentPhase: 4 reachable phases', () => {
  assert.equal(deriveCurrentPhase({ enabled: false, source_allowlist: ['x'], evaluator_enabled: true, trial_write_enabled: false }), 'paused');
  assert.equal(deriveCurrentPhase({ enabled: true, source_allowlist: [], evaluator_enabled: true, trial_write_enabled: false }), 'paused_no_active_source');
  assert.equal(deriveCurrentPhase({ enabled: true, source_allowlist: ['x'], evaluator_enabled: false }), 'ingesting_only');
  assert.equal(deriveCurrentPhase({ enabled: true, source_allowlist: ['x'], evaluator_enabled: true, trial_write_enabled: false }), 'evaluating_metrics_only');
});

test('deriveCurrentPhase: 5 future @pilot2-reachable phases (unit only; ceiling blocks them in a real run)', () => {
  assert.equal(deriveCurrentPhase({ enabled: true, source_allowlist: ['x'], evaluator_enabled: true, trial_write_enabled: true, candidate_write_enabled: false }), 'trialing');
  assert.equal(deriveCurrentPhase({ enabled: true, source_allowlist: ['x'], evaluator_enabled: true, trial_write_enabled: true, candidate_write_enabled: true, candidate_write_target_status: 'sandbox', promotion_enabled: false }), 'candidate_writing_sandbox');
  assert.equal(deriveCurrentPhase({ enabled: true, source_allowlist: ['x'], evaluator_enabled: true, trial_write_enabled: true, candidate_write_enabled: true, candidate_write_target_status: 'candidate', promotion_enabled: false }), 'candidate_writing');
  assert.equal(deriveCurrentPhase({ enabled: true, source_allowlist: ['x'], evaluator_enabled: true, trial_write_enabled: true, candidate_write_enabled: true, candidate_write_target_status: 'candidate', promotion_enabled: true, production_write_enabled: false }), 'promoting');
  assert.equal(deriveCurrentPhase({ enabled: true, source_allowlist: ['x'], evaluator_enabled: true, trial_write_enabled: true, candidate_write_enabled: true, candidate_write_target_status: 'candidate', promotion_enabled: true, production_write_enabled: true }), 'executing_limited');
});

// --------------------------------------------------------------------------- //
// 6 invalid-combos (DoD #6) — driven via first-boot templates -> live state never created
// --------------------------------------------------------------------------- //

const COMBO_CASES = [
  { combo: 1, overrides: { production_write_enabled: true, promotion_enabled: false } },
  { combo: 2, overrides: { promotion_enabled: true, candidate_write_enabled: false } },
  { combo: 3, overrides: { candidate_write_enabled: false, candidate_write_target_status: 'candidate' } },
  { combo: 4, overrides: { trial_write_enabled: true, evaluator_enabled: false } },
  { combo: 5, overrides: { candidate_write_enabled: true, trial_write_enabled: false } },
  { combo: 6, overrides: { enabled: false, evaluator_enabled: true } },
];

for (const c of COMBO_CASES) {
  test(`invalid-combo #${c.combo} -> fail-closed kind=invalid_combo, no state write`, () => {
    const root = freshRoot();
    const r = runHeartbeat({ rootDir: root, templatePath: writeTemplate(root, c.overrides), bootstrapConfirm: true });
    assert.equal(r.fail_closed.kind, 'invalid_combo', `combo #${c.combo}`);
    assert.equal(r.fail_closed.combo, c.combo);
    assert.ok(!existsSync(paths(root).live), 'no live state written on fail-closed');
    assert.ok(!existsSync(paths(root).transitions), 'no transition appended on fail-closed');
    rmSync(root, { recursive: true, force: true });
  });
}

test('checkInvalidCombos: a clean default posture is valid', () => {
  assert.equal(checkInvalidCombos(BASE_TEMPLATE).invalid, false);
});

test('invalid-combo via EXISTING operator-written live state is also labelled invalid_combo (not schema)', () => {
  const root = freshRoot();
  seedLiveState(root, makeState({ enabled: false, evaluator_enabled: true, current_phase: 'paused' }));
  const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
  assert.equal(r.fail_closed.kind, 'invalid_combo');
  assert.equal(r.fail_closed.combo, 6);
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// Pilot-1 ceiling (DoD #7) — schema PERMITS escalation flags; the runner blocks them
// --------------------------------------------------------------------------- //

// Phase 2a-α ceiling relax (F-1dtest): trial_write_enabled is NO LONGER ceiling-blocked
// (its own positive trialing-derivation case is the RUNNER-enforced test below). The
// three remaining escalation flags stay ceiling-locked.
const CEILING_CASES = [
  { name: 'candidate_write', overrides: { candidate_write_enabled: true, trial_write_enabled: true, evaluator_enabled: true } },
  { name: 'promotion', overrides: { promotion_enabled: true, candidate_write_enabled: true, trial_write_enabled: true, evaluator_enabled: true, candidate_write_target_status: 'candidate' } },
  { name: 'production_write', overrides: { production_write_enabled: true, promotion_enabled: true, candidate_write_enabled: true, trial_write_enabled: true, evaluator_enabled: true, candidate_write_target_status: 'candidate' } },
];

for (const c of CEILING_CASES) {
  test(`Pilot-1 ceiling (${c.name}) -> fail-closed kind=ceiling, no state write`, () => {
    const root = freshRoot();
    const r = runHeartbeat({ rootDir: root, templatePath: writeTemplate(root, c.overrides), bootstrapConfirm: true });
    assert.equal(r.fail_closed.kind, 'ceiling');
    assert.ok(r.fail_closed.offending_flags.includes(`${c.name}_enabled`), `${c.name} flagged`);
    assert.ok(!existsSync(paths(root).live), 'no live state written on ceiling');
    rmSync(root, { recursive: true, force: true });
  });
}

test('production_write_enabled=true is ALWAYS ceiling-blocked (Hard Gate 8 Pilot-1-wide)', () => {
  const r = checkCeiling({ ...BASE_TEMPLATE, production_write_enabled: true, promotion_enabled: true, candidate_write_enabled: true, trial_write_enabled: true });
  assert.equal(r.hit, true);
  assert.ok(r.offending.includes('production_write_enabled'));
});

test('Phase 2a-α ceiling relax: a trial_write=true state derives trialing (no longer ceiling-blocked)', () => {
  const root = freshRoot();
  const escalated = makeState({ trial_write_enabled: true, current_phase: 'trialing' });
  assert.equal(validateHeartbeatState(escalated), true, 'frozen v2 schema PERMITS trial_write_enabled=true');
  seedLiveState(root, escalated);
  const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
  assert.equal(r.fail_closed.kind, null, 'Phase 2a-α: trial_write_enabled no longer ceiling-blocked');
  assert.equal(r.current_phase, 'trialing', 'trial_write=true ∧ evaluator=true ∧ candidate=false derives trialing');
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// Runtime-owned guard + schema fail-closed (DoD #8 / #9)
// --------------------------------------------------------------------------- //

test('runtime-owned guard: a template injecting a runtime-owned field is rejected', () => {
  const root = freshRoot();
  const badTemplate = join(root, 'bad.json');
  writeFileSync(badTemplate, JSON.stringify({ ...BASE_TEMPLATE, current_phase: 'paused' }));
  assert.throws(
    () => runHeartbeat({ rootDir: root, templatePath: badTemplate, bootstrapConfirm: true }),
    /forbidden key|template/i,
    'template must be exactly the 11 config keys (runtime-owned fields are runner-set)');
  rmSync(root, { recursive: true, force: true });
});

test('only LIYE_HEARTBEAT_ENABLED is ENV-sourced: runtime-owned fields cannot be injected via env (no other env read)', () => {
  const src = readFileSync(RUNNER, 'utf-8');
  const envReads = src.match(/process\.env\.[A-Z_]+/g) || [];
  const unique = [...new Set(envReads)];
  assert.deepEqual(
    unique.sort(),
    ['process.env.LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM', 'process.env.LIYE_HEARTBEAT_ENABLED'].sort(),
    'exactly two env reads; none for runtime-owned fields');
});

const SCHEMA_FAIL_CASES = [
  { name: 'version!=2', state: makeState({ version: 3 }) },
  { name: '_runtime_owned_fields wrong', state: makeState({ _runtime_owned_fields: ['x'] }) },
  { name: 'extra key (additionalProperties)', state: makeState({ injected_extra: 1 }) },
];

for (const c of SCHEMA_FAIL_CASES) {
  test(`schema fail-closed: ${c.name} -> kind=schema`, () => {
    const root = freshRoot();
    seedLiveState(root, c.state);
    const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
    assert.equal(r.fail_closed.kind, 'schema', c.name);
    rmSync(root, { recursive: true, force: true });
  });
}

test('schema fail-closed: missing required runtime-owned key -> kind=schema', () => {
  const root = freshRoot();
  const s = makeState();
  delete s._runtime_owned_fields;
  seedLiveState(root, s);
  const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
  assert.equal(r.fail_closed.kind, 'schema');
  rmSync(root, { recursive: true, force: true });
});

test('schema fail-closed: unparseable live state JSON -> kind=schema', () => {
  const root = freshRoot();
  const { dir, live } = paths(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(live, '{ not valid json');
  const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
  assert.equal(r.fail_closed.kind, 'schema');
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// Transition append / rollback + reason enum (DoD #12 / SPEC §1.8 / N3)
// --------------------------------------------------------------------------- //

test('transition: kill_switch rollback (enabled=false -> paused) appends with reason=kill_switch (no silent rollback)', () => {
  const root = freshRoot();
  // 1) bootstrap to evaluating_metrics_only.
  runHeartbeat({ rootDir: root, templatePath: writeTemplate(root), bootstrapConfirm: true });
  assert.equal(transitionCount(root), 1);
  // 2) operator zeroes everything (combo#6-safe) -> derive paused.
  seedLiveState(root, makeState({ enabled: false, evaluator_enabled: false, current_phase: 'evaluating_metrics_only' }));
  const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
  assert.equal(r.current_phase, 'paused');
  assert.equal(r.transition_appended, true);
  assert.equal(transitionCount(root), 2);
  const entry = lastTransition(root);
  assert.deepEqual(
    { from: entry.from, to: entry.to, reason: entry.reason, actor: entry.actor },
    { from: 'evaluating_metrics_only', to: 'paused', reason: 'kill_switch', actor: 'operator' });
  rmSync(root, { recursive: true, force: true });
});

test('transition: fail-closed run does NOT append', () => {
  const root = freshRoot();
  runHeartbeat({ rootDir: root, templatePath: writeTemplate(root), bootstrapConfirm: true });
  assert.equal(transitionCount(root), 1);
  // operator writes an invalid-combo state -> fail-closed, no append.
  seedLiveState(root, makeState({ enabled: false, evaluator_enabled: true, current_phase: 'paused' }));
  const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
  assert.equal(r.fail_closed.kind, 'invalid_combo');
  assert.equal(transitionCount(root), 1, 'no transition appended on fail-closed');
  rmSync(root, { recursive: true, force: true });
});

test('transition: no phase change -> no append (rerun is idempotent)', () => {
  const root = freshRoot();
  runHeartbeat({ rootDir: root, templatePath: writeTemplate(root), bootstrapConfirm: true });
  const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true });
  assert.equal(r.transition_appended, false);
  assert.equal(transitionCount(root), 1);
  rmSync(root, { recursive: true, force: true });
});

test('transition schema: reason enum is exactly 4 values; invalid_combo is REJECTED', () => {
  const v = new Ajv({ strict: false, allErrors: true, validateFormats: false })
    .compile(parseYaml(readFileSync(TRANSITION_SCHEMA, 'utf-8')));
  const base = { transition_at: '2026-05-30T00:00:00Z', from: null, to: 'evaluating_metrics_only', actor: 'runtime' };
  for (const reason of ['bootstrap', 'operator', 'operator_rollback', 'kill_switch']) {
    assert.equal(v({ ...base, reason }), true, `reason=${reason} accepted`);
  }
  assert.equal(v({ ...base, reason: 'invalid_combo' }), false, 'invalid_combo rejected (never a transition)');
  assert.equal(v({ ...base, actor: 'nobody', reason: 'bootstrap' }), false, 'actor enum enforced');
});

// --------------------------------------------------------------------------- //
// ENV override semantics (re-covers retired v1 dual-switch kill/override)
// --------------------------------------------------------------------------- //

test('ENV LIYE_HEARTBEAT_ENABLED=false forces disable (state enabled=true -> paused, reason=kill_switch)', () => {
  const root = freshRoot();
  seedLiveState(root, makeState({ enabled: true, evaluator_enabled: false, current_phase: 'ingesting_only' }));
  const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true, enabledOverride: false });
  assert.equal(r.current_phase, 'paused');
  assert.equal(lastTransition(root).reason, 'kill_switch');
  rmSync(root, { recursive: true, force: true });
});

test('ENV LIYE_HEARTBEAT_ENABLED=true re-enables (state enabled=false -> ingesting_only)', () => {
  const root = freshRoot();
  seedLiveState(root, makeState({ enabled: false, evaluator_enabled: false, current_phase: 'paused' }));
  const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true, enabledOverride: true });
  assert.equal(r.current_phase, 'ingesting_only');
  rmSync(root, { recursive: true, force: true });
});

test('ENV kill while feature flags still on -> fail-closed invalid_combo (partial-flip guard, combo#6)', () => {
  const root = freshRoot();
  seedLiveState(root, makeState()); // evaluator_enabled=true
  const r = runHeartbeat({ rootDir: root, bootstrapConfirm: true, enabledOverride: false });
  assert.equal(r.fail_closed.kind, 'invalid_combo');
  assert.equal(r.fail_closed.combo, 6);
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// --dry-run no-persist + advisory placement + lock + path isolation
// --------------------------------------------------------------------------- //

test('--dry-run rehearses and persists NOTHING (no state/sidecar/transition/lock)', () => {
  const root = freshRoot();
  const r = runHeartbeat({ rootDir: root, templatePath: writeTemplate(root), bootstrapConfirm: true, dryRun: true });
  assert.equal(r.mode, 'rehearse');
  assert.equal(r.current_phase, 'evaluating_metrics_only');
  const p = paths(root);
  assert.ok(!existsSync(p.live) && !existsSync(p.sidecar) && !existsSync(p.transitions) && !existsSync(p.lock), 'nothing persisted');
  rmSync(root, { recursive: true, force: true });
});

test('advisory note lands in the cursor sidecar, NOT the live state', () => {
  const root = freshRoot();
  runHeartbeat({ rootDir: root, templatePath: writeTemplate(root), bootstrapConfirm: true });
  const live = JSON.parse(readFileSync(paths(root).live, 'utf-8'));
  const sidecar = JSON.parse(readFileSync(paths(root).sidecar, 'utf-8'));
  assert.ok(!('evaluator_invocation_mode_advisory' in live), 'advisory MUST NOT be in the schema-validated live state');
  assert.equal(sidecar.evaluator_invocation_mode_advisory, 'dry_run', 'advisory lives in the sidecar');
  rmSync(root, { recursive: true, force: true });
});

test('lock: an O_EXCL lock already held -> runHeartbeat throws (single-flight)', () => {
  const root = freshRoot();
  seedLiveState(root, makeState());
  const { dir, lock } = paths(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(lock, 'held');
  assert.throws(() => runHeartbeat({ rootDir: root, bootstrapConfirm: true }), /lock/i);
  rmSync(root, { recursive: true, force: true });
});

test('three-layer path isolation: all runtime files land under <rootDir>/state/runtime/learning/', () => {
  const root = freshRoot();
  runHeartbeat({ rootDir: root, templatePath: writeTemplate(root), bootstrapConfirm: true });
  const p = paths(root);
  for (const f of [p.live, p.sidecar, p.transitions]) {
    assert.ok(f.startsWith(join(root, 'state/runtime/learning')), `${f} under rootDir`);
    assert.ok(existsSync(f));
  }
  rmSync(root, { recursive: true, force: true });
});

test('window anchor: monotonic + no drift across reruns; null for a non-current phase', () => {
  const root = freshRoot();
  const tmpl = writeTemplate(root);
  runHeartbeat({ rootDir: root, templatePath: tmpl, bootstrapConfirm: true });
  const a1 = getPhaseWindowAge(paths(root).transitions, 'evaluating_metrics_only');
  const anchor1 = lastTransition(root).transition_at;
  assert.ok(a1 !== null && a1 >= 0);
  assert.equal(getPhaseWindowAge(paths(root).transitions), a1, 'tail phase == current phase window');
  assert.equal(getPhaseWindowAge(paths(root).transitions, 'promoting'), null, 'a phase with no entry returns null');
  // Re-run with no flag change: the anchor must NOT move (no drift), no new transition appended.
  const r2 = runHeartbeat({ rootDir: root, templatePath: tmpl, bootstrapConfirm: true });
  assert.equal(r2.transition_appended, false);
  assert.equal(transitionCount(root), 1, 'no anchor drift: window not re-appended on a no-op rerun');
  assert.equal(lastTransition(root).transition_at, anchor1, 'anchor timestamp stable across reruns');
  const a2 = getPhaseWindowAge(paths(root).transitions, 'evaluating_metrics_only');
  assert.ok(a2 >= a1, 'window age is monotonic non-decreasing');
  rmSync(root, { recursive: true, force: true });
});

test('HeartbeatRunReport shape (§1.1) is complete and well-typed', () => {
  const root = freshRoot();
  const r = runHeartbeat({ rootDir: root, templatePath: writeTemplate(root), bootstrapConfirm: true });
  assert.deepEqual(Object.keys(r).sort(), [
    'current_phase', 'current_phase_derived_at', 'evaluator_invocation_mode_advisory',
    'fail_closed', 'flags', 'last_run_at', 'mode', 'phase_window_age_seconds', 'transition_appended',
  ].sort(), 'report carries exactly the 9 §1.1 keys');
  assert.equal(r.mode, 'persist');
  assert.equal(typeof r.phase_window_age_seconds, 'number');
  assert.match(r.current_phase_derived_at, /^\d{4}-\d{2}-\d{2}T.*Z$/, 'derived_at is an ISO instant');
  assert.match(r.last_run_at, /^\d{4}-\d{2}-\d{2}T.*Z$/, 'last_run_at is an ISO instant');
  assert.equal(r.evaluator_invocation_mode_advisory, 'dry_run');
  assert.equal(typeof r.transition_appended, 'boolean');
  assert.equal(r.fail_closed.kind, null);
  assert.deepEqual(Object.keys(r.flags).sort(), [
    'candidate_write_enabled', 'candidate_write_target_status', 'enabled', 'evaluator_enabled',
    'production_write_enabled', 'promotion_enabled', 'trial_write_enabled',
  ].sort(), 'flags carries exactly the 7 control flags');
  rmSync(root, { recursive: true, force: true });
});

test('class wrapper LearningHeartbeatRunner.run() delegates to runHeartbeat', () => {
  const root = freshRoot();
  const runner = new LearningHeartbeatRunner({ rootDir: root, templatePath: writeTemplate(root), bootstrapConfirm: true });
  const r = runner.run();
  assert.equal(r.current_phase, 'evaluating_metrics_only');
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// CLI smoke (DoD #2)
// --------------------------------------------------------------------------- //

test('CLI: --help exits 0 and prints usage', () => {
  const out = execSync(`node ${RUNNER} --help`, { encoding: 'utf-8' });
  assert.match(out, /Usage:/);
});

test('CLI: --dry-run --json --fixtures (with confirm env) exits 0 and prints a valid report', () => {
  const root = freshRoot();
  const out = execSync(`node ${RUNNER} --dry-run --json --fixtures ${root}`, {
    encoding: 'utf-8',
    env: { ...process.env, LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM: '1' },
  });
  const report = JSON.parse(out);
  assert.equal(report.mode, 'rehearse');
  assert.equal(report.current_phase, 'evaluating_metrics_only');
  rmSync(root, { recursive: true, force: true });
});

test('CLI: first boot without confirm exits 2 with kind=bootstrap_unconfirmed', () => {
  const root = freshRoot();
  let status = 0;
  let stdout = '';
  try {
    stdout = execSync(`node ${RUNNER} --json --fixtures ${root}`, {
      encoding: 'utf-8',
      env: { ...process.env, LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM: '' },
    });
  } catch (e) {
    status = e.status;
    stdout = e.stdout || '';
  }
  assert.equal(status, 2, 'fail-closed exit code');
  assert.equal(JSON.parse(stdout).fail_closed.kind, 'bootstrap_unconfirmed');
  rmSync(root, { recursive: true, force: true });
});

// --------------------------------------------------------------------------- //
// Evaluator zero-reference (SPEC §1.6 / §4 — control-plane only, NOT wired)
// --------------------------------------------------------------------------- //

test('runner does NOT import or invoke the 1c evaluator / any subprocess', () => {
  const src = readFileSync(RUNNER, 'utf-8');
  assert.ok(!/^\s*import[^\n]*evaluator/m.test(src), 'no ESM import of an evaluator module');
  assert.ok(!src.includes('policy_trial_evaluator.mjs'), 'no evaluator module path');
  assert.ok(!src.includes('evaluatePolicyTrials'), 'no evaluator function call');
  assert.ok(!src.includes('child_process'), 'no child_process import');
  assert.ok(!/\bspawn\s*\(/.test(src), 'no spawn() call');
  assert.ok(!/\bexecSync\s*\(/.test(src), 'no execSync() call');
});

// --------------------------------------------------------------------------- //
// Contracts-gate registration + negative (DoD #13)
// --------------------------------------------------------------------------- //

test('contracts gate: the new transition schema is registered in validate-contracts schemaFiles', () => {
  const src = readFileSync(VALIDATE_CONTRACTS, 'utf-8');
  assert.match(src, /heartbeat_phase_transition_v1\.schema\.yaml/, 'schema must be registered (not silently skipped)');
});

test('contracts gate negative: corrupting the registered transition schema turns the gate RED', () => {
  const orig = readFileSync(TRANSITION_SCHEMA, 'utf-8');
  try {
    writeFileSync(TRANSITION_SCHEMA, 'broken: "unterminated\n  - ]['); // unparseable YAML
    let out = '';
    try {
      out = execSync(`node ${VALIDATE_CONTRACTS}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      out = `${e.stdout || ''}${e.stderr || ''}`; // gate exits 1 -> execSync throws
    }
    assert.match(out, /heartbeat_phase_transition_v1\.schema\.yaml/, 'gate processes the registered schema');
    assert.match(out, /heartbeat_phase_transition_v1[\s\S]*?(Failed to parse|not found)/, 'gate errors on the corrupt registered schema');
  } finally {
    writeFileSync(TRANSITION_SCHEMA, orig);
    assert.equal(readFileSync(TRANSITION_SCHEMA, 'utf-8'), orig, 'schema restored byte-identical');
  }
});
