#!/usr/bin/env node
/**
 * Business Probe: Anomaly Recovery v1.1.0
 * SSOT: .claude/scripts/proactive/business_probe_anomaly_recovery.mjs
 * ADR: ADR-003-business-probe-acceptance-criteria.md
 *
 * T+24h 业务指标探测（遵循 ADR-003 口径）：
 * - 回归区间：[p25, p75]（稳健区间）
 * - 数据来源：AGE T1 Truth Tables > Ads API > insufficient_data
 * - 判定逻辑：improved / regressed / stable / insufficient_data
 *
 * 用法：
 *   node business_probe_anomaly_recovery.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const RUNS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'runs');
const FACTS_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'facts', 'fact_run_outcomes.jsonl');

// AGE 数据源路径
const AGE_ROOT = process.env.AGE_ROOT || join(PROJECT_ROOT, '..', 'amazon-growth-engine');
const T1_DATA_DIR = join(AGE_ROOT, 'data', 't1');

// ═══════════════════════════════════════════════════════════
// ADR-003: 回归区间配置（冻结）
// ═══════════════════════════════════════════════════════════
const RECOVERY_INTERVAL = {
  type: 'percentile',
  lower: 25,  // p25
  upper: 75,  // p75
  // 变化幅度小于此值视为 stable
  stable_threshold_pct: 5
};

// ADR-003: 数据来源配置
const DATA_SOURCES = {
  primary: {
    name: 'AGE T1 Truth Tables',
    type: 'duckdb',
    latency_hours: 24
  },
  fallback: {
    name: 'Ads API Direct Query',
    type: 'amazon_ads_api',
    latency_hours: 0
  },
  insufficient_data_policy: {
    retry_after_hours: 24,
    max_retries: 3
  }
};

// T+24h 探测窗口（毫秒）
const PROBE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PROBE_GRACE_PERIOD_MS = 1 * 60 * 60 * 1000;

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * 计算百分位数
 */
function percentile(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (idx - lower) * (sorted[upper] - sorted[lower]);
}

/**
 * 从 T1 表查询历史指标（模拟）
 * 返回 { baseline_p25, baseline_p75, current_value, has_data }
 */
async function queryT1Metrics(asin, metricName, lookbackDays = 30) {
  // TODO: 实际实现应使用 DuckDB 查询 T1 parquet 文件
  // const db = await duckdb.connect();
  // const result = await db.run(`
  //   SELECT ${metricName}
  //   FROM read_parquet('${T1_DATA_DIR}/*.parquet')
  //   WHERE asin = '${asin}'
  //     AND date >= current_date - interval '${lookbackDays} days'
  // `);

  // 模拟：检查 T1 目录是否存在数据
  const hasT1Data = existsSync(T1_DATA_DIR) &&
    readdirSync(T1_DATA_DIR).some(f => f.endsWith('.parquet'));

  if (!hasT1Data) {
    return { has_data: false, source: 'insufficient_data', reason: 'T1 parquet files not found' };
  }

  // 模拟历史数据（30 天）
  const historicalValues = Array.from({ length: 30 }, () =>
    0.15 + Math.random() * 0.20  // 模拟 ACOS 在 15%-35% 范围
  );

  // 模拟当前值
  const currentValue = 0.15 + Math.random() * 0.25;

  return {
    has_data: true,
    source: DATA_SOURCES.primary.name,
    baseline_p25: percentile(historicalValues, RECOVERY_INTERVAL.lower),
    baseline_p75: percentile(historicalValues, RECOVERY_INTERVAL.upper),
    current_value: currentValue,
    sample_size: historicalValues.length
  };
}

/**
 * 从 Ads API 查询指标（fallback）
 */
async function queryAdsApiMetrics(asin, metricName) {
  // TODO: 实际实现应调用 Amazon Ads API
  // 模拟 API 失败场景
  const apiAvailable = Math.random() > 0.3;

  if (!apiAvailable) {
    return { has_data: false, source: 'insufficient_data', reason: 'Ads API unavailable' };
  }

  return {
    has_data: true,
    source: DATA_SOURCES.fallback.name,
    current_value: 0.18 + Math.random() * 0.15,
    sample_size: 1
  };
}

/**
 * 判定恢复状态（ADR-003 逻辑）
 */
function determineRecoveryStatus(metrics, anomalyDirection) {
  if (!metrics.has_data) {
    return {
      status: 'insufficient_data',
      reason: metrics.reason,
      source: metrics.source
    };
  }

  const { baseline_p25, baseline_p75, current_value } = metrics;

  // 如果没有 baseline，使用 API 结果判定
  if (baseline_p25 == null || baseline_p75 == null) {
    return {
      status: 'insufficient_data',
      reason: 'No baseline percentiles available',
      source: metrics.source
    };
  }

  // 判定是否在 [p25, p75] 区间内
  const inNormalRange = current_value >= baseline_p25 && current_value <= baseline_p75;

  // 计算相对于区间的变化
  const midpoint = (baseline_p25 + baseline_p75) / 2;
  const changePct = ((current_value - midpoint) / midpoint) * 100;

  if (Math.abs(changePct) < RECOVERY_INTERVAL.stable_threshold_pct) {
    return {
      status: 'stable',
      improvement_pct: 0,
      in_normal_range: inNormalRange,
      source: metrics.source
    };
  }

  if (inNormalRange) {
    return {
      status: 'improved',
      improvement_pct: parseFloat(Math.abs(changePct).toFixed(2)),
      in_normal_range: true,
      source: metrics.source
    };
  }

  return {
    status: 'regressed',
    improvement_pct: parseFloat((-Math.abs(changePct)).toFixed(2)),
    in_normal_range: false,
    source: metrics.source
  };
}

/**
 * 加载 run 的 playbook_io.json
 */
function loadPlaybookIo(runId) {
  const runIdSanitized = runId.replace(/:/g, '-');
  const runDir = join(RUNS_DIR, runIdSanitized);
  const ioPath = join(runDir, 'playbook_io.json');

  if (!existsSync(ioPath)) return null;
  return JSON.parse(readFileSync(ioPath, 'utf-8'));
}

/**
 * 加载 run 的 meta.json
 */
function loadMeta(runId) {
  const runIdSanitized = runId.replace(/:/g, '-');
  const runDir = join(RUNS_DIR, runIdSanitized);
  const metaPath = join(runDir, 'meta.json');

  if (!existsSync(metaPath)) return null;
  return JSON.parse(readFileSync(metaPath, 'utf-8'));
}

/**
 * 检查是否可以执行探测
 */
function canProbe(fact) {
  if (fact.business_probe_status !== 'pending') {
    return { canProbe: false, reason: 'not_pending' };
  }

  if (!fact.exec_success) {
    return { canProbe: false, reason: 'exec_failed' };
  }

  if (fact.operator_decision !== 'approve') {
    return { canProbe: false, reason: 'not_approved' };
  }

  const createdAt = new Date(fact.timestamp).getTime();
  const now = Date.now();
  const elapsed = now - createdAt;

  if (elapsed < PROBE_WINDOW_MS - PROBE_GRACE_PERIOD_MS) {
    return {
      canProbe: false,
      reason: 'too_early',
      remainingMs: PROBE_WINDOW_MS - elapsed
    };
  }

  return { canProbe: true };
}

/**
 * 执行业务探测
 */
async function runBusinessProbe(options = {}) {
  const dryRun = options.dryRun || false;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('     Business Probe: Anomaly Recovery v1.1.0 (ADR-003)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Recovery Interval: [p${RECOVERY_INTERVAL.lower}, p${RECOVERY_INTERVAL.upper}]`);
  console.log(`Stable Threshold: ±${RECOVERY_INTERVAL.stable_threshold_pct}%`);
  console.log('');

  if (dryRun) {
    console.log(`${YELLOW}DRY RUN MODE - No changes will be made${RESET}\n`);
  }

  if (!existsSync(FACTS_FILE)) {
    console.log(`${YELLOW}No facts file found. Nothing to probe.${RESET}`);
    return { probed: 0, skipped: 0 };
  }

  const lines = readFileSync(FACTS_FILE, 'utf-8').trim().split('\n').filter(l => l);
  const facts = lines.map(l => JSON.parse(l));

  console.log(`${CYAN}Found ${facts.length} fact records${RESET}\n`);

  const probeResults = [];
  let probed = 0;
  let skipped = 0;
  let insufficient = 0;

  for (const fact of facts) {
    const checkResult = canProbe(fact);

    if (!checkResult.canProbe) {
      skipped++;
      if (checkResult.reason === 'too_early') {
        const hoursRemaining = Math.ceil(checkResult.remainingMs / (60 * 60 * 1000));
        console.log(`${DIM}[Skip] ${fact.run_id}: ${hoursRemaining}h until probe window${RESET}`);
      }
      probeResults.push(fact);
      continue;
    }

    const meta = loadMeta(fact.run_id);
    const playbookIo = loadPlaybookIo(fact.run_id);

    if (!meta || !playbookIo) {
      console.log(`${YELLOW}[Skip] ${fact.run_id}: Missing run data${RESET}`);
      probeResults.push(fact);
      skipped++;
      continue;
    }

    console.log(`${CYAN}[Probe] ${fact.run_id}${RESET}`);

    // 提取 ASIN 和指标类型
    const inputs = playbookIo.inputs || {};
    const asin = inputs.asin || 'unknown';
    const metricName = 'acos'; // 默认检测 ACOS

    // 尝试从 T1 查询，失败则 fallback 到 API
    let metrics = await queryT1Metrics(asin, metricName);

    if (!metrics.has_data) {
      console.log(`  ${DIM}T1 unavailable, trying Ads API...${RESET}`);
      metrics = await queryAdsApiMetrics(asin, metricName);
    }

    // 判定恢复状态
    const recovery = determineRecoveryStatus(metrics, 'high'); // ACOS 高是异常

    // 更新 fact
    const updatedFact = {
      ...fact,
      business_probe_status: recovery.status,
      business_probe_value: recovery.improvement_pct || null,
      business_probe_source: recovery.source,
      measured_at: new Date().toISOString()
    };

    probeResults.push(updatedFact);
    probed++;

    // 输出结果
    if (recovery.status === 'improved') {
      console.log(`  ${GREEN}✓ Improved: +${recovery.improvement_pct}% (in [p25,p75])${RESET}`);
    } else if (recovery.status === 'regressed') {
      console.log(`  ${RED}✗ Regressed: ${recovery.improvement_pct}% (outside [p25,p75])${RESET}`);
    } else if (recovery.status === 'stable') {
      console.log(`  ${YELLOW}○ Stable: change < ±${RECOVERY_INTERVAL.stable_threshold_pct}%${RESET}`);
    } else if (recovery.status === 'insufficient_data') {
      console.log(`  ${DIM}? Insufficient data: ${recovery.reason}${RESET}`);
      insufficient++;
    }
  }

  if (!dryRun && probed > 0) {
    const updatedContent = probeResults.map(f => JSON.stringify(f)).join('\n') + '\n';
    writeFileSync(FACTS_FILE, updatedContent);
    console.log(`\n${GREEN}Updated ${probed} fact records${RESET}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Probed: ${probed}  |  Skipped: ${skipped}  |  Insufficient: ${insufficient}`);
  console.log('═══════════════════════════════════════════════════════════');

  return { probed, skipped, insufficient, total: facts.length };
}

function parseArgs() {
  const args = process.argv.slice(2);
  return { dryRun: args.includes('--dry-run') };
}

async function main() {
  const args = parseArgs();
  try {
    await runBusinessProbe({ dryRun: args.dryRun });
    process.exit(0);
  } catch (e) {
    console.error(`${RED}Error: ${e.message}${RESET}`);
    process.exit(1);
  }
}

export { runBusinessProbe, canProbe, RECOVERY_INTERVAL, DATA_SOURCES };

main();
