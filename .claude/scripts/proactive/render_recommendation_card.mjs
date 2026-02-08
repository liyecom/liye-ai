#!/usr/bin/env node
/**
 * Render Recommendation Card v1.0.0
 * SSOT: .claude/scripts/proactive/render_recommendation_card.mjs
 *
 * 将 playbook_io 输出渲染为飞书卡片格式。
 * 卡片包含：run_id、evidence_package_ref、建议摘要、置信度、scope。
 * 带 [批准]/[拒绝] 按钮用于 OperatorSuccess 信号收集。
 *
 * 用法:
 *   node render_recommendation_card.mjs < playbook_io.json
 *   node render_recommendation_card.mjs --input playbook_io.json
 *   node render_recommendation_card.mjs --input playbook_io.json --callback-url http://...
 */

import { readFileSync } from 'fs';

// ===============================================================
// 卡片渲染配置
// ===============================================================

const CARD_CONFIG = {
  // 默认回调 URL 模板
  callbackUrlTemplate: process.env.OPERATOR_CALLBACK_URL || 'http://localhost:8787/callback/operator',

  // 颜色映射
  verdictColors: {
    OK: 'green',
    WARN: 'orange',
    CRIT: 'red'
  },

  // 图标映射
  verdictIcons: {
    OK: '✅',
    WARN: '⚠️',
    CRIT: '🔴'
  }
};

// ===============================================================
// 卡片渲染函数
// ===============================================================

/**
 * 渲染推荐卡片
 */
export function renderRecommendationCard(playbookOutput, options = {}) {
  const callbackUrl = options.callbackUrl || CARD_CONFIG.callbackUrlTemplate;

  const {
    playbook_id,
    run_id,
    timestamp,
    engine_id,
    outputs
  } = playbookOutput;

  const verdict = outputs.verdict;
  const recommendations = outputs.recommendations || [];
  const evidenceRef = outputs.evidence_package_ref;

  // 构建推荐摘要
  const recommendationSummary = recommendations.map((rec, i) => {
    const confidence = Math.round((rec.confidence || 0) * 100);
    const impact = rec.dry_run_result?.impact || 'No impact description';
    const tier = rec.requires_tier || 'recommend';

    return {
      action: rec.action_type,
      confidence: `${confidence}%`,
      impact: impact.slice(0, 100),  // 截断过长内容
      tier,
      priority: rec.priority || 50
    };
  });

  // 构建飞书卡片 JSON
  const card = {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        tag: 'plain_text',
        content: `${CARD_CONFIG.verdictIcons[verdict]} Proactive Recommendation [${verdict}]`
      },
      template: CARD_CONFIG.verdictColors[verdict]
    },
    elements: [
      // 基本信息
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Run ID**\n\`${run_id}\``
            }
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Playbook**\n${playbook_id}`
            }
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Engine**\n${engine_id || 'unknown'}`
            }
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**Time**\n${new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
            }
          }
        ]
      },

      // 分隔线
      { tag: 'hr' },

      // 推荐摘要标题
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**📋 Recommendations (${recommendations.length})**`
        }
      }
    ]
  };

  // 添加每个推荐
  for (const rec of recommendationSummary) {
    card.elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `• **${rec.action}** (${rec.confidence} confidence, priority ${rec.priority})\n  _${rec.impact}_\n  Tier: \`${rec.tier}\``
      }
    });
  }

  // 添加证据引用
  if (evidenceRef) {
    card.elements.push(
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**📎 Evidence**\n\`${evidenceRef}\``
        }
      }
    );
  }

  // 添加操作按钮
  card.elements.push(
    { tag: 'hr' },
    {
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: '✅ 批准'
          },
          type: 'primary',
          value: JSON.stringify({
            action: 'approve',
            run_id: run_id,
            playbook_id: playbook_id,
            callback_url: callbackUrl
          })
        },
        {
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: '❌ 拒绝'
          },
          type: 'danger',
          value: JSON.stringify({
            action: 'reject',
            run_id: run_id,
            playbook_id: playbook_id,
            callback_url: callbackUrl
          })
        },
        {
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: '📝 详情'
          },
          type: 'default',
          url: `${callbackUrl}/details/${run_id}`
        }
      ]
    }
  );

  // 添加免责声明
  card.elements.push({
    tag: 'note',
    elements: [
      {
        tag: 'plain_text',
        content: 'Week 3: Recommend only, no write actions. Click 批准/拒绝 to record operator feedback.'
      }
    ]
  });

  return card;
}

/**
 * 渲染简化版文本消息（用于无卡片支持的场景）
 */
export function renderTextSummary(playbookOutput) {
  const { playbook_id, run_id, outputs } = playbookOutput;
  const verdict = outputs.verdict;
  const recommendations = outputs.recommendations || [];

  const recList = recommendations
    .map((r, i) => `  ${i + 1}. ${r.action_type} (${Math.round(r.confidence * 100)}%)`)
    .join('\n');

  return `
[${CARD_CONFIG.verdictIcons[verdict]} ${verdict}] Proactive Recommendation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run ID: ${run_id}
Playbook: ${playbook_id}
Recommendations:
${recList || '  (none)'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reply /approve ${run_id} or /reject ${run_id}
`.trim();
}

// ===============================================================
// CLI 入口
// ===============================================================

function parseArgs(args) {
  const result = {
    inputPath: null,
    callbackUrl: null,
    format: 'card'  // 'card' | 'text'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
      case '-i':
        result.inputPath = args[++i];
        break;
      case '--callback-url':
      case '-c':
        result.callbackUrl = args[++i];
        break;
      case '--text':
        result.format = 'text';
        break;
      case '--help':
      case '-h':
        console.log(`
Render Recommendation Card

Usage:
  node render_recommendation_card.mjs [options]

Options:
  --input, -i        Path to playbook_io.json (or use stdin)
  --callback-url, -c Operator callback URL
  --text             Output text format instead of card JSON
  --help, -h         Show this help

Examples:
  cat playbook_io.json | node render_recommendation_card.mjs
  node render_recommendation_card.mjs -i playbook_io.json
`);
        process.exit(0);
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  let inputJson;

  if (options.inputPath) {
    inputJson = readFileSync(options.inputPath, 'utf-8');
  } else if (!process.stdin.isTTY) {
    // 从 stdin 读取
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    inputJson = Buffer.concat(chunks).toString('utf-8');
  } else {
    console.error('Error: No input provided. Use --input or pipe JSON to stdin.');
    process.exit(1);
  }

  try {
    const playbookOutput = JSON.parse(inputJson);

    if (options.format === 'text') {
      console.log(renderTextSummary(playbookOutput));
    } else {
      const card = renderRecommendationCard(playbookOutput, {
        callbackUrl: options.callbackUrl
      });
      console.log(JSON.stringify(card, null, 2));
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

// 导出
export { CARD_CONFIG };

// 直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
