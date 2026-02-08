#!/usr/bin/env node
/**
 * Operator Callback Handler v1.1.0
 * SSOT: .claude/scripts/proactive/operator_callback.mjs
 *
 * Week 5 升级：
 * - 新增 operator_note 字段（可空但必须存在）
 * - approve 可触发 execute_limited pipeline（dry-run）
 * - 支持 --trigger-execute 选项
 *
 * 处理 operator 决策回调（飞书卡片 approve/reject）：
 * - HMAC 签名验证
 * - 幂等性检查
 * - 更新 Evidence Package operator_signal.json
 * - 更新 fact_run_outcomes.jsonl
 *
 * 用法：
 *   node operator_callback.mjs --run-id <id> --decision approve|reject --operator <id> [--note "..."] [--trigger-execute]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHmac } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const RUNS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'runs');
const FACTS_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'facts', 'fact_run_outcomes.jsonl');

const HMAC_SECRET = process.env.OPERATOR_HMAC_SECRET || 'dev-secret-key';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

export function generateSignature(timestamp, runId, decision) {
  const message = `${timestamp}:${runId}:${decision}`;
  return createHmac('sha256', HMAC_SECRET).update(message).digest('hex');
}

export function verifySignature(timestamp, runId, decision, signature) {
  const expected = generateSignature(timestamp, runId, decision);
  return expected === signature;
}

export function checkIdempotency(runId) {
  const runIdSanitized = runId.replace(/:/g, '-');
  const signalPath = join(RUNS_DIR, runIdSanitized, 'operator_signal.json');

  if (!existsSync(signalPath)) {
    return { exists: false, processed: false };
  }

  const signal = JSON.parse(readFileSync(signalPath, 'utf-8'));
  return {
    exists: true,
    processed: !signal.awaiting_decision,
    currentDecision: signal.decision
  };
}

function updateFactOperatorDecision(runId, decision) {
  if (!existsSync(FACTS_FILE)) return false;

  const lines = readFileSync(FACTS_FILE, 'utf-8').trim().split('\n');
  const updatedLines = lines.map(line => {
    if (!line) return line;
    try {
      const fact = JSON.parse(line);
      if (fact.run_id === runId) {
        fact.operator_decision = decision;
        return JSON.stringify(fact);
      }
      return line;
    } catch (e) {
      return line;
    }
  });

  writeFileSync(FACTS_FILE, updatedLines.join('\n') + '\n');
  return true;
}

export async function recordOperatorSignal(runId, decision, operatorId, signature, timestamp) {
  const runIdSanitized = runId.replace(/:/g, '-');
  const runDir = join(RUNS_DIR, runIdSanitized);

  if (!existsSync(runDir)) {
    throw new Error(`Run not found: ${runId}`);
  }

  const idempotency = checkIdempotency(runId);
  if (idempotency.processed) {
    console.log(`${YELLOW}[OperatorCallback] Already processed: ${runId} = ${idempotency.currentDecision}${RESET}`);
    return { duplicate: true, existingDecision: idempotency.currentDecision };
  }

  if (signature) {
    const isValid = verifySignature(timestamp, runId, decision, signature);
    if (!isValid) {
      throw new Error('Invalid HMAC signature');
    }
  } else {
    console.warn(`${YELLOW}[OperatorCallback] Warning: No signature provided${RESET}`);
  }

  const signalPath = join(runDir, 'operator_signal.json');
  const signalData = {
    run_id: runId,
    status: decision === 'approve' ? 'approved' : 'rejected',
    awaiting_decision: false,
    decision: decision,
    decided_by: operatorId,
    decided_at: new Date().toISOString(),
    signature: signature || null,
    timestamp: timestamp,
    // Week 5: operator_note 字段（可空但必须存在）
    operator_note: null
  };

  writeFileSync(signalPath, JSON.stringify(signalData, null, 2));
  updateFactOperatorDecision(runId, decision);

  console.log(`${GREEN}[OperatorCallback] Recorded: ${runId} = ${decision} by ${operatorId}${RESET}`);

  return { success: true, signal: signalData, runDir };
}

/**
 * Week 5: 更新 operator_note
 */
export function updateOperatorNote(runId, note) {
  const runIdSanitized = runId.replace(/:/g, '-');
  const signalPath = join(RUNS_DIR, runIdSanitized, 'operator_signal.json');

  if (!existsSync(signalPath)) {
    throw new Error(`Signal not found for run: ${runId}`);
  }

  const signal = JSON.parse(readFileSync(signalPath, 'utf-8'));
  signal.operator_note = note || null;
  writeFileSync(signalPath, JSON.stringify(signal, null, 2));

  return signal;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    runId: null,
    decision: null,
    operator: null,
    signature: null,
    timestamp: new Date().toISOString(),
    note: null,           // Week 5: operator note
    triggerExecute: false // Week 5: trigger execute pipeline
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run-id' && args[i + 1]) result.runId = args[++i];
    else if (args[i] === '--decision' && args[i + 1]) result.decision = args[++i];
    else if (args[i] === '--operator' && args[i + 1]) result.operator = args[++i];
    else if (args[i] === '--signature' && args[i + 1]) result.signature = args[++i];
    else if (args[i] === '--timestamp' && args[i + 1]) result.timestamp = args[++i];
    else if (args[i] === '--note' && args[i + 1]) result.note = args[++i];
    else if (args[i] === '--trigger-execute') result.triggerExecute = true;
  }

  return result;
}

/**
 * Week 5: 触发 execute pipeline（在 approve 后）
 */
async function triggerExecutePipeline(runId, runDir) {
  console.log(`${YELLOW}[OperatorCallback] Triggering execute pipeline...${RESET}`);

  try {
    // 1. 评估 gates
    const { evaluateGates } = await import('./execute_limited_gate.mjs');
    const playbookIo = JSON.parse(readFileSync(join(runDir, 'playbook_io.json'), 'utf-8'));
    const operatorSignal = JSON.parse(readFileSync(join(runDir, 'operator_signal.json'), 'utf-8'));

    const recommendations = playbookIo.output?.outputs?.recommendations ||
                            playbookIo.output?.recommendations || [];

    // 找出 execute_limited 层级的推荐
    const executeLimitedRecs = recommendations.filter(r => r.tier === 'execute_limited');

    if (executeLimitedRecs.length === 0) {
      console.log(`${YELLOW}[OperatorCallback] No execute_limited recommendations found${RESET}`);
      return { triggered: false, reason: 'no_execute_limited_recs' };
    }

    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];
      if (rec.tier !== 'execute_limited') continue;

      console.log(`\n[OperatorCallback] Evaluating recommendation ${i}: ${rec.action_type}`);

      const gateResult = evaluateGates(rec, { operatorSignal });

      if (gateResult.passed) {
        console.log(`${GREEN}[OperatorCallback] Gates passed, executing (dry-run)...${RESET}`);

        // 2. 执行（dry-run）
        const { executeAndSave } = await import('../../src/adapters/write_executor/index.mjs');
        const execResult = await executeAndSave(runId, i, true); // dry_run = true

        console.log(`${GREEN}[OperatorCallback] Execution complete: ${execResult.path}${RESET}`);
      } else {
        console.log(`${RED}[OperatorCallback] Gates failed: ${gateResult.firstFailedGate}${RESET}`);
      }
    }

    return { triggered: true };
  } catch (e) {
    console.error(`${RED}[OperatorCallback] Execute pipeline error: ${e.message}${RESET}`);
    return { triggered: false, error: e.message };
  }
}

async function main() {
  const args = parseArgs();

  if (!args.runId || !args.decision) {
    console.log('Usage: node operator_callback.mjs --run-id <id> --decision approve|reject [--note "..."] [--trigger-execute]');
    process.exit(1);
  }

  if (!['approve', 'reject'].includes(args.decision)) {
    console.error(`${RED}Error: decision must be 'approve' or 'reject'${RESET}`);
    process.exit(1);
  }

  try {
    const result = await recordOperatorSignal(
      args.runId,
      args.decision,
      args.operator || 'unknown',
      args.signature,
      args.timestamp
    );

    if (result.duplicate) {
      console.log(`Duplicate request - already processed as: ${result.existingDecision}`);
      process.exit(0);
    }

    // Week 5: 更新 operator_note
    if (args.note) {
      updateOperatorNote(args.runId, args.note);
      result.signal.operator_note = args.note;
    }

    console.log(JSON.stringify(result.signal, null, 2));

    // Week 5: 如果 approve 且 --trigger-execute，触发 execute pipeline
    if (args.decision === 'approve' && args.triggerExecute) {
      await triggerExecutePipeline(args.runId, result.runDir);
    }

    process.exit(0);
  } catch (e) {
    console.error(`${RED}Error: ${e.message}${RESET}`);
    process.exit(1);
  }
}

main();
