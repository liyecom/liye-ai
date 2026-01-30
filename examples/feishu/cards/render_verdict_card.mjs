/**
 * Verdict Card Renderer
 *
 * Renders GOV_TOOL_CALL_RESPONSE_V1 into Feishu Interactive Card.
 * Thin-Agent principle: render only, no decision logic.
 *
 * Week3: Added why_md and evidence_status_md support.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load card template once at startup
let cardTemplate = null;
try {
  cardTemplate = JSON.parse(
    readFileSync(join(__dirname, 'verdict_card_v1.json'), 'utf-8')
  );
} catch (e) {
  console.error('[VerdictCard] Failed to load template:', e.message);
}

/**
 * Sanitize string for safe JSON embedding
 * Escapes control characters that would break JSON.parse
 */
function sanitizeForJson(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// Decision badge mapping
const DECISION_BADGES = {
  ALLOW: 'ALLOW',
  BLOCK: 'BLOCK',
  DEGRADE: 'DEGRADE',
  UNKNOWN: 'UNKNOWN'
};

// Header template colors (Feishu supported templates)
const HEADER_TEMPLATES = {
  ALLOW: 'green',
  BLOCK: 'red',
  DEGRADE: 'orange',
  UNKNOWN: 'grey'
};

// Summary messages
const SUMMARY_MESSAGES = {
  ALLOW: '已通过治理检查，可继续执行下一步。',
  BLOCK: '已阻止执行，请查看原因并按指引处理。',
  DEGRADE: '已降级到 mock fallback，结果可用但受限。',
  UNKNOWN: '无法确定决策，请检查系统状态。'
};

// Why messages (1-3 bullet points per decision type)
const WHY_MESSAGES = {
  ALLOW: [
    '通过治理检查（read-only）',
    '可生成 dry-run 计划用于复核'
  ],
  BLOCK: [
    '风险或不确定性过高',
    '已阻止执行，需补充信息或调整请求'
  ],
  DEGRADE: [
    'AGE 不可达，已降级 mock fallback',
    '结果可用但受限（建议稍后重试）'
  ],
  UNKNOWN: [
    '无法确定决策状态',
    '请检查系统配置或稍后重试'
  ]
};

/**
 * Generate why_md content based on decision
 * Returns 1-3 bullet points
 */
function generateWhyMd(decision, fallbackReason) {
  const points = WHY_MESSAGES[decision] || WHY_MESSAGES.UNKNOWN;
  let bullets = points.map(p => `- ${p}`);

  // Add fallback reason as additional bullet if present
  if (decision === 'DEGRADE' && fallbackReason) {
    bullets.push(`- 原因：${fallbackReason}`);
  }

  // Limit to 3 bullets
  return bullets.slice(0, 3).join('\\n');
}

/**
 * Generate evidence_status_md content
 * @param {Object} opts - Options
 * @param {string} opts.status - 'pending' | 'generating' | 'generated'
 * @param {string} opts.evidenceUrl - URL to evidence package
 */
function generateEvidenceStatusMd(opts = {}) {
  const status = opts.status || 'pending';
  const evidenceUrl = opts.evidenceUrl || '';

  switch (status) {
    case 'generating':
      return '**Evidence**：生成中…';
    case 'generated':
      return `**Evidence**：已生成 ✅ [打开](${evidenceUrl})`;
    case 'pending':
    default:
      return '**Evidence**：未生成';
  }
}

/**
 * Render a verdict response into a Feishu Interactive Card
 *
 * @param {Object} response - GOV_TOOL_CALL_RESPONSE_V1 compliant response
 * @param {Object} opts - Options
 * @param {string} opts.traceViewerBaseUrl - Base URL for trace viewer (default: env or placeholder)
 * @param {string} opts.evidenceStatus - 'pending' | 'generating' | 'generated'
 * @param {string} opts.evidenceUrl - URL to evidence package (when generated)
 * @returns {Object} Feishu interactive card JSON
 */
export function renderVerdictCard(response, opts = {}) {
  const traceViewerBaseUrl = opts.traceViewerBaseUrl ||
    process.env.TRACE_VIEWER_BASE_URL ||
    'https://liye.os/.liye/traces';

  // Handle missing template gracefully
  if (!cardTemplate) {
    return createFallbackTextCard(response, opts);
  }

  try {
    // Deep clone template
    const card = JSON.parse(JSON.stringify(cardTemplate));
    const cardString = JSON.stringify(card);

    // Extract fields from response (with defaults for safety)
    const decision = response.decision || 'UNKNOWN';
    const traceId = response.trace_id || 'unknown';
    const origin = response.origin || 'unknown';
    const originProof = response.origin_proof ?? false;
    const mockUsed = response.mock_used ?? false;
    const policyVersion = response.policy_version || 'unknown';
    // Sanitize text fields for JSON safety (escape special chars)
    const fallbackReason = sanitizeForJson(response.fallback_reason || '');
    const verdictSummary = sanitizeForJson(response.verdict_summary || SUMMARY_MESSAGES[decision]);

    // Week3: Generate why_md and evidence_status_md
    const whyMd = generateWhyMd(decision, response.fallback_reason);
    const evidenceStatusMd = generateEvidenceStatusMd({
      status: opts.evidenceStatus || 'pending',
      evidenceUrl: opts.evidenceUrl || `${traceViewerBaseUrl}/${traceId}/evidence_package.md`
    });

    // Build replacement map
    // Note: \n in JSON strings must be \\n when doing string replacement
    const replacements = {
      '{{decision_badge}}': DECISION_BADGES[decision] || decision,
      '{{header_template}}': HEADER_TEMPLATES[decision] || 'blue',
      '{{trace_id}}': traceId,
      '{{decision}}': decision,
      '{{origin}}': origin,
      '{{origin_proof}}': String(originProof),
      '{{mock_used}}': String(mockUsed),
      '{{fallback_reason_block}}': mockUsed && fallbackReason
        ? `\\n\\n**Fallback Reason**：${fallbackReason}`
        : '',
      '{{policy_version}}': policyVersion,
      '{{summary_md}}': verdictSummary,
      '{{trace_url}}': `${traceViewerBaseUrl}/${traceId}`,
      '{{why_md}}': whyMd,
      '{{evidence_status_md}}': evidenceStatusMd
    };

    // Apply replacements
    let renderedString = cardString;
    for (const [placeholder, value] of Object.entries(replacements)) {
      renderedString = renderedString.split(placeholder).join(value);
    }

    return JSON.parse(renderedString);
  } catch (e) {
    console.error('[VerdictCard] Render error:', e.message);
    return createFallbackTextCard(response, opts);
  }
}

/**
 * Render an evidence status update card (for action callbacks)
 */
export function renderEvidenceStatusCard(traceId, status, evidenceUrl, opts = {}) {
  const traceViewerBaseUrl = opts.traceViewerBaseUrl ||
    process.env.TRACE_VIEWER_BASE_URL ||
    'https://liye.os/.liye/traces';

  const statusText = status === 'generated'
    ? `Evidence Package 已生成 ✅`
    : status === 'generating'
      ? 'Evidence Package 生成中…'
      : 'Evidence Package 准备中…';

  const elements = [
    {
      tag: 'markdown',
      content: `**Trace ID**：\`${traceId}\`\n\n**状态**：${statusText}`
    }
  ];

  if (status === 'generated' && evidenceUrl) {
    elements.push({
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '打开 Evidence Package' },
          type: 'primary',
          url: evidenceUrl
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '打开 Trace' },
          type: 'default',
          url: `${traceViewerBaseUrl}/${traceId}`
        }
      ]
    });
  }

  elements.push({
    tag: 'note',
    elements: [
      { tag: 'plain_text', content: 'Thin-Agent：仅生成文件，不执行写操作。' }
    ]
  });

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `Evidence · ${traceId.slice(0, 20)}...` },
      template: status === 'generated' ? 'green' : 'blue'
    },
    elements
  };
}

/**
 * Create fallback text card when template rendering fails
 * Ensures at minimum: trace_id, decision, origin, mock_used are always shown
 */
function createFallbackTextCard(response, opts = {}) {
  const decision = response.decision || 'UNKNOWN';
  const traceId = response.trace_id || 'unknown';
  const origin = response.origin || 'unknown';
  const mockUsed = response.mock_used ?? false;
  const policyVersion = response.policy_version || 'unknown';

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `LiYe Verdict · ${decision}` },
      template: HEADER_TEMPLATES[decision] || 'blue'
    },
    elements: [
      {
        tag: 'markdown',
        content: [
          `**Trace ID**：\`${traceId}\``,
          `**Decision**：**${decision}**`,
          `**Origin**：\`${origin}\``,
          `**Mock Used**：\`${mockUsed}\``,
          `**Policy**：\`${policyVersion}\``,
          '',
          '### Why',
          ...WHY_MESSAGES[decision].map(p => `- ${p}`)
        ].join('\n\n')
      },
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: 'Thin-Agent：飞书侧仅转发与展示。' }
        ]
      }
    ]
  };
}

/**
 * Create a simple text message for extreme fallback
 * Used when even card rendering is impossible
 */
export function createFallbackTextMessage(response) {
  const decision = response.decision || 'UNKNOWN';
  const traceId = response.trace_id || 'unknown';
  const origin = response.origin || 'unknown';
  const mockUsed = response.mock_used ?? false;

  return `LiYe Verdict: ${decision}\nTrace: ${traceId}\nOrigin: ${origin}\nMock: ${mockUsed}`;
}

export default { renderVerdictCard, renderEvidenceStatusCard, createFallbackTextMessage };
