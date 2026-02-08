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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const SIGNALS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'operator_signals');

// ===============================================================
// 信号记录
// ===============================================================

/**
 * 记录 operator 信号
 */
export function recordSignal(runId, signal) {
  if (!existsSync(SIGNALS_DIR)) {
    mkdirSync(SIGNALS_DIR, { recursive: true });
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

  // 如果已存在，追加到历史
  let existingData = { signals: [] };
  if (existsSync(signalPath)) {
    existingData = JSON.parse(readFileSync(signalPath, 'utf-8'));
  }

  existingData.signals.push(signalData);
  existingData.latest = signalData;
  existingData.updated_at = signalData.timestamp;

  writeFileSync(signalPath, JSON.stringify(existingData, null, 2));

  console.log(`[OperatorCallback] Signal recorded: ${runId} -> ${signal.approved ? 'APPROVED' : 'REJECTED'}`);

  return signalData;
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

        const signal = recordSignal(action.run_id, {
          approved: action.action === 'approve',
          operatorId: data.operator?.open_id || data.user_id || 'unknown',
          source: 'callback',
          metadata: {
            message_id: data.message_id,
            open_chat_id: data.open_chat_id
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, signal }));
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
    port: 8787
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
  --help, -h          Show this help

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

      const signal = recordSignal(options.runId, {
        approved: options.action === 'approve',
        operatorId: options.operatorId,
        note: options.note,
        source: 'command'
      });

      console.log(JSON.stringify(signal, null, 2));
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

// 导出
export { SIGNALS_DIR };

// 直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
