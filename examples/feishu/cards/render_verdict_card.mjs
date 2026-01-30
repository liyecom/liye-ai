/**
 * Verdict Card Renderer
 *
 * Renders GOV_TOOL_CALL_RESPONSE_V1 into Feishu Interactive Card.
 * Thin-Agent principle: render only, no decision logic.
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

/**
 * Render a verdict response into a Feishu Interactive Card
 *
 * @param {Object} response - GOV_TOOL_CALL_RESPONSE_V1 compliant response
 * @param {Object} opts - Options
 * @param {string} opts.traceViewerBaseUrl - Base URL for trace viewer (default: env or placeholder)
 * @returns {Object} Feishu interactive card JSON
 */
export function renderVerdictCard(response, opts = {}) {
  const traceViewerBaseUrl = opts.traceViewerBaseUrl ||
    process.env.TRACE_VIEWER_BASE_URL ||
    'https://liye.os/.liye/traces';

  // Handle missing template gracefully
  if (!cardTemplate) {
    return createFallbackTextCard(response);
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
      '{{trace_url}}': `${traceViewerBaseUrl}/${traceId}`
    };

    // Apply replacements
    let renderedString = cardString;
    for (const [placeholder, value] of Object.entries(replacements)) {
      renderedString = renderedString.split(placeholder).join(value);
    }

    return JSON.parse(renderedString);
  } catch (e) {
    console.error('[VerdictCard] Render error:', e.message);
    return createFallbackTextCard(response);
  }
}

/**
 * Create fallback text card when template rendering fails
 * Ensures at minimum: trace_id, decision, origin, mock_used are always shown
 */
function createFallbackTextCard(response) {
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
          `**Policy**：\`${policyVersion}\``
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

export default { renderVerdictCard, createFallbackTextMessage };
