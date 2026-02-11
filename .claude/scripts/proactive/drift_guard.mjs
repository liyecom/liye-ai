#!/usr/bin/env node
/**
 * Drift Guard v0.1.0
 * SSOT: .claude/scripts/proactive/drift_guard.mjs
 *
 * Week 5 漂移守卫：
 * - 监控 business_probe 结果
 * - 连续 N 次失败或 recovery_rate 下降 → 自动降级/禁用策略
 * - 从 execute_limited → recommend
 *
 * 规则：
 * 1. 同一 policy_id 最近 7 天 recovery_rate < X% → 降级
 * 2. 连续 N 次 recovered=false → 立即禁用
 *
 * 用法：
 *   node drift_guard.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const FACTS_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'facts', 'fact_run_outcomes.jsonl');
const POLICIES_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies');
const DRIFT_LOG_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'drift_logs');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// ═══════════════════════════════════════════════════════════
// Drift Guard 配置
// ═══════════════════════════════════════════════════════════

const DRIFT_CONFIG = {
  // 连续失败次数阈值（立即禁用）
  consecutive_failure_threshold: 3,

  // 7 天内 recovery_rate 阈值
  recovery_rate_threshold_pct: 30,

  // 评估窗口（天）
  evaluation_window_days: 7,

  // 降级目标 tier
  downgrade_tier: 'recommend',

  // 禁用目录
  disabled_dir: 'disabled'
};

// ═══════════════════════════════════════════════════════════
// 数据加载
// ═══════════════════════════════════════════════════════════

/**
 * 加载 facts
 */
function loadFacts(sinceDate) {
  if (!existsSync(FACTS_FILE)) return [];

  const lines = readFileSync(FACTS_FILE, 'utf-8').trim().split('\n').filter(l => l);
  const facts = lines.map(l => JSON.parse(l));

  if (sinceDate) {
    const sinceTime = new Date(sinceDate).getTime();
    return facts.filter(f => new Date(f.timestamp).getTime() >= sinceTime);
  }

  return facts;
}

/**
 * 从 run_id 提取 policy_id（简化：使用 playbook_id）
 */
function extractPolicyId(runId) {
  // run_id 格式: engine:playbook:hash:timestamp
  const parts = runId.split(':');
  return parts.length >= 2 ? parts[1] : 'unknown';
}

/**
 * 加载 production policies
 */
function loadProductionPolicies() {
  const productionDir = join(POLICIES_DIR, 'production');
  if (!existsSync(productionDir)) return [];

  const files = readdirSync(productionDir).filter(f => f.endsWith('.yaml'));
  return files.map(f => {
    const content = readFileSync(join(productionDir, f), 'utf-8');
    return {
      filename: f,
      path: join(productionDir, f),
      ...parseYaml(content)
    };
  });
}

// ═══════════════════════════════════════════════════════════
// 漂移检测
// ═══════════════════════════════════════════════════════════

/**
 * 按 policy 聚合 facts
 */
function aggregateByPolicy(facts) {
  const byPolicy = {};

  for (const fact of facts) {
    const policyId = extractPolicyId(fact.run_id);

    if (!byPolicy[policyId]) {
      byPolicy[policyId] = {
        policy_id: policyId,
        runs: [],
        total: 0,
        improved: 0,
        regressed: 0,
        pending: 0,
        consecutive_failures: 0
      };
    }

    const entry = byPolicy[policyId];
    entry.runs.push(fact);
    entry.total++;

    const status = fact.business_probe_status;
    if (status === 'improved') {
      entry.improved++;
      entry.consecutive_failures = 0; // 重置连续失败
    } else if (status === 'regressed') {
      entry.regressed++;
      entry.consecutive_failures++;
    } else if (status === 'pending') {
      entry.pending++;
      // pending 不影响连续计数
    }
  }

  // 计算 recovery_rate
  for (const policyId of Object.keys(byPolicy)) {
    const entry = byPolicy[policyId];
    const measured = entry.improved + entry.regressed;
    entry.recovery_rate = measured > 0
      ? (entry.improved / measured * 100)
      : null;
  }

  return byPolicy;
}

/**
 * 检测需要降级/禁用的策略
 */
function detectDrift(policyStats) {
  const actions = [];

  for (const [policyId, stats] of Object.entries(policyStats)) {
    // 规则 1：连续失败 >= N
    if (stats.consecutive_failures >= DRIFT_CONFIG.consecutive_failure_threshold) {
      actions.push({
        policy_id: policyId,
        action: 'disable',
        reason: `Consecutive failures: ${stats.consecutive_failures} >= ${DRIFT_CONFIG.consecutive_failure_threshold}`,
        stats
      });
      continue;
    }

    // 规则 2：recovery_rate < X%
    if (stats.recovery_rate !== null &&
        stats.recovery_rate < DRIFT_CONFIG.recovery_rate_threshold_pct) {
      actions.push({
        policy_id: policyId,
        action: 'downgrade',
        reason: `Recovery rate: ${stats.recovery_rate.toFixed(1)}% < ${DRIFT_CONFIG.recovery_rate_threshold_pct}%`,
        target_tier: DRIFT_CONFIG.downgrade_tier,
        stats
      });
    }
  }

  return actions;
}

// ═══════════════════════════════════════════════════════════
// 降级/禁用执行
// ═══════════════════════════════════════════════════════════

/**
 * 禁用策略（移动到 disabled 目录）
 */
function disablePolicy(policyPath, reason) {
  const disabledDir = join(POLICIES_DIR, DRIFT_CONFIG.disabled_dir);
  mkdirSync(disabledDir, { recursive: true });

  const filename = policyPath.split('/').pop();
  const newPath = join(disabledDir, filename);

  // 读取并更新 validation_status
  const content = readFileSync(policyPath, 'utf-8');
  const policy = parseYaml(content);
  policy.validation_status = 'disabled';
  policy.disabled_at = new Date().toISOString();
  policy.disabled_reason = reason;

  writeFileSync(newPath, stringifyYaml(policy));
  renameSync(policyPath, policyPath + '.disabled.bak'); // 备份原文件

  return newPath;
}

/**
 * 降级策略（修改 tier）
 */
function downgradePolicy(policyPath, targetTier, reason) {
  const content = readFileSync(policyPath, 'utf-8');
  const policy = parseYaml(content);

  // 如果有 execution_tier 字段，降级
  policy.execution_tier = targetTier;
  policy.downgraded_at = new Date().toISOString();
  policy.downgrade_reason = reason;

  writeFileSync(policyPath, stringifyYaml(policy));
  return policyPath;
}

/**
 * 记录漂移日志
 */
function logDriftAction(action, result) {
  mkdirSync(DRIFT_LOG_DIR, { recursive: true });

  const logFile = join(DRIFT_LOG_DIR, `drift_${new Date().toISOString().split('T')[0]}.jsonl`);
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...action,
    result
  };

  const content = existsSync(logFile) ? readFileSync(logFile, 'utf-8') : '';
  writeFileSync(logFile, content + JSON.stringify(logEntry) + '\n');
}

// ═══════════════════════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════════════════════

async function runDriftGuard(options = {}) {
  const dryRun = options.dryRun || false;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Drift Guard v0.1.0 (Week 5)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  if (dryRun) {
    console.log(`${YELLOW}DRY-RUN MODE: No changes will be made${RESET}\n`);
  }

  // 1. 加载最近 N 天的 facts
  const windowStart = new Date(Date.now() - DRIFT_CONFIG.evaluation_window_days * 24 * 60 * 60 * 1000);
  const facts = loadFacts(windowStart.toISOString());

  console.log(`Loaded ${facts.length} facts from last ${DRIFT_CONFIG.evaluation_window_days} days\n`);

  if (facts.length === 0) {
    console.log(`${YELLOW}No facts to evaluate${RESET}`);
    return { actions: [] };
  }

  // 2. 按 policy 聚合
  const policyStats = aggregateByPolicy(facts);
  console.log(`Policies analyzed: ${Object.keys(policyStats).length}\n`);

  // 3. 检测漂移
  const driftActions = detectDrift(policyStats);

  if (driftActions.length === 0) {
    console.log(`${GREEN}No drift detected - all policies within thresholds${RESET}`);
    return { actions: [] };
  }

  console.log(`${YELLOW}Drift detected: ${driftActions.length} action(s) needed${RESET}\n`);

  // 4. 执行/报告动作
  const results = [];

  for (const action of driftActions) {
    console.log(`${CYAN}Policy: ${action.policy_id}${RESET}`);
    console.log(`  Action: ${action.action}`);
    console.log(`  Reason: ${action.reason}`);

    if (dryRun) {
      console.log(`  ${DIM}[DRY-RUN] Would ${action.action} this policy${RESET}`);
      results.push({ ...action, executed: false, dry_run: true });
    } else {
      // 查找对应的 policy 文件
      const policies = loadProductionPolicies();
      const matchingPolicy = policies.find(p =>
        p.policy_id === action.policy_id || p.filename.includes(action.policy_id)
      );

      if (!matchingPolicy) {
        console.log(`  ${YELLOW}Policy file not found - skipped${RESET}`);
        results.push({ ...action, executed: false, reason: 'policy_not_found' });
        continue;
      }

      try {
        if (action.action === 'disable') {
          const newPath = disablePolicy(matchingPolicy.path, action.reason);
          console.log(`  ${RED}DISABLED → ${newPath}${RESET}`);
          logDriftAction(action, { success: true, new_path: newPath });
          results.push({ ...action, executed: true, new_path: newPath });
        } else if (action.action === 'downgrade') {
          downgradePolicy(matchingPolicy.path, action.target_tier, action.reason);
          console.log(`  ${YELLOW}DOWNGRADED to ${action.target_tier}${RESET}`);
          logDriftAction(action, { success: true, target_tier: action.target_tier });
          results.push({ ...action, executed: true });
        }
      } catch (e) {
        console.log(`  ${RED}ERROR: ${e.message}${RESET}`);
        logDriftAction(action, { success: false, error: e.message });
        results.push({ ...action, executed: false, error: e.message });
      }
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total actions: ${driftActions.length}`);
  console.log(`  Executed: ${results.filter(r => r.executed).length}`);
  console.log(`  Skipped: ${results.filter(r => !r.executed).length}`);
  console.log('═══════════════════════════════════════════════════════════');

  return { actions: results };
}

// ═══════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run')
  };
}

async function main() {
  const args = parseArgs();

  try {
    await runDriftGuard({ dryRun: args.dryRun });
    process.exit(0);
  } catch (e) {
    console.error(`${RED}Error: ${e.message}${RESET}`);
    process.exit(1);
  }
}

export { runDriftGuard, detectDrift, aggregateByPolicy, DRIFT_CONFIG };

main();
