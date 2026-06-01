#!/usr/bin/env node
/**
 * operator_feedback_ingest.mjs — Phase 2a-β F-flow: operator feedback ingestion (NEW file).
 * SSOT: .claude/scripts/learning/operator_feedback_ingest.mjs
 *
 * Normative: SPEC `.planning/phase-2a-beta/SPEC.md` v1.0 (blob d1b11bae) §1 F-flow.
 *
 * WHAT THIS DOES:
 *   An operator's verdict on a system trial -> an operator_feedback_v1 instance EMBEDDED in
 *   that trial object -> RE-APPENDS the whole policy_trial line to policy_trials.jsonl. The
 *   1e producer's read side is latest-wins by trial_id (§0.1-C), so the re-appended line
 *   supersedes the prior one on read; append-only is preserved (a new full line, not a mutate).
 *
 * SCHEMA: 0 change. operator_feedback_v1 (blob 4d917aef) + policy_trial_v1 (21f225d6) are
 *   reused; operator_feedback is already the $ref target of policy_trial_v1.operator_feedback.
 *
 * WRITE-SIDE IDEMPOTENCY (NEW invariant — SPEC §1 F-flow / §0.1-C; the producer provides only
 *   READ-side latest-wins + a late-arrival ledger dedup, NEITHER of which is a write-side no-op):
 *     - same (trial_id, reviewed_at) already present  -> NO-OP (no second line appended)
 *     - same trial_id, DIFFERENT reviewed_at          -> LATEST-WINS overwrite (append a new
 *       line; read-side latest-wins supersedes the earlier feedback — an explicit overwrite,
 *       NOT a silent drop; it changes the day-N d11_kpis atom the producer derives).
 *
 * NO PII: reviewer identity is stored ONLY as reviewer_id_hash = sha256(project-ns salt ||
 *   reviewer), pattern ^sha256:[0-9a-f]{64}$ (operator_feedback_v1). The raw reviewer string
 *   is never persisted.
 *
 * FAIL-CLOSED: the candidate trial object (existing trial + operator_feedback) must pass
 *   policy_trial_v1 ajv (incl. the operator_feedback $ref) before any append; invalid -> 0
 *   write + exit 2. Batch/manual CLI or library API (NOT a daemon; aligns with the evaluator's
 *   batch-invocation model, 2a-α OQ-4).
 *
 * POSTURE: observability-class write to the trial layer ONLY. No candidate/promotion/production
 *   write, no verdict mutation, no heartbeat/schema mutation (Hard Gate 8 / SPEC §2 R-β1).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

import { buildTrialValidator } from '../../../src/reasoning/policy_trial_evaluator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const DEFAULT_TRIALS = 'state/runtime/learning/policy_trials.jsonl';

// Project namespace salt for reviewer_id_hash. The hash is stable per (reviewer) and carries
// NO PII; the salt namespaces it to GHL operator feedback so the same email in another context
// does not collide. NOT a secret (the contract only needs a stable non-PII identity hash).
const REVIEWER_NS_SALT = 'liye_os/ghl/operator_feedback/v1';

const OPERATOR_VERDICTS = ['AGREE_WITH_SYSTEM', 'DISAGREE_WITH_SYSTEM', 'NEEDS_MORE_EVIDENCE'];

const EXIT = { SUCCESS: 0, FAIL_CLOSED: 2, UNEXPECTED: 1 };

function nowIso() { return new Date().toISOString(); }

/** sha256(salt || ':' || reviewer) -> "sha256:<64hex>" (NO PII; matches operator_feedback pattern). */
export function reviewerIdHash(reviewer) {
  const h = createHash('sha256').update(`${REVIEWER_NS_SALT}:${String(reviewer)}`).digest('hex');
  return `sha256:${h}`;
}

function absUnder(rootDir, p) { return p.startsWith('/') ? p : join(rootDir, p); }

/** Read all trial lines (parsed). Malformed lines are skipped (the producer is tolerant too). */
function readTrialLines(trialsAbs) {
  const out = [];
  if (!existsSync(trialsAbs)) return out;
  for (const line of readFileSync(trialsAbs, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try { obj = JSON.parse(t); } catch { continue; }
    if (obj && typeof obj === 'object') out.push(obj);
  }
  return out;
}

/**
 * Ingest one operator feedback into policy_trials.jsonl by re-appending the target trial
 * object with operator_feedback embedded. Returns a structured report.
 *
 * @param {object} o
 * @param {string} o.trialId
 * @param {string} o.verdict                 AGREE_WITH_SYSTEM | DISAGREE_WITH_SYSTEM | NEEDS_MORE_EVIDENCE
 * @param {string[]} o.reasonCodes           operator_feedback_v1 reason_codes (>=1)
 * @param {string} o.reviewer                raw reviewer id (hashed; never stored raw)
 * @param {string} [o.note]                  optional free text (NO PII)
 * @param {string} [o.reviewedAt]            ISO 8601 w/ tz; default now
 * @param {string} [o.trialsOut]             policy_trials.jsonl path
 * @param {string} [o.rootDir]               liye_os root (test seam)
 * @returns {object} report
 */
export function ingestOperatorFeedback(o = {}) {
  const rootDir = o.rootDir || PROJECT_ROOT;
  const trialsAbs = absUnder(rootDir, o.trialsOut || DEFAULT_TRIALS);
  const reviewedAt = o.reviewedAt || nowIso();

  const report = {
    trial_id: o.trialId, reviewed_at: reviewedAt,
    action: null,            // 'appended' | 'noop_duplicate' | 'overwrite_latest_wins'
    fail_closed: false, detail: null, trials_out: trialsAbs,
  };

  if (typeof o.trialId !== 'string' || !o.trialId) {
    report.fail_closed = true; report.detail = 'missing --trial-id'; return report;
  }
  if (!OPERATOR_VERDICTS.includes(o.verdict)) {
    report.fail_closed = true; report.detail = `invalid --verdict ${JSON.stringify(o.verdict)} (use ${OPERATOR_VERDICTS.join('|')})`; return report;
  }
  if (!Array.isArray(o.reasonCodes) || o.reasonCodes.length === 0) {
    report.fail_closed = true; report.detail = 'missing --reason-codes (>=1)'; return report;
  }
  if (typeof o.reviewer !== 'string' || !o.reviewer) {
    report.fail_closed = true; report.detail = 'missing --reviewer'; return report;
  }

  const lines = readTrialLines(trialsAbs);
  // latest-wins by trial_id: the LAST line for this trial_id is the current trial object.
  let target = null;
  for (const obj of lines) if (obj.trial_id === o.trialId) target = obj;
  if (!target) {
    report.fail_closed = true; report.detail = `trial_id ${o.trialId} not found in ${trialsAbs} (cannot attach feedback to a non-existent trial)`; return report;
  }

  // Write-side idempotency: is there ALREADY a line for this trial carrying feedback with the
  // same reviewed_at? -> no-op. Different reviewed_at present -> latest-wins overwrite.
  let sameReviewedAtPresent = false;
  let anyFeedbackPresent = false;
  for (const obj of lines) {
    if (obj.trial_id !== o.trialId || !obj.operator_feedback) continue;
    anyFeedbackPresent = true;
    if (obj.operator_feedback.reviewed_at === reviewedAt) sameReviewedAtPresent = true;
  }
  if (sameReviewedAtPresent) {
    report.action = 'noop_duplicate';
    report.detail = `feedback for (trial_id, reviewed_at=${reviewedAt}) already present — no-op`;
    return report; // exit 0; idempotent
  }

  const operatorFeedback = {
    reviewer_id_hash: reviewerIdHash(o.reviewer),
    verdict: o.verdict,
    reason_codes: o.reasonCodes,
    reviewed_at: reviewedAt,
  };
  if (typeof o.note === 'string' && o.note.length > 0) operatorFeedback.note = o.note;

  // Re-append the WHOLE trial object with operator_feedback embedded (latest-wins on read).
  const newTrial = { ...target, operator_feedback: operatorFeedback };

  // fail-closed: validate against policy_trial_v1 (incl operator_feedback $ref) BEFORE write.
  const validate = buildTrialValidator(PROJECT_ROOT);
  if (!validate(newTrial)) {
    const e = validate.errors && validate.errors[0];
    report.fail_closed = true;
    report.detail = `policy_trial_v1 (with operator_feedback) invalid: ${e ? `${e.instancePath || '<root>'} ${e.message}` : 'schema invalid'}`;
    return report; // 0 write
  }

  mkdirSync(dirname(trialsAbs), { recursive: true });
  // Newline-terminated append (single-writer batch CLI). Defensive guard: if the existing file
  // is non-empty and does NOT end in '\n' (a manual edit / truncated or crashed prior write),
  // prepend a '\n' so the new object can never be glued onto the prior line (which would corrupt
  // BOTH records). Without this, fail-OPEN data loss is possible; with it, the JSONL stays
  // well-formed. The producer's latest-wins-by-trial_id read then supersedes the prior line.
  const existing = existsSync(trialsAbs) ? readFileSync(trialsAbs, 'utf-8') : '';
  const leadingNl = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  writeFileSync(trialsAbs, leadingNl + JSON.stringify(newTrial) + '\n', { flag: 'a' });

  report.action = anyFeedbackPresent ? 'overwrite_latest_wins' : 'appended';
  report.detail = anyFeedbackPresent
    ? `appended new feedback line (latest-wins overwrite of earlier reviewed_at for trial ${o.trialId})`
    : `appended first feedback for trial ${o.trialId}`;
  return report;
}

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //

const HELP = `operator_feedback_ingest.mjs - Phase 2a-β F-flow operator feedback ingestion

Usage:
  node operator_feedback_ingest.mjs --trial-id <uuid> --verdict <V> --reason-codes <csv> --reviewer <id> [options]

Required:
  --trial-id <uuid>     Target trial_id (must already exist in policy_trials.jsonl)
  --verdict <V>         ${OPERATOR_VERDICTS.join(' | ')}
  --reason-codes <csv>  >=1 of: unsafe_reuse,weak_evidence,business_context_changed,regression_failed,acceptable
  --reviewer <id>       Reviewer identity (hashed to reviewer_id_hash; NEVER stored raw — NO PII)

Options:
  --note <text>         Optional free text (NO PII; <=500 chars)
  --reviewed-at <ISO>   ISO 8601 w/ tz offset (default: now). (trial_id, reviewed_at) is the idempotency key.
  --trials <path>       policy_trials.jsonl (default state/runtime/learning/policy_trials.jsonl)
  --root <dir>          liye_os root for data I/O (test seam)
  --json                Print the report as JSON
  --help                Show help and exit 0

Idempotency:
  same (trial_id, reviewed_at) -> no-op; same trial_id, different reviewed_at -> latest-wins overwrite.

Exit codes:
  0  appended / no-op (success)
  2  fail-closed (trial not found / schema-invalid / bad args; nothing written)
  1  unexpected error
`;

function parseArgs(argv) {
  const o = { trialId: null, verdict: null, reasonCodes: null, reviewer: null, note: null, reviewedAt: null, trialsOut: null, rootDir: null, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--json') o.json = true;
    else if (a === '--trial-id') o.trialId = argv[++i];
    else if (a === '--verdict') o.verdict = argv[++i];
    else if (a === '--reason-codes') o.reasonCodes = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--reviewer') o.reviewer = argv[++i];
    else if (a === '--note') o.note = argv[++i];
    else if (a === '--reviewed-at') o.reviewedAt = argv[++i];
    else if (a === '--trials') o.trialsOut = argv[++i];
    else if (a === '--root') o.rootDir = argv[++i];
    else { process.stderr.write(`unknown argument: ${a}\n`); }
  }
  return o;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { process.stdout.write(HELP); return EXIT.SUCCESS; }
  let report;
  try {
    report = ingestOperatorFeedback(o);
  } catch (err) {
    process.stderr.write(`[operator_feedback_ingest] unexpected error: ${err.stack || err.message}\n`);
    return EXIT.UNEXPECTED;
  }
  if (o.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(`[operator_feedback_ingest] trial=${report.trial_id} action=${report.action || 'fail'} ${report.detail || ''}\n`);
  }
  return report.fail_closed ? EXIT.FAIL_CLOSED : EXIT.SUCCESS;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (invokedDirectly) process.exit(main());
