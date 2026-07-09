#!/usr/bin/env node
/**
 * Governance Eval Task Validator v0.1.0
 * SSOT: _meta/evals/governance/scripts/validate-eval-tasks.mjs
 *
 * Validates every task under tasks/ (plus the fixtures selftest task) against
 * eval_task.schema.yaml, then applies semantic guards ajv cannot express:
 *   1. filename must equal <id>.yaml (GE-07.yaml carries id GE-07);
 *   2. tasks/ must contain EXACTLY the contiguous set GE-01..GE-20 — the suite
 *      is operator-ruled at 20 tasks; a silently missing task is a coverage
 *      hole, a 21st task is scope creep (both fail-closed);
 *   3. every transcript_* target must compile as a JS regex;
 *   4. hard-check ids must be unique within a task.
 *
 * Usage: node _meta/evals/governance/scripts/validate-eval-tasks.mjs
 * Exit:  0 = all valid, 1 = fail-closed.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCHEMA_FILE = join(ROOT, 'eval_task.schema.yaml');
const TASKS_DIR = join(ROOT, 'tasks');
const SELFTEST_TASK = join(ROOT, 'fixtures', 'selftest_task.yaml');

const RED = '\x1b[31m', GREEN = '\x1b[32m', RESET = '\x1b[0m';
let failures = 0;
const fail = (label, msg) => {
  failures++;
  console.log(`${RED}❌ ${label}${RESET}: ${msg}`);
};

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(parseYaml(readFileSync(SCHEMA_FILE, 'utf-8')));

function checkFile(path, { enforceName }) {
  const label = basename(path);
  let doc;
  try {
    doc = parseYaml(readFileSync(path, 'utf-8'));
  } catch (e) {
    return fail(label, `YAML parse error: ${e.message}`);
  }
  if (!validate(doc)) {
    for (const e of validate.errors.slice(0, 5)) {
      fail(label, `${e.instancePath || '/'} ${e.message} ${JSON.stringify(e.params)}`);
    }
    return;
  }
  if (enforceName && basename(path) !== `${doc.id}.yaml`) {
    return fail(label, `filename must equal id: expected ${doc.id}.yaml`);
  }
  const seen = new Set();
  for (const c of doc.graded_checks.hard) {
    if (seen.has(c.id)) fail(label, `duplicate hard-check id ${c.id}`);
    seen.add(c.id);
    if (c.check_method.startsWith('transcript_')) {
      try {
        new RegExp(c.target, 'mi');
      } catch (e) {
        fail(label, `check ${c.id}: target is not a valid regex: ${e.message}`);
      }
    }
  }
  console.log(`${GREEN}✅ ${label}${RESET} (${doc.id}: ${doc.graded_checks.hard.length} hard / ${(doc.graded_checks.advisory || []).length} advisory)`);
  return doc.id;
}

// tasks/: exactly GE-01..GE-20
const expected = Array.from({ length: 20 }, (_, i) => `GE-${String(i + 1).padStart(2, '0')}`);
const found = [];
if (!existsSync(TASKS_DIR)) {
  fail('tasks/', 'directory missing');
} else {
  const files = readdirSync(TASKS_DIR).filter((f) => f.endsWith('.yaml')).sort();
  for (const f of files) {
    const id = checkFile(join(TASKS_DIR, f), { enforceName: true });
    if (id) found.push(id);
  }
  const missing = expected.filter((id) => !found.includes(id));
  const extra = found.filter((id) => !expected.includes(id));
  if (missing.length) fail('tasks/', `missing task(s): ${missing.join(', ')} — the suite is 20 tasks, a hole is a coverage gap`);
  if (extra.length) fail('tasks/', `unexpected task id(s): ${extra.join(', ')} — extending the suite is a reviewed change to this validator`);
}

// fixtures selftest task (GE-00; name not id-locked to the GE-01..20 window)
if (existsSync(SELFTEST_TASK)) {
  checkFile(SELFTEST_TASK, { enforceName: false });
} else {
  fail('fixtures/selftest_task.yaml', 'missing — the grader selftest needs it');
}

console.log('');
if (failures > 0) {
  console.error(`${RED}FAIL-CLOSED: ${failures} problem(s).${RESET}`);
  process.exit(1);
}
console.log(`${GREEN}All eval tasks valid (${found.length}/20 + selftest).${RESET}`);
process.exit(0);
