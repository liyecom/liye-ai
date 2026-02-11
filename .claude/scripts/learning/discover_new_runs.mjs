#!/usr/bin/env node
/**
 * Discover New Runs v1.0.0
 * SSOT: .claude/scripts/learning/discover_new_runs.mjs
 *
 * 从 ENGINE_T1_DATA_DIR/data/runs/ 发现增量 runs。
 * 仅选择 engine_id=age + playbook_id=bid_recommend + tier=recommend 的 runs。
 *
 * 用法:
 *   node discover_new_runs.mjs --since <ISO8601> [--json] [--dry-run]
 *
 * 输出 (JSON):
 *   {
 *     "new_run_ids": ["age:bid_recommend:xxx", ...],
 *     "window_start": "2026-02-11T00:00:00Z",
 *     "window_end": "2026-02-11T12:00:00Z",
 *     "filtered_count": 5,
 *     "total_scanned": 20
 *   }
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const ENGINE_T1_DATA_DIR = process.env.ENGINE_T1_DATA_DIR ||
  join(PROJECT_ROOT, '..', 'amazon-growth-engine');

const TARGET_ENGINE_ID = 'age';
const TARGET_PLAYBOOK_ID = 'bid_recommend';
const TARGET_TIER = 'recommend';

function getRunMeta(runDir) {
  const outputPath = join(runDir, 'playbook_output.json');
  if (existsSync(outputPath)) {
    try {
      const output = JSON.parse(readFileSync(outputPath, 'utf-8'));
      return {
        engine_id: output.engine_id,
        playbook_id: output.playbook_id,
        tier: output.tier,
        run_id: output.run_id,
        created_at: output.created_at || statSync(outputPath).mtime.toISOString()
      };
    } catch (e) { /* ignore */ }
  }

  const metaPath = join(runDir, 'meta.json');
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      return {
        engine_id: meta.engine_id,
        playbook_id: meta.playbook_id,
        tier: meta.tier,
        run_id: meta.run_id,
        created_at: meta.created_at || statSync(metaPath).mtime.toISOString()
      };
    } catch (e) { /* ignore */ }
  }

  const dirName = runDir.split('/').pop();
  const parts = dirName.split(':');
  if (parts.length >= 2) {
    return {
      engine_id: parts[0],
      playbook_id: parts[1],
      tier: 'recommend',
      run_id: dirName,
      created_at: statSync(runDir).mtime.toISOString()
    };
  }
  return null;
}

function matchesTarget(meta) {
  if (!meta) return false;
  return (
    meta.engine_id === TARGET_ENGINE_ID &&
    meta.playbook_id === TARGET_PLAYBOOK_ID &&
    meta.tier === TARGET_TIER
  );
}

export function discoverNewRuns(options = {}) {
  const { since, sinceRunId, fixturesDir } = options;

  const runsDir = fixturesDir
    ? join(fixturesDir, 'data', 'runs')
    : join(ENGINE_T1_DATA_DIR, 'data', 'runs');

  if (!existsSync(runsDir)) {
    return {
      new_run_ids: [],
      window_start: since || null,
      window_end: new Date().toISOString(),
      filtered_count: 0,
      total_scanned: 0,
      error: `Runs directory not found: ${runsDir}`
    };
  }

  const allRuns = [];
  let totalScanned = 0;

  try {
    const entries = readdirSync(runsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      totalScanned++;
      const runDir = join(runsDir, entry.name);
      const meta = getRunMeta(runDir);
      if (meta) {
        allRuns.push({
          run_id: meta.run_id || entry.name,
          created_at: meta.created_at,
          meta
        });
      }
    }
  } catch (e) {
    return {
      new_run_ids: [],
      window_start: since || null,
      window_end: new Date().toISOString(),
      filtered_count: 0,
      total_scanned: 0,
      error: `Failed to read runs directory: ${e.message}`
    };
  }

  allRuns.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const sinceTime = since ? new Date(since) : new Date(0);
  const windowEnd = new Date();

  const newRuns = allRuns.filter(run => {
    const runTime = new Date(run.created_at);
    if (runTime <= sinceTime) return false;
    if (sinceRunId && run.run_id === sinceRunId) return false;
    return matchesTarget(run.meta);
  });

  return {
    new_run_ids: newRuns.map(r => r.run_id),
    window_start: since || sinceTime.toISOString(),
    window_end: windowEnd.toISOString(),
    filtered_count: newRuns.length,
    total_scanned: totalScanned
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { since: null, sinceRunId: null, fixturesDir: null, json: false, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--since' && args[i + 1]) options.since = args[++i];
    else if (arg === '--since-run-id' && args[i + 1]) options.sinceRunId = args[++i];
    else if (arg === '--fixtures' && args[i + 1]) options.fixturesDir = args[++i];
    else if (arg === '--json') options.json = true;
    else if (arg === '--dry-run') options.dryRun = true;
  }
  return options;
}

function main() {
  const options = parseArgs();
  const result = discoverNewRuns({
    since: options.since,
    sinceRunId: options.sinceRunId,
    fixturesDir: options.fixturesDir
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Discovered ${result.filtered_count} new runs (scanned ${result.total_scanned})`);
    if (result.error) console.error(`Error: ${result.error}`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) main();
