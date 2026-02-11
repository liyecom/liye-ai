#!/usr/bin/env node
/**
 * Bundle Build on Change v1.0.0
 * SSOT: .claude/scripts/learning/bundle_build_on_change.mjs
 *
 * 检测策略变化并按需构建 bundle
 *
 * 用法:
 *   node bundle_build_on_change.mjs [--base-version <version>] [--dry-run] [--json]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const POLICIES_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies');
const BUNDLES_DIR = join(PROJECT_ROOT, 'state', 'artifacts', 'learned-bundles');
const STATE_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'heartbeat_learning_state.json');
const BUILD_BUNDLE_SCRIPT = join(__dirname, 'build-learned-bundle.mjs');

const BUNDLE_DIRS = ['candidate', 'production'];

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return {
      version: 1,
      enabled: true,
      bundle: { last_content_sha: null, last_version: '0.4.0', last_artifact_path: null }
    };
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state) {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function sha256File(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

function calculateContentSha() {
  const hashes = [];
  for (const dir of BUNDLE_DIRS.sort()) {
    const dirPath = join(POLICIES_DIR, dir);
    if (!existsSync(dirPath)) continue;
    const files = readdirSync(dirPath)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .sort();
    for (const file of files) {
      const filePath = join(dirPath, file);
      const fileHash = sha256File(filePath);
      hashes.push(`${dir}/${file}:${fileHash}`);
    }
  }
  const combined = hashes.join('\n');
  const contentSha = createHash('sha256').update(combined).digest('hex');
  return { content_sha: `sha256:${contentSha}`, files_count: hashes.length, files_detail: hashes };
}

function incrementVersion(version) {
  const parts = version.split('.');
  if (parts.length < 3) return `${version}.1`;
  const patchPart = parts[2].split('-')[0];
  const patch = parseInt(patchPart, 10) || 0;
  return `${parts[0]}.${parts[1]}.${patch + 1}`;
}

function buildBundle(version, dryRun = false) {
  if (dryRun) {
    return { status: 'success', bundle_path: `${BUNDLES_DIR}/learned-bundle_${version}.tgz`, dry_run: true };
  }
  try {
    execSync(`node "${BUILD_BUNDLE_SCRIPT}" "${version}"`, {
      cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 60000
    });
    const bundlePath = join(BUNDLES_DIR, `learned-bundle_${version}.tgz`);
    if (!existsSync(bundlePath)) {
      return { status: 'error', error: `Bundle file not found: ${bundlePath}` };
    }
    return { status: 'success', bundle_path: bundlePath };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

export function buildOnChange(options = {}) {
  const { baseVersion, dryRun = false } = options;
  const state = loadState();
  const { content_sha, files_count } = calculateContentSha();

  const result = {
    status: 'skipped',
    content_sha,
    content_sha_changed: false,
    previous_content_sha: state.bundle.last_content_sha,
    files_count,
    bundle_version: null,
    bundle_path: null,
    error: null
  };

  if (content_sha === state.bundle.last_content_sha) {
    console.error('[bundle] Content SHA unchanged, skipping build.');
    return result;
  }

  result.content_sha_changed = true;
  const effectiveBaseVersion = baseVersion || state.bundle.last_version || '0.4.0';
  const newVersion = incrementVersion(effectiveBaseVersion);
  result.bundle_version = newVersion;

  console.error(`[bundle] Content SHA changed, building ${newVersion}`);

  const buildResult = buildBundle(newVersion, dryRun);
  if (buildResult.status === 'error') {
    result.status = 'error';
    result.error = buildResult.error;
    return result;
  }

  result.status = 'built';
  result.bundle_path = buildResult.bundle_path;

  if (!dryRun) {
    state.bundle.last_content_sha = content_sha;
    state.bundle.last_version = newVersion;
    state.bundle.last_artifact_path = buildResult.bundle_path;
    saveState(state);
  }

  return result;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { baseVersion: null, dryRun: false, json: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--base-version' && args[i + 1]) options.baseVersion = args[++i];
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
  }
  return options;
}

function main() {
  const options = parseArgs();
  const result = buildOnChange({ baseVersion: options.baseVersion, dryRun: options.dryRun });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Status: ${result.status}, Changed: ${result.content_sha_changed}`);
  }
  process.exit(result.status === 'error' ? 1 : 0);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) main();
