#!/usr/bin/env node
/**
 * Ingest Operator Backfill (Week 6 Backfill Ignition)
 * SSOT: .claude/scripts/proactive/ingest_operator_backfill.mjs
 *
 * Control Plane component: ingests operator decisions from CSV into run directories.
 *
 * Constraints:
 * - Writes operator_callback.json with operator_source="backfill" (audit trail)
 * - Idempotent: skips runs that already have operator_callback.json
 * - Validates applied_at is in the past (required for immediate business_probe)
 *
 * CSV Format:
 *   run_id,decision,action_taken,applied_at,note
 *   run-20260206-abc123,approve,applied,2026-02-06T01:00:00Z,"backfill"
 *
 * Usage:
 *   node .claude/scripts/proactive/ingest_operator_backfill.mjs <csv_path>
 *   node .claude/scripts/proactive/ingest_operator_backfill.mjs --generate-template
 *
 * Output: operator_callback.json files in each run directory
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, createHmac } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directories
const PROJECT_ROOT = join(__dirname, '../../..');
const RUNS_DIR = join(PROJECT_ROOT, 'data/runs');
const TMP_DIR = join(PROJECT_ROOT, 'state/tmp');

// HMAC secret for integrity (can be overridden via env)
const HMAC_SECRET = process.env.OPERATOR_HMAC_SECRET || 'week6-backfill-default-secret';

/**
 * Generate HMAC for operator callback (integrity check)
 */
function generateHmac(callback) {
  const payload = JSON.stringify({
    run_id: callback.run_id,
    decision: callback.decision,
    action_taken: callback.action_taken,
    applied_at: callback.applied_at
  });
  return createHmac('sha256', HMAC_SECRET).update(payload).digest('hex').slice(0, 16);
}

/**
 * Parse CSV file into array of records
 */
function parseCSV(csvPath) {
  if (!existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  if (lines.length < 2) {
    throw new Error('CSV file must have header row and at least one data row');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const requiredHeaders = ['run_id', 'decision', 'action_taken', 'applied_at'];

  for (const req of requiredHeaders) {
    if (!headers.includes(req)) {
      throw new Error(`Missing required header: ${req}`);
    }
  }

  // Parse data rows
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values (simple CSV parsing)
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] || '';
    });

    records.push(record);
  }

  return records;
}

/**
 * Validate an operator record
 */
function validateRecord(record) {
  const errors = [];

  // Required fields
  if (!record.run_id) {
    errors.push('run_id is required');
  }

  if (!['approve', 'reject'].includes(record.decision)) {
    errors.push(`decision must be 'approve' or 'reject', got '${record.decision}'`);
  }

  if (!['applied', 'not_applied'].includes(record.action_taken)) {
    errors.push(`action_taken must be 'applied' or 'not_applied', got '${record.action_taken}'`);
  }

  // applied_at required for 'applied' action
  if (record.action_taken === 'applied') {
    if (!record.applied_at) {
      errors.push('applied_at is required when action_taken=applied');
    } else {
      const appliedAt = new Date(record.applied_at);
      if (isNaN(appliedAt.getTime())) {
        errors.push(`applied_at is not a valid ISO timestamp: ${record.applied_at}`);
      } else if (appliedAt > new Date()) {
        errors.push(`applied_at must be in the past for backfill: ${record.applied_at}`);
      }
    }
  }

  return errors;
}

/**
 * Write operator callback to run directory
 */
function writeOperatorCallback(record) {
  const runDir = join(RUNS_DIR, record.run_id);

  // Check run exists
  if (!existsSync(runDir)) {
    return {
      success: false,
      reason: `run directory not found: ${runDir}`
    };
  }

  // Check if callback already exists (idempotent)
  const callbackPath = join(runDir, 'operator_callback.json');
  if (existsSync(callbackPath)) {
    return {
      success: false,
      reason: 'operator_callback.json already exists (skipped for idempotency)'
    };
  }

  // Build callback object
  const callback = {
    run_id: record.run_id,
    decision: record.decision,
    action_taken: record.action_taken,
    applied_at: record.action_taken === 'applied' ? record.applied_at : null,
    note: record.note || null,
    operator_source: 'backfill',  // Critical: marks this as backfilled data
    ingested_at: new Date().toISOString(),
    hmac: null  // Will be set after
  };

  // Generate HMAC for integrity
  callback.hmac = generateHmac(callback);

  // Write callback file
  writeFileSync(callbackPath, JSON.stringify(callback, null, 2));

  return {
    success: true,
    callback_path: callbackPath
  };
}

/**
 * Generate template CSV file
 */
function generateTemplate() {
  mkdirSync(TMP_DIR, { recursive: true });

  // Try to read seeded run IDs
  const runIdsPath = join(TMP_DIR, 'seeded_run_ids.txt');
  let runIds = [];

  if (existsSync(runIdsPath)) {
    runIds = readFileSync(runIdsPath, 'utf-8').split('\n').filter(l => l.trim());
  }

  // Generate template with 4-day-ago timestamp
  const appliedAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

  let csvContent = 'run_id,decision,action_taken,applied_at,note\n';

  if (runIds.length > 0) {
    // Use real run IDs from seed script
    for (const runId of runIds) {
      csvContent += `${runId},approve,applied,${appliedAt},"backfill"\n`;
    }
  } else {
    // Generate example rows
    csvContent += `run-20260206-example1,approve,applied,${appliedAt},"backfill"\n`;
    csvContent += `run-20260206-example2,approve,applied,${appliedAt},"backfill"\n`;
    csvContent += `run-20260206-example3,reject,not_applied,,"rejected for review"\n`;
  }

  const templatePath = join(TMP_DIR, 'operator_backfill.csv');
  writeFileSync(templatePath, csvContent);

  console.log(`Template generated: ${templatePath}`);
  console.log(`Run IDs used: ${runIds.length > 0 ? runIds.length : 'example (no seeded runs found)'}`);

  return templatePath;
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);

  console.error('[ingest_operator] Starting operator backfill ingestion v1.0...');

  // Check for --generate-template flag
  if (args.includes('--generate-template')) {
    const templatePath = generateTemplate();
    const result = {
      status: 'success',
      action: 'generate_template',
      template_path: templatePath,
      next_step: 'Edit the CSV file, then run: node .claude/scripts/proactive/ingest_operator_backfill.mjs ' + templatePath
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // Require CSV path argument
  const csvPath = args[0];
  if (!csvPath) {
    console.error('Usage: node ingest_operator_backfill.mjs <csv_path>');
    console.error('       node ingest_operator_backfill.mjs --generate-template');
    process.exit(1);
  }

  try {
    // Parse CSV
    const records = parseCSV(csvPath);
    console.error(`[ingest_operator] Parsed ${records.length} records from CSV`);

    // Process each record
    const results = {
      success: [],
      skipped: [],
      failed: []
    };

    for (const record of records) {
      // Validate
      const validationErrors = validateRecord(record);
      if (validationErrors.length > 0) {
        results.failed.push({
          run_id: record.run_id,
          errors: validationErrors
        });
        console.error(`[ingest_operator] FAILED ${record.run_id}: ${validationErrors.join(', ')}`);
        continue;
      }

      // Write callback
      const writeResult = writeOperatorCallback(record);
      if (writeResult.success) {
        results.success.push({
          run_id: record.run_id,
          callback_path: writeResult.callback_path
        });
        console.error(`[ingest_operator] SUCCESS ${record.run_id}`);
      } else {
        results.skipped.push({
          run_id: record.run_id,
          reason: writeResult.reason
        });
        console.error(`[ingest_operator] SKIPPED ${record.run_id}: ${writeResult.reason}`);
      }
    }

    const result = {
      status: 'success',
      timestamp: new Date().toISOString(),
      csv_path: csvPath,
      records_parsed: records.length,
      callbacks_written: results.success.length,
      skipped: results.skipped.length,
      failed: results.failed.length,
      details: results,
      next_step: results.success.length > 0
        ? 'Run: node .claude/scripts/proactive/business_probe_bid_recommend_outcome.mjs --mode backfill'
        : 'Fix failed records and re-run'
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(results.failed.length > 0 ? 1 : 0);

  } catch (error) {
    const result = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'INGEST_FAILED',
        message: error.message
      }
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

// Only run if directly executed
const isDirectRun = process.argv[1]?.endsWith('ingest_operator_backfill.mjs');
if (isDirectRun) {
  main();
}

export { parseCSV, validateRecord, writeOperatorCallback, generateTemplate };
