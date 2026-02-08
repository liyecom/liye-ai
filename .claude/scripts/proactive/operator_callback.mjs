#!/usr/bin/env node
/**
 * Operator Callback Handler v1.0.0
 * SSOT: .claude/scripts/proactive/operator_callback.mjs
 *
 * 处理飞书卡片按钮回调，记录 OperatorSuccess 信号。
 * 信号写入：state/runtime/proactive/operator_signals/{run_id}.json
 *
 * 可作为独立服务运行，或被 Dify gateway 调用。
 *
 * 用法:
 *   # 记录批准
 *   node operator_callback.mjs --approve run-20260208-xxx --operator user123
 *
 *   # 记录拒绝
 *   node operator_callback.mjs --reject run-20260208-xxx --operator user123 --note "风险太高"
 *
 *   # 查询信号
 *   node operator_callback.mjs --query run-20260208-xxx
 *
 *   # 作为 HTTP 服务运行（可选）
 *   node operator_callback.mjs --serve --port 8787
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { createHmac, timingSafeEqual } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const SIGNALS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'operator_signals');
const TRACES_DIR = join(PROJECT_ROOT, 'data', 'traces');

// ===============================================================
// 安全配置
// ===============================================================

const SECURITY_CONFIG = {
  // HMAC 密钥（生产环境必须通过环境变量设置）
  hmacSecret: process.env.OPERATOR_CALLBACK_SECRET || 'dev-secret-change-in-production',
  // 签名有效期（秒）
  signatureMaxAge: 300,  // 5 分钟
  // 是否强制验证签名（生产环境应为 true）
  enforceSignature: process.env.OPERATOR_ENFORCE_SIGNATURE === 'true'
};

// ===============================================================
// HMAC 签名验证
// ===============================================================

/**
 * 生成 HMAC 签名
 * 签名内容: timestamp:run_id:decision
 */
export function generateSignature(timestamp, runId, decision) {
  const payload = `${timestamp}:${runId}:${decision}`;
  return createHmac('sha256', SECURITY_CONFIG.hmacSecret)
    .update(payload)
    .digest('hex');
}

/**
 * 验证 HMAC 签名
 * @returns {{ valid: boolean, error?: string }}
 */
export function verifySignature(timestamp, runId, decision, providedSignature) {
  // 检查时间戳是否过期
  const now = Math.floor(Date.now() / 1000);
  const signatureAge = now - parseInt(timestamp, 10);

  if (isNaN(signatureAge) || signatureAge > SECURITY_CONFIG.signatureMaxAge) {
    return { valid: false, error: 'Signature expired or invalid timestamp' };
  }

  if (signatureAge < 0) {
    return { valid: false, error: 'Timestamp is in the future' };
  }

  // 生成预期签名
  const expectedSignature = generateSignature(timestamp, runId, decision);

  // 时间安全比较（防止时序攻击）
  try {
    const providedBuffer = Buffer.from(providedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (providedBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: 'Invalid signature format' };
    }

    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      return { valid: false, error: 'Signature mismatch' };
    }
  } catch (e) {
    return { valid: false, error: 'Invalid signature format' };
  }

  return { valid: true };
}

// ===============================================================
// 幂等性检查
// ===============================================================

/**
 * 检查是否已有最终决定（幂等性）
 * @returns {{ isDuplicate: boolean, existingDecision?: object }}
 */
export function checkIdempotency(runId) {
  const signalPath = join(SIGNALS_DIR, `${runId}.json`);

  if (!existsSync(signalPath)) {
    return { isDuplicate: false };
  }

  const existingData = JSON.parse(readFileSync(signalPath, 'utf-8'));

  // 如果已有 latest 决定，视为重复
  if (existingData.latest) {
    return {
      isDuplicate: true,
      existingDecision: existingData.latest
    };
  }

  return { isDuplicate: false };
}

// ===============================================================
// 信号记录
// ===============================================================

/**
 * 记录 operator 信号（带幂等性检查）
 * @param {string} runId
 * @param {object} signal
 * @param {object} options - { skipIdempotency: boolean, force: boolean }
 * @returns {{ success: boolean, signal?: object, error?: string, existingDecision?: object }}
 */
export function recordSignal(runId, signal, options = {}) {
  if (!existsSync(SIGNALS_DIR)) {
    mkdirSync(SIGNALS_DIR, { recursive: true });
  }

  // 幂等性检查（除非显式跳过或强制覆盖）
  if (!options.skipIdempotency && !options.force) {
    const idempotencyCheck = checkIdempotency(runId);
    if (idempotencyCheck.isDuplicate) {
      console.warn(`[OperatorCallback] IDEMPOTENCY: Duplicate signal for ${runId}, ignoring`);
      return {
        success: false,
        error: 'Duplicate signal - decision already recorded',
        existingDecision: idempotencyCheck.existingDecision
      };
    }
  }

  const signalData = {
    run_id: runId,
    approved: signal.approved,
    operator_id: signal.operatorId || 'unknown',
    timestamp: new Date().toISOString(),
    note: signal.note || null,
    source: signal.source || 'callback',  // 'callback' | 'command'
    metadata: signal.metadata || {}
  };

  const signalPath = join(SIGNALS_DIR, `${runId}.json`);

  // 如果已存在，追加到历史（force 模式）
  let existingData = { signals: [] };
  if (existsSync(signalPath)) {
    existingData = JSON.parse(readFileSync(signalPath, 'utf-8'));
  }

  existingData.signals.push(signalData);
  existingData.latest = signalData;
  existingData.updated_at = signalData.timestamp;

  writeFileSync(signalPath, JSON.stringify(existingData, null, 2));

  // 同时保存到 Evidence Package（如果存在）
  // run_id 可能包含 : 需要 sanitize
  const runIdSanitized = runId.replace(/:/g, '-');
  const evidenceDir = join(TRACES_DIR, runIdSanitized, 'evidence');

  if (existsSync(evidenceDir)) {
    const evidenceSignalPath = join(evidenceDir, 'operator_signal.json');
    writeFileSync(evidenceSignalPath, JSON.stringify(signalData, null, 2));
    console.log(`[OperatorCallback] Signal also saved to evidence: ${evidenceSignalPath}`);
  }

  console.log(`[OperatorCallback] Signal recorded: ${runId} -> ${signal.approved ? 'APPROVED' : 'REJECTED'}`);

  return { success: true, signal: signalData };
}

/**
 * 查询 operator 信号
 */
export function querySignal(runId) {
  const signalPath = join(SIGNALS_DIR, `${runId}.json`);

  if (!existsSync(signalPath)) {
    return null;
  }

  return JSON.parse(readFileSync(signalPath, 'utf-8'));
}

/**
 * 获取所有信号统计
 */
export function getSignalStats() {
  if (!existsSync(SIGNALS_DIR)) {
    return { total: 0, approved: 0, rejected: 0, approval_rate: 0 };
  }

  const files = readdirSync(SIGNALS_DIR).filter(f => f.endsWith('.json'));

  let approved = 0;
  let rejected = 0;

  for (const file of files) {
    const data = JSON.parse(readFileSync(join(SIGNALS_DIR, file), 'utf-8'));
    if (data.latest?.approved) {
      approved++;
    } else {
      rejected++;
    }
  }

  const total = approved + rejected;
  const approvalRate = total > 0 ? approved / total : 0;

  return {
    total,
    approved,
    rejected,
    approval_rate: Math.round(approvalRate * 100) / 100
  };
}

// ===============================================================
// HTTP 服务（可选）
// ===============================================================

function createCallbackServer(port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // POST /callback/operator - 处理飞书卡片回调
    if (req.method === 'POST' && url.pathname === '/callback/operator') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      try {
        const data = JSON.parse(body);

        // 飞书卡片回调格式
        const action = data.action?.value ? JSON.parse(data.action.value) : data;
        const runId = action.run_id;
        const decision = action.action === 'approve' ? 'approve' : 'reject';

        // HMAC 签名验证（如果启用）
        if (SECURITY_CONFIG.enforceSignature || action.signature) {
          const timestamp = action.timestamp || data.timestamp;
          const signature = action.signature || data.signature;

          if (!timestamp || !signature) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing signature or timestamp' }));
            return;
          }

          const verifyResult = verifySignature(timestamp, runId, decision, signature);
          if (!verifyResult.valid) {
            console.warn(`[OperatorCallback] SIGNATURE_FAILED: ${runId} - ${verifyResult.error}`);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: verifyResult.error }));
            return;
          }
        }

        // 记录信号（带幂等性检查）
        const result = recordSignal(runId, {
          approved: decision === 'approve',
          operatorId: data.operator?.open_id || data.user_id || 'unknown',
          source: 'callback',
          metadata: {
            message_id: data.message_id,
            open_chat_id: data.open_chat_id
          }
        });

        if (!result.success) {
          // 幂等性冲突 - 返回 409 Conflict
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: result.error,
            existing_decision: result.existingDecision
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, signal: result.signal }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // GET /callback/operator/stats - 获取统计
    if (req.method === 'GET' && url.pathname === '/callback/operator/stats') {
      const stats = getSignalStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      return;
    }

    // GET /callback/operator/details/:run_id - 获取详情
    const detailsMatch = url.pathname.match(/^\/callback\/operator\/details\/(.+)$/);
    if (req.method === 'GET' && detailsMatch) {
      const runId = detailsMatch[1];
      const signal = querySignal(runId);

      if (signal) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(signal));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Signal not found' }));
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`[OperatorCallback] Server listening on http://localhost:${port}`);
    console.log(`  POST /callback/operator - Record operator signal`);
    console.log(`  GET  /callback/operator/stats - Get signal statistics`);
    console.log(`  GET  /callback/operator/details/:run_id - Get signal details`);
  });

  return server;
}

// ===============================================================
// CLI 入口
// ===============================================================

function parseArgs(args) {
  const result = {
    action: null,  // 'approve' | 'reject' | 'query' | 'stats' | 'serve'
    runId: null,
    operatorId: 'cli-user',
    note: null,
    port: 8787,
    force: false  // 强制覆盖幂等性检查
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--approve':
        result.action = 'approve';
        result.runId = args[++i];
        break;
      case '--reject':
        result.action = 'reject';
        result.runId = args[++i];
        break;
      case '--query':
        result.action = 'query';
        result.runId = args[++i];
        break;
      case '--stats':
        result.action = 'stats';
        break;
      case '--serve':
        result.action = 'serve';
        break;
      case '--operator':
        result.operatorId = args[++i];
        break;
      case '--note':
        result.note = args[++i];
        break;
      case '--port':
        result.port = parseInt(args[++i], 10);
        break;
      case '--force':
      case '-f':
        result.force = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Operator Callback Handler

Usage:
  node operator_callback.mjs [action] [options]

Actions:
  --approve <run_id>  Record approval for run
  --reject <run_id>   Record rejection for run
  --query <run_id>    Query signal for run
  --stats             Get signal statistics
  --serve             Start HTTP callback server

Options:
  --operator <id>     Operator ID (default: cli-user)
  --note <text>       Note for approval/rejection
  --port <port>       Server port (default: 8787)
  --force, -f         Force override idempotency check
  --help, -h          Show this help

Environment Variables:
  OPERATOR_CALLBACK_SECRET     HMAC secret for signature verification
  OPERATOR_ENFORCE_SIGNATURE   Set to 'true' to require signatures

Examples:
  node operator_callback.mjs --approve run-20260208-xxx --operator user123
  node operator_callback.mjs --reject run-20260208-xxx --note "Too risky"
  node operator_callback.mjs --query run-20260208-xxx
  node operator_callback.mjs --stats
  node operator_callback.mjs --serve --port 8787
`);
        process.exit(0);
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.action) {
    console.error('Error: No action specified. Use --approve, --reject, --query, --stats, or --serve');
    process.exit(1);
  }

  switch (options.action) {
    case 'approve':
    case 'reject':
      if (!options.runId) {
        console.error('Error: run_id is required');
        process.exit(1);
      }

      const result = recordSignal(options.runId, {
        approved: options.action === 'approve',
        operatorId: options.operatorId,
        note: options.note,
        source: 'command'
      }, { skipIdempotency: options.force });

      if (!result.success) {
        console.error(`Error: ${result.error}`);
        if (result.existingDecision) {
          console.error('Existing decision:', JSON.stringify(result.existingDecision, null, 2));
        }
        process.exit(1);
      }

      console.log(JSON.stringify(result.signal, null, 2));
      break;

    case 'query':
      if (!options.runId) {
        console.error('Error: run_id is required');
        process.exit(1);
      }

      const queryResult = querySignal(options.runId);
      if (queryResult) {
        console.log(JSON.stringify(queryResult, null, 2));
      } else {
        console.log('Signal not found');
        process.exit(1);
      }
      break;

    case 'stats':
      const stats = getSignalStats();
      console.log(JSON.stringify(stats, null, 2));
      break;

    case 'serve':
      createCallbackServer(options.port);
      // Keep running
      break;
  }
}

// 导出（注意：generateSignature, verifySignature, checkIdempotency, recordSignal, querySignal, getSignalStats 已在函数定义处 export）
export { SIGNALS_DIR, SECURITY_CONFIG };

// 直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
