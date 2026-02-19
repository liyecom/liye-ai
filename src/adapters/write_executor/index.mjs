#!/usr/bin/env node
/**
 * Write Executor v1.1.0
 * SSOT: src/adapters/write_executor/index.mjs
 *
 * Week 5 写入执行器（默认 dry-run）：
 * - 接收通过所有 Gate 的 recommendation
 * - 执行写入操作（或 dry-run 模拟）
 * - 输出 execution_result.json 到 Evidence Package
 *
 * Week 5 默认 dry_run=true，不触碰真实 API
 * Week 6 可选开启真实写入
 *
 * S1 Phase B 更新 (v1.1.0)：
 * - 强制调用 execution_gate.preflightCheck() 作为硬前置
 * - deny-before-run：任何 WRITE_LIMITED 动作先过 gate
 * - 不可绕过：executeWithGate() 是唯一的外部入口
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { preflightCheck } from '../../governance/learning/execution_gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const RUNS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'runs');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// ═══════════════════════════════════════════════════════════
// 写入执行器接口
// ═══════════════════════════════════════════════════════════

/**
 * 写入执行结果
 */
class ExecutionResult {
  constructor(action_type, success, dry_run = true) {
    this.action_type = action_type;
    this.success = success;
    this.dry_run = dry_run;
    this.executed_at = new Date().toISOString();
    this.details = {};
    this.rollback_info = null;
  }

  setDetails(details) {
    this.details = details;
    return this;
  }

  setRollbackInfo(info) {
    this.rollback_info = info;
    return this;
  }

  toJSON() {
    return {
      action_type: this.action_type,
      success: this.success,
      dry_run: this.dry_run,
      executed_at: this.executed_at,
      details: this.details,
      rollback_info: this.rollback_info
    };
  }
}

// ═══════════════════════════════════════════════════════════
// 各 action_type 的执行器
// ═══════════════════════════════════════════════════════════

const executors = {
  /**
   * bid_adjust: 出价调整
   */
  async bid_adjust(parameters, dry_run) {
    const { keyword_id, campaign_id, current_bid, new_bid } = parameters;

    if (dry_run) {
      return new ExecutionResult('bid_adjust', true, true)
        .setDetails({
          mode: 'dry_run',
          would_change: {
            keyword_id,
            campaign_id,
            from_bid: current_bid,
            to_bid: new_bid,
            change_pct: ((new_bid - current_bid) / current_bid * 100).toFixed(2) + '%'
          },
          api_endpoint: 'POST /v2/sp/keywords',
          simulated_response: { status: 200, message: 'OK' }
        })
        .setRollbackInfo({
          action: 'bid_adjust',
          revert_to: current_bid,
          keyword_id
        });
    }

    // TODO: Week 6 真实 API 调用
    // const response = await adsApi.updateKeywordBid(keyword_id, new_bid);
    throw new Error('Real API execution not implemented (Week 6)');
  },

  /**
   * budget_adjust: 预算调整
   */
  async budget_adjust(parameters, dry_run) {
    const { campaign_id, current_budget, new_budget } = parameters;

    if (dry_run) {
      return new ExecutionResult('budget_adjust', true, true)
        .setDetails({
          mode: 'dry_run',
          would_change: {
            campaign_id,
            from_budget: current_budget,
            to_budget: new_budget,
            change_pct: ((new_budget - current_budget) / current_budget * 100).toFixed(2) + '%'
          },
          api_endpoint: 'PUT /v2/sp/campaigns',
          simulated_response: { status: 200, message: 'OK' }
        })
        .setRollbackInfo({
          action: 'budget_adjust',
          revert_to: current_budget,
          campaign_id
        });
    }

    throw new Error('Real API execution not implemented (Week 6)');
  },

  /**
   * keyword_pause: 暂停关键词
   */
  async keyword_pause(parameters, dry_run) {
    const { keyword_id, campaign_id } = parameters;

    if (dry_run) {
      return new ExecutionResult('keyword_pause', true, true)
        .setDetails({
          mode: 'dry_run',
          would_change: {
            keyword_id,
            campaign_id,
            state: 'enabled -> paused'
          },
          api_endpoint: 'PUT /v2/sp/keywords',
          simulated_response: { status: 200, message: 'OK' }
        })
        .setRollbackInfo({
          action: 'keyword_resume',
          keyword_id
        });
    }

    throw new Error('Real API execution not implemented (Week 6)');
  },

  /**
   * campaign_pause: 暂停广告活动
   */
  async campaign_pause(parameters, dry_run) {
    const { campaign_id } = parameters;

    if (dry_run) {
      return new ExecutionResult('campaign_pause', true, true)
        .setDetails({
          mode: 'dry_run',
          would_change: {
            campaign_id,
            state: 'enabled -> paused'
          },
          api_endpoint: 'PUT /v2/sp/campaigns',
          simulated_response: { status: 200, message: 'OK' },
          warning: 'HIGH RISK: Campaign pause affects all keywords'
        })
        .setRollbackInfo({
          action: 'campaign_resume',
          campaign_id
        });
    }

    throw new Error('Real API execution not implemented (Week 6)');
  },

  /**
   * keyword_negation: 否定关键词
   */
  async keyword_negation(parameters, dry_run) {
    const { keyword_text, match_type, campaign_id, ad_group_id } = parameters;

    if (dry_run) {
      return new ExecutionResult('keyword_negation', true, true)
        .setDetails({
          mode: 'dry_run',
          would_create: {
            keyword_text,
            match_type: match_type || 'negative_exact',
            campaign_id,
            ad_group_id
          },
          api_endpoint: 'POST /v2/sp/negativeKeywords',
          simulated_response: { status: 201, message: 'Created' }
        })
        .setRollbackInfo({
          action: 'delete_negative_keyword',
          keyword_text,
          campaign_id
        });
    }

    throw new Error('Real API execution not implemented (Week 6)');
  },

  /**
   * investigate_metric: 指标调查（不涉及写入）
   */
  async investigate_metric(parameters, dry_run) {
    return new ExecutionResult('investigate_metric', true, dry_run)
      .setDetails({
        mode: 'read_only',
        message: 'No write action needed for investigate_metric',
        parameters
      });
  },

  /**
   * no_action: 无需行动
   */
  async no_action(parameters, dry_run) {
    return new ExecutionResult('no_action', true, dry_run)
      .setDetails({
        mode: 'noop',
        message: 'No action required'
      });
  }
};

// ═══════════════════════════════════════════════════════════
// 执行回执协议 v0
// ═══════════════════════════════════════════════════════════

const RECEIPTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_execution_receipts.jsonl');

/**
 * 记录执行回执（append-only）
 */
function appendExecutionReceipt(receipt) {
  const dir = dirname(RECEIPTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(RECEIPTS_FILE, JSON.stringify(receipt) + '\n');
}

// ═══════════════════════════════════════════════════════════
// 主执行函数（内部使用，不直接导出给外部）
// ═══════════════════════════════════════════════════════════

/**
 * 执行写入动作（内部函数，不可直接调用）
 * @param {Object} recommendation - 推荐动作
 * @param {boolean} dry_run - 是否 dry-run（默认 true）
 * @returns {ExecutionResult}
 */
async function executeInternal(recommendation, dry_run = true) {
  const { action_type, parameters } = recommendation;

  const executor = executors[action_type];

  if (!executor) {
    throw new Error(`Unknown action_type: ${action_type}`);
  }

  return await executor(parameters, dry_run);
}

// 保留旧的 execute 导出用于向后兼容，但标记为 deprecated
/**
 * @deprecated 使用 executeWithGate() 代替，确保 preflight 检查
 */
export async function execute(recommendation, dry_run = true) {
  console.warn('[DEPRECATED] execute() is deprecated. Use executeWithGate() for mandatory preflight checks.');
  return executeInternal(recommendation, dry_run);
}

// ═══════════════════════════════════════════════════════════
// 带 Gate 的执行函数（S1 Phase B 新增）
// ═══════════════════════════════════════════════════════════

/**
 * 判断 action_type 是否需要 WRITE_LIMITED 权限
 */
function requiresWritePermission(action_type) {
  const READ_ONLY_ACTIONS = ['investigate_metric', 'no_action'];
  return !READ_ONLY_ACTIONS.includes(action_type);
}

/**
 * 带 Gate 的执行函数（推荐入口）
 *
 * deny-before-run：在执行任何写入动作前，强制调用 execution_gate.preflightCheck()
 * 不可绕过：所有外部调用都应使用此函数
 *
 * @param {Object} options
 * @param {Object} options.recommendation - 推荐动作
 * @param {string} options.policyId - 策略 ID（用于 drift 检查）
 * @param {string} options.currentTier - 当前执行层级（observe/recommend/execute_limited）
 * @param {boolean} options.dryRun - 是否 dry-run（默认 true）
 * @param {string} options.runId - 运行 ID（用于审计）
 * @returns {{ allowed: boolean, result?: ExecutionResult, gateResult?: Object, receipt?: Object }}
 */
export async function executeWithGate(options) {
  const {
    recommendation,
    policyId = null,
    currentTier = 'execute_limited',
    dryRun = true,
    runId = `exec-${Date.now()}`
  } = options;

  const { action_type } = recommendation;
  const actionHash = `${action_type}-${JSON.stringify(recommendation.parameters || {}).slice(0, 50)}`;

  // 判断是否需要 WRITE_LIMITED 权限
  const needsWrite = requiresWritePermission(action_type);
  const actionType = needsWrite ? 'WRITE_LIMITED' : 'READ_ONLY';

  // 1. Preflight Check（deny-before-run）
  const gateResult = preflightCheck({
    policyId,
    actionType,
    currentTier,
    recordFacts: true  // 记录到 facts
  });

  // 2. 如果 gate 拒绝，立即返回
  if (!gateResult.allowed) {
    const receipt = {
      timestamp: new Date().toISOString(),
      run_id: runId,
      action_hash: actionHash,
      action_type,
      status: 'DENIED',
      reason: gateResult.reason,
      denied_by: gateResult.denied_by,
      tier: currentTier,
      policy_id: policyId,
      dry_run: dryRun
    };

    appendExecutionReceipt(receipt);

    return {
      allowed: false,
      gateResult,
      receipt
    };
  }

  // 3. Gate 通过，执行动作
  try {
    const result = await executeInternal(recommendation, dryRun);

    const receipt = {
      timestamp: new Date().toISOString(),
      run_id: runId,
      action_hash: actionHash,
      action_type,
      status: dryRun ? 'DRY_RUN_APPLIED' : 'APPLIED',
      tier: currentTier,
      policy_id: policyId,
      dry_run: dryRun,
      success: result.success,
      details_summary: result.details?.mode || 'executed'
    };

    appendExecutionReceipt(receipt);

    return {
      allowed: true,
      result,
      gateResult,
      receipt
    };
  } catch (error) {
    const receipt = {
      timestamp: new Date().toISOString(),
      run_id: runId,
      action_hash: actionHash,
      action_type,
      status: 'ERROR',
      error: error.message,
      tier: currentTier,
      policy_id: policyId,
      dry_run: dryRun
    };

    appendExecutionReceipt(receipt);

    throw error;
  }
}

/**
 * 执行并保存结果到 Evidence Package（带 Gate 检查）
 *
 * S1 Phase B 更新：强制使用 executeWithGate()
 */
export async function executeAndSave(runId, recommendationIndex, dry_run = true, options = {}) {
  const runIdSanitized = runId.replace(/:/g, '-');
  const runDir = join(RUNS_DIR, runIdSanitized);

  if (!existsSync(runDir)) {
    throw new Error(`Run not found: ${runId}`);
  }

  // 加载 playbook_io
  const playbookIo = JSON.parse(readFileSync(join(runDir, 'playbook_io.json'), 'utf-8'));
  const recommendations = playbookIo.output?.outputs?.recommendations ||
                          playbookIo.output?.recommendations || [];

  const recommendation = recommendations[recommendationIndex];
  if (!recommendation) {
    throw new Error(`Recommendation index ${recommendationIndex} not found`);
  }

  // 提取 policy_id 和 tier（从 playbook_io 或 options）
  const policyId = options.policyId || playbookIo.policy_id || null;
  const currentTier = options.tier || playbookIo.tier || 'execute_limited';

  // 使用带 Gate 的执行（deny-before-run）
  const gatedResult = await executeWithGate({
    recommendation,
    policyId,
    currentTier,
    dryRun: dry_run,
    runId
  });

  // 保存 execution_result.json
  const executionResultPath = join(runDir, 'execution_result.json');

  if (gatedResult.allowed) {
    writeFileSync(executionResultPath, JSON.stringify({
      run_id: runId,
      recommendation_index: recommendationIndex,
      gate_passed: true,
      ...gatedResult.result.toJSON(),
      receipt: gatedResult.receipt
    }, null, 2));

    return { result: gatedResult.result, path: executionResultPath, receipt: gatedResult.receipt };
  } else {
    // Gate 拒绝，保存拒绝信息
    writeFileSync(executionResultPath, JSON.stringify({
      run_id: runId,
      recommendation_index: recommendationIndex,
      gate_passed: false,
      denied_by: gatedResult.gateResult.denied_by,
      reason: gatedResult.gateResult.reason,
      receipt: gatedResult.receipt
    }, null, 2));

    throw new Error(`Execution denied by gate: ${gatedResult.gateResult.reason}`);
  }
}

// ═══════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { runId: null, recIndex: 0, dryRun: true };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run-id' && args[i + 1]) result.runId = args[++i];
    if (args[i] === '--rec-index' && args[i + 1]) result.recIndex = parseInt(args[++i], 10);
    if (args[i] === '--no-dry-run') result.dryRun = false;
  }

  return result;
}

async function main() {
  const args = parseArgs();

  if (!args.runId) {
    console.log('Usage: node index.mjs --run-id <id> [--rec-index <n>] [--no-dry-run]');
    console.log('');
    console.log('Options:');
    console.log('  --run-id      Run ID to execute');
    console.log('  --rec-index   Recommendation index (default: 0)');
    console.log('  --no-dry-run  Execute for real (default: dry-run)');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('            Write Executor v1.0.0 (Week 5)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  if (args.dryRun) {
    console.log(`${YELLOW}DRY-RUN MODE: No real API calls will be made${RESET}`);
  } else {
    console.log(`${RED}LIVE MODE: Real API calls will be made!${RESET}`);
  }
  console.log('');

  try {
    const { result, path } = await executeAndSave(args.runId, args.recIndex, args.dryRun);

    console.log(`Action: ${result.action_type}`);
    console.log(`Success: ${result.success}`);
    console.log(`Dry-run: ${result.dry_run}`);
    console.log('');

    if (result.details.would_change) {
      console.log('Would change:');
      console.log(JSON.stringify(result.details.would_change, null, 2));
    }

    console.log('');
    console.log(`${GREEN}Result saved: ${path}${RESET}`);

    process.exit(0);
  } catch (e) {
    console.error(`${RED}Error: ${e.message}${RESET}`);
    process.exit(1);
  }
}

// 只在直接运行时执行 main
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
