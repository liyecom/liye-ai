/**
 * Final Result Renderer
 *
 * Converts GovToolCallResponseV1 to final Slack message.
 * Integrates with error sanitization for secure logging.
 */

import { toUserSafeError, formatSlackError } from '../util/errors.js';

export interface GovToolCallResponseV1 {
  version: 'GOV_TOOL_CALL_RESPONSE_V1';
  trace_id: string;
  decision: 'ALLOW' | 'BLOCK' | 'DEGRADE' | 'PENDING';
  verdict_summary: string;
  execution_result?: {
    summary?: {
      total_spend?: number;
      total_wasted_spend?: number;
      wasted_percentage?: number;
      wasted_count?: number;
      total_search_terms_analyzed?: number;
      time_range?: {
        start_date: string;
        end_date: string;
      };
    };
    wasted_spend?: Array<{
      campaign_name?: string;
      ad_group_name?: string;
      search_term?: string;
      spend?: number;
      clicks?: number;
      impressions?: number;
      recommendation?: string;
    }>;
  };
  evidence_package?: Record<string, unknown>;
  policy_version: string;
}

/**
 * Format currency value.
 */
function formatCurrency(value: number | undefined): string {
  if (value === undefined) return '-';
  return `$${value.toFixed(2)}`;
}

/**
 * Render final result as Slack blocks/message.
 */
export function renderFinalResult(response: GovToolCallResponseV1): string {
  const lines: string[] = [];
  const traceId = response.trace_id;

  // Decision header
  const decisionEmoji: Record<string, string> = {
    ALLOW: '✅',
    BLOCK: '🚫',
    DEGRADE: '⚠️',
    PENDING: '⏳',
  };
  const emoji = decisionEmoji[response.decision] || '❓';

  lines.push(`${emoji} *${response.decision}*: ${response.verdict_summary}`);
  lines.push('');

  if (response.decision === 'ALLOW' && response.execution_result) {
    const result = response.execution_result;

    // Summary section
    if (result.summary) {
      const summary = result.summary;
      lines.push('*📊 Summary*');

      if (summary.time_range) {
        lines.push(`• Period: ${summary.time_range.start_date} → ${summary.time_range.end_date}`);
      }
      lines.push(`• Total Spend: ${formatCurrency(summary.total_spend)}`);
      lines.push(`• Wasted Spend: ${formatCurrency(summary.total_wasted_spend)} (${summary.wasted_percentage?.toFixed(1) || 0}%)`);
      lines.push(`• Search Terms Analyzed: ${summary.total_search_terms_analyzed || 0}`);
      lines.push(`• Wasted Items Found: ${summary.wasted_count || 0}`);
      lines.push('');
    }

    // Top wasted items (limit to 5 for readability)
    if (result.wasted_spend && result.wasted_spend.length > 0) {
      lines.push('*🔥 Top Wasted Spend*');

      const topItems = result.wasted_spend.slice(0, 5);
      for (const item of topItems) {
        const spend = formatCurrency(item.spend);
        const term = item.search_term || 'N/A';
        const campaign = item.campaign_name || 'N/A';
        lines.push(`• *${term}* - ${spend} (${item.clicks || 0} clicks)`);
        lines.push(`  └ Campaign: ${campaign}`);
        if (item.recommendation) {
          lines.push(`  └ 💡 ${item.recommendation}`);
        }
      }

      if (result.wasted_spend.length > 5) {
        lines.push(`_...and ${result.wasted_spend.length - 5} more_`);
      }
      lines.push('');
    }
  } else if (response.decision === 'BLOCK') {
    lines.push('*❌ Request was blocked by governance policy.*');
    lines.push('');
  } else if (response.decision === 'DEGRADE') {
    lines.push('*⚠️ Request completed with degraded results.*');
    lines.push('');
  } else if (response.decision === 'PENDING') {
    lines.push('*⏳ Request is still pending. Check back later.*');
    lines.push('');
  }

  // Footer with trace info (always visible)
  lines.push('---');
  lines.push(`📋 *Trace ID*: \`${traceId}\``);
  lines.push(`💡 查询详情: \`GET /v1/traces/${traceId}\``);

  return lines.join('\n');
}

/**
 * Render error message using sanitized user-safe error format.
 */
export function renderError(error: Error | unknown, traceId: string): string {
  const safeError = toUserSafeError(error, traceId);
  return formatSlackError(safeError);
}

/**
 * Render contract validation error.
 */
export function renderContractError(errors: string[], traceId: string): string {
  const lines: string[] = [
    '❌ *Contract Validation Failed*',
    '',
  ];

  // Show first 3 errors max
  const displayErrors = errors.slice(0, 3);
  for (const err of displayErrors) {
    lines.push(`• ${err}`);
  }
  if (errors.length > 3) {
    lines.push(`_...and ${errors.length - 3} more_`);
  }

  lines.push('');
  lines.push('---');
  lines.push(`📋 *Trace ID*: \`${traceId}\``);
  lines.push(`💡 使用 trace ID 可查询详细状态`);

  return lines.join('\n');
}
