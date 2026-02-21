/**
 * Verdict Card Renderer for Enterprise WeChat
 *
 * Renders GOV_TOOL_CALL_RESPONSE_V1 into WeChat Markdown format.
 * Follows Thin-Agent principle: render only, no decision logic.
 */

export interface GovResponse {
  ok: boolean;
  decision: 'ALLOW' | 'BLOCK' | 'DEGRADE' | 'PENDING' | 'UNKNOWN';
  trace_id: string;
  origin?: string;
  origin_proof?: boolean;
  mock_used?: boolean;
  policy_version?: string;
  verdict_summary?: string;
  fallback_reason?: string;
  // Extended fields
  execution_result?: {
    summary?: {
      total_actions?: number;
      simulated_actions?: number;
      executed_actions?: number;
      blocked_actions?: number;
      notes?: string;
    };
  };
}

// Decision emoji and color indicators
const DECISION_DISPLAY: Record<string, { emoji: string; color: string }> = {
  ALLOW: { emoji: '✅', color: 'info' },
  BLOCK: { emoji: '🚫', color: 'warning' },
  DEGRADE: { emoji: '⚠️', color: 'comment' },
  PENDING: { emoji: '⏳', color: 'info' },
  UNKNOWN: { emoji: '❓', color: 'comment' }
};

// Summary messages by decision
const SUMMARY_MESSAGES: Record<string, string> = {
  ALLOW: '已通过治理检查，可继续执行下一步。',
  BLOCK: '已阻止执行，请查看原因并按指引处理。',
  DEGRADE: '已降级到 mock fallback，结果可用但受限。',
  PENDING: '报告正在后台生成，完成后将自动推送结果。',
  UNKNOWN: '无法确定决策，请检查系统状态。'
};

/**
 * Render verdict response as WeChat Markdown
 */
export function renderVerdictCard(response: GovResponse): string {
  const decision = response.decision || 'UNKNOWN';
  const display = DECISION_DISPLAY[decision] || DECISION_DISPLAY.UNKNOWN;
  const summary = response.verdict_summary || SUMMARY_MESSAGES[decision];

  const lines: string[] = [];

  // Header
  lines.push(`## ${display.emoji} LiYe Verdict · ${decision}`);
  lines.push('');

  // Summary
  lines.push(`**摘要**：${summary}`);
  lines.push('');

  // Details
  lines.push('---');
  lines.push(`**Trace ID**：\`${response.trace_id}\``);
  lines.push(`**来源**：\`${response.origin || 'unknown'}\``);

  if (response.mock_used) {
    lines.push(`**Mock**：是`);
    if (response.fallback_reason) {
      lines.push(`**降级原因**：${response.fallback_reason}`);
    }
  }

  lines.push(`**策略版本**：\`${response.policy_version || 'unknown'}\``);

  // Execution summary if available
  if (response.execution_result?.summary) {
    const s = response.execution_result.summary;
    lines.push('');
    lines.push('**执行摘要**：');
    lines.push(`> ${s.executed_actions || s.simulated_actions || 0} 执行 / ${s.blocked_actions || 0} 阻止 / ${s.total_actions || 0} 总计`);
    if (s.notes) {
      lines.push(`> ${s.notes}`);
    }
  }

  // Footer
  lines.push('');
  lines.push('---');
  lines.push('*Thin-Agent: 企微侧仅转发与展示*');

  return lines.join('\n');
}

/**
 * Render a simple text fallback when markdown fails
 */
export function renderVerdictText(response: GovResponse): string {
  const decision = response.decision || 'UNKNOWN';
  const display = DECISION_DISPLAY[decision] || DECISION_DISPLAY.UNKNOWN;

  return [
    `${display.emoji} LiYe Verdict: ${decision}`,
    `Trace: ${response.trace_id}`,
    `Origin: ${response.origin || 'unknown'}`,
    response.verdict_summary || SUMMARY_MESSAGES[decision]
  ].join('\n');
}
