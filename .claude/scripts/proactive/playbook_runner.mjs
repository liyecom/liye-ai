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
  pythonPath: 'python3'
};

// ===============================================================
// 工具函数
// ===============================================================

/**
 * 生成 run_id
 */
function generateRunId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8);
  return `run-${dateStr}-${random}`;
}

/**
 * 计算对象 SHA256
 */
function hashObject(obj) {
  const json = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash('sha256').update(json).digest('hex');
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
  const runId = options.runId || generateRunId();
  const timeout = options.timeout || DEFAULT_CONFIG.timeout;

  console.error(`[PlaybookRunner] Starting playbook: ${playbookId}`);
  console.error(`[PlaybookRunner] Run ID: ${runId}`);
  console.error(`[PlaybookRunner] Engine path: ${enginePath}`);

  // 1. 验证 engine 存在
  if (!existsSync(enginePath)) {
    throw new Error(`Engine not found: ${enginePath}`);
  }

  // 2. 查找 playbook entrypoint
  const playbookPath = join(enginePath, 'src', 'playbooks', `${playbookId}.py`);
  if (!existsSync(playbookPath)) {
    throw new Error(`Playbook not found: ${playbookPath}`);
  }

  // 3. 计算 inputs hash
  const inputsHash = hashObject(inputs);

  // 4. 构建环境变量
  const env = {
    ...process.env,
    PLAYBOOK_ID: playbookId,
    RUN_ID: runId,
    PYTHONPATH: enginePath
  };

  if (bundlePath) {
    env.LEARNED_BUNDLE_PATH = bundlePath;
  }

  // 5. 构建输入 JSON
  const playbookInput = {
    playbook_id: playbookId,
    run_id: runId,
    inputs: inputs
  };

  // 6. 执行 subprocess
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

  // 7. 构建完整的 playbook_io 输出
  const playbookOutput = {
    playbook_id: playbookId,
    run_id: runId,
    timestamp: new Date().toISOString(),
    engine_id: 'amazon-growth-engine',
    inputs: {
      hash: inputsHash,
      data: inputs
    },
    outputs: {
      verdict: result.verdict || result.outputs?.verdict || 'OK',
      recommendations: result.recommendations || result.outputs?.recommendations || [],
      evidence_package_ref: result.evidence_package_ref || result.outputs?.evidence_package_ref || `data/traces/${runId}/evidence/`,
      success_signal_hooks: result.success_signal_hooks || result.outputs?.success_signal_hooks || null,
      metadata: {
        execution_time_ms: executionTime,
        api_calls: result.api_calls || 0,
        bundle_version: bundlePath ? 'loaded' : null
      }
    },
    status: 'success'
  };

  // 8. 验证输出
  const schema = loadSchema();
  const validationErrors = validateOutput(playbookOutput, schema);

  if (validationErrors.length > 0) {
    console.error(`[PlaybookRunner] Validation warnings: ${validationErrors.join(', ')}`);
  }

  // 9. 保存 trace
  const traceDir = join(TRACES_DIR, runId);
  if (!existsSync(traceDir)) {
    mkdirSync(traceDir, { recursive: true });
  }

  const tracePath = join(traceDir, 'playbook_io.json');
  writeFileSync(tracePath, JSON.stringify(playbookOutput, null, 2));
  console.error(`[PlaybookRunner] Trace saved: ${tracePath}`);

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
export { runPlaybook, generateRunId, hashObject };

// 直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
