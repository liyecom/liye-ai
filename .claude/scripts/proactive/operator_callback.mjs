#!/usr/bin/env node
/**
 * Operator Callback Handler v1.0.0
 * SSOT: .claude/scripts/proactive/operator_callback.mjs
 *
 * 处理飞书卡片按钮点击的 callback。
 *
 * 功能:
 * - HMAC-SHA256 签名验证
 * - 幂等性保证（重复 callback 返回 409）
 * - 写入 operator_signal.json
 * - 追加写入 facts (append-only)
 *
 * Callback 协议 v1:
 * - run_id: string (必填)
 * - decision: 'approve' | 'reject' (必填)
 * - action_taken: 'applied' | 'not_applied' | 'n/a' (必填)
 * - applied_at: ISO8601 (仅 action_taken='applied' 时必填)
 * - operator_source: 'feishu' | 'cli' | 'backfill' (必填)
 * - operator_id: string (可选，飞书 user_id)
 * - note: string (可选)
 * - sig: HMAC-SHA256 签名 (必填，header 或 body)
 *
 * 用法 (CLI):
 *   node operator_callback.mjs \
 *     --run-id <run_id> \
 *     --decision approve|reject \
 *     --action_taken applied|not_applied|n/a \
 *     [--applied_at <ISO8601>] \
 *     [--operator_source feishu] \
 *     [--note "..."]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHmac, timingSafeEqual } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// ===============================================================
// 配置
// ===============================================================

const HMAC_SECRET = process.env.OPERATOR_CALLBACK_HMAC_SECRET || 'dev_secret';
const FACTS_DIR = join(PROJECT_ROOT, 'state', 'memory', 'facts');
const FACTS_FILE = join(FACTS_DIR, 'fact_run_outcomes.jsonl');

// 有效的 decision 和 action_taken 值
const VALID_DECISIONS = ['approve', 'reject'];
const VALID_ACTION_TAKEN = ['applied', 'not_applied', 'n/a'];
const VALID_OPERATOR_SOURCES = ['feishu', 'cli', 'backfill', 'api'];

// ===============================================================
// HMAC 验证
// ===============================================================

/**
 * 生成 HMAC 签名
 */
export function generateHmac(payload) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
}

/**
 * 验证 HMAC 签名
 */
export function verifyHmac(payload, signature) {
  const expected = generateHmac(payload);

  // 使用 timingSafeEqual 防止时序攻击
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch (e) {
    return false;
  }
}

// ===============================================================
// Run 目录操作
// ===============================================================

/**
 * 获取 run 目录路径
 */
function getRunDir(runId) {
  // 优先检查 data/runs
  const dataRunDir = join(PROJECT_ROOT, 'data', 'runs', runId);
  if (existsSync(dataRunDir)) {
    return dataRunDir;
  }

  // 回退到 state/runs
  const stateRunDir = join(PROJECT_ROOT, 'state', 'runs', runId);
  if (existsSync(stateRunDir)) {
    return stateRunDir;
  }

  return null;
}

/**
 * 检查 run 是否存在
 */
function runExists(runId) {
  return getRunDir(runId) !== null;
}

/**
 * 获取现有的 operator_signal
 */
function getExistingSignal(runId) {
  const runDir = getRunDir(runId);
  if (!runDir) return null;

  const signalPath = join(runDir, 'operator_signal.json');
  if (!existsSync(signalPath)) return null;

  try {
    return JSON.parse(readFileSync(signalPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * 写入 operator_signal.json
 */
function writeSignal(runId, signal) {
  let runDir = getRunDir(runId);

  // 如果 run 目录不存在，创建在 state/runs
  if (!runDir) {
    runDir = join(PROJECT_ROOT, 'state', 'runs', runId);
    mkdirSync(runDir, { recursive: true });
  }

  const signalPath = join(runDir, 'operator_signal.json');
  writeFileSync(signalPath, JSON.stringify(signal, null, 2));

  return signalPath;
}

// ===============================================================
// Facts 追加写入
// ===============================================================

/**
 * 追加写入 fact
 */
function appendFact(fact) {
  // 确保目录存在
  if (!existsSync(FACTS_DIR)) {
    mkdirSync(FACTS_DIR, { recursive: true });
  }

  // Append-only 写入
  const line = JSON.stringify(fact) + '\n';
  appendFileSync(FACTS_FILE, line);
}

// ===============================================================
// Callback 处理
// ===============================================================

/**
 * 验证 callback 请求
 */
function validateRequest(payload) {
  const errors = [];

  // 必填字段
  if (!payload.run_id) {
    errors.push('run_id is required');
  }

  if (!payload.decision || !VALID_DECISIONS.includes(payload.decision)) {
    errors.push(`decision must be one of: ${VALID_DECISIONS.join(', ')}`);
  }

  if (!payload.action_taken || !VALID_ACTION_TAKEN.includes(payload.action_taken)) {
    errors.push(`action_taken must be one of: ${VALID_ACTION_TAKEN.join(', ')}`);
  }

  if (!payload.operator_source || !VALID_OPERATOR_SOURCES.includes(payload.operator_source)) {
    errors.push(`operator_source must be one of: ${VALID_OPERATOR_SOURCES.join(', ')}`);
  }

  // action_taken='applied' 时必须有 applied_at
  if (payload.action_taken === 'applied' && !payload.applied_at) {
    errors.push('applied_at is required when action_taken is "applied"');
  }

  // applied_at 格式验证
  if (payload.applied_at) {
    const date = new Date(payload.applied_at);
    if (isNaN(date.getTime())) {
      errors.push('applied_at must be a valid ISO8601 date');
    }
  }

  return errors;
}

/**
 * 处理 operator callback
 *
 * @param {Object} payload - Callback payload
 * @param {string} signature - HMAC 签名
 * @returns {Object} { ok, status, message, data? }
 */
export function handleCallback(payload, signature = null) {
  // 1. 验证签名（如果提供）
  if (signature && !verifyHmac(payload, signature)) {
    return {
      ok: false,
      status: 401,
      message: 'Unauthorized: HMAC signature verification failed'
    };
  }

  // 2. 验证请求
  const validationErrors = validateRequest(payload);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      status: 400,
      message: `Bad Request: ${validationErrors.join('; ')}`
    };
  }

  const { run_id, decision, action_taken, applied_at, operator_source, operator_id, note } = payload;

  // 3. 检查 run 是否存在
  if (!runExists(run_id)) {
    return {
      ok: false,
      status: 404,
      message: `Not Found: run_id "${run_id}" does not exist`
    };
  }

  // 4. 幂等性检查
  const existingSignal = getExistingSignal(run_id);
  if (existingSignal) {
    // 如果相同的 decision + action_taken，返回 409
    if (existingSignal.decision === decision && existingSignal.action_taken === action_taken) {
      return {
        ok: false,
        status: 409,
        message: 'Conflict: duplicate callback (same decision + action_taken)',
        data: existingSignal
      };
    }

    // 如果不同，也返回 409（不允许修改）
    return {
      ok: false,
      status: 409,
      message: 'Conflict: operator signal already exists with different decision',
      data: existingSignal
    };
  }

  // 5. 构建 signal 对象
  const now = new Date().toISOString();
  const signal = {
    run_id,
    decision,
    action_taken,
    applied_at: action_taken === 'applied' ? (applied_at || now) : null,
    operator_source,
    operator_id: operator_id || null,
    note: note || null,
    received_at: now
  };

  // 6. 写入 operator_signal.json
  const signalPath = writeSignal(run_id, signal);

  // 7. 追加写入 fact
  const fact = {
    event_type: 'operator_signal',
    run_id,
    decision,
    action_taken,
    applied_at: signal.applied_at,
    operator_source,
    operator_id: signal.operator_id,
    note: signal.note,
    timestamp: now
  };
  appendFact(fact);

  return {
    ok: true,
    status: 200,
    message: 'OK: operator signal recorded',
    data: {
      signal_path: signalPath,
      fact_appended: true
    }
  };
}

// ===============================================================
// HTTP 处理器（供 Express/Hono 等使用）
// ===============================================================

/**
 * HTTP 请求处理器
 *
 * @param {Object} req - HTTP 请求（需要有 body 和 headers）
 * @returns {Object} { status, body }
 */
export function httpHandler(req) {
  const payload = req.body;
  const signature = req.headers?.['x-hmac-signature'] || payload?.sig;

  // 如果没有签名且不是 dev 模式，拒绝
  if (!signature && HMAC_SECRET !== 'dev_secret') {
    return {
      status: 401,
      body: { ok: false, message: 'Unauthorized: HMAC signature required' }
    };
  }

  const result = handleCallback(payload, signature);

  return {
    status: result.status,
    body: {
      ok: result.ok,
      message: result.message,
      data: result.data
    }
  };
}

// ===============================================================
// CLI
// ===============================================================

async function main() {
  const args = process.argv.slice(2);

  // 解析参数
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '_');
      opts[key] = args[++i];
    }
  }

  // 检查必填参数
  if (!opts.run_id || !opts.decision || !opts.action_taken) {
    console.error(`Usage: node operator_callback.mjs \\
  --run-id <run_id> \\
  --decision approve|reject \\
  --action_taken applied|not_applied|n/a \\
  [--applied_at <ISO8601>] \\
  [--operator_source feishu|cli|backfill] \\
  [--note "..."]`);
    process.exit(1);
  }

  // 构建 payload
  const payload = {
    run_id: opts.run_id,
    decision: opts.decision,
    action_taken: opts.action_taken,
    applied_at: opts.applied_at || (opts.action_taken === 'applied' ? new Date().toISOString() : null),
    operator_source: opts.operator_source || 'cli',
    operator_id: opts.operator_id || null,
    note: opts.note || null
  };

  // 在 CLI 模式下跳过签名验证
  const result = handleCallback(payload, null);

  // 输出结果
  console.log(JSON.stringify(result, null, 2));

  process.exit(result.ok ? 0 : 1);
}

// 如果直接运行
const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}

export default { handleCallback, httpHandler, generateHmac, verifyHmac };
