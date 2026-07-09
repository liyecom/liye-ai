#!/usr/bin/env node
/**
 * Governed Work Loop Validator v2.0.0
 * SSOT: _meta/contracts/scripts/validate-governed-work-loop.mjs
 *
 * Validates the governed_work_loop draft-07 schema against its template + fixtures
 * in TWO layers:
 *   Layer A — structural / cross-field (real ajv; the schema relies on allOf/if-then
 *             for C1–C13, which the hand-rolled subset validators cannot express).
 *   Layer B — semantic guards ajv cannot express:
 *             (1) control_plane_touch is a self-reported boolean, so we DERIVE it from
 *                 scope_roots and reject any false negative;
 *             (2) no_mutation is checked against allowed_actions via a deny-by-default
 *                 read-only allowlist;
 *             (3) next_action_card.final_card must be a member of the loop's OWN
 *                 declared enum — a run cannot end on a card outside its vocabulary
 *                 (the schema can pin final_card to the global six-word vocabulary,
 *                 but not to the per-loop declared subset).
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
const SCHEMA_FILE = join(LOOP_DIR, 'governed_work_loop_v2.schema.yaml');
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
// both. A mutating-verb BLACKLIST leaks forever — edit_file / modify_bid / set_budget /
// send_email / rename_file / execute_request are all writes that no finite stem list
// catches. So we use the inverse: a deny-by-default READ-ONLY ALLOWLIST. A no_mutation
// loop may ONLY draw from this governed read-only vocabulary; ANY other action (or a
// non-string) makes it a mutation loop. Over-restricting (rejecting a genuine read-only
// action not yet listed) is the SAFE direction — the author adds it here (a deliberate,
// reviewed schema change) or declares no_mutation:false. Mirrors the control_plane_touch
// derivation: a load-bearing flag is never trusted blind.
const READ_ONLY_ACTIONS = new Set([
  'read_file',           // read a file within scope
  'grep',                // search file contents
  'run_tests',           // execute a checker/verifier — observes; does not mutate scope
  'emit_candidate_diff', // PROPOSE a diff (proposes_only) — never self-applies
  'emit_review_card',    // emit a review/finding artifact
]);
function isMutatingAction(action) {
  // deny-by-default: anything not EXACTLY in the read-only vocabulary is a mutation.
  return !READ_ONLY_ACTIONS.has(action);
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
    const offending = actions.filter(isMutatingAction);
    if (offending.length) {
      const allow = [...READ_ONLY_ACTIONS].join(', ');
      errs.push(`/scope/no_mutation declared=true but allowed_action(s) [${offending.join(', ')}] are not in the read-only allowlist {${allow}} — read-only is deny-by-default; any non-allowlisted action counts as a mutation (bypasses C2/C3). Declare no_mutation:false, or add the action to READ_ONLY_ACTIONS (a governed change)`);
    }
  }
  // (3) final_card ∈ the loop's OWN declared enum (C13 companion). Layer A pins
  // final_card to the global six-word vocabulary; only Layer B can compare two
  // instance-level arrays. A run that ends on a card its contract never declared
  // is reporting an outcome outside its own vocabulary.
  const finalCard = doc?.next_action_card?.final_card;
  const declaredEnum = doc?.next_action_card?.enum;
  if (typeof finalCard === 'string' && Array.isArray(declaredEnum) && !declaredEnum.includes(finalCard)) {
    errs.push(`/next_action_card/final_card "${finalCard}" is not in this loop's declared enum [${declaredEnum.join(', ')}] — a run cannot end on a card outside its own declared vocabulary`);
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
