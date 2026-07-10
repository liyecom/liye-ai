#!/usr/bin/env node
/**
 * Governed Execution Contract validator v0.1.0.
 *
 * Layer A: AJV draft-07 structure and conditional constraints.
 * Layer B: recomputed identities, receipt summary/readback, and conservative verdict.
 *
 * Invalid fixtures are compact mutation cases over a valid fixture. The expectation
 * table below pins both the intended rejection layer and a semantic error marker, so
 * an invalid case rejected only because of an unrelated defect does not count as green.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXECUTION_DIR = join(__dirname, '..', 'execution');
const SCHEMA_FILE = join(EXECUTION_DIR, 'governed_execution_v0.schema.yaml');
const TEMPLATE_DIR = join(EXECUTION_DIR, 'templates');
const FIXTURE_DIR = join(EXECUTION_DIR, 'fixtures');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const EXPECTED_INVALID = new Map([
  ['invalid_approval_request_mismatch.yaml', { ajv: 'pass', marker: 'E_APPROVAL_REQUEST' }],
  ['invalid_identity_mismatch.yaml', { ajv: 'pass', marker: 'E_IDENTITY_BINDING' }],
  ['invalid_live_without_authorization.yaml', { ajv: 'reject', marker: 'E_LIVE_AUTHORITY' }],
  ['invalid_readback_aggregate_mismatch.yaml', { ajv: 'pass', marker: 'E_READBACK_AGGREGATE' }],
  ['invalid_resume_without_checkpoint.yaml', { ajv: 'reject', marker: 'E_RESUME_CHECKPOINT' }],
  ['invalid_rollback_available_without_ref.yaml', { ajv: 'reject', marker: 'E_ROLLBACK_REF' }],
  ['invalid_verdict_receipt_mismatch.yaml', { ajv: 'pass', marker: 'E_VERDICT_RECEIPT' }],
  ['invalid_summary_mismatch.yaml', { ajv: 'pass', marker: 'E_SUMMARY_COUNTS' }],
  ['invalid_pass_without_readback.yaml', { ajv: 'pass', marker: 'E_PASS_READBACK' }],
]);

function loadYaml(path) {
  return parseYaml(readFileSync(path, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pointerSegments(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) {
    throw new Error(`invalid json_pointer: ${JSON.stringify(pointer)}`);
  }
  return pointer
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function applyMutation(document, mutation) {
  const parts = pointerSegments(mutation?.json_pointer);
  let parent = document;
  for (const part of parts.slice(0, -1)) {
    if (parent === null || typeof parent !== 'object' || !(part in parent)) {
      throw new Error(`mutation path does not exist: ${mutation.json_pointer}`);
    }
    parent = parent[part];
  }
  const key = parts.at(-1);
  if (parent === null || typeof parent !== 'object' || !(key in parent)) {
    throw new Error(`mutation target does not exist: ${mutation.json_pointer}`);
  }
  if (mutation.operation === 'remove') {
    if (Array.isArray(parent)) parent.splice(Number(key), 1);
    else delete parent[key];
    return;
  }
  if (mutation.operation === 'replace') {
    parent[key] = mutation.value;
    return;
  }
  throw new Error(`unsupported mutation operation: ${JSON.stringify(mutation.operation)}`);
}

function materializeInvalid(path) {
  const spec = loadYaml(path);
  if (spec?.fixture_kind !== 'governed_execution_mutation') {
    throw new Error('invalid fixture must declare fixture_kind: governed_execution_mutation');
  }
  if (basename(spec.base_fixture || '') !== spec.base_fixture || !spec.base_fixture.startsWith('valid_')) {
    throw new Error(`base_fixture must be a local valid_ fixture: ${JSON.stringify(spec.base_fixture)}`);
  }
  if (!Array.isArray(spec.mutations) || spec.mutations.length === 0) {
    throw new Error('invalid fixture must declare at least one mutation');
  }
  const basePath = join(FIXTURE_DIR, spec.base_fixture);
  if (!existsSync(basePath)) throw new Error(`base fixture not found: ${spec.base_fixture}`);
  const document = clone(loadYaml(basePath));
  for (const mutation of spec.mutations) applyMutation(document, mutation);
  return document;
}

function error(code, detail) {
  return { code, detail };
}

function expectedReadback(entries) {
  const observed = entries
    .map((entry) => entry?.readback_verified)
    .filter((value) => typeof value === 'boolean');
  if (observed.length === 0) return null;
  return observed.every(Boolean);
}

const STATUS_TO_SUMMARY = {
  SUCCESS: 'succeeded',
  PARTIAL_SUCCESS: 'partial_success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  HALTED: 'halted',
  DRY_RUN_SIMULATED: 'simulated',
};

function recomputeSummary(entries) {
  const summary = {
    total: entries.length,
    succeeded: 0,
    partial_success: 0,
    failed: 0,
    skipped: 0,
    halted: 0,
    simulated: 0,
  };
  for (const entry of entries) {
    const key = STATUS_TO_SUMMARY[entry?.status];
    if (key) summary[key] += 1;
  }
  return summary;
}

function sameSummary(actual, expected) {
  return Object.keys(expected).every((key) => actual?.[key] === expected[key]);
}

function expectedVerdict(mode, summary, aggregateReadback) {
  if (mode === 'dry_run') return { decision: 'HOLD', hold_reason: 'AWAITING_OBSERVATION' };
  if (summary.failed > 0 || summary.halted > 0) return { decision: 'FAIL' };
  if (summary.total === summary.skipped) {
    return { decision: 'HOLD', hold_reason: 'INSUFFICIENT_EVIDENCE' };
  }
  if (summary.partial_success > 0 || aggregateReadback !== true) {
    return { decision: 'HOLD', hold_reason: 'PARTIAL_VERIFICATION' };
  }
  if (summary.succeeded > 0) return { decision: 'PASS' };
  return { decision: 'HOLD', hold_reason: 'INSUFFICIENT_EVIDENCE' };
}

function semanticErrors(document) {
  if (document?.instance_scope !== 'per_run') return [];

  const errors = [];
  const identity = document.execution_identity || {};
  const authority = document.authority || {};
  const resume = document.resume || {};
  const receipt = document.receipt || {};
  const verdict = document.verdict || {};
  const entries = Array.isArray(receipt.entries) ? receipt.entries : [];

  if (identity.execution_mode === 'live' && !['pre_authorized', 'explicit_decision'].includes(authority.kind)) {
    errors.push(error('E_LIVE_AUTHORITY', 'live execution requires an existing envelope plus pre-authorization or explicit approval'));
  }
  if (authority.kind === 'explicit_decision' && authority.approval_request?.request_id !== authority.approval_decision?.request_id) {
    errors.push(error('E_APPROVAL_REQUEST', 'approval decision must bind the same request_id as the approval request'));
  }
  if (resume.mode === 'from_checkpoint' && !resume.checkpoint) {
    errors.push(error('E_RESUME_CHECKPOINT', 'from_checkpoint resume requires the authoritative checkpoint snapshot'));
  }
  for (const [index, entry] of entries.entries()) {
    if (entry?.rollback?.capability === 'available' && !entry.rollback.rollback_ref) {
      errors.push(error('E_ROLLBACK_REF', `receipt entry ${index} declares rollback available without rollback_ref`));
    }
  }

  const identityKeys = ['execution_id', 'task_id', 'run_id', 'changeset_id'];
  for (const key of identityKeys) {
    if (identity[key] !== receipt[key] || identity[key] !== verdict[key]) {
      errors.push(error('E_IDENTITY_BINDING', `${key} must match across execution_identity, receipt, and verdict`));
    }
  }
  if (identity.execution_mode !== receipt.execution_mode) {
    errors.push(error('E_IDENTITY_BINDING', 'execution_mode must match between execution_identity and receipt'));
  }
  if (verdict.receipt_id !== receipt.receipt_id) {
    errors.push(error('E_VERDICT_RECEIPT', 'verdict receipt_id must bind the emitted receipt'));
  }

  const computedSummary = recomputeSummary(entries);
  if (!sameSummary(receipt.summary, computedSummary)) {
    errors.push(error('E_SUMMARY_COUNTS', `receipt summary does not match entries; expected ${JSON.stringify(computedSummary)}`));
  }
  const aggregateReadback = expectedReadback(entries);
  if (!Object.is(receipt.readback_verified, aggregateReadback)) {
    errors.push(error('E_READBACK_AGGREGATE', `receipt readback aggregate must be ${JSON.stringify(aggregateReadback)}`));
  }

  if (identity.execution_mode === 'dry_run' && entries.some((entry) => entry.status !== 'DRY_RUN_SIMULATED')) {
    errors.push(error('E_MODE_STATUS', 'dry_run receipts may contain only DRY_RUN_SIMULATED entries'));
  }
  if (identity.execution_mode === 'live' && entries.some((entry) => entry.status === 'DRY_RUN_SIMULATED')) {
    errors.push(error('E_MODE_STATUS', 'live receipts may not contain DRY_RUN_SIMULATED entries'));
  }
  if (verdict.decision === 'PASS' && aggregateReadback !== true) {
    errors.push(error('E_PASS_READBACK', 'PASS requires verified readback; unknown or false is not success'));
  }

  const derived = expectedVerdict(identity.execution_mode, computedSummary, aggregateReadback);
  if (verdict.decision !== derived.decision || verdict.hold_reason !== derived.hold_reason) {
    errors.push(error('E_VERDICT_DERIVATION', `verdict must be ${derived.decision}${derived.hold_reason ? `/${derived.hold_reason}` : ''} for this receipt`));
  }
  return errors;
}

if (!existsSync(SCHEMA_FILE)) {
  console.error(`${RED}Schema not found: ${SCHEMA_FILE}${RESET}`);
  process.exit(1);
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(loadYaml(SCHEMA_FILE));

const work = [];
for (const file of readdirSync(TEMPLATE_DIR).filter((name) => name.endsWith('.template.yaml')).sort()) {
  work.push({ file, path: join(TEMPLATE_DIR, file), kind: 'valid', label: `template/${file}` });
}
for (const file of readdirSync(FIXTURE_DIR).filter((name) => name.startsWith('valid_') && name.endsWith('.yaml')).sort()) {
  work.push({ file, path: join(FIXTURE_DIR, file), kind: 'valid', label: `fixtures/${file}` });
}
for (const file of readdirSync(FIXTURE_DIR).filter((name) => name.startsWith('invalid_') && name.endsWith('.yaml')).sort()) {
  work.push({ file, path: join(FIXTURE_DIR, file), kind: 'invalid', label: `fixtures/${file}` });
}

let failures = 0;
const seenInvalid = new Set();
console.log(`\nGoverned Execution Contract — schema + semantic validation (${work.length} cases)\n`);

for (const item of work) {
  try {
    const document = item.kind === 'invalid' ? materializeInvalid(item.path) : loadYaml(item.path);
    const ajvOk = validate(document);
    const ajvErrors = ajvOk ? [] : (validate.errors || []);
    const semantic = semanticErrors(document);

    if (item.kind === 'valid') {
      if (ajvOk && semantic.length === 0) {
        console.log(`${GREEN}✅ ${item.label}${RESET} ${DIM}(passed Layer A + Layer B)${RESET}`);
      } else {
        failures += 1;
        console.log(`${RED}❌ ${item.label}${RESET} (expected PASS)`);
        for (const issue of ajvErrors) {
          console.log(`   ${RED}- [Layer-A] ${issue.instancePath || '/'} ${issue.message}${RESET}`);
        }
        for (const issue of semantic) {
          console.log(`   ${RED}- [Layer-B:${issue.code}] ${issue.detail}${RESET}`);
        }
      }
      continue;
    }

    const expected = EXPECTED_INVALID.get(item.file);
    seenInvalid.add(item.file);
    if (!expected) {
      failures += 1;
      console.log(`${RED}❌ ${item.label}${RESET} (missing explicit expectation-table entry)`);
      continue;
    }
    const ajvLayerMet = expected.ajv === 'pass' ? ajvOk : !ajvOk;
    const markerMet = semantic.some((issue) => issue.code === expected.marker);
    if (ajvLayerMet && markerMet) {
      console.log(`${GREEN}✅ ${item.label}${RESET} ${DIM}(Layer A ${expected.ajv}; intended marker ${expected.marker} fired)${RESET}`);
    } else {
      failures += 1;
      console.log(`${RED}❌ ${item.label}${RESET} (expected Layer A ${expected.ajv} + ${expected.marker})`);
      console.log(`   ${RED}- Layer A was ${ajvOk ? 'pass' : 'reject'}${RESET}`);
      console.log(`   ${RED}- Layer B markers: ${semantic.map((issue) => issue.code).join(', ') || '(none)'}${RESET}`);
      for (const issue of ajvErrors.slice(0, 4)) {
        console.log(`   ${RED}- [Layer-A] ${issue.instancePath || '/'} ${issue.message}${RESET}`);
      }
    }
  } catch (cause) {
    failures += 1;
    console.log(`${RED}❌ ${item.label}${RESET} (fixture/validator error: ${cause.message})`);
  }
}

for (const file of EXPECTED_INVALID.keys()) {
  if (!seenInvalid.has(file)) {
    failures += 1;
    console.log(`${RED}❌ fixtures/${file}${RESET} (expectation exists but fixture is missing)`);
  }
}

console.log('');
if (failures > 0) {
  console.error(`${RED}FAIL-CLOSED: ${failures} case(s) did not meet expectation.${RESET}\n`);
  process.exit(1);
}
console.log(`${GREEN}All ${work.length} cases met expectation.${RESET}\n`);
