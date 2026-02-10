#!/usr/bin/env node
/**
 * Seed Runs: Bid Recommend from T1 (Week 6 Backfill Ignition)
 * SSOT: .claude/scripts/proactive/seed_runs_bid_recommend_from_t1.mjs
 *
 * Control Plane component: generates bid_recommend runs from T1 data for learning pipeline.
 *
 * Constraints:
 * - Only reads real T1 data (fail-closed, no random/guessing)
 * - Filters learnable samples: clicks_7d >= 50, spend_7d > 0, acos_7d non-null
 * - Generates run directories with meta.json + playbook_io.json
 * - Does NOT create operator_callback.json (use ingest_operator_backfill.mjs)
 *
 * Usage:
 *   ENGINE_T1_DATA_DIR=/path/to/t1 node .claude/scripts/proactive/seed_runs_bid_recommend_from_t1.mjs --limit 30
 *
 * Output: Run directories in data/runs/ + summary JSON
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directories
const PROJECT_ROOT = join(__dirname, '../../..');
const RUNS_DIR = join(PROJECT_ROOT, 'data/runs');
const TMP_DIR = join(PROJECT_ROOT, 'state/tmp');

// T1 Data directory (required)
const ENGINE_T1_DATA_DIR = process.env.ENGINE_T1_DATA_DIR;

// Learnable sample thresholds (hardcoded for Week 6)
const MIN_CLICKS_7D = 50;
const MIN_SPEND_7D = 0;  // Must be > 0

// CVR/ACOS bucket boundaries (for pattern detection)
const CVR_BUCKETS = [
  { id: 'cvr_low', min: 0, max: 0.10 },
  { id: 'cvr_mid', min: 0.10, max: 0.15 },
  { id: 'cvr_high', min: 0.15, max: Infinity }
];

const ACOS_BUCKETS = [
  { id: 'acos_low', min: 0, max: 0.25 },
  { id: 'acos_mid', min: 0.25, max: 0.35 },
  { id: 'acos_high', min: 0.35, max: Infinity }
];

/**
 * Get bucket ID for a value
 */
function getBucketId(value, buckets) {
  for (const bucket of buckets) {
    if (value >= bucket.min && value < bucket.max) {
      return bucket.id;
    }
  }
  return 'unknown';
}

/**
 * Generate a deterministic run ID from keyword data
 */
function generateRunId(keywordData, timestamp) {
  const hash = createHash('sha256')
    .update(JSON.stringify(keywordData) + timestamp)
    .digest('hex')
    .slice(0, 12);
  return `run-${timestamp.split('T')[0].replace(/-/g, '')}-${hash}`;
}

/**
 * Query T1 data using DuckDB CLI
 * Returns array of keyword rows or null if unavailable
 */
function queryT1KeywordData(limit) {
  if (!ENGINE_T1_DATA_DIR) {
    console.error('[seed_runs] ENGINE_T1_DATA_DIR not set');
    return null;
  }

  if (!existsSync(ENGINE_T1_DATA_DIR)) {
    console.error(`[seed_runs] T1 directory not found: ${ENGINE_T1_DATA_DIR}`);
    return null;
  }

  // Try to find keyword metrics parquet files
  const possiblePaths = [
    join(ENGINE_T1_DATA_DIR, 'keyword_metrics'),
    join(ENGINE_T1_DATA_DIR, 'keywords'),
    join(ENGINE_T1_DATA_DIR, 't1_keywords'),
    ENGINE_T1_DATA_DIR  // Direct path
  ];

  let dataDir = null;
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      const files = readdirSync(p);
      if (files.some(f => f.endsWith('.parquet') || f.endsWith('.json') || f.endsWith('.csv'))) {
        dataDir = p;
        break;
      }
    }
  }

  if (!dataDir) {
    console.error('[seed_runs] No parquet/json/csv files found in T1 directory');
    return null;
  }

  // Try DuckDB query first
  try {
    const parquetFiles = readdirSync(dataDir).filter(f => f.endsWith('.parquet'));
    if (parquetFiles.length > 0) {
      const parquetPath = join(dataDir, parquetFiles[0]);
      const query = `
        SELECT *
        FROM read_parquet('${parquetPath}')
        WHERE clicks >= ${MIN_CLICKS_7D}
          AND spend > ${MIN_SPEND_7D}
          AND acos IS NOT NULL
        LIMIT ${limit}
      `;

      const result = execSync(`duckdb -json -c "${query}"`, {
        encoding: 'utf-8',
        timeout: 30000
      });

      return JSON.parse(result);
    }
  } catch (e) {
    console.error(`[seed_runs] DuckDB query failed: ${e.message}`);
  }

  // Fallback: Try JSON files
  try {
    const jsonFiles = readdirSync(dataDir).filter(f => f.endsWith('.json'));
    if (jsonFiles.length > 0) {
      const jsonPath = join(dataDir, jsonFiles[0]);
      const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      const keywords = Array.isArray(data) ? data : (data.keywords || data.data || []);

      return keywords
        .filter(k =>
          (k.clicks_7d || k.clicks || 0) >= MIN_CLICKS_7D &&
          (k.spend_7d || k.spend || 0) > MIN_SPEND_7D &&
          (k.acos_7d || k.acos) != null
        )
        .slice(0, limit);
    }
  } catch (e) {
    console.error(`[seed_runs] JSON fallback failed: ${e.message}`);
  }

  // Fallback: Try CSV files
  try {
    const csvFiles = readdirSync(dataDir).filter(f => f.endsWith('.csv'));
    if (csvFiles.length > 0) {
      const csvPath = join(dataDir, csvFiles[0]);
      const lines = readFileSync(csvPath, 'utf-8').split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const keywords = [];
      for (let i = 1; i < lines.length && keywords.length < limit; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx]?.trim();
        });

        const clicks = parseFloat(row.clicks_7d || row.clicks || 0);
        const spend = parseFloat(row.spend_7d || row.spend || 0);
        const acos = parseFloat(row.acos_7d || row.acos);

        if (clicks >= MIN_CLICKS_7D && spend > MIN_SPEND_7D && !isNaN(acos)) {
          keywords.push({
            ...row,
            clicks_7d: clicks,
            spend_7d: spend,
            acos_7d: acos
          });
        }
      }

      return keywords;
    }
  } catch (e) {
    console.error(`[seed_runs] CSV fallback failed: ${e.message}`);
  }

  console.error('[seed_runs] No valid data source found in T1 directory');
  return null;
}

/**
 * Calculate suggested bid adjustment based on ACOS
 */
function calculateBidAdjustment(keywordData) {
  const acos = keywordData.acos_7d || keywordData.acos || 0.30;
  const cvr = keywordData.cvr_7d || keywordData.cvr || 0.10;
  const currentBid = keywordData.bid || keywordData.current_bid || 1.00;

  // Simple heuristic: low ACOS + high CVR = increase bid
  // High ACOS = decrease bid
  let deltaPct = 0;

  if (acos < 0.25 && cvr >= 0.15) {
    deltaPct = 20;  // Increase 20%
  } else if (acos < 0.25) {
    deltaPct = 15;  // Increase 15%
  } else if (acos < 0.35) {
    deltaPct = 10;  // Slight increase
  } else if (acos >= 0.45) {
    deltaPct = -15;  // Decrease 15%
  } else {
    deltaPct = 5;  // Default slight increase
  }

  // Cap at 30%
  deltaPct = Math.max(-30, Math.min(30, deltaPct));
  const suggestedBid = currentBid * (1 + deltaPct / 100);

  return {
    currentBid,
    suggestedBid: Math.round(suggestedBid * 100) / 100,
    deltaPct,
    capPct: 30
  };
}

/**
 * Build entity object for business_probe tracking
 */
function buildEntity(keywordData, bidAdjustment) {
  const clicks = keywordData.clicks_7d || keywordData.clicks || 0;
  const cvr = keywordData.cvr_7d || keywordData.cvr || 0;
  const acos = keywordData.acos_7d || keywordData.acos || 0;
  const orders = keywordData.orders_7d || keywordData.orders || 0;
  const spend = keywordData.spend_7d || keywordData.spend || 0;

  return {
    entity_type: 'keyword',
    entity_key: {
      campaign_id: keywordData.campaign_id || 'unknown',
      ad_group_id: keywordData.ad_group_id || 'unknown',
      keyword_id: keywordData.keyword_id || keywordData.id || `kw-${Date.now()}`
    },
    match_type: keywordData.match_type || 'broad',
    keyword_text: keywordData.keyword || keywordData.keyword_text || 'unknown',
    features: {
      clicks_7d: clicks,
      cvr_7d: cvr,
      acos_7d: acos,
      orders_7d: orders,
      spend_7d: spend
    },
    recommendation: {
      action_type: 'bid_adjust',
      current_bid: bidAdjustment.currentBid,
      suggested_bid: bidAdjustment.suggestedBid,
      delta_pct: bidAdjustment.deltaPct,
      cap_pct: bidAdjustment.capPct
    },
    rollback_plan: {
      revert_to_bid: bidAdjustment.currentBid,
      safe_window_hours: 48
    }
  };
}

/**
 * Generate playbook output for a keyword
 */
function generatePlaybookOutput(keywordData, runId, entity) {
  const acos = keywordData.acos_7d || keywordData.acos || 0.30;
  const cvrBucket = getBucketId(keywordData.cvr_7d || keywordData.cvr || 0, CVR_BUCKETS);
  const acosBucket = getBucketId(acos, ACOS_BUCKETS);

  // Determine verdict based on ACOS
  let verdict = 'OK';
  if (acos >= 0.35) {
    verdict = 'WARN';
  } else if (acos >= 0.45) {
    verdict = 'CRIT';
  }

  return {
    playbook_id: 'bid_recommend',
    run_id: runId,
    inputs: {
      hash: createHash('sha256').update(JSON.stringify(keywordData)).digest('hex').slice(0, 16)
    },
    outputs: {
      verdict,
      recommendations: [{
        action_type: 'bid_adjust',
        parameters: entity.recommendation,
        confidence: 0.75,
        dry_run_result: {
          expected_acos: acos * (entity.recommendation.delta_pct > 0 ? 0.90 : 1.05)
        }
      }]
    },
    primary_metric: {
      name: 'acos',
      anomaly_direction: 'low',  // ACOS lower is better
      lookback_days: 7
    },
    entities: [entity],
    evidence_package_ref: `data/runs/${runId}/evidence/`,
    metadata: {
      cvr_bucket: cvrBucket,
      acos_bucket: acosBucket,
      seeded_from: 't1_backfill'
    }
  };
}

/**
 * Create a run directory with meta.json and playbook_io.json
 */
function createRun(keywordData, timestamp) {
  const bidAdjustment = calculateBidAdjustment(keywordData);
  const entity = buildEntity(keywordData, bidAdjustment);
  const runId = generateRunId(keywordData, timestamp);
  const playbookOutput = generatePlaybookOutput(keywordData, runId, entity);

  const runDir = join(RUNS_DIR, runId);
  mkdirSync(runDir, { recursive: true });
  mkdirSync(join(runDir, 'evidence'), { recursive: true });

  // Write meta.json
  const meta = {
    run_id: runId,
    playbook_id: 'bid_recommend',
    engine_id: 'age',
    timestamp,
    status: 'completed',
    source: 't1_backfill',
    execution_time_ms: 100  // Simulated
  };
  writeFileSync(join(runDir, 'meta.json'), JSON.stringify(meta, null, 2));

  // Write playbook_io.json
  writeFileSync(join(runDir, 'playbook_io.json'), JSON.stringify(playbookOutput, null, 2));

  console.error(`[seed_runs] Created run: ${runId}`);

  return {
    run_id: runId,
    keyword: entity.keyword_text,
    acos: entity.features.acos_7d,
    cvr: entity.features.cvr_7d,
    delta_pct: entity.recommendation.delta_pct
  };
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);

  // Parse --limit argument
  let limit = 30;
  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    limit = parseInt(args[limitIndex + 1], 10);
  }

  console.error('[seed_runs] Starting T1-to-runs seeding v1.0...');
  console.error(`[seed_runs] ENGINE_T1_DATA_DIR: ${ENGINE_T1_DATA_DIR || '(not set)'}`);
  console.error(`[seed_runs] Limit: ${limit}`);
  console.error(`[seed_runs] Thresholds: clicks_7d >= ${MIN_CLICKS_7D}, spend_7d > ${MIN_SPEND_7D}`);

  try {
    // Ensure directories exist
    mkdirSync(RUNS_DIR, { recursive: true });
    mkdirSync(TMP_DIR, { recursive: true });

    // Query T1 data
    const keywords = queryT1KeywordData(limit);

    if (!keywords || keywords.length === 0) {
      const result = {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: {
          code: 'NO_T1_DATA',
          message: 'No learnable keyword data found in T1. Set ENGINE_T1_DATA_DIR to a valid T1 data directory.'
        }
      };
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.error(`[seed_runs] Found ${keywords.length} learnable keywords`);

    // Generate runs
    const timestamp = new Date().toISOString();
    const runs = [];

    for (const kw of keywords) {
      const runInfo = createRun(kw, timestamp);
      runs.push(runInfo);
    }

    // Write inputs to tmp for reference
    const inputsPath = join(TMP_DIR, 'bid_recommend_inputs.jsonl');
    const inputsContent = keywords.map(k => JSON.stringify(k)).join('\n');
    writeFileSync(inputsPath, inputsContent + '\n');

    // Write run IDs for operator backfill
    const runIdsPath = join(TMP_DIR, 'seeded_run_ids.txt');
    writeFileSync(runIdsPath, runs.map(r => r.run_id).join('\n') + '\n');

    const result = {
      status: 'success',
      timestamp,
      keywords_found: keywords.length,
      runs_created: runs.length,
      runs,
      output_files: {
        inputs: inputsPath,
        run_ids: runIdsPath
      },
      next_step: `Run: node .claude/scripts/proactive/ingest_operator_backfill.mjs <csv_path>`
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);

  } catch (error) {
    const result = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'SEED_FAILED',
        message: error.message
      }
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

// Only run if directly executed
const isDirectRun = process.argv[1]?.endsWith('seed_runs_bid_recommend_from_t1.mjs');
if (isDirectRun) {
  main();
}

export { queryT1KeywordData, createRun, generatePlaybookOutput, buildEntity };
