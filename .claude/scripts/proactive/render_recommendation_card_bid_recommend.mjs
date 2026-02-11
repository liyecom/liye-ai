#!/usr/bin/env node
/**
 * Bid Recommend Card Renderer v1.0.0
 * SSOT: .claude/scripts/proactive/render_recommendation_card_bid_recommend.mjs
 *
 * 渲染 bid_recommend playbook 的推荐结果为飞书交互卡片。
 * 卡片包含 3 个按钮：
 * - Approve & Applied (带 applied_at)
 * - Approve but Not Applied (不带 applied_at)
 * - Reject
 *
 * 用法:
 *   node render_recommendation_card_bid_recommend.mjs --run-id <run_id> [--dry-run]
 *   node render_recommendation_card_bid_recommend.mjs --input <json_file>
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHmac } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// ===============================================================
// 常量
// ===============================================================

const CALLBACK_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3210';
const HMAC_SECRET = process.env.OPERATOR_CALLBACK_HMAC_SECRET || 'dev_secret';

// 支持的契约版本（fail-closed：不支持的版本拒绝渲染）
const SUPPORTED_CONTRACT_VERSIONS = Object.freeze(['1']);

// 颜色配置
const HEADER_TEMPLATES = {
  recommend: 'orange',
  info: 'blue',
  success: 'green',
  error: 'red'
};

// ===============================================================
// 辅助函数
// ===============================================================

/**
 * 生成 HMAC 签名
 */
function generateHmac(payload) {
  return createHmac('sha256', HMAC_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * 格式化数字为百分比
 */
function formatPercent(value, decimals = 1) {
  if (value == null) return '-';
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 格式化 ACOS 方向指示
 */
function formatAcosDirection(direction) {
  return direction === 'low' ? '↓ (越低越好)' : '↑ (越高越好)';
}

/**
 * 获取 Top N entities 摘要
 */
function getTopEntities(entities, n = 5) {
  if (!Array.isArray(entities) || entities.length === 0) {
    return [];
  }

  // 按 delta_pct 降序排列
  const sorted = [...entities].sort((a, b) =>
    (b.delta_pct || 0) - (a.delta_pct || 0)
  );

  return sorted.slice(0, n);
}

/**
 * 生成 entities 表格 markdown
 */
function generateEntitiesTable(entities) {
  if (entities.length === 0) {
    return '_No entities_';
  }

  const rows = entities.map(e => {
    const keyword = e.keyword_text || e.keyword || '-';
    const matchType = e.match_type || '-';
    const acos = formatPercent(e.acos_7d || e.acos);
    const cvr = formatPercent(e.cvr_7d || e.cvr);
    const delta = e.delta_pct ? `+${e.delta_pct}%` : '-';

    return `| ${keyword} | ${matchType} | ${acos} | ${cvr} | ${delta} |`;
  });

  return [
    '| Keyword | Match | ACOS | CVR | Delta |',
    '|---------|-------|------|-----|-------|',
    ...rows
  ].join('\n');
}

/**
 * 生成回滚计划摘要
 */
function formatRollbackPlan(rollbackPlan) {
  if (!rollbackPlan) return 'N/A';

  const type = rollbackPlan.type || 'manual';
  const steps = rollbackPlan.steps || [];
  const window = rollbackPlan.safe_window_hours || 48;

  return `${type} (${window}h window)`;
}

// ===============================================================
// 版本协商 Fallback
// ===============================================================

/**
 * 渲染版本不兼容的 fallback 卡片（plain text）
 *
 * @param {Object} opts - 选项
 * @returns {Object} Feishu 卡片 JSON（plain text 警告）
 */
function renderVersionMismatchFallback({ run_id, engine_id, playbook_id, requested_version, supported_versions }) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '⚠️ Card Contract Version Mismatch' },
      template: 'red'
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: [
            `**Error**: Unsupported card contract version`,
            '',
            `- **Run ID**: ${run_id || 'unknown'}`,
            `- **Engine**: ${engine_id}/${playbook_id}`,
            `- **Requested Version**: ${requested_version || 'null (missing)'}`,
            `- **Supported Versions**: ${supported_versions.join(', ')}`,
            '',
            '**Action Required**: Update the playbook to output a supported card_contract_version.',
            '',
            '_This card cannot be rendered until the version is updated._'
          ].join('\n')
        }
      }
    ]
  };
}

// ===============================================================
// 卡片渲染
// ===============================================================

/**
 * 渲染 Bid Recommend 推荐卡片
 *
 * @param {Object} opts - 选项
 * @param {Object} opts.run_meta - Run 元数据
 * @param {Object} opts.recommendation - 推荐内容
 * @returns {Object} Feishu 交互卡片 JSON
 */
export function renderBidRecommendCard({ run_meta, recommendation }) {
  const {
    run_id,
    engine_id = 'age',
    playbook_id = 'bid_recommend',
    inputs_hash,
    policy_id = null,
    card_contract_version = null
  } = run_meta || {};

  // 契约版本协商：fail-closed（不支持的版本返回 plain text fallback）
  // card_contract_version 来源：playbook 输出或 run_meta
  const effectiveVersion = card_contract_version || recommendation?.card_contract_version;

  if (!effectiveVersion || !SUPPORTED_CONTRACT_VERSIONS.includes(effectiveVersion)) {
    return renderVersionMismatchFallback({
      run_id,
      engine_id,
      playbook_id,
      requested_version: effectiveVersion,
      supported_versions: SUPPORTED_CONTRACT_VERSIONS
    });
  }

  const {
    primary_metric = { name: 'acos', anomaly_direction: 'low' },
    entities = [],
    max_delta_pct = 20,
    cap_pct = 30,
    rollback_plan = null,
    lookback_days = 7
  } = recommendation || {};

  const entitiesCount = entities.length;
  const topEntities = getTopEntities(entities, 5);

  // 生成标题
  const metricName = (primary_metric.name || 'acos').toUpperCase();
  const directionEmoji = primary_metric.anomaly_direction === 'low' ? '↓' : '↑';
  const title = `Bid Recommend (${metricName}${directionEmoji}) - ${entitiesCount} keywords`;

  // 生成 callback payload（不含 applied_at，由按钮决定）
  const baseCallbackPayload = {
    run_id,
    engine_id,
    playbook_id,
    inputs_hash,
    policy_id,
    operator_source: 'feishu'
  };

  // 生成 callback URLs
  const callbackUrl = `${CALLBACK_BASE_URL}/v1/operator_callback`;

  // 按钮 value 需要携带完整上下文
  const approveAppliedValue = JSON.stringify({
    ...baseCallbackPayload,
    decision: 'approve',
    action_taken: 'applied'
  });

  const approveNotAppliedValue = JSON.stringify({
    ...baseCallbackPayload,
    decision: 'approve',
    action_taken: 'not_applied'
  });

  const rejectValue = JSON.stringify({
    ...baseCallbackPayload,
    decision: 'reject',
    action_taken: 'n/a'
  });

  // 构建卡片
  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: title },
      template: HEADER_TEMPLATES.recommend
    },
    elements: [
      // 核心指标区域
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**指标**：${metricName} ${formatAcosDirection(primary_metric.anomaly_direction)}` }
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**回溯**：${lookback_days} 天` }
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**建议 Delta**：+${max_delta_pct}%` }
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Cap**：${cap_pct}%` }
          }
        ]
      },
      { tag: 'hr' },
      // Top Entities 表格
      {
        tag: 'markdown',
        content: `**Top ${Math.min(5, entitiesCount)} Keywords** (共 ${entitiesCount} 个)\n\n${generateEntitiesTable(topEntities)}`
      },
      { tag: 'hr' },
      // 策略与回滚信息
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Policy**：\`${policy_id || 'N/A'}\`` }
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Rollback**：${formatRollbackPlan(rollback_plan)}` }
          }
        ]
      },
      // 风险提示
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: '⚠️ Recommend only: 本推荐不会自动执行，需人工确认后手动应用。' }
        ]
      },
      { tag: 'hr' },
      // 操作按钮
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '✅ Approve & Applied' },
            type: 'primary',
            value: { action: 'approve_applied', payload: approveAppliedValue }
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '📝 Approve (Not Applied)' },
            type: 'default',
            value: { action: 'approve_not_applied', payload: approveNotAppliedValue }
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '❌ Reject' },
            type: 'danger',
            value: { action: 'reject', payload: rejectValue }
          }
        ]
      },
      // Trace ID
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: `run_id: ${run_id} | inputs_hash: ${inputs_hash || 'N/A'}` }
        ]
      }
    ]
  };

  return card;
}

/**
 * 从 run 目录加载推荐数据
 */
function loadRunData(runId) {
  const runDir = join(PROJECT_ROOT, 'data', 'runs', runId);

  if (!existsSync(runDir)) {
    // Try state/runs as fallback
    const stateRunDir = join(PROJECT_ROOT, 'state', 'runs', runId);
    if (!existsSync(stateRunDir)) {
      throw new Error(`Run directory not found: ${runDir} or ${stateRunDir}`);
    }
    return loadRunDataFromDir(stateRunDir, runId);
  }

  return loadRunDataFromDir(runDir, runId);
}

function loadRunDataFromDir(runDir, runId) {
  // Load playbook_output.json
  const outputPath = join(runDir, 'playbook_output.json');
  if (!existsSync(outputPath)) {
    throw new Error(`Playbook output not found: ${outputPath}`);
  }

  const output = JSON.parse(readFileSync(outputPath, 'utf-8'));

  // Load input.json for inputs_hash
  const inputPath = join(runDir, 'input.json');
  let inputsHash = null;
  if (existsSync(inputPath)) {
    const input = JSON.parse(readFileSync(inputPath, 'utf-8'));
    inputsHash = input.inputs_hash || null;
  }

  // Extract data
  const recommendation = output.recommendation || output;
  const entities = recommendation.entities || output.entities || [];

  return {
    run_meta: {
      run_id: runId,
      engine_id: output.engine_id || 'age',
      playbook_id: output.playbook_id || 'bid_recommend',
      inputs_hash: inputsHash,
      policy_id: recommendation.policy_id || output.policy_id || null
    },
    recommendation: {
      primary_metric: recommendation.primary_metric || { name: 'acos', anomaly_direction: 'low' },
      entities,
      max_delta_pct: recommendation.delta_pct || recommendation.max_delta_pct || 20,
      cap_pct: recommendation.cap_pct || 30,
      rollback_plan: recommendation.rollback_plan || null,
      lookback_days: recommendation.lookback_days || 7
    }
  };
}

// ===============================================================
// CLI
// ===============================================================

async function main() {
  const args = process.argv.slice(2);

  let runId = null;
  let inputFile = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run-id' && args[i + 1]) {
      runId = args[++i];
    } else if (args[i] === '--input' && args[i + 1]) {
      inputFile = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  let data;

  if (inputFile) {
    // Load from JSON file
    data = JSON.parse(readFileSync(inputFile, 'utf-8'));
  } else if (runId) {
    // Load from run directory
    data = loadRunData(runId);
  } else {
    console.error('Usage: node render_recommendation_card_bid_recommend.mjs --run-id <run_id> [--dry-run]');
    console.error('       node render_recommendation_card_bid_recommend.mjs --input <json_file>');
    process.exit(1);
  }

  const card = renderBidRecommendCard(data);

  if (dryRun) {
    console.log(JSON.stringify(card, null, 2));
  } else {
    // Output compact JSON for piping
    console.log(JSON.stringify(card));
  }
}

// 如果直接运行
const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}

export default { renderBidRecommendCard };
