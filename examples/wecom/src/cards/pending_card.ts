/**
 * Pending Card Renderer for Enterprise WeChat
 *
 * Renders timeout/pending state with trace_id for status query.
 * Provides user guidance for follow-up actions.
 */

export interface PendingOptions {
  traceId: string;
  task?: string;
  reason?: string;
  estimatedMinutes?: number;
}

/**
 * Render pending card as WeChat Markdown
 *
 * Used when:
 * - Gateway call times out (20s budget exceeded)
 * - Long-running task is queued for async processing
 * - System is under high load
 */
export function renderPendingCard(opts: PendingOptions): string {
  const { traceId, task, reason, estimatedMinutes = 3 } = opts;

  const lines: string[] = [];

  // Header
  lines.push('## ⏳ 已接收，处理中');
  lines.push('');

  // Trace ID (for status query)
  lines.push(`**Trace ID**：\`${traceId}\``);
  lines.push('');

  // Task info if available
  if (task) {
    lines.push(`**任务**：${task.slice(0, 50)}${task.length > 50 ? '...' : ''}`);
    lines.push('');
  }

  // Reason if available
  if (reason) {
    lines.push(`**原因**：${reason}`);
    lines.push('');
  }

  // Status query instruction
  lines.push('---');
  lines.push('**查询状态**：私聊发送');
  lines.push(`> /status ${traceId}`);
  lines.push('');

  // Estimated time
  lines.push(`**预计完成**：${estimatedMinutes}-${estimatedMinutes + 2} 分钟`);
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('*完成后将自动推送结果到本群*');

  return lines.join('\n');
}

/**
 * Render error card for unrecoverable failures
 */
export function renderErrorCard(traceId: string, errorCode: string, errorMessage: string): string {
  const lines: string[] = [];

  // Error code display mapping
  const ERROR_DISPLAY: Record<string, string> = {
    AGE_UNREACHABLE: '🔌 AGE 服务不可达',
    AGE_TIMEOUT: '⏰ AGE 响应超时',
    GATEWAY_ERROR: '🚫 Gateway 内部错误',
    AUTH_EXPIRED: '🔑 认证已过期',
    RATE_LIMIT: '🚦 请求频率限制',
    IDEMPOTENT_DUPLICATE: '🔄 重复请求已处理',
    UNKNOWN: '❓ 未知错误'
  };

  const display = ERROR_DISPLAY[errorCode] || ERROR_DISPLAY.UNKNOWN;

  lines.push(`## ${display}`);
  lines.push('');
  lines.push(`**Trace ID**：\`${traceId}\``);
  lines.push(`**错误码**：\`${errorCode}\``);
  lines.push('');

  if (errorMessage) {
    lines.push(`**详情**：${errorMessage}`);
    lines.push('');
  }

  // Suggestions
  lines.push('---');
  lines.push('**建议**：');

  switch (errorCode) {
    case 'AGE_UNREACHABLE':
      lines.push('> 检查 AGE MCP 服务是否运行');
      break;
    case 'AGE_TIMEOUT':
      lines.push('> 稍后重试或检查网络连接');
      break;
    case 'AUTH_EXPIRED':
      lines.push('> 刷新 API 凭证');
      break;
    case 'RATE_LIMIT':
      lines.push('> 等待 1-2 分钟后重试');
      break;
    case 'IDEMPOTENT_DUPLICATE':
      lines.push('> 此请求已处理，请查询状态或等待结果');
      break;
    default:
      lines.push('> 联系管理员或查看系统日志');
  }

  return lines.join('\n');
}

/**
 * Render acknowledgment card (quick response to avoid WeChat retry)
 */
export function renderAckCard(traceId: string): string {
  return [
    '## ✓ 已收到',
    '',
    `**Trace ID**：\`${traceId}\``,
    '',
    '正在处理，请稍候...'
  ].join('\n');
}
