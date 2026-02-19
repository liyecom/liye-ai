#!/usr/bin/env node
/**
 * Ingest Execution Receipt - S1 Phase C
 * SSOT: scripts/ingest_execution_receipt.mjs
 *
 * Ingests AGE execution receipts into LiYe OS facts.
 * Produces evidence artifact for audit/replay.
 *
 * Usage:
 *   node scripts/ingest_execution_receipt.mjs \
 *     --receipt /path/to/receipt.jsonl \
 *     --request /path/to/execution_request.json \
 *     --evidence_out /path/to/evidence.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--receipt' && args[i + 1]) {
      parsed.receiptPath = args[++i];
    } else if (args[i] === '--request' && args[i + 1]) {
      parsed.requestPath = args[++i];
    } else if (args[i] === '--evidence_out' && args[i + 1]) {
      parsed.evidenceOut = args[++i];
    }
  }

  return parsed;
}

// ============================================================================
// Receipt Ingestion
// ============================================================================

function loadReceipts(receiptPath) {
  if (!existsSync(receiptPath)) {
    throw new Error(`Receipt file not found: ${receiptPath}`);
  }

  const content = readFileSync(receiptPath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());

  return lines.map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new Error(`Invalid JSON on line ${idx + 1}: ${e.message}`);
    }
  });
}

function loadRequest(requestPath) {
  if (!existsSync(requestPath)) {
    throw new Error(`Request file not found: ${requestPath}`);
  }

  return JSON.parse(readFileSync(requestPath, 'utf-8'));
}

// ============================================================================
// Fact Writer (append-only)
// ============================================================================

function appendToFacts(factPath, entries) {
  const factDir = dirname(factPath);

  if (!existsSync(factDir)) {
    mkdirSync(factDir, { recursive: true });
  }

  for (const entry of entries) {
    appendFileSync(factPath, JSON.stringify(entry) + '\n');
  }
}

// ============================================================================
// Evidence Generator
// ============================================================================

function generateEvidence(request, receipts, ingestResult) {
  const now = new Date().toISOString();

  // Compute receipt stats
  const stats = {
    total: receipts.length,
    dry_run_applied: receipts.filter(r => r.status === 'DRY_RUN_APPLIED').length,
    applied: receipts.filter(r => r.status === 'APPLIED').length,
    denied: receipts.filter(r => r.status === 'DENIED').length,
    error: receipts.filter(r => r.status === 'ERROR').length
  };

  return {
    evidence_id: `S1-PHASEC-E2E-${Date.now()}`,
    title: 'S1 Phase C: Full E2E Execution Flow',
    timestamp: now,
    status: stats.error === 0 ? 'PASS' : 'PARTIAL',
    phase: 'S1 Phase C',
    description: 'End-to-end flow: OS -> AGE -> Receipt ingestion',

    request_summary: {
      run_id: request.run_id,
      tier: request.tier,
      require_approval: request.require_approval,
      actions_count: request.actions?.length || 0,
      inputs_hash: request.inputs_hash,
      generated_at: request.generated_at
    },

    receipt_summary: {
      total_receipts: stats.total,
      dry_run_applied: stats.dry_run_applied,
      applied: stats.applied,
      denied: stats.denied,
      errors: stats.error
    },

    ingest_result: {
      facts_appended: ingestResult.factsAppended,
      fact_path: ingestResult.factPath,
      ingested_at: ingestResult.ingestedAt
    },

    verification: {
      request_actions_match_receipts: request.actions?.length === receipts.length,
      all_receipts_have_run_id: receipts.every(r => r.run_id),
      all_receipts_have_status: receipts.every(r => r.status),
      all_receipts_have_timestamp: receipts.every(r => r.timestamp)
    },

    artifacts: {
      execution_request: basename(request._source_path || 'execution_request.json'),
      receipt_file: basename(ingestResult.receiptPath),
      evidence_file: basename(ingestResult.evidencePath || 'evidence.json')
    },

    receipts_detail: receipts.map(r => ({
      action_hash: r.action_hash,
      action_kind: r.action_kind,
      status: r.status,
      reason: r.reason || null
    }))
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('     LiYe OS Receipt Ingestion - S1 Phase C');
  console.log('═══════════════════════════════════════════════════════════');

  const args = parseArgs();

  if (!args.receiptPath || !args.requestPath) {
    console.error('Usage: node scripts/ingest_execution_receipt.mjs \\');
    console.error('  --receipt /path/to/receipt.jsonl \\');
    console.error('  --request /path/to/execution_request.json \\');
    console.error('  --evidence_out /path/to/evidence.json');
    process.exit(1);
  }

  console.log(`Receipt: ${args.receiptPath}`);
  console.log(`Request: ${args.requestPath}`);
  console.log(`Evidence Out: ${args.evidenceOut || '(none)'}`);
  console.log('');

  // 1. Load request and receipts
  console.log('Loading request...');
  const request = loadRequest(args.requestPath);
  request._source_path = args.requestPath;
  console.log(`  Run ID: ${request.run_id}`);
  console.log(`  Actions: ${request.actions?.length || 0}`);

  console.log('Loading receipts...');
  const receipts = loadReceipts(args.receiptPath);
  console.log(`  Receipts: ${receipts.length}`);

  // 2. Validate receipt count matches actions
  if (request.actions?.length !== receipts.length) {
    console.warn(`⚠️  Warning: actions (${request.actions?.length}) != receipts (${receipts.length})`);
  }

  // 3. Prepare fact entries
  const factEntries = receipts.map(receipt => ({
    timestamp: new Date().toISOString(),
    event_type: 'execution_receipt_ingested',
    source: 'age',
    run_id: receipt.run_id || request.run_id,
    action_hash: receipt.action_hash,
    action_kind: receipt.action_kind,
    status: receipt.status,
    reason: receipt.reason || null,
    original_timestamp: receipt.timestamp,
    tier: request.tier,
    require_approval: request.require_approval
  }));

  // 4. Append to facts
  const factPath = join(ROOT, 'state/memory/facts/fact_execution_receipts.jsonl');
  console.log('');
  console.log(`Appending ${factEntries.length} entries to facts...`);
  appendToFacts(factPath, factEntries);
  console.log(`✅ Facts appended: ${factPath}`);

  // 5. Generate evidence
  const ingestResult = {
    factsAppended: factEntries.length,
    factPath,
    receiptPath: args.receiptPath,
    evidencePath: args.evidenceOut,
    ingestedAt: new Date().toISOString()
  };

  const evidence = generateEvidence(request, receipts, ingestResult);

  // 6. Write evidence file if specified
  if (args.evidenceOut) {
    const evidenceDir = dirname(args.evidenceOut);
    if (!existsSync(evidenceDir)) {
      mkdirSync(evidenceDir, { recursive: true });
    }
    writeFileSync(args.evidenceOut, JSON.stringify(evidence, null, 2));
    console.log(`✅ Evidence written: ${args.evidenceOut}`);
  }

  // 7. Output summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Status: ${evidence.status}`);
  console.log(`Run ID: ${evidence.request_summary.run_id}`);
  console.log(`Tier: ${evidence.request_summary.tier}`);
  console.log(`Actions: ${evidence.request_summary.actions_count}`);
  console.log(`Receipts: ${evidence.receipt_summary.total_receipts}`);
  console.log(`  - DRY_RUN_APPLIED: ${evidence.receipt_summary.dry_run_applied}`);
  console.log(`  - APPLIED: ${evidence.receipt_summary.applied}`);
  console.log(`  - DENIED: ${evidence.receipt_summary.denied}`);
  console.log(`  - ERROR: ${evidence.receipt_summary.errors}`);
  console.log('');

  if (evidence.status === 'PASS') {
    console.log('✅ S1 Phase C E2E: PASS');
  } else {
    console.log('⚠️  S1 Phase C E2E: PARTIAL (some errors)');
  }

  return evidence;
}

main().catch(err => {
  console.error('Receipt ingestion failed:', err);
  process.exit(1);
});
