#!/usr/bin/env node

/**
 * Memory Health Report Generator
 *
 * Generates JSON + Markdown health metrics for MAAP governance.
 *
 * Usage:
 *   node scripts/ops/memory-health.mjs [--days 7] [--output ./artifacts]
 *
 * Output:
 *   - artifacts/memory-health.json (machine-readable)
 *   - artifacts/memory-health.md (human-readable)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../');

// Parse arguments
const args = process.argv.slice(2);
let daysWindow = 7;
let outputDir = path.join(PROJECT_ROOT, 'artifacts');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--days' && args[i + 1]) {
    daysWindow = parseInt(args[i + 1], 10);
    i++;
  }
  if (args[i] === '--output' && args[i + 1]) {
    outputDir = args[i + 1];
    i++;
  }
}

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Load governance events from JSONL file
 */
function loadEvents(logPath, daysWindow) {
  if (!fs.existsSync(logPath)) {
    return [];
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  const events = [];
  const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(l => l.trim());

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const timestamp = new Date(event.timestamp);
      if (timestamp >= cutoff) {
        events.push(event);
      }
    } catch (e) {
      // Skip invalid lines
    }
  }

  return events;
}

/**
 * Calculate health metrics
 */
function calculateMetrics(events) {
  const metrics = {
    window_days: daysWindow,
    timestamp: new Date().toISOString(),
    total_events: events.length,

    // Core KPIs
    rejected_observations: 0,
    legacy_detected: 0,
    successful_observations: 0,

    // Failure reason breakdown
    failure_reasons: {},

    // Rates
    rejection_rate: 0,
    legacy_detection_rate: 0,
  };

  // Count events
  for (const event of events) {
    if (event.event === 'MAAP_OBSERVATION_REJECTED') {
      metrics.rejected_observations++;

      // Track failure reasons
      if (event.invalid_fields && Array.isArray(event.invalid_fields)) {
        for (const reason of event.invalid_fields) {
          metrics.failure_reasons[reason] = (metrics.failure_reasons[reason] || 0) + 1;
        }
      }
      if (event.missing_fields && Array.isArray(event.missing_fields)) {
        for (const field of event.missing_fields) {
          const reason = `missing: ${field}`;
          metrics.failure_reasons[reason] = (metrics.failure_reasons[reason] || 0) + 1;
        }
      }
    }

    if (event.event === 'MAAP_OBSERVATION_LEGACY_DETECTED') {
      metrics.legacy_detected++;
    }

    if (event.event === 'MAAP_OBSERVATION_SAVED') {
      metrics.successful_observations++;
    }
  }

  // Calculate rates
  const total_write_attempts = metrics.rejected_observations + metrics.successful_observations;
  if (total_write_attempts > 0) {
    metrics.rejection_rate = (metrics.rejected_observations / total_write_attempts * 100).toFixed(2) + '%';
  } else {
    metrics.rejection_rate = 'N/A (no write attempts)';
  }

  // Sort failure reasons
  metrics.top_failures = Object.entries(metrics.failure_reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => ({ reason, count }));

  return metrics;
}

/**
 * Generate health status assessment
 */
function assessHealth(metrics) {
  const rejectionRate = typeof metrics.rejection_rate === 'string'
    ? parseFloat(metrics.rejection_rate)
    : 0;

  if (rejectionRate >= 10) return 'critical';
  if (rejectionRate >= 5) return 'warning';
  return 'healthy';
}

/**
 * Generate markdown report
 */
function generateMarkdown(metrics) {
  const status = assessHealth(metrics);
  const statusEmoji = {
    healthy: '✅',
    warning: '⚠️',
    critical: '🚨',
  }[status];

  const topFailures = metrics.top_failures
    .map((f, i) => `${i + 1}. ${f.reason}: ${f.count} occurrences`)
    .join('\n');

  return `# Memory Health Report

**Period**: Last ${metrics.window_days} days
**Generated**: ${metrics.timestamp}
**Status**: ${statusEmoji} ${status.toUpperCase()}

## Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Total Events | ${metrics.total_events} | - |
| Rejected Observations | ${metrics.rejected_observations} | ${metrics.rejection_rate} |
| Legacy Detected | ${metrics.legacy_detected} | - |
| Successful Writes | ${metrics.successful_observations} | - |

## Top Rejection Reasons

${topFailures || 'No rejections in this period.'}

## Health Assessment

- **Rejection Rate**: ${metrics.rejection_rate} (Alert: ≥10%)
- **Status**: ${status === 'healthy' ? '✅ Healthy' : status === 'warning' ? '⚠️ Warning - Monitor closely' : '🚨 Critical - Immediate action required'}

## Recommended Actions

${status === 'critical' ? '1. Investigate top rejection reasons immediately\\n2. Check validation rules for overly strict constraints\\n' : status === 'warning' ? '1. Review top rejection reasons\\n2. Consider tuning validation rules if rejections are too strict\\n' : '1. Continue monitoring\\n2. No immediate action required\\n'}
3. Reference: [Memory Health Metrics](../docs/ops/memory-health-metrics.md)

---
**Artifact**: Auto-generated by \`scripts/ops/memory-health.mjs\`
`;
}

/**
 * Main
 */
async function main() {
  console.log(`📊 Generating memory health report for last ${daysWindow} days...`);

  const logPath = path.join(PROJECT_ROOT, '.liye/logs/test-compliance.jsonl');
  const events = loadEvents(logPath, daysWindow);

  if (events.length === 0) {
    console.log('⚠️ No events found in timeframe');
  }

  const metrics = calculateMetrics(events);

  // Generate outputs
  const jsonPath = path.join(outputDir, 'memory-health.json');
  const mdPath = path.join(outputDir, 'memory-health.md');

  fs.writeFileSync(jsonPath, JSON.stringify(metrics, null, 2), 'utf-8');
  console.log(`✅ JSON report: ${jsonPath}`);

  const markdown = generateMarkdown(metrics);
  fs.writeFileSync(mdPath, markdown, 'utf-8');
  console.log(`✅ Markdown report: ${mdPath}`);

  // Print summary
  console.log('\n📈 Summary:');
  console.log(`   Rejected: ${metrics.rejected_observations}`);
  console.log(`   Legacy Detected: ${metrics.legacy_detected}`);
  console.log(`   Rejection Rate: ${metrics.rejection_rate}`);
  console.log(`   Status: ${assessHealth(metrics).toUpperCase()}`);
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
