#!/usr/bin/env node
/**
 * Governed Work Loop Validator v1.0.0
 * SSOT: _meta/contracts/scripts/validate-governed-work-loop.mjs
 *
 * Validates the governed_work_loop draft-07 schema against its template + fixtures
 * in TWO layers:
 *   Layer A — structural / cross-field (real ajv; the schema relies on allOf/if-then
 *             for C1–C8, which the hand-rolled subset validators cannot express).
 *   Layer B — semantic guards ajv cannot express: control_plane_touch is a self-reported
 *             boolean, so we DERIVE it from scope_roots and reject any false negative
 *             (scope clearly hits the control plane but the flag says false).
 * A file is accepted only if it passes BOTH layers.
 *
 * Expectation is encoded in the filename (TDD red/green):
 *   - fixtures/valid_*.yaml      MUST validate    (green)
 *   - templates/*.template.yaml  MUST validate    (green)
 *   - fixtures/invalid_*.yaml    MUST be rejected  (green = correctly rejected)
 *
 * Usage:   node _meta/contracts/scripts/validate-governed-work-loop.mjs
 * Exit:    0 = every file met its expectation, 1 = at least one did not (fail-closed).
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOOP_DIR = join(__dirname, '..', 'loop');
const SCHEMA_FILE = join(LOOP_DIR, 'governed_work_loop_v1.schema.yaml');
const TPL_DIR = join(LOOP_DIR, 'templates');
const FIX_DIR = join(LOOP_DIR, 'fixtures');

const RED = '\x1b[31m', GREEN = '\x1b[32m', DIM = '\x1b[2m', RESET = '\x1b[0m';
let failures = 0;

function loadYaml(p) {
  return parseYaml(readFileSync(p, 'utf-8'));
}

if (!existsSync(SCHEMA_FILE)) {
  console.error(`${RED}Schema not found: ${SCHEMA_FILE}${RESET}`);
  process.exit(1);
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(loadYaml(SCHEMA_FILE));

// ----------------------------------------------------------------------------
// Layer B — semantic guards AJV (structural) cannot express.
// control_plane_touch is load-bearing for C4 but is a self-reported boolean; a loop
// could under-report it (false negative) and silently bypass the proposes_only gate.
// Here we DERIVE control-plane intersection from scope_roots and reject any mismatch.
// Over-reporting (declared true while derived false) is SAFE and allowed — fail-closed
// is the conservative direction. The segment set mirrors the schema's control-plane globs.
// ----------------------------------------------------------------------------
const CONTROL_PLANE_SEGMENTS = ['_meta', 'contracts', 'policies', 'rubrics'];
function pathTouchesControlPlane(p) {
  if (typeof p !== 'string') return false;
  if (p.endsWith('.schema.yaml')) return true;
  return p.split('/').some((seg) => CONTROL_PLANE_SEGMENTS.includes(seg));
}

// no_mutation is the SAME class of self-reported flag (it gates C2 fail_closed + C3
// replay_safe). A loop can claim no_mutation:true while listing write actions, dodging
// both. We DERIVE mutation from allowed_actions: any action token whose stem is a
// mutating verb. Conservative by design — over-reporting (flagging a read-only action)
// only forces the safe no_mutation:false path; under-reporting (missing a real write)
// is the danger we close. Mirrors the control_plane_touch derivation above.
const MUTATING_ACTION_STEMS = [
  'write', 'patch', 'delete', 'put', 'post', 'mutate', 'apply',
  'create', 'update', 'remove', 'push', 'upsert', 'overwrite',
];
function actionImpliesMutation(action) {
  if (typeof action !== 'string') return false;
  return action
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((tok) => tok && MUTATING_ACTION_STEMS.some((stem) => tok.startsWith(stem)));
}

function semanticErrors(doc) {
  const errs = [];
  const roots = doc?.scope?.scope_roots;
  if (Array.isArray(roots)) {
    const hit = roots.find(pathTouchesControlPlane);
    const declared = doc?.scope?.control_plane_touch === true;
    if (hit && !declared) {
      errs.push(`/scope/control_plane_touch derived=true (scope_root "${hit}" hits the control plane) but declared=false`);
    }
  }
  const actions = doc?.scope?.allowed_actions;
  if (Array.isArray(actions) && doc?.scope?.no_mutation === true) {
    const mut = actions.find(actionImpliesMutation);
    if (mut) {
      errs.push(`/scope/no_mutation derived=mutation (allowed_action "${mut}" is a write) but declared=true — a mutation loop cannot self-report read-only (bypasses C2/C3)`);
    }
  }
  return errs;
}

// Build the work list: (path, expectPass, label)
const work = [];
if (existsSync(TPL_DIR)) {
  for (const f of readdirSync(TPL_DIR).filter((f) => f.endsWith('.template.yaml'))) {
    work.push({ path: join(TPL_DIR, f), expectPass: true, label: `template/${f}` });
  }
}
if (existsSync(FIX_DIR)) {
  for (const f of readdirSync(FIX_DIR).filter((f) => f.endsWith('.yaml'))) {
    const expectPass = f.startsWith('valid_');
    work.push({ path: join(FIX_DIR, f), expectPass, label: `fixtures/${f}` });
  }
}

console.log(`\nGoverned Work Loop — schema validation (${work.length} files)\n`);

for (const { path, expectPass, label } of work) {
  const doc = loadYaml(path);
  const ajvOk = validate(doc);
  const ajvErrors = ajvOk ? [] : (validate.errors || []);
  const semErrs = semanticErrors(doc); // Layer B
  const ok = ajvOk && semErrs.length === 0;
  const met = ok === expectPass;
  const tag = expectPass ? 'expect PASS' : 'expect REJECT';

  if (met && expectPass) {
    console.log(`${GREEN}✅ ${label}${RESET} ${DIM}(${tag} → passed both layers)${RESET}`);
  } else if (met && !expectPass) {
    // Correctly rejected — surface the violated keyword(s)/layer so we know it failed for the right reason.
    const ajvWhy = ajvErrors
      .filter((e) => ['const', 'enum', 'required', 'minProperties', 'minLength'].includes(e.keyword))
      .map((e) => `${e.instancePath || '/'} ${e.keyword} ${JSON.stringify(e.params)}`);
    const why = [...semErrs.map((s) => `[Layer-B] ${s}`), ...ajvWhy].slice(0, 4).join('; ');
    console.log(`${GREEN}✅ ${label}${RESET} ${DIM}(${tag} → correctly rejected: ${why || 'see errors'})${RESET}`);
  } else if (!met && expectPass) {
    failures++;
    console.log(`${RED}❌ ${label}${RESET} (${tag} but was REJECTED):`);
    for (const e of ajvErrors) {
      console.log(`   ${RED}- ${e.instancePath || '/'} ${e.message} ${JSON.stringify(e.params)}${RESET}`);
    }
    for (const s of semErrs) {
      console.log(`   ${RED}- [Layer-B] ${s}${RESET}`);
    }
  } else {
    failures++;
    console.log(`${RED}❌ ${label}${RESET} (${tag} but it PASSED — the guardrail did not fire)`);
  }
}

console.log('');
if (failures > 0) {
  console.error(`${RED}FAIL-CLOSED: ${failures} file(s) did not meet expectation.${RESET}\n`);
  process.exit(1);
}
console.log(`${GREEN}All ${work.length} files met expectation.${RESET}\n`);
process.exit(0);
