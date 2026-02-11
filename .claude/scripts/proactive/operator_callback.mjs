#!/usr/bin/env node
/**
 * Operator Callback Handler v1.1.0
 * SSOT: .claude/scripts/proactive/operator_callback.mjs
 *
 * 处理飞书卡片按钮点击的 callback。
 *
 * 功能:
 * - HMAC-SHA256 签名验证
 * - 幂等性保证（run_id + inputs_hash 作为幂等键）
 * - inputs_hash 防串单校验
 * - 速率限制（同一 run_id 1 分钟内最多 3 次）
 * - 写入 operator_signal.json
 * - 追加写入 facts (append-only)
 * - 结构化日志输出
 *
 * Callback 协议 v1.1:
 * - run_id: string (必填)
 * - inputs_hash: string (必填，防串单校验)
 * - decision: 'approve' | 'reject' (必填，严格枚举)
 * - action_taken: 'applied' | 'not_applied' | 'n/a' (必填，严格枚举)
 * - applied_at: ISO8601 (仅 action_taken='applied' 时自动填充)
 * - operator_source: 'feishu' | 'cli' | 'backfill' | 'api' (必填，严格枚举)
 * - operator_id: string (可选，飞书 user_id)
 * - note: string (可选)
 * - sig: HMAC-SHA256 签名 (必填，header 或 body)
 *
 * 用法 (CLI):
 *   node operator_callback.mjs \
 *     --run-id <run_id> \
 *     --inputs-hash <sha256:xxx> \
 *     --decision approve|reject \
 *     --action_taken applied|not_applied|n/a \
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
const RATE_LIMIT_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'rate_limits');
const SECURITY_LOG_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'security_events.jsonl');

// 严格枚举白名单 - 任何未知值直接 400 fail-closed
const VALID_DECISIONS = Object.freeze(['approve', 'reject']);
const VALID_ACTION_TAKEN = Object.freeze(['applied', 'not_applied', 'n/a']);
const VALID_OPERATOR_SOURCES = Object.freeze(['feishu', 'cli', 'backfill', 'api']);

// 速率限制配置
const RATE_LIMIT_WINDOW_MS = 60 * 1000;  // 1 分钟
const RATE_LIMIT_MAX_REQUESTS = 3;       // 每 run_id 最多 3 次

// ===============================================================
// 结构化日志
// ===============================================================

/**
 * 输出结构化日志（不含敏感字段）
 */
function structuredLog(level, event, data) {
  const log = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data
  };
  // 输出到 stderr 避免污染 stdout JSON 输出
  console.error(JSON.stringify(log));
}

/**
 * 记录安全事件（持久化）
 */
function logSecurityEvent(eventType, data) {
  try {
    const dir = dirname(SECURITY_LOG_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const event = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      ...data
    };
    appendFileSync(SECURITY_LOG_FILE, JSON.stringify(event) + '\n');
  } catch (e) {
    // 安全日志失败不应阻塞主流程
    console.error(`[WARN] Failed to log security event: ${e.message}`);
  }
}

// ===============================================================
// 速率限制
// ===============================================================

/**
 * 检查速率限制
 * @returns {Object} { allowed: boolean, remaining: number, resetAt: string }
 */
function checkRateLimit(runId) {
  if (!existsSync(RATE_LIMIT_DIR)) {
    mkdirSync(RATE_LIMIT_DIR, { recursive: true });
  }

  const safeRunId = runId.replace(/[^a-zA-Z0-9_:-]/g, '_');
  const limitFile = join(RATE_LIMIT_DIR, `${safeRunId}.json`);
  const now = Date.now();

  let state = { requests: [], window_start: now };

  if (existsSync(limitFile)) {
    try {
      state = JSON.parse(readFileSync(limitFile, 'utf-8'));
    } catch (e) {
      // 损坏的文件，重置
      state = { requests: [], window_start: now };
    }
  }

  // 清理过期请求
  state.requests = state.requests.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

  // 检查是否超限
  if (state.requests.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestRequest = Math.min(...state.requests);
    const resetAt = new Date(oldestRequest + RATE_LIMIT_WINDOW_MS).toISOString();

    structuredLog('warn', 'rate_limit_exceeded', {
      run_id: runId,
      request_count: state.requests.length,
      reset_at: resetAt
    });

    return {
      allowed: false,
      remaining: 0,
      resetAt
    };
  }

  // 记录本次请求
  state.requests.push(now);
  writeFileSync(limitFile, JSON.stringify(state));

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - state.requests.length,
    resetAt: new Date(now + RATE_LIMIT_WINDOW_MS).toISOString()
  };
}

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
 * @returns {Object} { valid: boolean, mismatch: boolean }
 */
export function verifyHmac(payload, signature) {
  const expected = generateHmac(payload);

  // 使用 timingSafeEqual 防止时序攻击
  try {
    const valid = timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
    return { valid, mismatch: !valid };
  } catch (e) {
    return { valid: false, mismatch: true };
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
 * 获取 run 的 inputs_hash（从 input.json）
 */
function getRunInputsHash(runId) {
  const runDir = getRunDir(runId);
  if (!runDir) return null;

  const inputPath = join(runDir, 'input.json');
  if (!existsSync(inputPath)) return null;

  try {
    const input = JSON.parse(readFileSync(inputPath, 'utf-8'));
    return input.inputs_hash || null;
  } catch (e) {
    return null;
  }
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
 * 验证 callback 请求（严格枚举白名单）
 */
function validateRequest(payload) {
  const errors = [];

  // 必填字段
  if (!payload.run_id) {
    errors.push('run_id is required');
  }

  // inputs_hash 必填（防串单）
  if (!payload.inputs_hash) {
    errors.push('inputs_hash is required (anti-tampering)');
  }

  // 严格枚举验证 - 任何未知值直接 fail-closed
  if (!payload.decision || !VALID_DECISIONS.includes(payload.decision)) {
    errors.push(`decision must be one of: ${VALID_DECISIONS.join(', ')} (got: "${payload.decision}")`);
  }

  if (!payload.action_taken || !VALID_ACTION_TAKEN.includes(payload.action_taken)) {
    errors.push(`action_taken must be one of: ${VALID_ACTION_TAKEN.join(', ')} (got: "${payload.action_taken}")`);
  }

  if (!payload.operator_source || !VALID_OPERATOR_SOURCES.includes(payload.operator_source)) {
    errors.push(`operator_source must be one of: ${VALID_OPERATOR_SOURCES.join(', ')} (got: "${payload.operator_source}")`);
  }

  // Applied_at 语义：action_taken=not_applied 时必须为 null
  if (payload.action_taken === 'not_applied' && payload.applied_at) {
    errors.push('applied_at must be null when action_taken is "not_applied"');
  }

  // applied_at 格式验证（如果提供）
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
 * @param {Object} options - 选项 { skipRateLimit: boolean }
 * @returns {Object} { ok, status, message, data? }
 */
export function handleCallback(payload, signature = null, options = {}) {
  const startTime = Date.now();

  // 1. 验证签名（如果提供）
  if (signature) {
    const hmacResult = verifyHmac(payload, signature);
    if (!hmacResult.valid) {
      // 记录签名失败（用于异常监控）
      logSecurityEvent('hmac_mismatch', {
        run_id: payload.run_id || 'unknown',
        operator_source: payload.operator_source || 'unknown'
      });

      structuredLog('warn', 'callback_hmac_failed', {
        run_id: payload.run_id,
        status_code: 401
      });

      return {
        ok: false,
        status: 401,
        message: 'Unauthorized: HMAC signature verification failed'
      };
    }
  }

  // 2. 验证请求（严格枚举白名单）
  const validationErrors = validateRequest(payload);
  if (validationErrors.length > 0) {
    structuredLog('info', 'callback_validation_failed', {
      run_id: payload.run_id,
      errors: validationErrors,
      status_code: 400
    });

    return {
      ok: false,
      status: 400,
      message: `Bad Request: ${validationErrors.join('; ')}`
    };
  }

  const { run_id, inputs_hash, decision, action_taken, operator_source, operator_id, note } = payload;

  // 3. 速率限制检查
  if (!options.skipRateLimit) {
    const rateLimit = checkRateLimit(run_id);
    if (!rateLimit.allowed) {
      return {
        ok: false,
        status: 429,
        message: `Too Many Requests: rate limit exceeded for run_id "${run_id}"`,
        data: {
          retry_after: rateLimit.resetAt,
          remaining: rateLimit.remaining
        }
      };
    }
  }

  // 4. 检查 run 是否存在
  if (!runExists(run_id)) {
    structuredLog('info', 'callback_run_not_found', {
      run_id,
      status_code: 404
    });

    return {
      ok: false,
      status: 404,
      message: `Not Found: run_id "${run_id}" does not exist`
    };
  }

  // 5. 防串单校验：验证 inputs_hash 匹配
  const storedInputsHash = getRunInputsHash(run_id);
  if (storedInputsHash && storedInputsHash !== inputs_hash) {
    logSecurityEvent('inputs_hash_mismatch', {
      run_id,
      expected_hash: storedInputsHash,
      received_hash: inputs_hash,
      operator_source
    });

    structuredLog('warn', 'callback_inputs_hash_mismatch', {
      run_id,
      expected_hash: storedInputsHash?.slice(0, 16) + '...',
      received_hash: inputs_hash?.slice(0, 16) + '...',
      status_code: 400
    });

    return {
      ok: false,
      status: 400,
      message: `Bad Request: inputs_hash mismatch (anti-tampering protection)`
    };
  }

  // 6. 幂等性检查（run_id + inputs_hash 作为幂等键）
  const existingSignal = getExistingSignal(run_id);
  if (existingSignal) {
    // 如果相同的 decision + action_taken，返回 409
    if (existingSignal.decision === decision && existingSignal.action_taken === action_taken) {
      structuredLog('info', 'callback_duplicate', {
        run_id,
        decision,
        action_taken,
        status_code: 409
      });

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

  // 7. 构建 signal 对象（Applied_at 语义固定）
  const now = new Date().toISOString();
  const signal = {
    run_id,
    inputs_hash,
    decision,
    action_taken,
    // Applied_at 语义：
    // - action_taken='applied': applied_at = now(), applied_at_source = 'click_time'
    // - action_taken='not_applied' 或 'n/a': applied_at = null
    applied_at: action_taken === 'applied' ? now : null,
    applied_at_source: action_taken === 'applied' ? 'click_time' : null,
    operator_source,
    operator_id: operator_id || null,
    note: note || null,
    received_at: now,
    protocol_version: '1.1'
  };

  // 8. 写入 operator_signal.json
  const signalPath = writeSignal(run_id, signal);

  // 9. 追加写入 fact
  const fact = {
    event_type: 'operator_signal',
    run_id,
    inputs_hash,
    decision,
    action_taken,
    applied_at: signal.applied_at,
    applied_at_source: signal.applied_at_source,
    operator_source,
    operator_id: signal.operator_id,
    note: signal.note,
    timestamp: now
  };
  appendFact(fact);

  // 10. 结构化日志（成功）
  const duration = Date.now() - startTime;
  structuredLog('info', 'callback_success', {
    run_id,
    decision,
    action_taken,
    operator_source,
    status_code: 200,
    duration_ms: duration
  });

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
    structuredLog('warn', 'callback_missing_signature', {
      run_id: payload?.run_id || 'unknown'
    });

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
  --inputs-hash <sha256:xxx> \\
  --decision approve|reject \\
  --action_taken applied|not_applied|n/a \\
  [--operator_source feishu|cli|backfill|api] \\
  [--note "..."]`);
    process.exit(1);
  }

  // 构建 payload
  const payload = {
    run_id: opts.run_id,
    inputs_hash: opts.inputs_hash || 'cli-bypass',  // CLI 模式允许跳过
    decision: opts.decision,
    action_taken: opts.action_taken,
    operator_source: opts.operator_source || 'cli',
    operator_id: opts.operator_id || null,
    note: opts.note || null
  };

  // 在 CLI 模式下跳过签名验证和速率限制
  const result = handleCallback(payload, null, { skipRateLimit: true });

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
