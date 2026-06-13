#!/usr/bin/env node
/**
 * Drift Monitor v1.0.0
 * SSOT: src/governance/learning/drift_monitor.mjs
 *
 * ⚠ STATUS: superseded-by-GHL (ADR-Learning-Stack-Generations §D-A2) — SURFACE-SCOPED (v0 "week 3" 栈)
 *   限定于本模块的【主动降级/quarantine 路径】(writeFileSync :233 / unlinkSync :236 状态变更 + CLI main = RETIRED)：
 *   不再是 policy demotion/lifecycle 权威；禁止新代码作 demotion/lifecycle 权威调用该面。GHL v1 sealed 栈是唯一权威。
 *   EXCEPTION: isDriftBlocked() (:421, 只读 existsSync/readFileSync) 是 D-A3 preserved read-only enforcement
 *   library，被 STAYING enforcement primitive execution_gate.mjs:23/:267 消费 (policyId 非空 ∧ actionType=WRITE_LIMITED)；
 *   既存边 grandfathered，"no-NEW-references" 不溯及该 live enforcement 读。
 *
 * 监控 production/candidate policies 的 primary_metric 走势
 * 触发 drift → 自动降级/冻结 execute_limited
 *
 * 规则：
 * - 连续 W 次（默认 3）business_signal=fail → drift_triggered
 * - drift_triggered → policy 状态进入 quarantine 或降级到 recommend
 *
 * 输出：
 * - facts: drift_evaluated, drift_triggered, policy_demoted
 *
 * 运行：node src/governance/learning/drift_monitor.mjs [--dry-run] [--json]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync, unlinkSync, renameSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// 配置路径
const TIERS_CONFIG_PATH = join(PROJECT_ROOT, '.claude', 'config', 'execution_tiers.yaml');
const FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_run_outcomes.jsonl');
const DRIFT_FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_drift_events.jsonl');
const POLICIES_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// 默认 drift 配置
const DEFAULT_DRIFT_CONFIG = {
  consecutive_failure_threshold: 3,
  performance_degradation_pct: 20,
  evaluation_window_days: 7
};

/**
 * 加载 execution_tiers 配置
 */
function loadTiersConfig() {
  if (!existsSync(TIERS_CONFIG_PATH)) {
    return { drift_monitor_integration: DEFAULT_DRIFT_CONFIG };
  }
  const config = parseYaml(readFileSync(TIERS_CONFIG_PATH, 'utf-8'));
  return {
    ...config,
    drift_config: {
      ...DEFAULT_DRIFT_CONFIG,
      ...config.drift_monitor_integration
    }
  };
}

/**
 * 加载 facts
 */
function loadFacts(windowDays = 7) {
  if (!existsSync(FACTS_FILE)) {
    return [];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const lines = readFileSync(FACTS_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.map(line => {
    try {
      const fact = JSON.parse(line);
      if (fact.timestamp && new Date(fact.timestamp) >= cutoff) {
        return fact;
      }
      return null;
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

/**
 * 加载需要监控的 policies（candidate 和 production）
 */
function loadMonitoredPolicies() {
  const policies = [];
  const subdirs = ['candidate', 'production'];

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
          _path: join(dir, file)
        });
      } catch (e) {
        console.error(`${YELLOW}⚠️ Failed to load policy ${file}: ${e.message}${RESET}`);
      }
    }
  }

  return policies;
}

/**
 * 分析 policy 的最近 business signals
 */
function analyzeBusinessSignals(policyId, facts) {
  // 按时间排序（最新在前）
  const relevantFacts = facts
    .filter(f => {
      if (f.policy_id === policyId) return true;
      if (f.run_id?.includes(policyId)) return true;
      return false;
    })
    .filter(f =>
      f.event_type === 'business_probe' ||
      f.event_type === 'business_signal' ||
      f.event_type === 'operator_signal'
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // 计算连续失败次数
  let consecutiveFailures = 0;
  for (const fact of relevantFacts) {
    const isFailure =
      fact.outcome === 'fail' ||
      fact.outcome === 'failure' ||
      fact.decision === 'reject' ||
      (fact.improvement_pct !== undefined && fact.improvement_pct < 0);

    if (isFailure) {
      consecutiveFailures++;
    } else {
      break; // 遇到成功就停止计数
    }
  }

  // 计算性能趋势
  const businessFacts = relevantFacts.filter(f =>
    f.event_type === 'business_probe' && f.metric_value !== undefined
  );

  let performanceDegradationPct = 0;
  if (businessFacts.length >= 2) {
    const recent = businessFacts.slice(0, Math.ceil(businessFacts.length / 2));
    const older = businessFacts.slice(Math.ceil(businessFacts.length / 2));

    const recentAvg = recent.reduce((sum, f) => sum + f.metric_value, 0) / recent.length;
    const olderAvg = older.reduce((sum, f) => sum + f.metric_value, 0) / older.length;

    if (olderAvg !== 0) {
      // 对于 ACOS 等指标，上升是退步；对于 ROAS 等，下降是退步
      // 这里假设更高的值是更差的（ACOS 场景）
      performanceDegradationPct = ((recentAvg - olderAvg) / Math.abs(olderAvg)) * 100;
    }
  }

  return {
    total_signals: relevantFacts.length,
    consecutive_failures: consecutiveFailures,
    performance_degradation_pct: performanceDegradationPct,
    latest_signals: relevantFacts.slice(0, 5)
  };
}

/**
 * 记录 drift 事件到 facts（append-only）
 */
function appendDriftFact(fact) {
  const dir = dirname(DRIFT_FACTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const record = {
    timestamp: new Date().toISOString(),
    ...fact
  };

  appendFileSync(DRIFT_FACTS_FILE, JSON.stringify(record) + '\n');
}

/**
 * 执行降级：移动 policy 到 quarantine 或 candidate
 */
function executeDemotion(policy, toDir, reason, dryRun = false) {
  const fromPath = policy._path;
  const toPath = join(POLICIES_DIR, toDir, policy._file);

  // 确保目标目录存在
  if (!existsSync(join(POLICIES_DIR, toDir))) {
    if (!dryRun) {
      mkdirSync(join(POLICIES_DIR, toDir), { recursive: true });
    }
  }

  // 更新 policy
  const updatedPolicy = {
    ...policy,
    validation_status: toDir,
    demoted_at: new Date().toISOString(),
    demoted_reason: reason,
    previous_status: policy._dir
  };

  // 移除内部字段
  delete updatedPolicy._file;
  delete updatedPolicy._dir;
  delete updatedPolicy._path;

  if (!dryRun) {
    writeFileSync(toPath, stringifyYaml(updatedPolicy));

    if (fromPath !== toPath && existsSync(fromPath)) {
      unlinkSync(fromPath);
    }
  }

  return { fromPath, toPath };
}

/**
 * 评估所有 policies 的 drift
 */
export async function evaluateDrift(options = {}) {
  const { dryRun = false } = options;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Drift Monitor v1.0.0');
  console.log('═══════════════════════════════════════════════════════════');

  const result = {
    timestamp: new Date().toISOString(),
    dry_run: dryRun,
    evaluated: 0,
    drifted: [],
    stable: [],
    errors: [],
    blocked_actions: []
  };

  // 加载配置
  let config;
  try {
    config = loadTiersConfig();
    console.log(`${GREEN}✅ Loaded drift config${RESET}`);
  } catch (e) {
    console.error(`${RED}❌ Failed to load config: ${e.message}${RESET}`);
    result.errors.push({ type: 'config_load', message: e.message });
    return result;
  }

  const driftConfig = config.drift_config || DEFAULT_DRIFT_CONFIG;
  console.log(`   Thresholds: consecutive_failures=${driftConfig.consecutive_failure_threshold}, ` +
              `degradation=${driftConfig.performance_degradation_pct}%`);

  // 加载 facts
  const facts = loadFacts(driftConfig.evaluation_window_days || 7);
  console.log(`${CYAN}📊 Loaded ${facts.length} facts (last ${driftConfig.evaluation_window_days || 7} days)${RESET}`);

  // 加载 policies
  const policies = loadMonitoredPolicies();
  console.log(`${CYAN}📋 Monitoring ${policies.length} policies (candidate + production)${RESET}\n`);

  // 评估每个 policy
  for (const policy of policies) {
    result.evaluated++;
    const policyId = policy.policy_id;
    const currentDir = policy._dir;

    console.log(`--- Evaluating: ${policyId} (${currentDir}) ---`);

    // 分析 business signals
    const analysis = analyzeBusinessSignals(policyId, facts);
    console.log(`  Signals: total=${analysis.total_signals}, ` +
                `consecutive_failures=${analysis.consecutive_failures}, ` +
                `degradation=${analysis.performance_degradation_pct.toFixed(1)}%`);

    // 记录评估事件
    if (!dryRun) {
      appendDriftFact({
        event_type: 'drift_evaluated',
        policy_id: policyId,
        current_tier: currentDir,
        analysis: {
          consecutive_failures: analysis.consecutive_failures,
          performance_degradation_pct: analysis.performance_degradation_pct,
          total_signals: analysis.total_signals
        },
        thresholds: driftConfig
      });
    }

    // 检查是否触发 drift
    const consecutiveFailureTriggered =
      analysis.consecutive_failures >= driftConfig.consecutive_failure_threshold;
    const degradationTriggered =
      analysis.performance_degradation_pct >= driftConfig.performance_degradation_pct;

    const driftTriggered = consecutiveFailureTriggered || degradationTriggered;

    if (!driftTriggered) {
      console.log(`  ${GREEN}✅ Stable (no drift detected)${RESET}\n`);
      result.stable.push({
        policy_id: policyId,
        tier: currentDir,
        analysis: analysis
      });
      continue;
    }

    // Drift 触发
    const driftReason = consecutiveFailureTriggered
      ? `consecutive_failures(${analysis.consecutive_failures}) >= threshold(${driftConfig.consecutive_failure_threshold})`
      : `performance_degradation(${analysis.performance_degradation_pct.toFixed(1)}%) >= threshold(${driftConfig.performance_degradation_pct}%)`;

    console.log(`  ${RED}🚨 DRIFT TRIGGERED: ${driftReason}${RESET}`);

    // 记录 drift_triggered
    if (!dryRun) {
      appendDriftFact({
        event_type: 'drift_triggered',
        policy_id: policyId,
        current_tier: currentDir,
        reason: driftReason,
        analysis: analysis,
        thresholds: driftConfig
      });
    }

    // 决定降级目标
    // production → candidate, candidate → quarantine
    const demoteTo = currentDir === 'production' ? 'candidate' : 'quarantine';
    console.log(`  ${YELLOW}📉 Demoting: ${currentDir} → ${demoteTo}${RESET}`);

    // 执行降级
    if (!dryRun) {
      try {
        const { fromPath, toPath } = executeDemotion(policy, demoteTo, driftReason, dryRun);
        console.log(`  ${CYAN}📦 Moved: ${basename(fromPath)} → ${demoteTo}/${basename(toPath)}${RESET}`);

        appendDriftFact({
          event_type: 'policy_demoted',
          policy_id: policyId,
          from_tier: currentDir,
          to_tier: demoteTo,
          reason: driftReason
        });
      } catch (e) {
        console.error(`  ${RED}❌ Demotion failed: ${e.message}${RESET}`);
        result.errors.push({
          type: 'demotion_execution',
          policy_id: policyId,
          message: e.message
        });
      }
    } else {
      console.log(`  ${CYAN}[dry-run] Would demote and record facts${RESET}`);
    }

    // 记录被阻断的动作
    if (currentDir === 'production') {
      result.blocked_actions.push({
        policy_id: policyId,
        action: 'WRITE_LIMITED',
        reason: 'drift_triggered',
        details: driftReason
      });
    }

    result.drifted.push({
      policy_id: policyId,
      from_tier: currentDir,
      to_tier: demoteTo,
      reason: driftReason,
      analysis: analysis
    });

    console.log('');
  }

  // 汇总
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Evaluated: ${result.evaluated}`);
  console.log(`  ${GREEN}Stable: ${result.stable.length}${RESET}`);
  console.log(`  ${RED}Drifted: ${result.drifted.length}${RESET}`);
  console.log(`  ${YELLOW}Blocked actions: ${result.blocked_actions.length}${RESET}`);
  console.log(`  Errors: ${result.errors.length}`);
  console.log('═══════════════════════════════════════════════════════════');

  // 硬阻断提醒
  if (result.blocked_actions.length > 0) {
    console.log(`\n${RED}⚠️  WRITE_LIMITED BLOCKED for ${result.blocked_actions.length} policies due to drift${RESET}`);
    for (const block of result.blocked_actions) {
      console.log(`   - ${block.policy_id}: ${block.reason}`);
    }
  }

  return result;
}

/**
 * 导出：检查特定 policy 是否被 drift 阻断
 */
// ENFORCEMENT-READ (D-A3): consumed by execution_gate preflight; behavior frozen, byte-level regression under Hard Gate 1
export function isDriftBlocked(policyId) {
  // 检查 policy 是否在 quarantine
  const quarantinePath = join(POLICIES_DIR, 'quarantine', `${policyId}.yaml`);
  if (existsSync(quarantinePath)) {
    return { blocked: true, reason: 'policy_in_quarantine' };
  }

  // 检查最近的 drift_triggered 事件
  if (existsSync(DRIFT_FACTS_FILE)) {
    const lines = readFileSync(DRIFT_FACTS_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    const recentDrift = lines
      .map(line => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(Boolean)
      .filter(f => f.policy_id === policyId && f.event_type === 'drift_triggered')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

    if (recentDrift) {
      // 检查是否在最近 24 小时内
      const triggeredAt = new Date(recentDrift.timestamp);
      const now = new Date();
      const hoursSince = (now - triggeredAt) / (1000 * 60 * 60);

      if (hoursSince < 24) {
        return { blocked: true, reason: 'recent_drift_triggered', drift_event: recentDrift };
      }
    }
  }

  return { blocked: false };
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
  const result = await evaluateDrift({ dryRun: options.dryRun });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) main();
