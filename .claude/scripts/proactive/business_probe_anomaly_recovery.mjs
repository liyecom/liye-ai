#!/usr/bin/env node
/**
 * Business Probe: Anomaly Recovery v2.0.0
 * SSOT: .claude/scripts/proactive/business_probe_anomaly_recovery.mjs
 * ADR: ADR-003-business-probe-acceptance-criteria.md
 *
 * T+24h 业务指标探测（遵循 ADR-003 + P0-1 修复）：
 * - 回归区间：[p25, p75]（稳健区间）
 * - 数据来源：ENGINE_T1_DATA_DIR（ENV 必须指定）
 * - 判定逻辑：improved / regressed / stable / insufficient_data
 * - 禁止随机数：fail-closed 原则
 * - facts append-only：只追加不覆盖
 *
 * 用法：
 *   ENGINE_T1_DATA_DIR=/path/to/data node business_probe_anomaly_recovery.mjs
 */

import { readFileSync, appendFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const RUNS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'runs');
const FACTS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'facts');
const FACTS_FILE = join(FACTS_DIR, 'fact_run_outcomes.jsonl');
const BUSINESS_PROBES_FILE = join(FACTS_DIR, 'fact_business_probes.jsonl');

// P0-1.3: 禁止默认相邻仓库路径 - ENV 必须指定
const ENGINE_T1_DATA_DIR = process.env.ENGINE_T1_DATA_DIR;

// 数值安全常量
const EPSILON = 1e-9;

// ═══════════════════════════════════════════════════════════
// ADR-003: 回归区间配置（冻结）
// ═══════════════════════════════════════════════════════════
const RECOVERY_INTERVAL = {
  type: 'percentile',
  lower: 25,  // p25
  upper: 75,  // p75
  stable_threshold_pct: 5
};

// ADR-003: 数据来源配置
const DATA_SOURCES = {
  primary: {
    name: 'ENGINE T1 Truth Tables',
    type: 'parquet',
    env_var: 'ENGINE_T1_DATA_DIR'
  },
  fallback: {
    name: 'Ads API Direct Query',
    type: 'amazon_ads_api',
    status: 'not_implemented'
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
 * 计算百分位数（确定性算法）
 */
function percentile(arr, p) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (idx - lower) * (sorted[upper] - sorted[lower]);
}

/**
 * P0-1.1 + P0-1.3: 从 T1 表查询历史指标（无随机数，ENV 必须指定）
 * 返回 { baseline_p25, baseline_p75, current_value, has_data }
 */
async function queryT1Metrics(asin, metricName, lookbackDays = 30) {
  // P0-1.3: ENV 必须指定，不猜路径
  if (!ENGINE_T1_DATA_DIR) {
    return {
      has_data: false,
      source: 'insufficient_data',
      reason: 'ENGINE_T1_DATA_DIR env not set. Configure with: export ENGINE_T1_DATA_DIR=/path/to/engine/data/t1'
    };
  }

  // 检查目录是否存在
  if (!existsSync(ENGINE_T1_DATA_DIR)) {
    return {
      has_data: false,
      source: 'insufficient_data',
      reason: `ENGINE_T1_DATA_DIR path does not exist: ${ENGINE_T1_DATA_DIR}`
    };
  }

  // 检查是否有 parquet 文件
  let parquetFiles;
  try {
    parquetFiles = readdirSync(ENGINE_T1_DATA_DIR).filter(f => f.endsWith('.parquet'));
  } catch (e) {
    return {
      has_data: false,
      source: 'insufficient_data',
      reason: `Cannot read ENGINE_T1_DATA_DIR: ${e.message}`
    };
  }

  if (parquetFiles.length === 0) {
    return {
      has_data: false,
      source: 'insufficient_data',
      reason: 'No parquet files found in ENGINE_T1_DATA_DIR'
    };
  }

  // TODO: 实际实现应使用 DuckDB 查询 parquet 文件
  // 当前返回 insufficient_data（fail-closed）直到真实实现
  //
  // 真实实现示例：
  // import duckdb from 'duckdb';
  // const db = await duckdb.Database.create(':memory:');
  // const conn = await db.connect();
  // const result = await conn.all(`
  //   SELECT ${metricName}
  //   FROM read_parquet('${ENGINE_T1_DATA_DIR}/*.parquet')
  //   WHERE asin = ?
  //     AND date >= current_date - interval '${lookbackDays} days'
  //   ORDER BY date DESC
  // `, [asin]);
  //
  // const values = result.map(r => r[metricName]).filter(v => v != null);
  // return {
  //   has_data: values.length >= 7,
  //   source: DATA_SOURCES.primary.name,
  //   baseline_p25: percentile(values.slice(1), RECOVERY_INTERVAL.lower),
  //   baseline_p75: percentile(values.slice(1), RECOVERY_INTERVAL.upper),
  //   current_value: values[0],
  //   sample_size: values.length
  // };

  return {
    has_data: false,
    source: 'insufficient_data',
    reason: 'T1 parquet query not yet implemented. Parquet files exist but DuckDB integration pending.'
  };
}

/**
 * P0-1.1: Ads API 查询（无随机数，fail-closed）
 */
async function queryAdsApiMetrics(asin, metricName) {
  // P0-1.1: 禁止 Math.random()，API 未实现则 fail-closed
  return {
    has_data: false,
    source: 'insufficient_data',
    reason: 'Ads API integration not_implemented'
  };
}

/**
 * P0-1.4: 判定恢复状态（正确使用 anomalyDirection）
 * @param {Object} metrics - 指标数据
 * @param {string} anomalyDirection - 'high' 表示越高越异常（如 ACOS），'low' 表示越低越异常（如 CVR）
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

  if (baseline_p25 == null || baseline_p75 == null) {
    return {
      status: 'insufficient_data',
      reason: 'No baseline percentiles available',
      source: metrics.source
    };
  }

  if (current_value == null) {
    return {
      status: 'insufficient_data',
      reason: 'No current value available',
      source: metrics.source
    };
  }

  // P0-1.4: 修复除零风险，使用区间宽度归一化
  const intervalWidth = baseline_p75 - baseline_p25;
  const midpoint = (baseline_p25 + baseline_p75) / 2;

  // 使用区间宽度作为归一化基准（更稳健），如果区间太窄则用 midpoint
  const normalizer = intervalWidth > EPSILON ? intervalWidth : (Math.abs(midpoint) + EPSILON);

  // 计算相对变化（使用 midpoint 作为参考点）
  const delta = current_value - midpoint;
  const changePct = (delta / (Math.abs(midpoint) + EPSILON)) * 100;

  // 判定是否在 [p25, p75] 区间内
  const inNormalRange = current_value >= baseline_p25 && current_value <= baseline_p75;

  // P0-1.4: 根据 anomalyDirection 确定"改善"的语义
  // anomalyDirection='high' => 值降低是改善（如 ACOS）
  // anomalyDirection='low'  => 值升高是改善（如 CVR）
  let improvementPct;
  let isImproved;

  if (anomalyDirection === 'high') {
    // 对于 ACOS 类指标：值低于 midpoint 是好的
    improvementPct = -changePct;  // 负的 changePct 变成正的 improvement
    isImproved = current_value < midpoint;
  } else if (anomalyDirection === 'low') {
    // 对于 CVR 类指标：值高于 midpoint 是好的
    improvementPct = changePct;
    isImproved = current_value > midpoint;
  } else {
    return {
      status: 'insufficient_data',
      reason: `Unknown anomalyDirection: ${anomalyDirection}. Must be 'high' or 'low'.`,
      source: metrics.source
    };
  }

  // 判定状态
  if (Math.abs(improvementPct) < RECOVERY_INTERVAL.stable_threshold_pct) {
    return {
      status: 'stable',
      improvement_pct: 0,
      in_normal_range: inNormalRange,
      anomaly_direction: anomalyDirection,
      source: metrics.source
    };
  }

  if (inNormalRange || isImproved) {
    return {
      status: 'improved',
      improvement_pct: parseFloat(Math.abs(improvementPct).toFixed(2)),
      in_normal_range: inNormalRange,
      anomaly_direction: anomalyDirection,
      source: metrics.source
    };
  }

  return {
    status: 'regressed',
    improvement_pct: parseFloat((-Math.abs(improvementPct)).toFixed(2)),
    in_normal_range: false,
    anomaly_direction: anomalyDirection,
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
  try {
    return JSON.parse(readFileSync(ioPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * 加载 run 的 meta.json
 */
function loadMeta(runId) {
  const runIdSanitized = runId.replace(/:/g, '-');
  const runDir = join(RUNS_DIR, runIdSanitized);
  const metaPath = join(runDir, 'meta.json');

  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * P0-1.5: 从 playbook 输出提取指标语义
 */
function extractMetricSemantics(playbookIo) {
  const outputs = playbookIo.output?.outputs || playbookIo.output || {};

  // 优先从 primary_metric 字段读取（P1 新增）
  if (outputs.primary_metric) {
    return {
      has_semantics: true,
      metric_name: outputs.primary_metric.name,
      anomaly_direction: outputs.primary_metric.anomaly_direction,
      lookback_days: outputs.primary_metric.lookback_days || 30
    };
  }

  // 兼容：从 recommendations 推断
  const recommendations = outputs.recommendations || [];
  for (const rec of recommendations) {
    const params = rec.parameters || {};
    if (params.metric) {
      // 推断方向：常见指标的默认方向
      const metricDefaults = {
        acos: 'high',
        cpc: 'high',
        spend: 'high',
        cvr: 'low',
        conversion_rate: 'low',
        impressions: 'low',
        clicks: 'low',
        sales: 'low'
      };
      const direction = metricDefaults[params.metric.toLowerCase()];
      if (direction) {
        return {
          has_semantics: true,
          metric_name: params.metric,
          anomaly_direction: direction,
          lookback_days: 30,
          source: 'inferred_from_recommendation'
        };
      }
    }
  }

  // fail-closed: 无法确定语义
  return {
    has_semantics: false,
    reason: 'missing_metric_semantics: playbook output lacks primary_metric field'
  };
}

/**
 * 检查是否可以执行探测
 */
function canProbe(fact) {
  if (fact.business_probe_status && fact.business_probe_status !== 'pending') {
    return { canProbe: false, reason: 'already_probed' };
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
 * P0-1.2: 追加 fact 记录（append-only）
 */
function appendFact(factRecord) {
  mkdirSync(FACTS_DIR, { recursive: true });
  appendFileSync(BUSINESS_PROBES_FILE, JSON.stringify(factRecord) + '\n');
}

/**
 * 加载已有的 business probe 记录
 */
function loadExistingProbes() {
  if (!existsSync(BUSINESS_PROBES_FILE)) {
    return new Map();
  }
  const lines = readFileSync(BUSINESS_PROBES_FILE, 'utf-8').trim().split('\n').filter(l => l);
  const probesByRunId = new Map();
  for (const line of lines) {
    try {
      const probe = JSON.parse(line);
      probesByRunId.set(probe.run_id, probe);
    } catch (e) {
      // skip malformed lines
    }
  }
  return probesByRunId;
}

/**
 * 执行业务探测
 */
async function runBusinessProbe(options = {}) {
  const dryRun = options.dryRun || false;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('     Business Probe: Anomaly Recovery v2.0.0 (P0-1 Fixed)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Recovery Interval: [p${RECOVERY_INTERVAL.lower}, p${RECOVERY_INTERVAL.upper}]`);
  console.log(`Stable Threshold: ±${RECOVERY_INTERVAL.stable_threshold_pct}%`);
  console.log('');

  // P0-1.3: 检查 ENV
  if (!ENGINE_T1_DATA_DIR) {
    console.log(`${YELLOW}WARNING: ENGINE_T1_DATA_DIR not set${RESET}`);
    console.log(`Configure with: export ENGINE_T1_DATA_DIR=/path/to/engine/data/t1`);
    console.log('');
  } else {
    console.log(`T1 Data Dir: ${ENGINE_T1_DATA_DIR}`);
    console.log('');
  }

  if (dryRun) {
    console.log(`${YELLOW}DRY RUN MODE - No changes will be made${RESET}\n`);
  }

  if (!existsSync(FACTS_FILE)) {
    console.log(`${YELLOW}No facts file found. Nothing to probe.${RESET}`);
    return { probed: 0, skipped: 0, insufficient: 0 };
  }

  const lines = readFileSync(FACTS_FILE, 'utf-8').trim().split('\n').filter(l => l);
  const facts = lines.map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(f => f);

  console.log(`${CYAN}Found ${facts.length} fact records${RESET}\n`);

  // P0-1.2: 加载已有探测记录，避免重复探测
  const existingProbes = loadExistingProbes();

  let probed = 0;
  let skipped = 0;
  let insufficient = 0;

  for (const fact of facts) {
    // 检查是否已经探测过
    if (existingProbes.has(fact.run_id)) {
      const existing = existingProbes.get(fact.run_id);
      if (existing.business_probe_status !== 'pending') {
        skipped++;
        continue;
      }
    }

    const checkResult = canProbe(fact);

    if (!checkResult.canProbe) {
      skipped++;
      if (checkResult.reason === 'too_early') {
        const hoursRemaining = Math.ceil(checkResult.remainingMs / (60 * 60 * 1000));
        console.log(`${DIM}[Skip] ${fact.run_id}: ${hoursRemaining}h until probe window${RESET}`);
      } else if (checkResult.reason === 'already_probed') {
        console.log(`${DIM}[Skip] ${fact.run_id}: already probed${RESET}`);
      }
      continue;
    }

    const meta = loadMeta(fact.run_id);
    const playbookIo = loadPlaybookIo(fact.run_id);

    if (!meta || !playbookIo) {
      console.log(`${YELLOW}[Skip] ${fact.run_id}: Missing run data${RESET}`);
      skipped++;
      continue;
    }

    console.log(`${CYAN}[Probe] ${fact.run_id}${RESET}`);

    // P0-1.5: 提取指标语义（不硬编码）
    const semantics = extractMetricSemantics(playbookIo);
    if (!semantics.has_semantics) {
      console.log(`  ${YELLOW}? Insufficient data: ${semantics.reason}${RESET}`);

      if (!dryRun) {
        appendFact({
          run_id: fact.run_id,
          event_type: 'business_probe',
          measured_at: new Date().toISOString(),
          business_probe_status: 'insufficient_data',
          business_probe_value: null,
          reason: semantics.reason,
          source: 'metric_semantics_missing'
        });
      }
      insufficient++;
      continue;
    }

    // 提取 ASIN
    const inputs = playbookIo.inputs || {};
    const asin = inputs.asin || 'unknown';

    console.log(`  Metric: ${semantics.metric_name} (direction: ${semantics.anomaly_direction})`);

    // 尝试从 T1 查询
    let metrics = await queryT1Metrics(asin, semantics.metric_name, semantics.lookback_days);

    if (!metrics.has_data) {
      console.log(`  ${DIM}T1 unavailable: ${metrics.reason}${RESET}`);
      console.log(`  ${DIM}Trying Ads API fallback...${RESET}`);
      metrics = await queryAdsApiMetrics(asin, semantics.metric_name);
    }

    // P0-1.4: 判定恢复状态（正确使用 anomalyDirection）
    const recovery = determineRecoveryStatus(metrics, semantics.anomaly_direction);

    // P0-1.2: 追加 fact 记录（不覆盖）
    const probeRecord = {
      run_id: fact.run_id,
      event_type: 'business_probe',
      measured_at: new Date().toISOString(),
      business_probe_status: recovery.status,
      business_probe_value: recovery.improvement_pct ?? null,
      metric_name: semantics.metric_name,
      anomaly_direction: semantics.anomaly_direction,
      in_normal_range: recovery.in_normal_range ?? null,
      source: recovery.source,
      reason: recovery.reason ?? null
    };

    if (!dryRun) {
      appendFact(probeRecord);
    }
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
    console.error(e.stack);
    process.exit(1);
  }
}

export { runBusinessProbe, canProbe, determineRecoveryStatus, RECOVERY_INTERVAL, DATA_SOURCES };

// 仅在直接运行时执行 main()
const isDirectRun = process.argv[1]?.endsWith('business_probe_anomaly_recovery.mjs');
if (isDirectRun) {
  main();
}
