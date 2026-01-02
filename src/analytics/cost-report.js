/**
 * Cost Report Generator
 * Aggregates events.jsonl into a cost governance dashboard
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse date range from options
 */
function parseDateRange(options) {
  const now = new Date();
  let from, to;

  if (options.from && options.to) {
    from = new Date(options.from);
    to = new Date(options.to);
    to.setHours(23, 59, 59, 999);
  } else {
    const days = options.days || 7;
    to = now;
    from = new Date(now);
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
  }

  return { from, to };
}

/**
 * Load and filter events from events.jsonl
 */
function loadEvents(repoRoot, options = {}) {
  const eventsPath = path.join(repoRoot, 'data', 'events.jsonl');

  if (!fs.existsSync(eventsPath)) {
    return [];
  }

  const { from, to } = parseDateRange(options);
  const lines = fs.readFileSync(eventsPath, 'utf8').trim().split('\n');
  const events = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      const eventDate = new Date(event.ts);

      // Date filter
      if (eventDate < from || eventDate > to) continue;

      // Broker filter
      if (options.broker && event.broker !== options.broker) continue;

      // Route filter
      if (options.route && event.route !== options.route) continue;

      events.push(event);
    } catch (e) {
      // Skip malformed lines
    }
  }

  return events;
}

/**
 * Aggregate events into metrics
 */
function aggregateMetrics(events) {
  const metrics = {
    total: 0,
    byBroker: {},
    byRoute: {},
    byErrorCode: {},
    byStatus: { ok: 0, fail: 0, needs_manual: 0, completed: 0 },
    totalRuntimeSec: 0,
    dangerousActionBlocks: 0,
  };

  // Only process 'end' events for status/runtime metrics
  const endEvents = events.filter(e => e.type === 'end');

  for (const event of endEvents) {
    metrics.total++;

    // Status
    const status = event.status || 'unknown';
    if (status === 'ok' || status === 'completed') {
      metrics.byStatus.ok++;
      metrics.byStatus.completed++;
    } else if (status === 'needs_manual') {
      metrics.byStatus.needs_manual++;
    } else if (status === 'fail' || status === 'failed') {
      metrics.byStatus.fail++;
    }

    // Runtime
    const runtime = event.runtime_sec || event.duration_ms / 1000 || 0;
    metrics.totalRuntimeSec += runtime;

    // By broker
    const broker = event.broker || 'unknown';
    if (!metrics.byBroker[broker]) {
      metrics.byBroker[broker] = {
        count: 0,
        ok: 0,
        needs_manual: 0,
        fail: 0,
        totalRuntime: 0,
        errors: {},
      };
    }
    metrics.byBroker[broker].count++;
    if (status === 'ok' || status === 'completed') {
      metrics.byBroker[broker].ok++;
    } else if (status === 'needs_manual') {
      metrics.byBroker[broker].needs_manual++;
    } else {
      metrics.byBroker[broker].fail++;
    }
    metrics.byBroker[broker].totalRuntime += runtime;

    // By route
    const route = event.route || 'unknown';
    if (!metrics.byRoute[route]) {
      metrics.byRoute[route] = {
        count: 0,
        ok: 0,
        needs_manual: 0,
        fail: 0,
        totalRuntime: 0,
        errors: {},
      };
    }
    metrics.byRoute[route].count++;
    if (status === 'ok' || status === 'completed') {
      metrics.byRoute[route].ok++;
    } else if (status === 'needs_manual') {
      metrics.byRoute[route].needs_manual++;
    } else {
      metrics.byRoute[route].fail++;
    }
    metrics.byRoute[route].totalRuntime += runtime;

    // Error codes
    const errorCode = event.error_code;
    if (errorCode && errorCode !== 'null') {
      metrics.byErrorCode[errorCode] = (metrics.byErrorCode[errorCode] || 0) + 1;
      if (metrics.byBroker[broker]) {
        metrics.byBroker[broker].errors[errorCode] =
          (metrics.byBroker[broker].errors[errorCode] || 0) + 1;
      }
      if (metrics.byRoute[route]) {
        metrics.byRoute[route].errors[errorCode] =
          (metrics.byRoute[route].errors[errorCode] || 0) + 1;
      }

      // Count FORBIDDEN_ACTION as dangerous action block
      if (errorCode === 'FORBIDDEN_ACTION') {
        metrics.dangerousActionBlocks++;
      }
    }

    // Check notes for dangerous action patterns
    const notes = event.notes || '';
    if (notes.includes('dangerous pattern') || notes.includes('reapprove')) {
      metrics.dangerousActionBlocks++;
    }
  }

  return metrics;
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(metrics) {
  const recommendations = [];

  // Check needs_manual rate
  if (metrics.total > 0) {
    const needsManualRate = metrics.byStatus.needs_manual / metrics.total;
    if (needsManualRate > 0.3) {
      recommendations.push(
        `⚠️ High needs_manual rate (${(needsManualRate * 100).toFixed(1)}%): Check broker CLI availability and auth status with \`liye broker check\``
      );
    }
  }

  // Check BROKER_NOT_INSTALLED errors
  if (metrics.byErrorCode.BROKER_NOT_INSTALLED > 0) {
    recommendations.push(
      `🔧 ${metrics.byErrorCode.BROKER_NOT_INSTALLED} tasks failed due to missing broker CLI. Install missing brokers: \`npm install -g @openai/codex\``
    );
  }

  // Check AUTH_REQUIRED errors
  if (metrics.byErrorCode.AUTH_REQUIRED > 0) {
    recommendations.push(
      `🔑 ${metrics.byErrorCode.AUTH_REQUIRED} tasks need authentication. Run \`codex auth\` or configure API keys in .env`
    );
  }

  // Check FORBIDDEN_ACTION
  if (metrics.byErrorCode.FORBIDDEN_ACTION > 0) {
    recommendations.push(
      `🚫 ${metrics.byErrorCode.FORBIDDEN_ACTION} tasks blocked by safety policy. Review prompts to avoid forbidden patterns (web scraping, token extraction)`
    );
  }

  // Check slow brokers
  for (const [broker, data] of Object.entries(metrics.byBroker)) {
    if (data.count >= 3) {
      const avgRuntime = data.totalRuntime / data.count;
      if (avgRuntime > 60) {
        recommendations.push(
          `⏱️ ${broker} broker averaging ${avgRuntime.toFixed(1)}s per task. Consider using faster models or optimizing prompts`
        );
      }
    }
  }

  // Default recommendation if none
  if (recommendations.length === 0) {
    recommendations.push('✅ No critical issues detected. System operating normally.');
  }

  return recommendations.slice(0, 3);
}

/**
 * Format report as Markdown
 */
function formatMarkdown(metrics, options, dateRange) {
  const lines = [];

  // Header
  lines.push('# Cost Governance Report');
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Filters
  lines.push('## Parameters');
  lines.push('');
  lines.push(`- **Period**: ${dateRange.from.toISOString().split('T')[0]} to ${dateRange.to.toISOString().split('T')[0]}`);
  if (options.broker) lines.push(`- **Broker Filter**: ${options.broker}`);
  if (options.route) lines.push(`- **Route Filter**: ${options.route}`);
  lines.push(`- **Total Missions**: ${metrics.total}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  const okRate = metrics.total > 0 ? ((metrics.byStatus.ok / metrics.total) * 100).toFixed(1) : 0;
  const needsManualRate = metrics.total > 0 ? ((metrics.byStatus.needs_manual / metrics.total) * 100).toFixed(1) : 0;
  const avgRuntime = metrics.total > 0 ? (metrics.totalRuntimeSec / metrics.total).toFixed(1) : 0;
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Success Rate | ${okRate}% |`);
  lines.push(`| Needs Manual Rate | ${needsManualRate}% |`);
  lines.push(`| Avg Runtime | ${avgRuntime}s |`);
  lines.push(`| Dangerous Action Blocks | ${metrics.dangerousActionBlocks} |`);
  lines.push('');

  // By Broker
  lines.push('## By Broker');
  lines.push('');
  lines.push('| Broker | Count | OK% | Needs Manual% | Avg Runtime | Top Error |');
  lines.push('|--------|-------|-----|---------------|-------------|-----------|');
  for (const [broker, data] of Object.entries(metrics.byBroker)) {
    const okPct = data.count > 0 ? ((data.ok / data.count) * 100).toFixed(0) : 0;
    const nmPct = data.count > 0 ? ((data.needs_manual / data.count) * 100).toFixed(0) : 0;
    const avgRt = data.count > 0 ? (data.totalRuntime / data.count).toFixed(1) : 0;
    const topError = Object.entries(data.errors).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    lines.push(`| ${broker} | ${data.count} | ${okPct}% | ${nmPct}% | ${avgRt}s | ${topError} |`);
  }
  lines.push('');

  // By Route
  lines.push('## By Route');
  lines.push('');
  lines.push('| Route | Count | OK% | Needs Manual% | Avg Runtime | Top Error |');
  lines.push('|-------|-------|-----|---------------|-------------|-----------|');
  for (const [route, data] of Object.entries(metrics.byRoute)) {
    const okPct = data.count > 0 ? ((data.ok / data.count) * 100).toFixed(0) : 0;
    const nmPct = data.count > 0 ? ((data.needs_manual / data.count) * 100).toFixed(0) : 0;
    const avgRt = data.count > 0 ? (data.totalRuntime / data.count).toFixed(1) : 0;
    const topError = Object.entries(data.errors).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    lines.push(`| ${route} | ${data.count} | ${okPct}% | ${nmPct}% | ${avgRt}s | ${topError} |`);
  }
  lines.push('');

  // Error Codes Top 10
  lines.push('## Error Codes (Top 10)');
  lines.push('');
  const sortedErrors = Object.entries(metrics.byErrorCode)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  if (sortedErrors.length > 0) {
    lines.push('| Error Code | Count |');
    lines.push('|------------|-------|');
    for (const [code, count] of sortedErrors) {
      lines.push(`| ${code} | ${count} |`);
    }
  } else {
    lines.push('_No errors recorded_');
  }
  lines.push('');

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');
  const recommendations = generateRecommendations(metrics);
  for (const rec of recommendations) {
    lines.push(`- ${rec}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format report as JSON
 */
function formatJson(metrics, options, dateRange) {
  return JSON.stringify({
    generated_at: new Date().toISOString(),
    period: {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    },
    filters: {
      broker: options.broker || null,
      route: options.route || null,
    },
    summary: {
      total_missions: metrics.total,
      success_rate: metrics.total > 0 ? metrics.byStatus.ok / metrics.total : 0,
      needs_manual_rate: metrics.total > 0 ? metrics.byStatus.needs_manual / metrics.total : 0,
      avg_runtime_sec: metrics.total > 0 ? metrics.totalRuntimeSec / metrics.total : 0,
      dangerous_action_blocks: metrics.dangerousActionBlocks,
    },
    by_broker: metrics.byBroker,
    by_route: metrics.byRoute,
    error_codes: metrics.byErrorCode,
    recommendations: generateRecommendations(metrics),
  }, null, 2);
}

/**
 * Generate cost report
 */
function generateCostReport(repoRoot, options = {}) {
  const dateRange = parseDateRange(options);
  const events = loadEvents(repoRoot, options);
  const metrics = aggregateMetrics(events);
  const format = options.format || 'md';

  let report;
  if (format === 'json') {
    report = formatJson(metrics, options, dateRange);
  } else {
    report = formatMarkdown(metrics, options, dateRange);
  }

  return {
    report,
    metrics,
    dateRange,
    format,
  };
}

/**
 * Save report to file
 */
function saveReport(repoRoot, report, format) {
  const reportsDir = path.join(repoRoot, 'reports', 'cost');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const ext = format === 'json' ? 'json' : 'md';
  const filename = `${date}_cost_report.${ext}`;
  const filepath = path.join(reportsDir, filename);

  fs.writeFileSync(filepath, report);
  return filepath;
}

module.exports = {
  generateCostReport,
  saveReport,
  loadEvents,
  aggregateMetrics,
  generateRecommendations,
};
