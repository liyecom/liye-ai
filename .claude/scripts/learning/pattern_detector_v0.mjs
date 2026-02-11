#!/usr/bin/env node
/**
 * Pattern Detector v0.1 (Week 6 Learning Pipeline)
 * SSOT: .claude/scripts/learning/pattern_detector_v0.mjs
 *
 * Control Plane component: detects recurring success patterns from execution traces.
 * Uses three-signal validation: exec + operator + business.
 *
 * Pattern ID format:
 * {engine_id}:{playbook_id}:{primary_metric.name}:{scope_hash}:{match_type}:{bucket_cvr}:{bucket_acos}
 *
 * Buckets:
 * - CVR: <0.10, 0.10-0.15, >=0.15
 * - ACOS: <0.25, 0.25-0.35, >=0.35
 * - Filter: clicks_7d >= 50
 *
 * Usage:
 *   node .claude/scripts/learning/pattern_detector_v0.mjs [--since YYYY-MM-DD] [--output-dir <path>]
 *
 * Output: state/runtime/learning/patterns/patterns_{date}.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directories
const RUNS_DIR = join(__dirname, '../../../data/runs');
const FACTS_DIR = join(__dirname, '../../../state/memory/facts');
const PATTERNS_OUTPUT_DIR = join(__dirname, '../../../state/runtime/learning/patterns');

// Buckets for pattern grouping
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

// Minimum clicks filter
const MIN_CLICKS = 50;

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
 * Generate scope hash from entity keys (for entity-specific patterns)
 * NOTE: Not used in v0.1 - patterns are grouped by bucket conditions only
 */
function scopeHash(entityKey) {
  const key = JSON.stringify(entityKey);
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

/**
 * Generate pattern ID
 * v0.1: Group by match_type + cvr_bucket + acos_bucket (not entity-specific)
 * This allows patterns to aggregate across multiple keywords with similar characteristics
 */
function generatePatternId(engineId, playbookId, metricName, entityKey, matchType, cvrBucket, acosBucket) {
  // v0.1: Remove entity_key scope to allow cross-entity pattern aggregation
  // Patterns are grouped by: engine + playbook + metric + match_type + cvr_bucket + acos_bucket
  return `${engineId}:${playbookId}:${metricName}:global:${matchType}:${cvrBucket}:${acosBucket}`;
}

/**
 * Load all runs from runs directory
 */
function loadRuns(sinceDate) {
  if (!existsSync(RUNS_DIR)) {
    console.error(`[pattern_detector] Runs directory not found: ${RUNS_DIR}`);
    return [];
  }

  const runDirs = readdirSync(RUNS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const runs = [];

  for (const runId of runDirs) {
    const runDir = join(RUNS_DIR, runId);
    const metaPath = join(runDir, 'meta.json');
    const playbookIoPath = join(runDir, 'playbook_io.json');
    const operatorPath = join(runDir, 'operator_callback.json');

    if (!existsSync(metaPath) || !existsSync(playbookIoPath)) {
      continue;
    }

    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      const playbookIo = JSON.parse(readFileSync(playbookIoPath, 'utf-8'));
      const operatorCallback = existsSync(operatorPath)
        ? JSON.parse(readFileSync(operatorPath, 'utf-8'))
        : null;

      // Filter by date if specified
      if (sinceDate && meta.timestamp) {
        const runDate = new Date(meta.timestamp);
        if (runDate < new Date(sinceDate)) {
          continue;
        }
      }

      runs.push({
        run_id: runId,
        meta,
        playbook_io: playbookIo,
        operator_callback: operatorCallback
      });
    } catch (e) {
      console.error(`[pattern_detector] Failed to load run ${runId}: ${e.message}`);
    }
  }

  return runs;
}

/**
 * Load business probe facts
 */
function loadBusinessProbeFacts() {
  const factsFile = join(FACTS_DIR, 'fact_business_probes_bid_recommend.jsonl');

  if (!existsSync(factsFile)) {
    return {};
  }

  const facts = {};
  const lines = readFileSync(factsFile, 'utf-8').split('\n').filter(l => l.trim());

  for (const line of lines) {
    try {
      const fact = JSON.parse(line);
      if (fact.run_id) {
        facts[fact.run_id] = fact;
      }
    } catch (e) {
      // Skip invalid lines
    }
  }

  return facts;
}

/**
 * Check if a run has all three signals
 */
function hasAllThreeSignals(run, businessFacts) {
  // 1. Exec success: run completed without error
  const execSuccess = run.meta?.status === 'completed' || run.playbook_io?.verdict;

  // 2. Operator approval
  const operatorApproved = run.operator_callback?.decision === 'approve';

  // 3. Business probe measured
  const businessFact = businessFacts[run.run_id];
  const businessMeasured = businessFact?.business_probe_status === 'measured';

  return {
    exec_success: execSuccess,
    operator_approved: operatorApproved,
    business_measured: businessMeasured,
    all_signals: execSuccess && operatorApproved && businessMeasured,
    business_improved: businessFact?.improved || false
  };
}

/**
 * Extract entities from playbook output
 */
function extractEntities(playbookIo) {
  const entities = playbookIo.entities || [];
  const primaryMetric = playbookIo.primary_metric || { name: 'acos', anomaly_direction: 'low' };

  return entities.map(entity => ({
    entity_key: entity.entity_key,
    match_type: entity.match_type || 'broad',
    features: entity.features || {},
    recommendation: entity.recommendation || {},
    primary_metric: primaryMetric
  }));
}

/**
 * Detect patterns from runs
 */
function detectPatterns(runs, businessFacts) {
  const patternMap = {};

  for (const run of runs) {
    // Only process bid_recommend runs
    if (run.meta?.playbook_id !== 'bid_recommend') {
      continue;
    }

    const signals = hasAllThreeSignals(run, businessFacts);

    // Only use runs with all three signals
    if (!signals.all_signals) {
      continue;
    }

    const entities = extractEntities(run.playbook_io);
    const engineId = run.meta.engine_id || 'age';

    for (const entity of entities) {
      const features = entity.features;
      const clicks = features.clicks_7d || features.clicks || 0;

      // Filter by minimum clicks
      if (clicks < MIN_CLICKS) {
        continue;
      }

      const cvr = features.cvr_7d || features.cvr || 0;
      const acos = features.acos_7d || features.acos || 0;
      const matchType = entity.match_type;

      const cvrBucket = getBucketId(cvr, CVR_BUCKETS);
      const acosBucket = getBucketId(acos, ACOS_BUCKETS);

      const patternId = generatePatternId(
        engineId,
        'bid_recommend',
        entity.primary_metric.name,
        entity.entity_key,
        matchType,
        cvrBucket,
        acosBucket
      );

      if (!patternMap[patternId]) {
        patternMap[patternId] = {
          pattern_id: patternId,
          engine_id: engineId,
          playbook_id: 'bid_recommend',
          primary_metric: entity.primary_metric,
          match_type: matchType,
          cvr_bucket: cvrBucket,
          acos_bucket: acosBucket,
          sample_size: 0,
          improved_count: 0,
          evidence_refs: [],
          recommendations: []
        };
      }

      const pattern = patternMap[patternId];
      pattern.sample_size++;

      if (signals.business_improved) {
        pattern.improved_count++;
      }

      // Store evidence refs (max 20)
      if (pattern.evidence_refs.length < 20) {
        pattern.evidence_refs.push(run.run_id);
      }

      // Store recommendation deltas for averaging
      if (entity.recommendation?.delta_pct !== undefined) {
        pattern.recommendations.push(entity.recommendation.delta_pct);
      }
    }
  }

  // Calculate final metrics for each pattern
  const patterns = Object.values(patternMap).map(pattern => {
    const improveRate = pattern.sample_size > 0
      ? pattern.improved_count / pattern.sample_size
      : 0;

    // Calculate average delta_pct
    const avgDeltaPct = pattern.recommendations.length > 0
      ? pattern.recommendations.reduce((a, b) => a + b, 0) / pattern.recommendations.length
      : 0;

    return {
      pattern_id: pattern.pattern_id,
      engine_id: pattern.engine_id,
      playbook_id: pattern.playbook_id,
      primary_metric: pattern.primary_metric,
      conditions: {
        match_type: pattern.match_type,
        cvr_bucket: pattern.cvr_bucket,
        acos_bucket: pattern.acos_bucket,
        min_clicks: MIN_CLICKS
      },
      sample_size: pattern.sample_size,
      improved_count: pattern.improved_count,
      business_improve_rate: Math.round(improveRate * 1000) / 1000,
      avg_delta_pct: Math.round(avgDeltaPct * 100) / 100,
      evidence_refs: pattern.evidence_refs,
      can_crystallize: pattern.sample_size >= 10 && improveRate >= 0.6
    };
  });

  // Sort by sample size descending
  return patterns.sort((a, b) => b.sample_size - a.sample_size);
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  let sinceDate = null;
  let outputDir = PATTERNS_OUTPUT_DIR;

  // Parse arguments
  const sinceIndex = args.indexOf('--since');
  if (sinceIndex !== -1 && args[sinceIndex + 1]) {
    sinceDate = args[sinceIndex + 1];
  }

  const outputIndex = args.indexOf('--output-dir');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputDir = args[outputIndex + 1];
  }

  console.error('[pattern_detector] Starting pattern detection v0.1...');
  console.error(`[pattern_detector] Since: ${sinceDate || 'all time'}`);
  console.error(`[pattern_detector] Runs dir: ${RUNS_DIR}`);
  console.error(`[pattern_detector] Output dir: ${outputDir}`);

  try {
    // Load runs and business facts
    const runs = loadRuns(sinceDate);
    console.error(`[pattern_detector] Loaded ${runs.length} runs`);

    const businessFacts = loadBusinessProbeFacts();
    console.error(`[pattern_detector] Loaded ${Object.keys(businessFacts).length} business probe facts`);

    // Detect patterns
    const patterns = detectPatterns(runs, businessFacts);
    console.error(`[pattern_detector] Detected ${patterns.length} patterns`);

    const crystallizable = patterns.filter(p => p.can_crystallize);
    console.error(`[pattern_detector] Crystallizable patterns: ${crystallizable.length}`);

    // Write output
    mkdirSync(outputDir, { recursive: true });
    const dateStr = new Date().toISOString().split('T')[0];
    const outputPath = join(outputDir, `patterns_${dateStr}.json`);

    const result = {
      status: 'success',
      timestamp: new Date().toISOString(),
      since: sinceDate,
      runs_analyzed: runs.length,
      patterns_detected: patterns.length,
      patterns_crystallizable: crystallizable.length,
      patterns
    };

    writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.error(`[pattern_detector] Output written to: ${outputPath}`);

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);

  } catch (error) {
    const result = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'PATTERN_DETECTION_FAILED',
        message: error.message
      }
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

// Only run if directly executed
const isDirectRun = process.argv[1]?.endsWith('pattern_detector_v0.mjs');
if (isDirectRun) {
  main();
}

export { detectPatterns, generatePatternId, getBucketId, hasAllThreeSignals };
