#!/usr/bin/env node
/**
 * Learning Pipeline v0.1 Runner
 * SSOT: .claude/scripts/learning/learning_pipeline_v0_runner.mjs
 *
 * 顺序执行学习流水线：pattern_detector → policy_crystallizer → promotion
 *
 * 用法:
 *   node learning_pipeline_v0_runner.mjs [--window-start ISO8601] [--window-end ISO8601] [--dry-run] [--json]
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const SCRIPTS = {
  patternDetector: join(__dirname, 'pattern_detector_v0.mjs'),
  policyCrystallizer: join(__dirname, 'policy_crystallizer_v0.mjs'),
  promotion: join(__dirname, 'promotion_v0.mjs')
};

const PATTERNS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'learning', 'patterns');
const SANDBOX_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies', 'sandbox');
const CANDIDATE_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies', 'candidate');

function runScript(scriptPath, args = [], options = {}) {
  const { dryRun = false, timeout = 60000 } = options;
  const fullArgs = [...args];
  if (dryRun) fullArgs.push('--dry-run');

  try {
    const result = execSync(`node "${scriptPath}" ${fullArgs.join(' ')}`, {
      cwd: PROJECT_ROOT,
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { status: 'success', output: result.trim() };
  } catch (error) {
    return { status: 'error', error: error.message, output: error.stdout || error.stderr || '' };
  }
}

function getLatestPatterns() {
  if (!existsSync(PATTERNS_DIR)) return { patterns: [], file: null };
  const files = readdirSync(PATTERNS_DIR)
    .filter(f => f.startsWith('patterns_') && f.endsWith('.json'))
    .sort().reverse();
  if (files.length === 0) return { patterns: [], file: null };
  const latestFile = join(PATTERNS_DIR, files[0]);
  try {
    const data = JSON.parse(readFileSync(latestFile, 'utf-8'));
    return { patterns: data.patterns || [], file: files[0] };
  } catch (e) {
    return { patterns: [], file: files[0], error: e.message };
  }
}

function countPolicies(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => f.endsWith('.yaml')).length;
}

export function runLearningPipeline(options = {}) {
  const { windowStart, windowEnd, dryRun = false } = options;

  const result = {
    status: 'success',
    stages: {
      pattern_detector: { status: 'pending', patterns_count: 0 },
      policy_crystallizer: { status: 'pending', policies_generated: 0 },
      promotion: { status: 'pending', promotions: 0 }
    },
    window: { start: windowStart, end: windowEnd },
    dry_run: dryRun,
    error: null
  };

  const sandboxBefore = countPolicies(SANDBOX_DIR);
  const candidateBefore = countPolicies(CANDIDATE_DIR);

  // Stage 1: Pattern Detector
  console.error('[pipeline] Stage 1: Pattern Detector...');
  const patternArgs = [];
  if (windowStart) patternArgs.push('--since', windowStart.split('T')[0]);
  const patternResult = runScript(SCRIPTS.patternDetector, patternArgs, { dryRun });

  if (patternResult.status === 'error') {
    result.status = 'error';
    result.stages.pattern_detector.status = 'error';
    result.error = `Pattern detector failed: ${patternResult.error}`;
    return result;
  }

  const patternsData = getLatestPatterns();
  result.stages.pattern_detector = {
    status: 'success',
    patterns_count: patternsData.patterns.length,
    patterns_file: patternsData.file
  };

  // Stage 2: Policy Crystallizer
  console.error('[pipeline] Stage 2: Policy Crystallizer...');
  const crystallizerResult = runScript(SCRIPTS.policyCrystallizer, [], { dryRun });

  if (crystallizerResult.status === 'error') {
    result.status = 'error';
    result.stages.policy_crystallizer.status = 'error';
    result.error = `Policy crystallizer failed: ${crystallizerResult.error}`;
    return result;
  }

  const sandboxAfter = countPolicies(SANDBOX_DIR);
  result.stages.policy_crystallizer = {
    status: 'success',
    policies_generated: sandboxAfter - sandboxBefore
  };

  // Stage 3: Promotion
  console.error('[pipeline] Stage 3: Promotion...');
  const promotionResult = runScript(SCRIPTS.promotion, [], { dryRun });

  if (promotionResult.status === 'error') {
    result.status = 'error';
    result.stages.promotion.status = 'error';
    result.error = `Promotion failed: ${promotionResult.error}`;
    return result;
  }

  const candidateAfter = countPolicies(CANDIDATE_DIR);
  result.stages.promotion = {
    status: 'success',
    promotions: candidateAfter - candidateBefore
  };

  console.error('[pipeline] All stages completed successfully.');
  return result;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { windowStart: null, windowEnd: null, dryRun: false, json: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--window-start' && args[i + 1]) options.windowStart = args[++i];
    else if (arg === '--window-end' && args[i + 1]) options.windowEnd = args[++i];
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
  }
  return options;
}

function main() {
  const options = parseArgs();
  const result = runLearningPipeline({
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\n=== Learning Pipeline Results ===');
    console.log(`Status: ${result.status}`);
    if (result.error) console.log(`Error: ${result.error}`);
  }
  process.exit(result.status === 'success' ? 0 : 1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) main();
