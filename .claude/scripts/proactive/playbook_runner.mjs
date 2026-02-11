#!/usr/bin/env node
/**
 * Playbook Runner v1.0.0
 * SSOT: .claude/scripts/proactive/playbook_runner.mjs
 *
 * 执行 AGE Playbooks，生成 Evidence Package v1 四件套：
 * - inputs.json: 规范化输入 (canonical JSON + hash)
 * - playbook_io.json: playbook 完整输出
 * - operator_signal.json: operator 决策 (初始为 awaiting)
 * - meta.json: 执行元数据
 *
 * 用法：
 *   node playbook_runner.mjs --engine age --playbook anomaly_detect --inputs '{"asin":"B0TEST"}'
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const RUNS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'runs');
const FACTS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'facts');
const FACTS_FILE = join(FACTS_DIR, 'fact_run_outcomes.jsonl');

const AGE_ROOT = process.env.AGE_ROOT || join(PROJECT_ROOT, '..', 'amazon-growth-engine');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const ENGINE_ALIASES = {
  'age': 'amazon-growth-engine',
  'amazon-growth-engine': 'amazon-growth-engine'
};

function canonicalJson(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort(), 0);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function generateRunId(engine, playbook, inputsHash) {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const hashShort = inputsHash.slice(0, 8);
  return `${engine}:${playbook}:${hashShort}:${ts}`;
}

function validatePlaybookRegistry(engineId, playbookId) {
  const manifestPath = join(AGE_ROOT, 'engine_manifest.yaml');

  if (!existsSync(manifestPath)) {
    console.warn(`${YELLOW}[PlaybookRunner] Warning: engine_manifest.yaml not found${RESET}`);
    return true;
  }

  const manifest = parseYaml(readFileSync(manifestPath, 'utf-8'));
  const normalizedEngineId = ENGINE_ALIASES[engineId] || engineId;

  if (manifest.engine_id !== normalizedEngineId) {
    throw new Error(`Engine ID mismatch: expected ${manifest.engine_id}, got ${normalizedEngineId}`);
  }

  const playbooks = manifest.playbooks || [];
  const found = playbooks.find(p => p.id === playbookId);

  if (!found) {
    throw new Error(`Playbook ${playbookId} not registered in engine_manifest.yaml`);
  }

  return found;
}

async function runPlaybook(engineId, playbookId, inputs, options = {}) {
  const startTime = Date.now();
  const createdAt = new Date().toISOString();

  const canonicalInputs = canonicalJson(inputs);
  const inputsHash = sha256(canonicalInputs);
  const runId = options.runId || generateRunId(engineId, playbookId, inputsHash);
  const runIdSanitized = runId.replace(/:/g, '-');

  console.log(`${CYAN}[PlaybookRunner] Starting: ${runId}${RESET}`);

  try {
    validatePlaybookRegistry(engineId, playbookId);
  } catch (e) {
    console.error(`${RED}[PlaybookRunner] Validation error: ${e.message}${RESET}`);
    throw e;
  }

  // Get bundle version
  let bundleVersion = null;
  try {
    const bundleDir = join(PROJECT_ROOT, 'state', 'artifacts', 'learned-bundles');
    if (existsSync(bundleDir)) {
      const manifestFiles = readdirSync(bundleDir).filter(f => f.endsWith('.manifest.json'));
      if (manifestFiles.length > 0) {
        const latestManifest = manifestFiles.sort().pop();
        const manifest = JSON.parse(readFileSync(join(bundleDir, latestManifest), 'utf-8'));
        bundleVersion = manifest.bundle_version;
      }
    }
  } catch (e) {
    console.warn(`${YELLOW}[PlaybookRunner] Could not determine bundle version${RESET}`);
  }

  // Create Evidence Package directory
  const runDir = join(RUNS_DIR, runIdSanitized);
  mkdirSync(runDir, { recursive: true });
  mkdirSync(FACTS_DIR, { recursive: true });

  // Save inputs.json
  const inputsData = {
    canonical_json: canonicalInputs,
    hash: inputsHash,
    raw: inputs,
    timestamp: createdAt
  };
  writeFileSync(join(runDir, 'inputs.json'), JSON.stringify(inputsData, null, 2));

  // Execute playbook
  let playbookOutput = null;
  let execError = null;

  try {
    const playbookPath = join(AGE_ROOT, 'src', 'playbooks', `${playbookId}.py`);

    if (!existsSync(playbookPath)) {
      throw new Error(`Playbook not found: ${playbookPath}`);
    }

    const result = execSync(
      `python3 "${playbookPath}"`,
      {
        cwd: AGE_ROOT,
        input: JSON.stringify({ inputs, run_id: runId }),
        encoding: 'utf-8',
        timeout: 60000,
        env: { ...process.env, PYTHONPATH: AGE_ROOT }
      }
    );

    playbookOutput = JSON.parse(result.trim());
  } catch (e) {
    execError = e.message;
    playbookOutput = { error: e.message };
  }

  const executionTimeMs = Date.now() - startTime;

  // Validate output
  const validationErrors = [];
  if (playbookOutput && !playbookOutput.error) {
    const outputs = playbookOutput.outputs || playbookOutput;

    if (!outputs.verdict || !['OK', 'WARN', 'CRIT'].includes(outputs.verdict)) {
      validationErrors.push('Invalid or missing verdict');
    }

    if (!Array.isArray(outputs.recommendations)) {
      validationErrors.push('recommendations must be an array');
    } else {
      outputs.recommendations.forEach((rec, i) => {
        if (!rec.action_type) validationErrors.push(`recommendations[${i}].action_type required`);
        if (!rec.dry_run_result) validationErrors.push(`recommendations[${i}].dry_run_result required`);
      });
    }
  }

  // Save playbook_io.json
  writeFileSync(join(runDir, 'playbook_io.json'), JSON.stringify({
    run_id: runId,
    playbook_id: playbookId,
    inputs_hash: inputsHash,
    output: playbookOutput,
    validation_errors: validationErrors,
    executed_at: createdAt
  }, null, 2));

  // Save operator_signal.json
  writeFileSync(join(runDir, 'operator_signal.json'), JSON.stringify({
    run_id: runId,
    status: 'awaiting_decision',
    awaiting_decision: true,
    decision: null,
    decided_by: null,
    decided_at: null,
    signature: null
  }, null, 2));

  // Save meta.json
  const metaData = {
    run_id: runId,
    engine_id: engineId,
    playbook_id: playbookId,
    created_at: createdAt,
    bundle_version: bundleVersion,
    schema_version: '1.0.0',
    inputs_hash: inputsHash,
    exec_success: !execError && validationErrors.length === 0,
    execution_time_ms: executionTimeMs
  };
  writeFileSync(join(runDir, 'meta.json'), JSON.stringify(metaData, null, 2));

  // Write to fact_run_outcomes.jsonl
  const factRecord = {
    run_id: runId,
    timestamp: createdAt,
    exec_success: !execError && validationErrors.length === 0,
    operator_decision: 'none',
    business_probe_status: 'pending',
    business_probe_value: null,
    measured_at: null
  };
  appendFileSync(FACTS_FILE, JSON.stringify(factRecord) + '\n');

  console.log(`${GREEN}[PlaybookRunner] Evidence Package v1 created: ${runDir}${RESET}`);
  console.log(`[PlaybookRunner] Fact recorded: exec_success=${metaData.exec_success}`);

  return { runId, runDir, meta: metaData };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { engine: null, playbook: null, inputs: {} };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--engine' && args[i + 1]) result.engine = args[++i];
    else if (args[i] === '--playbook' && args[i + 1]) result.playbook = args[++i];
    else if (args[i] === '--inputs' && args[i + 1]) result.inputs = JSON.parse(args[++i]);
  }

  return result;
}

async function main() {
  const args = parseArgs();

  if (!args.engine || !args.playbook) {
    console.log('Usage: node playbook_runner.mjs --engine <id> --playbook <id> --inputs <json>');
    process.exit(1);
  }

  try {
    const result = await runPlaybook(args.engine, args.playbook, args.inputs);
    console.log(JSON.stringify(result.meta, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(`${RED}Error: ${e.message}${RESET}`);
    process.exit(1);
  }
}

export { runPlaybook, canonicalJson, sha256, generateRunId };

main();
