#!/usr/bin/env node
/**
 * Playbook Runner v1.0.0
 * SSOT: .claude/scripts/proactive/playbook_runner.mjs
 *
 * OS 统一 Playbook 调用入口：
 * - subprocess 调用 AGE 的 python entrypoint
 * - 输出符合 playbook_io.schema.yaml
 * - 不引入 OS-Engine 耦合
 *
 * 运行方式:
 *   node .claude/scripts/proactive/playbook_runner.mjs \
 *     --playbook alert_score \
 *     --input '{"alert_id":"xyz"}' \
 *     --bundle /path/to/bundle.tgz \
 *     --engine /path/to/amazon-growth-engine
 *
 * 输出: playbook_io.json（stdout）
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const CONTRACTS_DIR = join(PROJECT_ROOT, '_meta', 'contracts');
const TRACES_DIR = join(PROJECT_ROOT, 'data', 'traces');

// ===============================================================
// 默认配置
// ===============================================================

const DEFAULT_CONFIG = {
  enginePath: process.env.AGE_ENGINE_PATH || join(PROJECT_ROOT, '..', 'amazon-growth-engine'),
  bundlePath: process.env.LEARNED_BUNDLE_PATH || null,
  timeout: 60000,  // 60 秒超时
  pythonPath: 'python3',
  // 安全配置
  enforceRegistry: process.env.PLAYBOOK_ENFORCE_REGISTRY !== 'false',  // 默认启用注册表校验
  allowedPlaybookPattern: /^[a-z][a-z0-9_]*$/  // 只允许小写字母、数字、下划线
};

// ===============================================================
// 安全：Playbook 注册表校验
// ===============================================================

/**
 * 加载 engine_manifest.yaml（如果存在）
 * @returns {{ playbooks: Array<{id: string, entrypoint: string}> } | null}
 */
function loadEngineManifest(enginePath) {
  const manifestPath = join(enginePath, 'engine_manifest.yaml');

  if (!existsSync(manifestPath)) {
    console.warn(`[PlaybookRunner] WARNING: No engine_manifest.yaml found at ${manifestPath}`);
    return null;
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    return parseYaml(content);
  } catch (e) {
    console.error(`[PlaybookRunner] ERROR: Failed to parse engine_manifest.yaml: ${e.message}`);
    return null;
  }
}

/**
 * 验证 playbook_id 是否在注册表中
 * @returns {{ valid: boolean, error?: string, entrypoint?: string }}
 */
function validatePlaybookRegistry(playbookId, enginePath) {
  // 1. 基础格式校验（防止路径注入）
  if (!DEFAULT_CONFIG.allowedPlaybookPattern.test(playbookId)) {
    return {
      valid: false,
      error: `Invalid playbook_id format: ${playbookId}. Must match ${DEFAULT_CONFIG.allowedPlaybookPattern}`
    };
  }

  // 2. 检查是否包含危险字符
  if (playbookId.includes('..') || playbookId.includes('/') || playbookId.includes('\\')) {
    return {
      valid: false,
      error: `Playbook_id contains path traversal characters: ${playbookId}`
    };
  }

  // 3. 如果不强制注册表校验，跳过
  if (!DEFAULT_CONFIG.enforceRegistry) {
    console.warn(`[PlaybookRunner] WARNING: Registry enforcement disabled, allowing ${playbookId}`);
    return { valid: true };
  }

  // 4. 加载 manifest 并校验
  const manifest = loadEngineManifest(enginePath);

  if (!manifest) {
    // 无 manifest 但强制校验 → 拒绝
    return {
      valid: false,
      error: 'No engine_manifest.yaml found but registry enforcement is enabled'
    };
  }

  if (!manifest.playbooks || !Array.isArray(manifest.playbooks)) {
    return {
      valid: false,
      error: 'engine_manifest.yaml has no playbooks array'
    };
  }

  // 5. 查找匹配的 playbook
  const registeredPlaybook = manifest.playbooks.find(p => p.id === playbookId);

  if (!registeredPlaybook) {
    const availablePlaybooks = manifest.playbooks.map(p => p.id).join(', ');
    return {
      valid: false,
      error: `Playbook '${playbookId}' not in registry. Available: [${availablePlaybooks}]`
    };
  }

  return {
    valid: true,
    entrypoint: registeredPlaybook.entrypoint
  };
}

// ===============================================================
// 工具函数
// ===============================================================

/**
 * 计算对象 SHA256（canonical JSON - key 排序）
 */
function hashObject(obj) {
  const json = canonicalJSON(obj);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * 生成 canonical JSON（递归 key 排序）
 * 确保同一输入始终产生相同 hash
 */
function canonicalJSON(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalJSON(item)).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => {
    return JSON.stringify(key) + ':' + canonicalJSON(obj[key]);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * 生成规范化 run_id
 * 格式: {engine_id}:{playbook_id}:{inputs_hash_short}:{timestamp}
 */
function generateRunId(engineId = 'age', playbookId = 'unknown', inputsHash = null) {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);  // YYYYMMDDHHmmss
  const hashShort = inputsHash ? inputsHash.slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${engineId}:${playbookId}:${hashShort}:${ts}`;
}

/**
 * 简化 run_id（用于文件名等场景）
 * 将 : 替换为 -，避免文件系统问题
 */
function sanitizeRunId(runId) {
  return runId.replace(/:/g, '-');
}

/**
 * 加载 playbook_io schema
 */
function loadSchema() {
  const schemaPath = join(CONTRACTS_DIR, 'playbook', 'playbook_io.schema.yaml');
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema not found: ${schemaPath}`);
  }
  return parseYaml(readFileSync(schemaPath, 'utf-8'));
}

/**
 * 验证输出是否符合 schema（基础校验）
 */
function validateOutput(output, schema) {
  const errors = [];

  // 检查必需字段
  const required = schema.required || [];
  for (const field of required) {
    if (!(field in output)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // 检查 outputs.verdict
  if (output.outputs) {
    const validVerdicts = ['OK', 'WARN', 'CRIT'];
    if (!validVerdicts.includes(output.outputs.verdict)) {
      errors.push(`Invalid verdict: ${output.outputs.verdict}`);
    }

    // 检查 recommendations
    if (!Array.isArray(output.outputs.recommendations)) {
      errors.push('outputs.recommendations must be an array');
    }
  }

  return errors;
}

// ===============================================================
// Playbook Runner
// ===============================================================

/**
 * 运行 playbook
 */
async function runPlaybook(options) {
  const playbookId = options.playbookId;
  const inputs = options.inputs || {};
  const bundlePath = options.bundlePath || DEFAULT_CONFIG.bundlePath;
  const enginePath = options.enginePath || DEFAULT_CONFIG.enginePath;
  const timeout = options.timeout || DEFAULT_CONFIG.timeout;
  const engineId = options.engineId || 'age';

  // 1. 验证 engine 存在
  if (!existsSync(enginePath)) {
    throw new Error(`Engine not found: ${enginePath}`);
  }

  // 2. 安全校验：验证 playbook_id 在注册表中（防止路径注入）
  const registryCheck = validatePlaybookRegistry(playbookId, enginePath);
  if (!registryCheck.valid) {
    throw new Error(`[SECURITY] Playbook registry validation failed: ${registryCheck.error}`);
  }

  // 3. 查找 playbook entrypoint（优先使用 manifest 中的路径）
  let playbookPath;
  if (registryCheck.entrypoint) {
    playbookPath = join(enginePath, registryCheck.entrypoint);
  } else {
    playbookPath = join(enginePath, 'src', 'playbooks', `${playbookId}.py`);
  }

  if (!existsSync(playbookPath)) {
    throw new Error(`Playbook not found: ${playbookPath}`);
  }

  // 4. 计算 inputs hash（canonical JSON）
  const inputsHash = hashObject(inputs);

  // 5. 生成规范化 run_id: {engine}:{playbook}:{hash_short}:{ts}
  const runId = options.runId || generateRunId(engineId, playbookId, inputsHash);
  const runIdSanitized = sanitizeRunId(runId);

  console.error(`[PlaybookRunner] Starting playbook: ${playbookId}`);
  console.error(`[PlaybookRunner] Run ID: ${runId}`);
  console.error(`[PlaybookRunner] Inputs hash: ${inputsHash}`);
  console.error(`[PlaybookRunner] Engine path: ${enginePath}`);

  // 5. 构建环境变量
  const env = {
    ...process.env,
    PLAYBOOK_ID: playbookId,
    RUN_ID: runId,
    PYTHONPATH: enginePath
  };

  if (bundlePath) {
    env.LEARNED_BUNDLE_PATH = bundlePath;
  }

  // 6. 构建输入 JSON
  const playbookInput = {
    playbook_id: playbookId,
    run_id: runId,
    inputs: inputs,
    inputs_hash: inputsHash
  };

  // 7. 执行 subprocess
  const startTime = Date.now();

  const result = await new Promise((resolve, reject) => {
    const pythonProcess = spawn(DEFAULT_CONFIG.pythonPath, [playbookPath], {
      cwd: enginePath,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // 发送输入
    pythonProcess.stdin.write(JSON.stringify(playbookInput));
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[PlaybookRunner] ${data.toString().trim()}`);
    });

    // 设置超时
    const timeoutId = setTimeout(() => {
      pythonProcess.kill('SIGTERM');
      reject(new Error(`Playbook timeout after ${timeout}ms`));
    }, timeout);

    pythonProcess.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code !== 0) {
        reject(new Error(`Playbook exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const output = JSON.parse(stdout);
        resolve(output);
      } catch (e) {
        reject(new Error(`Failed to parse playbook output: ${e.message}\nStdout: ${stdout}`));
      }
    });

    pythonProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to spawn playbook: ${err.message}`));
    });
  });

  const executionTime = Date.now() - startTime;

  // 8. 构建完整的 playbook_io 输出
  const playbookOutput = {
    playbook_id: playbookId,
    run_id: runId,
    timestamp: new Date().toISOString(),
    engine_id: engineId,
    inputs: {
      hash: inputsHash,
      data: inputs
    },
    outputs: {
      verdict: result.verdict || result.outputs?.verdict || 'OK',
      recommendations: result.recommendations || result.outputs?.recommendations || [],
      evidence_package_ref: result.evidence_package_ref || result.outputs?.evidence_package_ref || `data/traces/${runIdSanitized}/evidence/`,
      success_signal_hooks: result.success_signal_hooks || result.outputs?.success_signal_hooks || null,
      metadata: {
        execution_time_ms: executionTime,
        api_calls: result.api_calls || 0,
        bundle_version: bundlePath ? 'loaded' : null
      }
    },
    status: 'success'
  };

  // 9. 验证输出
  const schema = loadSchema();
  const validationErrors = validateOutput(playbookOutput, schema);

  if (validationErrors.length > 0) {
    console.error(`[PlaybookRunner] Validation warnings: ${validationErrors.join(', ')}`);
  }

  // 10. 保存 trace（使用 sanitized run_id 作为目录名）
  const traceDir = join(TRACES_DIR, runIdSanitized);
  if (!existsSync(traceDir)) {
    mkdirSync(traceDir, { recursive: true });
  }

  const tracePath = join(traceDir, 'playbook_io.json');
  writeFileSync(tracePath, JSON.stringify(playbookOutput, null, 2));
  console.error(`[PlaybookRunner] Trace saved: ${tracePath}`);

  // 11. 创建 Evidence Package（真实落地，非占位）
  const evidenceDir = join(traceDir, 'evidence');
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  // 11a. inputs.json（canonical JSON）
  const inputsPath = join(evidenceDir, 'inputs.json');
  writeFileSync(inputsPath, JSON.stringify({
    canonical_json: canonicalJSON(inputs),
    hash: inputsHash,
    raw: inputs,
    timestamp: new Date().toISOString()
  }, null, 2));

  // 11b. outputs.json
  const outputsPath = join(evidenceDir, 'outputs.json');
  writeFileSync(outputsPath, JSON.stringify({
    verdict: playbookOutput.outputs.verdict,
    recommendations: playbookOutput.outputs.recommendations,
    metadata: playbookOutput.outputs.metadata,
    timestamp: new Date().toISOString()
  }, null, 2));

  // 11c. manifest.json（evidence 包清单）
  const manifestPath = join(evidenceDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify({
    run_id: runId,
    engine_id: engineId,
    playbook_id: playbookId,
    created_at: new Date().toISOString(),
    files: [
      { name: 'inputs.json', purpose: 'canonical inputs with hash' },
      { name: 'outputs.json', purpose: 'playbook outputs and recommendations' },
      { name: 'operator_signal.json', purpose: 'operator feedback (if any)', optional: true }
    ]
  }, null, 2));

  console.error(`[PlaybookRunner] Evidence package created: ${evidenceDir}`);
  console.error(`[PlaybookRunner] Completed in ${executionTime}ms`);

  return playbookOutput;
}

// ===============================================================
// CLI 入口
// ===============================================================

function parseArgs(args) {
  const result = {
    playbookId: null,
    inputs: {},
    bundlePath: null,
    enginePath: null,
    runId: null
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--playbook':
      case '-p':
        result.playbookId = args[++i];
        break;
      case '--input':
      case '-i':
        result.inputs = JSON.parse(args[++i]);
        break;
      case '--bundle':
      case '-b':
        result.bundlePath = args[++i];
        break;
      case '--engine':
      case '-e':
        result.enginePath = args[++i];
        break;
      case '--run-id':
        result.runId = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Playbook Runner - OS unified playbook execution

Usage:
  node playbook_runner.mjs --playbook <id> [options]

Options:
  --playbook, -p  Playbook ID (required)
  --input, -i     Input JSON (default: {})
  --bundle, -b    Learned bundle path
  --engine, -e    Engine path (default: ../amazon-growth-engine)
  --run-id        Custom run ID (default: auto-generated)
  --help, -h      Show this help

Examples:
  node playbook_runner.mjs -p alert_score -i '{"alert_id":"xyz"}'
  node playbook_runner.mjs -p anomaly_detect -i '{"asin":"B0C5Q8L7FP"}' -b ./bundle.tgz
`);
        process.exit(0);
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.playbookId) {
    console.error('Error: --playbook is required');
    process.exit(1);
  }

  try {
    const result = await runPlaybook({
      playbookId: options.playbookId,
      inputs: options.inputs,
      bundlePath: options.bundlePath,
      enginePath: options.enginePath,
      runId: options.runId
    });

    // 输出 JSON 到 stdout
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(`[PlaybookRunner] Error: ${e.message}`);

    // 输出错误格式
    const errorOutput = {
      playbook_id: options.playbookId,
      run_id: options.runId || generateRunId(),
      timestamp: new Date().toISOString(),
      status: 'failed',
      error: {
        code: 'INTERNAL_ERROR',
        message: e.message
      }
    };

    console.log(JSON.stringify(errorOutput, null, 2));
    process.exit(1);
  }
}

// 导出供其他模块使用
export { runPlaybook, generateRunId, hashObject, canonicalJSON, sanitizeRunId, validatePlaybookRegistry, loadEngineManifest };

// 直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
