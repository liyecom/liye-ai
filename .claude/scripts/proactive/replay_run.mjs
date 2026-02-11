#!/usr/bin/env node
/**
 * Replay Run v1.0.0
 * SSOT: .claude/scripts/proactive/replay_run.mjs
 *
 * 重放 playbook 执行并对比 diff：
 * - 读取原始 inputs.json + meta.json
 * - 使用相同 bundle 版本重新执行 playbook
 * - 对比 recommendations 核心字段变化
 *
 * 用法：
 *   node replay_run.mjs --run-id <run_id>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const RUNS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'runs');
const AGE_ROOT = process.env.AGE_ROOT || join(PROJECT_ROOT, '..', 'amazon-growth-engine');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function loadOriginalRun(runId) {
  const runIdSanitized = runId.replace(/:/g, '-');
  const runDir = join(RUNS_DIR, runIdSanitized);

  if (!existsSync(runDir)) {
    throw new Error(`Run not found: ${runId}`);
  }

  return {
    inputs: JSON.parse(readFileSync(join(runDir, 'inputs.json'), 'utf-8')),
    meta: JSON.parse(readFileSync(join(runDir, 'meta.json'), 'utf-8')),
    playbookIo: JSON.parse(readFileSync(join(runDir, 'playbook_io.json'), 'utf-8')),
    runDir
  };
}

function executePlaybook(playbookId, inputs) {
  const playbookPath = join(AGE_ROOT, 'src', 'playbooks', `${playbookId}.py`);

  if (!existsSync(playbookPath)) {
    throw new Error(`Playbook not found: ${playbookPath}`);
  }

  const result = execSync(
    `python3 "${playbookPath}"`,
    {
      cwd: AGE_ROOT,
      input: JSON.stringify({ inputs }),
      encoding: 'utf-8',
      timeout: 60000,
      env: { ...process.env, PYTHONPATH: AGE_ROOT }
    }
  );

  return JSON.parse(result.trim());
}

function extractRecommendationCore(rec) {
  return {
    action_type: rec.action_type,
    parameters: rec.parameters,
    confidence: rec.confidence
  };
}

function diffRecommendations(original, replayed) {
  const diffs = [];
  const maxLen = Math.max(original.length, replayed.length);

  for (let i = 0; i < maxLen; i++) {
    const origRec = original[i];
    const replayRec = replayed[i];

    if (!origRec && replayRec) {
      diffs.push({ index: i, type: 'added', replayed: extractRecommendationCore(replayRec) });
    } else if (origRec && !replayRec) {
      diffs.push({ index: i, type: 'removed', original: extractRecommendationCore(origRec) });
    } else if (origRec && replayRec) {
      const origJson = JSON.stringify(extractRecommendationCore(origRec));
      const replayJson = JSON.stringify(extractRecommendationCore(replayRec));

      if (origJson !== replayJson) {
        diffs.push({
          index: i,
          type: 'changed',
          original: extractRecommendationCore(origRec),
          replayed: extractRecommendationCore(replayRec)
        });
      }
    }
  }

  return diffs;
}

async function replayRun(runId, options = {}) {
  console.log(`${CYAN}[Replay] Loading original run: ${runId}${RESET}`);

  const original = loadOriginalRun(runId);

  console.log(`[Replay] Engine: ${original.meta.engine_id}`);
  console.log(`[Replay] Playbook: ${original.meta.playbook_id}`);
  console.log(`[Replay] Original bundle: ${original.meta.bundle_version || 'unknown'}`);
  console.log('');

  console.log(`${CYAN}[Replay] Executing playbook...${RESET}`);

  let replayedOutput;
  try {
    replayedOutput = executePlaybook(original.meta.playbook_id, original.inputs.raw);
  } catch (e) {
    console.error(`${RED}[Replay] Execution failed: ${e.message}${RESET}`);
    throw e;
  }

  const originalRecs = original.playbookIo.output?.outputs?.recommendations ||
                       original.playbookIo.output?.recommendations || [];
  const replayedRecs = replayedOutput?.outputs?.recommendations ||
                       replayedOutput?.recommendations || [];

  const diffs = diffRecommendations(originalRecs, replayedRecs);

  // Output
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                     REPLAY DIFF REPORT');
  console.log('═══════════════════════════════════════════════════════════\n');

  const origVerdict = original.playbookIo.output?.outputs?.verdict || original.playbookIo.output?.verdict;
  const replayVerdict = replayedOutput?.outputs?.verdict || replayedOutput?.verdict;

  if (origVerdict === replayVerdict) {
    console.log(`${GREEN}✓ Verdict: ${origVerdict} (unchanged)${RESET}`);
  } else {
    console.log(`${YELLOW}! Verdict changed: ${origVerdict} → ${replayVerdict}${RESET}`);
  }

  console.log('');

  if (diffs.length === 0) {
    console.log(`${GREEN}✓ Recommendations: No changes detected${RESET}`);
  } else {
    console.log(`${YELLOW}! Recommendations: ${diffs.length} difference(s) found${RESET}\n`);
    for (const diff of diffs) {
      if (diff.type === 'added') {
        console.log(`  ${GREEN}+ [${diff.index}] Added: ${diff.replayed.action_type}${RESET}`);
      } else if (diff.type === 'removed') {
        console.log(`  ${RED}- [${diff.index}] Removed: ${diff.original.action_type}${RESET}`);
      } else if (diff.type === 'changed') {
        console.log(`  ${YELLOW}~ [${diff.index}] Changed: ${diff.original.action_type}${RESET}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');

  // Save replay result
  const replayDir = join(original.runDir, 'replays');
  mkdirSync(replayDir, { recursive: true });

  const replayFile = join(replayDir, `replay_${Date.now()}.json`);
  writeFileSync(replayFile, JSON.stringify({
    original_run_id: runId,
    replayed_at: new Date().toISOString(),
    verdict_changed: origVerdict !== replayVerdict,
    diffs_count: diffs.length,
    diffs: diffs,
    replayed_output: replayedOutput
  }, null, 2));

  console.log(`\n[Replay] Report saved: ${replayFile}`);

  return { identical: diffs.length === 0, diffs, replayFile };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { runId: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run-id' && args[i + 1]) result.runId = args[++i];
  }

  return result;
}

async function main() {
  const args = parseArgs();

  if (!args.runId) {
    console.log('Usage: node replay_run.mjs --run-id <run_id>');
    process.exit(1);
  }

  try {
    const result = await replayRun(args.runId);
    if (result.identical) {
      console.log(`\n${GREEN}✓ Replay identical - output is deterministic${RESET}`);
    } else {
      console.log(`\n${YELLOW}! Replay differs - ${result.diffs.length} change(s) detected${RESET}`);
    }
    process.exit(0);
  } catch (e) {
    console.error(`${RED}Error: ${e.message}${RESET}`);
    process.exit(1);
  }
}

export { replayRun, diffRecommendations, loadOriginalRun };

main();
