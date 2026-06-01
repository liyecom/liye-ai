#!/usr/bin/env node
/**
 * heartbeat_runner.mjs - Phase 1d GHL heartbeat v2 control-plane state manager.
 * SSOT: .claude/scripts/learning/heartbeat_runner.mjs (File A, learning domain).
 *
 * Normative: SPEC .planning/phase-1d/SPEC.md v1.0 (blob a5349b52).
 * Consumes (READ-ONLY, frozen 0b): _meta/contracts/learning/heartbeat_state_v2.schema.yaml.
 * Emits (NEW 1d): _meta/contracts/learning/heartbeat_phase_transition_v1.schema.yaml.
 *
 * WHAT THIS DOES (SPEC scope - control-plane ONLY):
 *   - Reads the committed bootstrap template + the gitignored live state.
 *   - Derives current_phase from the 7 feature flags (full 9-phase decision table).
 *   - Fails closed on the 6 schema invalid-combinations AND a runner-side Pilot-1
 *     ceiling (Phase 2a-α relaxes trial_write_enabled; candidate_write/promotion stay
 *     locked and production_write is Pilot-1-wide locked per Hard Gate 8). Never
 *     auto-corrects, never writes a half-baked state.
 *   - Validates the assembled live state against the frozen v2 schema (ajv).
 *   - Holds the first-boot evaluating_metrics_only posture (trial_write_enabled=false,
 *     Hard Gate 7) behind an explicit bootstrap-confirm env-gate.
 *   - Appends a phase-transition log entry (heartbeat_phase_transition_v1) on every
 *     phase change (bootstrap / operator / kill_switch), never silently.
 *
 * WHAT THIS DOES NOT DO (deferred - SPEC §6 / Hard NO):
 *   - Does NOT spawn/import the 1c policy_trial_evaluator (control-plane only). The
 *     forward seam for wiring is an advisory note in the cursor sidecar
 *     (evaluator_invocation_mode_advisory: "dry_run"); advisory only, never a call.
 *   - Does NOT orchestrate the learning pipeline / discover_new_runs / cost_meter.
 *   - Does NOT write policy_trials, candidate/promotion/production artifacts.
 *   - No scheduler (manual / library trigger only).
 *
 * Two "dry_run" senses are deliberately separate (SPEC §1.1):
 *   - system dry_run posture = trial_write_enabled=false -> current_phase=
 *     evaluating_metrics_only. A control-plane STATE, held false throughout 1d.
 *   - --dry-run CLI flag = the runner rehearses (derive+validate+report) and
 *     persists NOTHING (no state / sidecar / transition / lock).
 *
 * Usage:
 *   node heartbeat_runner.mjs [--dry-run] [--fixtures <dir>] [--json] [--help]
 * Env:
 *   LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1   required on first boot (no live state present)
 *   LIYE_HEARTBEAT_ENABLED={true,false}  retained master-switch override (ENV > state)
 */

import {
  readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync,
  openSync, closeSync, renameSync, unlinkSync, realpathSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// --------------------------------------------------------------------------- //
// Locked constants
// --------------------------------------------------------------------------- //

const STATE_SCHEMA_PATH = join(PROJECT_ROOT, '_meta/contracts/learning/heartbeat_state_v2.schema.yaml');
const TRANSITION_SCHEMA_PATH = join(PROJECT_ROOT, '_meta/contracts/learning/heartbeat_phase_transition_v1.schema.yaml');
const DEFAULT_TEMPLATE_PATH = join(PROJECT_ROOT, '_meta/contracts/learning/heartbeat_state_v2.bootstrap.json');

const STATE_DIR_REL = 'state/runtime/learning';
const LIVE_STATE_REL = `${STATE_DIR_REL}/heartbeat_learning_state.json`;
const CURSOR_SIDECAR_REL = `${STATE_DIR_REL}/heartbeat_learning_runtime.json`;
const TRANSITIONS_REL = `${STATE_DIR_REL}/heartbeat_phase_transitions.jsonl`;
const LOCK_REL = `${STATE_DIR_REL}/heartbeat.lock`;

// The 11 config keys the bootstrap template carries (7 flags + 4 registry). The
// remaining 5 schema-required keys (version + _runtime_owned_fields + the 3
// runtime-owned fields) are runner-assembled, NEVER template/config/env sourced.
const CONFIG_KEYS = [
  'enabled', 'evaluator_enabled', 'trial_write_enabled', 'candidate_write_enabled',
  'candidate_write_target_status', 'promotion_enabled', 'production_write_enabled',
  'source_allowlist', 'max_trials_per_day', 'kill_switch_required', 'cooldown_minutes',
];

// RUNTIME-OWNED fields, in the exact order the frozen v2 schema pins as a const array.
const RUNTIME_OWNED_FIELDS = ['current_phase', 'current_phase_derived_at', 'last_run_at'];

// The 7 control flags surfaced in the report (schema enforces them in the state).
const REPORT_FLAG_KEYS = [
  'enabled', 'evaluator_enabled', 'trial_write_enabled', 'candidate_write_enabled',
  'candidate_write_target_status', 'promotion_enabled', 'production_write_enabled',
];

// Pilot-1 escalation ceiling (runner-side, additive to the 6 schema combos; the schema
// PERMITS trial_write_enabled=true since that is the 2a flip). Phase 2a-α relaxes
// trial_write_enabled (phase-versioned departure); candidate_write/promotion stay locked
// until 2c/Phase-4 and production_write_enabled is the Pilot-1-wide lock (Hard Gate 8).
const ESCALATION_FLAGS = [
  'candidate_write_enabled', 'promotion_enabled', 'production_write_enabled',
];

const EXIT = { SUCCESS: 0, FAIL_CLOSED: 2, UNEXPECTED: 1 };

// Advisory-only forward seam (cursor sidecar; never the live state). NOT a contract.
const ADVISORY_INVOCATION_MODE = 'dry_run';

// Distinct error kinds so the CLI maps the lock/template/config failures to exit 1
// (UNEXPECTED), keeping fail-closed (exit 2) for state/combo/ceiling/bootstrap.
class HeartbeatLockError extends Error { constructor(m) { super(m); this.name = 'HeartbeatLockError'; } }
class HeartbeatTemplateError extends Error { constructor(m) { super(m); this.name = 'HeartbeatTemplateError'; } }
class HeartbeatConfigError extends Error { constructor(m) { super(m); this.name = 'HeartbeatConfigError'; } }

// --------------------------------------------------------------------------- //
// ajv validators (lazy, cached). Draft-07, strict off, formats off (matches the
// 1b/1c convention; the runtime sets the date-time fields itself via toISOString).
// --------------------------------------------------------------------------- //

let _stateValidator = null;
let _transitionValidator = null;

function getStateValidator() {
  if (!_stateValidator) {
    const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
    _stateValidator = ajv.compile(parseYaml(readFileSync(STATE_SCHEMA_PATH, 'utf-8')));
  }
  return _stateValidator;
}

function getTransitionValidator() {
  if (!_transitionValidator) {
    const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
    _transitionValidator = ajv.compile(parseYaml(readFileSync(TRANSITION_SCHEMA_PATH, 'utf-8')));
  }
  return _transitionValidator;
}

function firstError(validate) {
  const e = validate.errors && validate.errors[0];
  if (!e) return 'schema invalid';
  return `${e.instancePath || '<root>'} ${e.message}`;
}

/** Boolean validity check of a full 16-key state against the frozen v2 schema (exported per SPEC §1.1). */
export function validateHeartbeatState(state) {
  return getStateValidator()(state) === true;
}

// --------------------------------------------------------------------------- //
// Derivation + fail-closed layers (pure functions; exported for unit coverage).
// --------------------------------------------------------------------------- //

/**
 * Derive current_phase from the feature flags. Full 9-row decision table, priority
 * short-circuit (SPEC §1.4 / frozen schema N-1 §7.3). Data mapping, not policy.
 */
export function deriveCurrentPhase(flags) {
  if (flags.enabled === false) return 'paused';
  if (!Array.isArray(flags.source_allowlist) || flags.source_allowlist.length === 0) return 'paused_no_active_source';
  if (flags.evaluator_enabled === false) return 'ingesting_only';
  if (flags.evaluator_enabled === true && flags.trial_write_enabled === false) return 'evaluating_metrics_only';
  if (flags.trial_write_enabled === true && flags.candidate_write_enabled === false) return 'trialing';
  if (flags.candidate_write_enabled === true && flags.candidate_write_target_status === 'sandbox' && flags.promotion_enabled === false) return 'candidate_writing_sandbox';
  if (flags.candidate_write_enabled === true && flags.candidate_write_target_status === 'candidate' && flags.promotion_enabled === false) return 'candidate_writing';
  if (flags.promotion_enabled === true && flags.production_write_enabled === false) return 'promoting';
  if (flags.production_write_enabled === true) return 'executing_limited';
  throw new HeartbeatConfigError(`deriveCurrentPhase: no phase matched (flags=${JSON.stringify(flags)})`);
}

/**
 * Mirror of the 6 invalid feature-flag combinations encoded as allOf if/then in the
 * frozen v2 schema. Checked in code (before the generic ajv pass) so the report can
 * label kind="invalid_combo" distinctly from a structural schema failure, and so an
 * ENV override that creates a combo is caught (SPEC §1.5 Layer-A).
 */
export function checkInvalidCombos(f) {
  if (f.production_write_enabled === true && f.promotion_enabled === false) {
    return invalid(1, ['production_write_enabled', 'promotion_enabled'], 'production_write_enabled=true requires promotion_enabled=true');
  }
  if (f.promotion_enabled === true && f.candidate_write_enabled === false) {
    return invalid(2, ['promotion_enabled', 'candidate_write_enabled'], 'promotion_enabled=true requires candidate_write_enabled=true');
  }
  if (f.candidate_write_enabled === false && f.candidate_write_target_status === 'candidate') {
    return invalid(3, ['candidate_write_enabled', 'candidate_write_target_status'], 'candidate_write_target_status=candidate requires candidate_write_enabled=true');
  }
  if (f.trial_write_enabled === true && f.evaluator_enabled === false) {
    return invalid(4, ['trial_write_enabled', 'evaluator_enabled'], 'trial_write_enabled=true requires evaluator_enabled=true');
  }
  if (f.candidate_write_enabled === true && f.trial_write_enabled === false) {
    return invalid(5, ['candidate_write_enabled', 'trial_write_enabled'], 'candidate_write_enabled=true requires trial_write_enabled=true');
  }
  if (f.enabled === false && (
    f.evaluator_enabled === true || f.trial_write_enabled === true || f.candidate_write_enabled === true ||
    f.promotion_enabled === true || f.production_write_enabled === true)) {
    return invalid(6, ['enabled'], 'enabled=false requires all eval/write flags false (master switch zeroes everything)');
  }
  return { invalid: false };
}

function invalid(combo, offending, detail) {
  return { invalid: true, combo, offending, detail };
}

/**
 * Pilot-1 ceiling (SPEC §1.5 Layer-B). Additive to the schema combos. Any of the three
 * remaining escalation flags true -> fail closed. Phase 2a-α relaxes trial_write_enabled
 * (phase-versioned); production_write_enabled stays Pilot-1-wide locked (Hard Gate 8).
 */
export function checkCeiling(f) {
  const offending = ESCALATION_FLAGS.filter((k) => f[k] === true);
  if (offending.length > 0) {
    return {
      hit: true,
      offending,
      detail: `Pilot-1 ceiling: ${offending.join(', ')} must be false (Phase 2a-α relaxes trial_write_enabled; candidate_write/promotion stay locked, production_write_enabled is Pilot-1-wide locked per Hard Gate 8)`,
    };
  }
  return { hit: false };
}

// --------------------------------------------------------------------------- //
// Phase-transition window age (SPEC §1.8 single definition). now - transition_at of
// the FIRST contiguous entry that established the CURRENT phase.
// --------------------------------------------------------------------------- //

export function getPhaseWindowAge(transitionsPath, currentPhase = null) {
  if (!existsSync(transitionsPath)) return null;
  const entries = [];
  for (const line of readFileSync(transitionsPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try { obj = JSON.parse(trimmed); } catch { continue; }
    if (obj && typeof obj.to === 'string' && typeof obj.transition_at === 'string') entries.push(obj);
  }
  if (entries.length === 0) return null;
  const target = currentPhase || entries[entries.length - 1].to;
  if (entries[entries.length - 1].to !== target) return null; // current phase has no open window
  let anchor = entries[entries.length - 1].transition_at;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].to !== target) break;
    anchor = entries[i].transition_at;
  }
  const ageMs = Date.now() - Date.parse(anchor);
  return ageMs < 0 ? 0 : Math.floor(ageMs / 1000);
}

// --------------------------------------------------------------------------- //
// State assembly + I/O helpers.
// --------------------------------------------------------------------------- //

function nowIso() { return new Date().toISOString(); } // ...Z == +00:00 offset

function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

function readJson(path) { return JSON.parse(readFileSync(path, 'utf-8')); }

/** Atomic write: full content to a temp sibling, then rename (no torn writes). */
function writeJsonAtomic(path, obj) {
  ensureDir(dirname(path));
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`);
  renameSync(tmp, path);
}

function acquireLock(lockPath) {
  ensureDir(dirname(lockPath));
  let fd;
  try { fd = openSync(lockPath, 'wx'); } // O_CREAT | O_EXCL
  catch (err) {
    if (err.code === 'EEXIST') throw new HeartbeatLockError(`heartbeat lock held: ${lockPath}`);
    throw err;
  }
  try { writeSyncLine(fd, `${nowIso()} pid=${process.pid}\n`); } finally { closeSync(fd); }
}

function writeSyncLine(fd, text) { writeFileSync(fd, text); }

function releaseLock(lockPath) { try { unlinkSync(lockPath); } catch { /* already gone */ } }

/**
 * Read + validate the committed bootstrap template. It MUST be exactly the 11 config
 * keys: any runtime-owned key (or other extra key) is a contract violation (those are
 * runner-set, never template-sourced), and a missing key is template corruption.
 */
function readTemplate(templatePath) {
  if (!existsSync(templatePath)) throw new HeartbeatTemplateError(`bootstrap template not found: ${templatePath}`);
  let obj;
  try { obj = readJson(templatePath); }
  catch (e) { throw new HeartbeatTemplateError(`bootstrap template not parseable: ${e.message}`); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new HeartbeatTemplateError('bootstrap template must be a JSON object');
  }
  const allowed = new Set(CONFIG_KEYS);
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      throw new HeartbeatTemplateError(
        `bootstrap template has forbidden key '${k}' (runtime-owned fields are runner-set; template must be exactly the 11 config keys)`);
    }
  }
  for (const k of CONFIG_KEYS) {
    if (!(k in obj)) throw new HeartbeatTemplateError(`bootstrap template missing config key '${k}'`);
  }
  return obj;
}

function extractConfigFlags(source) {
  const out = {};
  for (const k of CONFIG_KEYS) out[k] = source[k];
  return out;
}

function pickReportFlags(flags) {
  const out = {};
  for (const k of REPORT_FLAG_KEYS) out[k] = flags[k];
  return out;
}

/** Assemble the authoritative full 16-key v2 state (runtime-owned fields runner-set). */
function assembleState(flags, phase, iso) {
  return {
    version: 2,
    enabled: flags.enabled,
    evaluator_enabled: flags.evaluator_enabled,
    trial_write_enabled: flags.trial_write_enabled,
    candidate_write_enabled: flags.candidate_write_enabled,
    candidate_write_target_status: flags.candidate_write_target_status,
    promotion_enabled: flags.promotion_enabled,
    production_write_enabled: flags.production_write_enabled,
    source_allowlist: flags.source_allowlist,
    max_trials_per_day: flags.max_trials_per_day,
    kill_switch_required: flags.kill_switch_required,
    cooldown_minutes: flags.cooldown_minutes,
    _runtime_owned_fields: [...RUNTIME_OWNED_FIELDS],
    current_phase: phase,
    current_phase_derived_at: iso,
    last_run_at: iso,
  };
}

/** Inert cursor sidecar (schema-external runtime cursors). 1d carries only defaults. */
function buildCursorSidecar() {
  return {
    notify_policy: 'bundle_or_error',
    last_window_end: null,
    last_processed_run_id: null,
    bundle: { last_content_sha: null, last_version: null, last_artifact_path: null },
    evaluator_invocation_mode_advisory: ADVISORY_INVOCATION_MODE,
  };
}

/**
 * Classify the transition reason + actor (SPEC §1.8 / 2a §0.1-9). Reachable: bootstrap
 * (first boot), kill_switch (enabled=false -> paused; combo#6 forces all flags zeroed),
 * operator_rollback (graceful trialing -> evaluating_metrics_only, trial_write true->false),
 * operator (any other operator-driven phase change). operator_rollback becomes reachable
 * in Phase 2a-α after the trial_write ceiling relax (a trial_write=true trialing state can
 * now persist, so an operator can step it back down); it is the safety-symmetric inverse of
 * the false->true flip. The flip direction (evaluating_metrics_only -> trialing) does NOT
 * match this predicate and falls through to the generic `operator` reason.
 */
function classifyReason(firstBoot, flags, prevPhase, newPhase) {
  if (firstBoot) return { reason: 'bootstrap', actor: 'runtime' };
  if (flags.enabled === false) return { reason: 'kill_switch', actor: 'operator' };
  if (prevPhase === 'trialing' && newPhase === 'evaluating_metrics_only') {
    return { reason: 'operator_rollback', actor: 'operator' };
  }
  return { reason: 'operator', actor: 'operator' };
}

function appendTransition(transitionsPath, entry) {
  const v = getTransitionValidator();
  if (!v(entry)) return { ok: false, error: firstError(v) };
  ensureDir(dirname(transitionsPath));
  appendFileSync(transitionsPath, `${JSON.stringify(entry)}\n`);
  return { ok: true };
}

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

/**
 * Run one heartbeat control-plane cycle.
 *
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false]        rehearse only; persist nothing (no state/sidecar/transition/lock)
 * @param {string}  [options.rootDir]             state I/O root (test seam); default PROJECT_ROOT
 * @param {string}  [options.templatePath]        bootstrap template path; default the committed contract artifact
 * @param {boolean} [options.bootstrapConfirm]    mirrors LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1 (required on first boot)
 * @param {boolean} [options.enabledOverride]     mirrors LIYE_HEARTBEAT_ENABLED (master-switch override, ENV > state)
 * @returns {object} HeartbeatRunReport (audit; NOT the live state)
 */
export function runHeartbeat(options = {}) {
  const dryRun = options.dryRun === true;
  const rootDir = options.rootDir ? realpathSync(options.rootDir) : PROJECT_ROOT;
  const templatePath = options.templatePath || DEFAULT_TEMPLATE_PATH;
  const bootstrapConfirm = options.bootstrapConfirm === true;
  const enabledOverride = typeof options.enabledOverride === 'boolean' ? options.enabledOverride : undefined;

  const liveStatePath = join(rootDir, LIVE_STATE_REL);
  const cursorPath = join(rootDir, CURSOR_SIDECAR_REL);
  const transitionsPath = join(rootDir, TRANSITIONS_REL);
  const lockPath = join(rootDir, LOCK_REL);
  const stateDir = join(rootDir, STATE_DIR_REL);

  const iso = nowIso();
  const firstBoot = !existsSync(liveStatePath);

  const report = {
    mode: dryRun ? 'rehearse' : 'persist',
    current_phase: null,
    current_phase_derived_at: null,
    phase_window_age_seconds: null,
    flags: null,
    fail_closed: { kind: null, detail: null },
    evaluator_invocation_mode_advisory: ADVISORY_INVOCATION_MODE,
    transition_appended: false,
    last_run_at: iso,
  };

  // Bootstrap env-gate (SPEC §1.1/§1.2, ruling N): first boot requires explicit
  // confirmation regardless of dry-run -- a merge never triggers a write.
  if (firstBoot && !bootstrapConfirm) {
    report.fail_closed = {
      kind: 'bootstrap_unconfirmed',
      detail: 'first boot requires LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1 (no live state present)',
    };
    return report;
  }

  // Lock only when we will persist (--dry-run never persists, so never locks).
  let locked = false;
  if (!dryRun) { ensureDir(stateDir); acquireLock(lockPath); locked = true; }
  try {
    // 1) Obtain the 11 config flags from the template (bootstrap) or live state.
    let prevPhase = null;
    let loadedState = null;
    let configSource;
    if (firstBoot) {
      configSource = readTemplate(templatePath);
    } else {
      try { loadedState = readJson(liveStatePath); }
      catch (e) { report.fail_closed = { kind: 'schema', detail: `live state not parseable: ${e.message}` }; return report; }
      prevPhase = loadedState && typeof loadedState.current_phase === 'string' ? loadedState.current_phase : null;
      configSource = loadedState;
    }
    const flags = extractConfigFlags(configSource);

    // Master-switch override (ENV > state); only `enabled` is ENV-controllable (N6).
    if (enabledOverride !== undefined) flags.enabled = enabledOverride;
    report.flags = pickReportFlags(flags);

    // 2) Layer-A fail-closed: the 6 invalid feature-flag combinations.
    const combo = checkInvalidCombos(flags);
    if (combo.invalid) {
      report.fail_closed = { kind: 'invalid_combo', detail: combo.detail, combo: combo.combo, offending_flags: combo.offending };
      return report;
    }
    // 3) Layer-B fail-closed: Pilot-1 / 1d ceiling.
    const ceiling = checkCeiling(flags);
    if (ceiling.hit) {
      report.fail_closed = { kind: 'ceiling', detail: ceiling.detail, offending_flags: ceiling.offending };
      return report;
    }
    // 4) Existing states: enforce the full v2 schema on the operator-written file
    //    (additionalProperties:false, version=2, runtime-owned const, types).
    if (!firstBoot) {
      const v = getStateValidator();
      if (!v(loadedState)) { report.fail_closed = { kind: 'schema', detail: firstError(v) }; return report; }
    }

    // 5) Derive + assemble the authoritative 16-key state.
    const phase = deriveCurrentPhase(flags);
    const state = assembleState(flags, phase, iso);

    // 6) Defense-in-depth: the assembled state must pass the frozen v2 schema.
    const v2 = getStateValidator();
    if (!v2(state)) { report.fail_closed = { kind: 'schema', detail: `assembled state invalid: ${firstError(v2)}` }; return report; }

    report.current_phase = phase;
    report.current_phase_derived_at = iso;

    // 7) Transition: append on phase change (never silent). Append BEFORE writing the
    //    live state so a silent audit gap is impossible; at worst a crash over-logs a
    //    duplicate entry, which is strictly preferable to a missing transition.
    const phaseChanged = prevPhase !== phase;
    if (phaseChanged && !dryRun) {
      const { reason, actor } = classifyReason(firstBoot, flags, prevPhase, phase);
      const entry = { transition_at: iso, from: prevPhase, to: phase, reason, actor };
      const appended = appendTransition(transitionsPath, entry);
      if (!appended.ok) { report.fail_closed = { kind: 'schema', detail: `transition entry invalid: ${appended.error}` }; return report; }
      report.transition_appended = true;
    }

    // 8) Persist live state + cursor sidecar (skipped under --dry-run).
    if (!dryRun) {
      writeJsonAtomic(liveStatePath, state);
      writeJsonAtomic(cursorPath, buildCursorSidecar());
    }

    // 9) Window age for the current phase (post-append, so a fresh phase reads ~0).
    report.phase_window_age_seconds = getPhaseWindowAge(transitionsPath, phase);
    report.last_run_at = iso;
    return report;
  } finally {
    if (locked) releaseLock(lockPath);
  }
}

/** Class wrapper (whitelisted compound name) around the functional core. */
export class LearningHeartbeatRunner {
  constructor(options = {}) { this.options = options; }
  run() { return runHeartbeat(this.options); }
}

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //

const HELP = `heartbeat_runner.mjs - Phase 1d GHL heartbeat v2 control-plane state manager

Usage:
  node heartbeat_runner.mjs [options]

Options:
  --dry-run            Rehearse: derive + validate + report, persist nothing
                       (NOT the system dry_run posture; that is trial_write_enabled=false).
  --fixtures <dir>     State I/O root (test seam); isolates state/sidecar/transitions/lock.
  --json               Print the HeartbeatRunReport as JSON on stdout.
  --help               Show this help and exit 0.

Env:
  LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1   Required on first boot (no live state present).
  LIYE_HEARTBEAT_ENABLED={true,false}  Master-switch override (ENV > state).

Exit codes:
  0  success (state persisted, or --dry-run rehearsed)
  2  fail-closed: schema-invalid / invalid-combo / Pilot-1 ceiling / bootstrap-unconfirmed
     (read report.fail_closed.kind to distinguish)
  1  unexpected: missing/corrupt template, lock contention, bad LIYE_HEARTBEAT_ENABLED, I/O
`;

function parseArgs(argv) {
  const opts = { dryRun: false, json: false, fixtures: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--fixtures') opts.fixtures = argv[++i];
    else process.stderr.write(`unknown argument: ${a}\n`);
  }
  return opts;
}

function resolveEnabledEnv() {
  const raw = process.env.LIYE_HEARTBEAT_ENABLED;
  if (raw === undefined || raw === '') return undefined;
  const n = raw.toLowerCase().trim();
  if (['true', '1', 'yes', 'on'].includes(n)) return true;
  if (['false', '0', 'no', 'off'].includes(n)) return false;
  throw new HeartbeatConfigError(`invalid LIYE_HEARTBEAT_ENABLED='${raw}' (expected true|false|1|0|yes|no|on|off)`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { process.stdout.write(HELP); return EXIT.SUCCESS; }
  let report;
  try {
    report = runHeartbeat({
      dryRun: opts.dryRun,
      rootDir: opts.fixtures || undefined,
      bootstrapConfirm: process.env.LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM === '1',
      enabledOverride: resolveEnabledEnv(),
    });
  } catch (err) {
    process.stderr.write(`[heartbeat_runner] ${err.name || 'Error'}: ${err.message}\n`);
    return EXIT.UNEXPECTED;
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (report.fail_closed.kind) {
    process.stderr.write(`[heartbeat_runner] FAIL_CLOSED (${report.fail_closed.kind}): ${report.fail_closed.detail}\n`);
  } else {
    process.stdout.write(
      `[heartbeat_runner] mode=${report.mode} current_phase=${report.current_phase} ` +
      `window_age_s=${report.phase_window_age_seconds} transition_appended=${report.transition_appended}\n`);
  }
  return report.fail_closed.kind ? EXIT.FAIL_CLOSED : EXIT.SUCCESS;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) process.exit(main());
