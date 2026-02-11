#!/usr/bin/env node
/**
 * Weekly Report Generator v1.1.0
 * SSOT: .claude/scripts/proactive/report_weekly.mjs
 * ADR: ADR-003-business-probe-acceptance-criteria.md
 *
 * 生成周度汇总报告（遵循 ADR-003 KPI 列名冻结）：
 * - runs_total, exec_success_count, exec_success_rate
 * - operator_accept_count, operator_accept_rate
 * - probe_measured_count, probe_measured_rate
 * - recovery_count, recovery_rate
 *
 * 用法：
 *   node report_weekly.mjs [--since <date>] [--output <path>] [--json]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const FACTS_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'facts', 'fact_run_outcomes.jsonl');
const REPORTS_DIR = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'reports');

// 颜色输出
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// ═══════════════════════════════════════════════════════════
// ADR-003: 冻结的 KPI 列名（修改需走 ADR）
// ═══════════════════════════════════════════════════════════
const FROZEN_COLUMNS = [
  'runs_total',
  'exec_success_count',
  'exec_success_rate',
  'operator_accept_count',
  'operator_accept_rate',
  'probe_measured_count',
  'probe_measured_rate',
  'recovery_count',
  'recovery_rate'
];

/**
 * 加载并过滤 facts
 */
function loadFacts(sinceDate) {
  if (!existsSync(FACTS_FILE)) return [];

  const lines = readFileSync(FACTS_FILE, 'utf-8').trim().split('\n').filter(l => l);
  const facts = lines.map(l => JSON.parse(l));

  if (sinceDate) {
    const sinceTime = new Date(sinceDate).getTime();
    return facts.filter(f => new Date(f.timestamp).getTime() >= sinceTime);
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return facts.filter(f => new Date(f.timestamp).getTime() >= weekAgo);
}

/**
 * 聚合统计（ADR-003 冻结列名）
 */
function aggregateStats(facts) {
  // 核心 KPI（冻结列名）
  const kpi = {
    // 基础
    runs_total: facts.length,

    // Exec 信号
    exec_success_count: 0,
    exec_success_rate: 0,

    // Operator 信号
    operator_accept_count: 0,
    operator_reject_count: 0,  // 辅助列
    operator_accept_rate: 0,

    // Business 信号
    probe_measured_count: 0,
    probe_measured_rate: 0,
    recovery_count: 0,
    recovery_rate: 0,

    // 扩展列（非冻结）
    avg_improvement_pct: 0,
    insufficient_data_count: 0,
    by_playbook: {}
  };

  if (facts.length === 0) return kpi;

  let totalImprovement = 0;
  let improvementSamples = 0;

  for (const fact of facts) {
    // Exec
    if (fact.exec_success) {
      kpi.exec_success_count++;
    }

    // Operator
    if (fact.operator_decision === 'approve') {
      kpi.operator_accept_count++;
    } else if (fact.operator_decision === 'reject') {
      kpi.operator_reject_count++;
    }

    // Business Probe
    const status = fact.business_probe_status;
    if (status && status !== 'pending') {
      kpi.probe_measured_count++;

      if (status === 'improved') {
        kpi.recovery_count++;
        if (fact.business_probe_value != null) {
          totalImprovement += fact.business_probe_value;
          improvementSamples++;
        }
      } else if (status === 'insufficient_data') {
        kpi.insufficient_data_count++;
      }
    }

    // 按 playbook 分组
    const playbookId = fact.run_id.split(':')[1] || 'unknown';
    if (!kpi.by_playbook[playbookId]) {
      kpi.by_playbook[playbookId] = {
        runs_total: 0,
        exec_success_count: 0,
        operator_accept_count: 0,
        recovery_count: 0
      };
    }
    kpi.by_playbook[playbookId].runs_total++;
    if (fact.exec_success) kpi.by_playbook[playbookId].exec_success_count++;
    if (fact.operator_decision === 'approve') kpi.by_playbook[playbookId].operator_accept_count++;
    if (fact.business_probe_status === 'improved') kpi.by_playbook[playbookId].recovery_count++;
  }

  // 计算比率
  kpi.exec_success_rate = kpi.runs_total > 0
    ? parseFloat((kpi.exec_success_count / kpi.runs_total * 100).toFixed(1))
    : 0;

  const operatorTotal = kpi.operator_accept_count + kpi.operator_reject_count;
  kpi.operator_accept_rate = operatorTotal > 0
    ? parseFloat((kpi.operator_accept_count / operatorTotal * 100).toFixed(1))
    : null;

  kpi.probe_measured_rate = kpi.runs_total > 0
    ? parseFloat((kpi.probe_measured_count / kpi.runs_total * 100).toFixed(1))
    : 0;

  kpi.recovery_rate = kpi.probe_measured_count > 0
    ? parseFloat((kpi.recovery_count / kpi.probe_measured_count * 100).toFixed(1))
    : null;

  kpi.avg_improvement_pct = improvementSamples > 0
    ? parseFloat((totalImprovement / improvementSamples).toFixed(2))
    : null;

  return kpi;
}

/**
 * 生成 Markdown 报告
 */
function generateMarkdownReport(kpi, period) {
  const now = new Date().toISOString().split('T')[0];

  let md = `# LiYe OS 主动性系统周报

**报告日期**: ${now}
**统计周期**: ${period.start} ~ ${period.end}

---

## 核心 KPI（ADR-003 冻结列名）

| 指标 | 值 | 说明 |
|------|-----|------|
| \`runs_total\` | ${kpi.runs_total} | Playbook 执行总次数 |
| \`exec_success_count\` | ${kpi.exec_success_count} | 执行成功次数 |
| \`exec_success_rate\` | ${kpi.exec_success_rate}% | 执行成功率 |
| \`operator_accept_count\` | ${kpi.operator_accept_count} | Operator 批准次数 |
| \`operator_accept_rate\` | ${kpi.operator_accept_rate ?? 'N/A'}% | Operator 批准率 |
| \`probe_measured_count\` | ${kpi.probe_measured_count} | Business probe 完成数 |
| \`probe_measured_rate\` | ${kpi.probe_measured_rate}% | Business probe 完成率 |
| \`recovery_count\` | ${kpi.recovery_count} | 指标恢复/改善数 |
| \`recovery_rate\` | ${kpi.recovery_rate ?? 'N/A'}% | 恢复率 |

`;

  // 扩展指标
  md += `
## 扩展指标

| 指标 | 值 |
|------|-----|
| avg_improvement_pct | ${kpi.avg_improvement_pct ?? 'N/A'}% |
| insufficient_data_count | ${kpi.insufficient_data_count} |
| operator_reject_count | ${kpi.operator_reject_count} |

`;

  // 按 Playbook 分组
  if (Object.keys(kpi.by_playbook).length > 0) {
    md += `
## 按 Playbook 统计

| Playbook | runs_total | exec_success | operator_accept | recovery |
|----------|------------|--------------|-----------------|----------|
`;

    for (const [playbook, data] of Object.entries(kpi.by_playbook)) {
      md += `| ${playbook} | ${data.runs_total} | ${data.exec_success_count} | ${data.operator_accept_count} | ${data.recovery_count} |\n`;
    }
  }

  // 建议行动
  md += `
---

## 建议行动

`;

  if (kpi.exec_success_rate < 80) {
    md += `- **[P0]** exec_success_rate ${kpi.exec_success_rate}% < 80%，需排查 playbook 执行错误\n`;
  }

  if (kpi.operator_accept_rate !== null && kpi.operator_accept_rate < 60) {
    md += `- **[P1]** operator_accept_rate ${kpi.operator_accept_rate}% < 60%，需优化推荐质量\n`;
  }

  if (kpi.probe_measured_rate < 50) {
    md += `- **[P2]** probe_measured_rate ${kpi.probe_measured_rate}% < 50%，需加快 business probe 执行\n`;
  }

  if (kpi.recovery_rate !== null && kpi.recovery_rate < 30) {
    md += `- **[P0]** recovery_rate ${kpi.recovery_rate}% < 30%，需紧急复盘策略效果\n`;
  }

  if (kpi.insufficient_data_count > kpi.probe_measured_count) {
    md += `- **[P1]** insufficient_data (${kpi.insufficient_data_count}) > measured，需改善数据源覆盖\n`;
  }

  if (kpi.runs_total === 0) {
    md += `- 本周无执行记录\n`;
  }

  md += `
---

**ADR-003 合规声明**: 核心 KPI 列名已冻结，修改需走 ADR 流程。

*报告由 LiYe OS report_weekly.mjs v1.1.0 自动生成*
`;

  return md;
}

/**
 * 生成 JSON 格式报告
 */
function generateJsonReport(kpi, period) {
  return {
    version: '1.1.0',
    adr: 'ADR-003',
    generated_at: new Date().toISOString(),
    period: {
      start: period.start,
      end: period.end
    },
    frozen_columns: FROZEN_COLUMNS,
    kpi: {
      // 冻结列
      runs_total: kpi.runs_total,
      exec_success_count: kpi.exec_success_count,
      exec_success_rate: kpi.exec_success_rate,
      operator_accept_count: kpi.operator_accept_count,
      operator_accept_rate: kpi.operator_accept_rate,
      probe_measured_count: kpi.probe_measured_count,
      probe_measured_rate: kpi.probe_measured_rate,
      recovery_count: kpi.recovery_count,
      recovery_rate: kpi.recovery_rate
    },
    extended: {
      avg_improvement_pct: kpi.avg_improvement_pct,
      insufficient_data_count: kpi.insufficient_data_count,
      operator_reject_count: kpi.operator_reject_count,
      by_playbook: kpi.by_playbook
    }
  };
}

/**
 * 生成报告
 */
async function generateReport(options = {}) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('        Weekly Report Generator v1.1.0 (ADR-003)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const sinceDate = options.since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];

  console.log(`${CYAN}Period: ${sinceDate} ~ ${endDate}${RESET}\n`);

  const facts = loadFacts(sinceDate);
  console.log(`Loaded ${facts.length} fact records\n`);

  const kpi = aggregateStats(facts);

  // 打印冻结 KPI
  console.log('Frozen KPIs (ADR-003):');
  console.log(`  runs_total:           ${kpi.runs_total}`);
  console.log(`  exec_success_rate:    ${kpi.exec_success_rate}%`);
  console.log(`  operator_accept_rate: ${kpi.operator_accept_rate ?? 'N/A'}%`);
  console.log(`  probe_measured_rate:  ${kpi.probe_measured_rate}%`);
  console.log(`  recovery_rate:        ${kpi.recovery_rate ?? 'N/A'}%`);
  console.log('');

  mkdirSync(REPORTS_DIR, { recursive: true });

  const period = { start: sinceDate, end: endDate };

  // Markdown 报告
  const mdReport = generateMarkdownReport(kpi, period);
  const mdPath = options.output || join(REPORTS_DIR, `weekly_${endDate}.md`);
  writeFileSync(mdPath, mdReport);
  console.log(`${GREEN}Markdown: ${mdPath}${RESET}`);

  // JSON 报告（可选）
  if (options.json) {
    const jsonReport = generateJsonReport(kpi, period);
    const jsonPath = mdPath.replace('.md', '.json');
    writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    console.log(`${GREEN}JSON: ${jsonPath}${RESET}`);
  }

  return { kpi, mdPath };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { since: null, output: null, json: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since' && args[i + 1]) {
      result.since = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      result.output = args[++i];
    } else if (args[i] === '--json') {
      result.json = true;
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();
  try {
    await generateReport(args);
    process.exit(0);
  } catch (e) {
    console.error(`${RED}Error: ${e.message}${RESET}`);
    process.exit(1);
  }
}

export { generateReport, aggregateStats, FROZEN_COLUMNS };

main();
