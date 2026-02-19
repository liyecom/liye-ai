#!/usr/bin/env node
/**
 * Tier Manager v1.0.0
 * SSOT: src/governance/learning/tier_manager.mjs
 *
 * 管理 policies 生命周期：observe → recommend → execute_limited
 * 决策必须 deterministic（同输入同输出，可 replay）
 *
 * 输入依赖：
 * - state/memory/facts/fact_run_outcomes.jsonl（三信号）
 * - state/memory/learned/policies/（policy artifacts）
 * - .claude/config/execution_tiers.yaml（晋升规则）
 *
 * 输出：
 * - append-only facts: tier_decision_made
 * - 更新 policy 的 validation_status
 *
 * 运行：node src/governance/learning/tier_manager.mjs [--dry-run] [--json]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// 配置路径
const TIERS_CONFIG_PATH = join(PROJECT_ROOT, '.claude', 'config', 'execution_tiers.yaml');
const FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_run_outcomes.jsonl');
const TIER_FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_tier_decisions.jsonl');
const POLICIES_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// Tier 到目录的映射
const TIER_TO_DIR = {
  observe: 'sandbox',
  recommend: 'candidate',
  execute_limited: 'production'
};

const DIR_TO_TIER = {
  sandbox: 'observe',
  candidate: 'recommend',
  production: 'execute_limited'
};

/**
 * 加载 execution_tiers 配置
 */
function loadTiersConfig() {
  if (!existsSync(TIERS_CONFIG_PATH)) {
    throw new Error(`Tiers config not found: ${TIERS_CONFIG_PATH}`);
  }
  return parseYaml(readFileSync(TIERS_CONFIG_PATH, 'utf-8'));
}

/**
 * 加载 facts（三信号数据）
 */
function loadFacts(since = null) {
  if (!existsSync(FACTS_FILE)) {
    return [];
  }

  const lines = readFileSync(FACTS_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  const facts = lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);

  if (since) {
    const sinceDate = new Date(since);
    return facts.filter(f => new Date(f.timestamp) > sinceDate);
  }

  return facts;
}

/**
 * 加载所有 policies
 */
function loadPolicies() {
  const policies = [];
  const subdirs = ['sandbox', 'candidate', 'production'];

  for (const subdir of subdirs) {
    const dir = join(POLICIES_DIR, subdir);
    if (!existsSync(dir)) continue;

    const files = readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of files) {
      try {
        const content = readFileSync(join(dir, file), 'utf-8');
        const policy = parseYaml(content);
        policies.push({
          ...policy,
          _file: file,
          _dir: subdir,
          _path: join(dir, file),
          _current_tier: DIR_TO_TIER[subdir]
        });
      } catch (e) {
        console.error(`${YELLOW}⚠️ Failed to load policy ${file}: ${e.message}${RESET}`);
      }
    }
  }

  return policies;
}

/**
 * 计算 policy 的三信号
 * @param {string} policyId - Policy ID
 * @param {Array} facts - 所有 facts
 * @param {number} windowDays - 统计窗口天数
 */
function computeSignals(policyId, facts, windowDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  // 过滤与此 policy 相关的 facts
  const relevantFacts = facts.filter(f => {
    if (!f.timestamp) return false;
    if (new Date(f.timestamp) < cutoff) return false;

    // 匹配 policy_id（可能在不同字段中）
    if (f.policy_id === policyId) return true;
    if (f.run_id?.includes(policyId)) return true;

    return false;
  });

  // 执行信号
  const execFacts = relevantFacts.filter(f =>
    f.event_type === 'heartbeat_learning_run' ||
    f.event_type === 'policy_execution'
  );
  const execSuccess = execFacts.filter(f => f.status === 'success').length;
  const execTotal = execFacts.length;
  const execSuccessRate = execTotal > 0 ? execSuccess / execTotal : 0;

  // Operator 信号
  const operatorFacts = relevantFacts.filter(f => f.event_type === 'operator_signal');
  const approvals = operatorFacts.filter(f => f.decision === 'approve').length;
  const rejections = operatorFacts.filter(f => f.decision === 'reject').length;
  const operatorTotal = approvals + rejections;
  const operatorApprovalRate = operatorTotal > 0 ? approvals / operatorTotal : 0;

  // Business 信号
  const businessFacts = relevantFacts.filter(f =>
    f.event_type === 'business_probe' ||
    f.event_type === 'business_signal'
  );
  const businessSuccess = businessFacts.filter(f =>
    f.outcome === 'success' ||
    f.improvement_pct > 0
  ).length;
  const businessTotal = businessFacts.length;
  const businessSuccessRate = businessTotal > 0 ? businessSuccess / businessTotal : 0;

  return {
    exec: {
      count: execTotal,
      success_rate: execSuccessRate
    },
    operator: {
      approval_count: approvals,
      rejection_count: rejections,
      approval_rate: operatorApprovalRate
    },
    business: {
      count: businessTotal,
      success_rate: businessSuccessRate
    },
    total_facts: relevantFacts.length
  };
}

/**
 * 检查是否满足晋升条件
 * @param {Object} policy - Policy 对象
 * @param {Object} signals - 三信号
 * @param {Object} criteria - 晋升条件
 */
function checkPromotionCriteria(policy, signals, criteria) {
  const reasons = [];
  let passed = true;

  // min_runs
  if (criteria.min_runs && signals.exec.count < criteria.min_runs) {
    reasons.push(`exec.count(${signals.exec.count}) < min_runs(${criteria.min_runs})`);
    passed = false;
  }

  // exec_success_rate
  if (criteria.exec_success_rate && signals.exec.success_rate < criteria.exec_success_rate) {
    reasons.push(`exec.success_rate(${signals.exec.success_rate.toFixed(2)}) < required(${criteria.exec_success_rate})`);
    passed = false;
  }

  // operator_approval_rate
  if (criteria.operator_approval_rate && signals.operator.approval_rate < criteria.operator_approval_rate) {
    reasons.push(`operator.approval_rate(${signals.operator.approval_rate.toFixed(2)}) < required(${criteria.operator_approval_rate})`);
    passed = false;
  }

  // business_success_rate
  if (criteria.business_success_rate && signals.business.success_rate < criteria.business_success_rate) {
    reasons.push(`business.success_rate(${signals.business.success_rate.toFixed(2)}) < required(${criteria.business_success_rate})`);
    passed = false;
  }

  // min_confidence
  if (criteria.min_confidence && policy.confidence < criteria.min_confidence) {
    reasons.push(`confidence(${policy.confidence}) < min_confidence(${criteria.min_confidence})`);
    passed = false;
  }

  // min_days
  if (criteria.min_days) {
    const learnedAt = new Date(policy.learned_at);
    const now = new Date();
    const daysSinceLearned = (now - learnedAt) / (1000 * 60 * 60 * 24);
    if (daysSinceLearned < criteria.min_days) {
      reasons.push(`days_since_learned(${daysSinceLearned.toFixed(1)}) < min_days(${criteria.min_days})`);
      passed = false;
    }
  }

  return { passed, reasons };
}

/**
 * 记录 tier 决策到 facts（append-only）
 */
function appendTierDecisionFact(decision) {
  const dir = dirname(TIER_FACTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const record = {
    timestamp: new Date().toISOString(),
    event_type: 'tier_decision_made',
    ...decision
  };

  appendFileSync(TIER_FACTS_FILE, JSON.stringify(record) + '\n');
}

/**
 * 执行晋升：移动 policy 文件
 */
function executePromotion(policy, fromTier, toTier, dryRun = false) {
  const fromDir = TIER_TO_DIR[fromTier];
  const toDir = TIER_TO_DIR[toTier];

  const fromPath = join(POLICIES_DIR, fromDir, policy._file);
  const toPath = join(POLICIES_DIR, toDir, policy._file);

  if (!existsSync(join(POLICIES_DIR, toDir))) {
    if (!dryRun) {
      mkdirSync(join(POLICIES_DIR, toDir), { recursive: true });
    }
  }

  // 更新 policy 的 validation_status
  const updatedPolicy = {
    ...policy,
    validation_status: toDir,
    promoted_at: new Date().toISOString(),
    previous_tier: fromDir
  };

  // 移除内部字段
  delete updatedPolicy._file;
  delete updatedPolicy._dir;
  delete updatedPolicy._path;
  delete updatedPolicy._current_tier;

  if (!dryRun) {
    // 写入新位置
    writeFileSync(toPath, stringifyYaml(updatedPolicy));

    // 删除旧文件（如果不是同一位置）
    if (fromPath !== toPath && existsSync(fromPath)) {
      unlinkSync(fromPath);
    }
  }

  return { fromPath, toPath };
}

/**
 * 评估所有 policies 的晋升资格
 */
export async function evaluatePromotions(options = {}) {
  const { dryRun = false } = options;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Tier Manager v1.0.0');
  console.log('═══════════════════════════════════════════════════════════');

  const result = {
    timestamp: new Date().toISOString(),
    dry_run: dryRun,
    evaluated: 0,
    promoted: [],
    not_promoted: [],
    errors: []
  };

  // 加载配置
  let tiersConfig;
  try {
    tiersConfig = loadTiersConfig();
    console.log(`${GREEN}✅ Loaded tiers config${RESET}`);
  } catch (e) {
    console.error(`${RED}❌ Failed to load tiers config: ${e.message}${RESET}`);
    result.errors.push({ type: 'config_load', message: e.message });
    return result;
  }

  // 加载 facts
  const facts = loadFacts();
  console.log(`${CYAN}📊 Loaded ${facts.length} facts${RESET}`);

  // 加载 policies
  const policies = loadPolicies();
  console.log(`${CYAN}📋 Found ${policies.length} policies${RESET}\n`);

  // 评估每个 policy
  for (const policy of policies) {
    result.evaluated++;
    const currentTier = policy._current_tier;
    const policyId = policy.policy_id;

    console.log(`--- Evaluating: ${policyId} (current: ${currentTier}) ---`);

    // execute_limited 是最高层级，不再晋升
    if (currentTier === 'execute_limited') {
      console.log(`  ${YELLOW}⏭️  Already at execute_limited (max tier)${RESET}\n`);
      result.not_promoted.push({
        policy_id: policyId,
        reason: 'already_max_tier'
      });
      continue;
    }

    // 计算三信号
    const signals = computeSignals(policyId, facts);
    console.log(`  Signals: exec=${signals.exec.count}(${(signals.exec.success_rate * 100).toFixed(0)}%), ` +
                `operator=${signals.operator.approval_count}/${signals.operator.approval_count + signals.operator.rejection_count}(${(signals.operator.approval_rate * 100).toFixed(0)}%), ` +
                `business=${signals.business.count}(${(signals.business.success_rate * 100).toFixed(0)}%)`);

    // 获取晋升条件
    const criteria = tiersConfig.tiers[currentTier]?.promotion_criteria;
    if (!criteria) {
      console.log(`  ${YELLOW}⚠️ No promotion_criteria for ${currentTier}${RESET}\n`);
      result.not_promoted.push({
        policy_id: policyId,
        reason: 'no_promotion_criteria'
      });
      continue;
    }

    // 检查是否满足条件
    const check = checkPromotionCriteria(policy, signals, criteria);

    if (!check.passed) {
      console.log(`  ${YELLOW}❌ Not eligible:${RESET}`);
      for (const reason of check.reasons) {
        console.log(`     - ${reason}`);
      }
      console.log('');

      result.not_promoted.push({
        policy_id: policyId,
        reason: 'criteria_not_met',
        details: check.reasons
      });
      continue;
    }

    // 确定目标层级
    const nextTier = currentTier === 'observe' ? 'recommend' : 'execute_limited';
    console.log(`  ${GREEN}✅ Eligible for promotion: ${currentTier} → ${nextTier}${RESET}`);

    // 记录决策到 facts
    const decision = {
      policy_id: policyId,
      from_tier: currentTier,
      to_tier: nextTier,
      reason: 'criteria_met',
      thresholds: criteria,
      signals: signals,
      scope: policy.scope,
      primary_metric: policy.success_signals?.business?.metric_name || 'n/a'
    };

    if (!dryRun) {
      appendTierDecisionFact(decision);
      console.log(`  ${CYAN}📝 Recorded tier_decision_made fact${RESET}`);

      // 执行晋升
      try {
        const { fromPath, toPath } = await executePromotion(policy, currentTier, nextTier, dryRun);
        console.log(`  ${GREEN}📦 Moved policy: ${basename(fromPath)} → ${basename(toPath)}${RESET}`);
      } catch (e) {
        console.error(`  ${RED}❌ Failed to move policy: ${e.message}${RESET}`);
        result.errors.push({
          type: 'promotion_execution',
          policy_id: policyId,
          message: e.message
        });
      }
    } else {
      console.log(`  ${CYAN}[dry-run] Would record fact and move policy${RESET}`);
    }

    result.promoted.push({
      policy_id: policyId,
      from: currentTier,
      to: nextTier,
      signals: signals
    });

    console.log('');
  }

  // 汇总
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Evaluated: ${result.evaluated}`);
  console.log(`  ${GREEN}Promoted: ${result.promoted.length}${RESET}`);
  console.log(`  ${YELLOW}Not promoted: ${result.not_promoted.length}${RESET}`);
  console.log(`  ${RED}Errors: ${result.errors.length}${RESET}`);
  console.log('═══════════════════════════════════════════════════════════');

  return result;
}

// CLI
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { dryRun: false, json: false };
  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--json') options.json = true;
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const result = await evaluatePromotions({ dryRun: options.dryRun });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) main();
