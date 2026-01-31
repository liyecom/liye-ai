/**
 * Verdict Card Renderer
 *
 * Renders GOV_TOOL_CALL_RESPONSE_V1 into Feishu Interactive Card.
 * Thin-Agent principle: render only, no decision logic.
 *
 * Week3: Added Why section and Evidence buttons
 * Week4: Added Approval status and approval buttons
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

// Week3: Why messages by decision
const WHY_MESSAGES = {
  ALLOW: [
    '通过治理检查（read-only 操作）',
    '符合 Phase 1 策略约束',
    '可生成 dry-run 计划用于复核'
  ],
  BLOCK: [
    '风险或不确定性过高',
    '不符合当前策略约束',
    '需要补充信息或调整请求'
  ],
  DEGRADE: [
    'AGE 服务不可达',
    '已降级到 mock fallback',
    '结果可用但受限（建议稍后重试）'
  ],
  UNKNOWN: [
    '无法确定决策状态',
    '请检查系统配置',
    '建议联系管理员'
  ]
};

// Week4: Approval status display
const APPROVAL_STATUS_DISPLAY = {
  DRAFT: '📝 草稿',
  SUBMITTED: '⏳ 待审批',
  APPROVED: '✅ 已批准',
  REJECTED: '❌ 已驳回',
  EXECUTED: '🚀 已执行',
  NOT_CREATED: '⬜ 未创建'
};

// Week5: Execution status display
const EXECUTION_STATUS_DISPLAY = {
  NOT_EXECUTED: '**执行**：未执行',
  IN_PROGRESS: '**执行**：执行中…',
  EXECUTED: '**执行**：已执行（Dry-run）✅'
};

/**
 * Generate Why section markdown
 */
function generateWhyMd(decision) {
  const points = WHY_MESSAGES[decision] || WHY_MESSAGES.UNKNOWN;
  return points.map(p => `• ${p}`).join('\\n');
}

/**
 * Generate Approval Status markdown
 */
function generateApprovalStatusMd(approvalStatus) {
  const display = APPROVAL_STATUS_DISPLAY[approvalStatus] || APPROVAL_STATUS_DISPLAY.NOT_CREATED;
  return `**状态**：${display}`;
}

/**
 * Generate Plan Status markdown
 */
function generatePlanStatusMd(planExists) {
  return planExists
    ? '**计划**：✅ 已生成'
    : '**计划**：⬜ 未生成（点击"提交审批"自动生成）';
}

/**
 * Week5: Generate Execution Status markdown
 */
function generateExecutionStatusMd(executionStatus, executionUrl) {
  if (executionStatus === 'EXECUTED' && executionUrl) {
    return `${EXECUTION_STATUS_DISPLAY.EXECUTED} [打开结果](${executionUrl})`;
  }
  if (executionStatus === 'IN_PROGRESS') {
    return EXECUTION_STATUS_DISPLAY.IN_PROGRESS;
  }
  return EXECUTION_STATUS_DISPLAY.NOT_EXECUTED;
}

/**
 * Render a verdict response into a Feishu Interactive Card
 *
 * @param {Object} response - GOV_TOOL_CALL_RESPONSE_V1 compliant response
 * @param {Object} opts - Options
 * @param {string} opts.traceViewerBaseUrl - Base URL for trace viewer
 * @param {string} opts.approvalStatus - Current approval status (Week4)
 * @param {boolean} opts.planExists - Whether action plan exists (Week4)
 * @param {string} opts.executionStatus - Execution status: NOT_EXECUTED, IN_PROGRESS, EXECUTED (Week5)
 * @param {string} opts.executionUrl - URL to execution result (Week5)
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

    // Week4: Approval and plan status
    const approvalStatus = opts.approvalStatus || 'NOT_CREATED';
    const planExists = opts.planExists || false;

    // Week5: Execution status
    const executionStatus = opts.executionStatus || 'NOT_EXECUTED';
    const executionUrl = opts.executionUrl || null;

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
      '{{why_md}}': generateWhyMd(decision),
      '{{approval_status_md}}': generateApprovalStatusMd(approvalStatus),
      '{{plan_status_md}}': generatePlanStatusMd(planExists),
      '{{execution_status_md}}': generateExecutionStatusMd(executionStatus, executionUrl),
      '{{plan_url}}': planExists
        ? `${traceViewerBaseUrl}/${traceId}/action_plan.md`
        : '#'
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
 * Week3: Render evidence status card (for action callbacks)
 *
 * @param {string} traceId - Trace identifier
 * @param {string} status - 'generated' | 'failed'
 * @param {string} evidenceUrl - URL to evidence file (if generated)
 * @param {Object} opts - Options
 * @returns {Object} Feishu interactive card JSON
 */
export function renderEvidenceStatusCard(traceId, status, evidenceUrl, opts = {}) {
  const isGenerated = status === 'generated';
  const headerColor = isGenerated ? 'green' : 'red';
  const statusEmoji = isGenerated ? '✅' : '❌';
  const statusText = isGenerated ? '已生成' : '生成失败';

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `Evidence ${statusEmoji} ${statusText}` },
      template: headerColor
    },
    elements: [
      {
        tag: 'markdown',
        content: `**Trace ID**：\`${traceId}\`\n\n**状态**：${statusText}`
      },
      ...(isGenerated && evidenceUrl ? [{
        tag: 'action',
        actions: [{
          tag: 'button',
          text: { tag: 'plain_text', content: '查看 Evidence' },
          type: 'primary',
          url: evidenceUrl
        }]
      }] : []),
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: 'Evidence 为只读文件，不可修改。' }
        ]
      }
    ]
  };
}

/**
 * Week4: Render approval status card (for approval action callbacks)
 *
 * @param {string} traceId - Trace identifier
 * @param {Object} approval - Approval object
 * @param {Object} opts - Options
 * @returns {Object} Feishu interactive card JSON
 */
export function renderApprovalStatusCard(traceId, approval, opts = {}) {
  const traceViewerBaseUrl = opts.traceViewerBaseUrl ||
    process.env.TRACE_VIEWER_BASE_URL ||
    'http://localhost:3210/trace';

  const status = approval?.status || 'NOT_CREATED';
  const statusDisplay = APPROVAL_STATUS_DISPLAY[status] || APPROVAL_STATUS_DISPLAY.NOT_CREATED;

  // Determine header color based on status
  const headerColors = {
    DRAFT: 'grey',
    SUBMITTED: 'orange',
    APPROVED: 'green',
    REJECTED: 'red',
    EXECUTED: 'blue',
    NOT_CREATED: 'grey'
  };
  const headerColor = headerColors[status] || 'grey';

  // Build review info if present
  let reviewInfo = '';
  if (approval?.review) {
    const reviewDecision = approval.review.decision === 'APPROVE' ? '✅ 批准' : '❌ 驳回';
    reviewInfo = `\\n\\n**审批结果**：${reviewDecision}`;
    if (approval.review.comment) {
      reviewInfo += `\\n**备注**：${sanitizeForJson(approval.review.comment)}`;
    }
    reviewInfo += `\\n**审批人**：\`${approval.review.reviewed_by}\``;
    reviewInfo += `\\n**审批时间**：${approval.review.reviewed_at}`;
  }

  // Build elements
  const elements = [
    {
      tag: 'markdown',
      content: `**Trace ID**：\`${traceId}\`\n\n**审批状态**：${statusDisplay}${reviewInfo}`
    }
  ];

  // Add action buttons based on status
  if (status === 'APPROVED') {
    elements.push({
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '查看计划' },
          type: 'primary',
          url: `${traceViewerBaseUrl}/${traceId}/action_plan.md`
        }
      ]
    });
  }

  elements.push({
    tag: 'note',
    elements: [
      { tag: 'plain_text', content: 'Week4: 所有写操作均为 dry-run，不会执行真实写入。' }
    ]
  });

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `Approval Status · ${statusDisplay}` },
      template: headerColor
    },
    elements
  };
}

/**
 * Week5: Render execution status card (for execute_dry_run action callbacks)
 *
 * @param {string} traceId - Trace identifier
 * @param {Object} executionResult - Execution result object
 * @param {Object} opts - Options
 * @returns {Object} Feishu interactive card JSON
 */
export function renderExecutionStatusCard(traceId, executionResult, opts = {}) {
  const traceViewerBaseUrl = opts.traceViewerBaseUrl ||
    process.env.TRACE_VIEWER_BASE_URL ||
    'http://localhost:3210/trace';

  const isSuccess = executionResult?.summary != null;
  const headerColor = isSuccess ? 'green' : 'red';
  const statusEmoji = isSuccess ? '✅' : '❌';
  const statusText = isSuccess ? '已执行' : '执行失败';

  // Build summary if available
  let summaryInfo = '';
  if (executionResult?.summary) {
    const s = executionResult.summary;
    summaryInfo = `\\n\\n**摘要**：${s.simulated_actions} 模拟 / ${s.blocked_actions} 阻止 / ${s.total_actions} 总计`;
    if (s.notes) {
      summaryInfo += `\\n> ${sanitizeForJson(s.notes)}`;
    }
  }

  // Build guarantee info
  let guaranteeInfo = '';
  if (executionResult?.GUARANTEE) {
    const g = executionResult.GUARANTEE;
    guaranteeInfo = `\\n\\n**保证**：no_real_write=${g.no_real_write}, write_calls_attempted=${g.write_calls_attempted}`;
  }

  const executionUrl = `${traceViewerBaseUrl}/${traceId}/execution_result.md`;

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `Execution ${statusEmoji} ${statusText} (Dry-run)` },
      template: headerColor
    },
    elements: [
      {
        tag: 'markdown',
        content: `**Trace ID**：\`${traceId}\`\n\n**模式**：🔒 Dry-run（无真实写入）${summaryInfo}${guaranteeInfo}`
      },
      ...(isSuccess ? [{
        tag: 'action',
        actions: [{
          tag: 'button',
          text: { tag: 'plain_text', content: '查看执行结果' },
          type: 'primary',
          url: executionUrl
        }]
      }] : []),
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: 'Week5: 所有执行均为 Dry-run，未执行真实 API 调用。' }
        ]
      }
    ]
  };
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

export default {
  renderVerdictCard,
  renderEvidenceStatusCard,
  renderApprovalStatusCard,
  renderExecutionStatusCard,
  createFallbackTextMessage
};
