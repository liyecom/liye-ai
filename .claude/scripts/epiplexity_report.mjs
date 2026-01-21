#!/usr/bin/env node
/**
 * Epiplexity Report Generator
 * Phase 0-1: Value-for-Context analysis
 *
 * Phase 0 Output (console):
 *   - Total traces count
 *   - Global success rate (baseline)
 *   - Pack usage top 20
 *   - Pack success rate top 20
 *   - Pack drift top 20
 *
 * Phase 1 Output (markdown reports):
 *   - PACK_VALUE_FOR_CONTEXT.md
 *   - TOP_PACKS_BY_VFC.md
 *   - DRIFT_SOURCES.md
 *   - SCALE_OR_KILL_DECISION.md
 *
 * Usage:
 *   node epiplexity_report.mjs              # Phase 0 console output
 *   node epiplexity_report.mjs --phase1     # Generate Phase 1 markdown reports
 *   node epiplexity_report.mjs --help       # Show help
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

// ============================================================================
// Constants
// ============================================================================

const TRACE_FILE = path.join(REPO_ROOT, "data/traces/epiplexity/epiplexity-traces.jsonl");
const REPORTS_DIR = path.join(REPO_ROOT, "Artifacts_Vault/reports");

// VFC Thresholds (from contract)
const THRESHOLDS = {
  vfc: { high: 0.15, low: 0.02 },
  drift_risk: { high: 0.25, low: 0.05 }
};

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Read all traces from the trace file
 * @returns {Object[]}
 */
function readTraces() {
  if (!fs.existsSync(TRACE_FILE)) {
    console.warn(`[epiplexity_report] Trace file not found: ${TRACE_FILE}`);
    return [];
  }

  const content = fs.readFileSync(TRACE_FILE, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);

  return lines.map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.warn(`[epiplexity_report] Failed to parse line ${idx + 1}: ${e.message}`);
      return null;
    }
  }).filter(Boolean);
}

// ============================================================================
// Statistics Calculations
// ============================================================================

/**
 * Calculate baseline statistics
 * @param {Object[]} traces
 * @returns {Object}
 */
function calculateBaseline(traces) {
  if (traces.length === 0) {
    return {
      total_traces: 0,
      baseline_success: 0,
      total_tokens: 0,
      avg_tokens: 0,
      total_duration_ms: 0,
      avg_duration_ms: 0
    };
  }

  const successCount = traces.filter(t => t.task_success).length;
  const totalTokens = traces.reduce((sum, t) => sum + (t.context_tokens_total || 0), 0);
  const totalDuration = traces.reduce((sum, t) => sum + (t.duration_ms || 0), 0);

  return {
    total_traces: traces.length,
    baseline_success: successCount / traces.length,
    total_tokens: totalTokens,
    avg_tokens: Math.round(totalTokens / traces.length),
    total_duration_ms: totalDuration,
    avg_duration_ms: Math.round(totalDuration / traces.length)
  };
}

/**
 * Calculate per-pack statistics
 * @param {Object[]} traces
 * @returns {Map<string, Object>}
 */
function calculatePackStats(traces) {
  const packStats = new Map();

  for (const trace of traces) {
    const packs = trace.packs_loaded || [];
    for (const pack of packs) {
      if (!packStats.has(pack)) {
        packStats.set(pack, {
          pack_id: pack,
          usage_count: 0,
          success_count: 0,
          total_tokens: 0,
          drift_count: 0,
          failure_tags: []
        });
      }

      const stats = packStats.get(pack);
      stats.usage_count++;
      if (trace.task_success) {
        stats.success_count++;
      }
      stats.total_tokens += trace.context_tokens_total || 0;

      // Count drift (any failure mode tags)
      const tags = trace.failure_mode_tags || [];
      if (tags.length > 0) {
        stats.drift_count++;
        stats.failure_tags.push(...tags);
      }
    }
  }

  return packStats;
}

/**
 * Calculate VFC for each pack
 * @param {Map<string, Object>} packStats
 * @param {number} baselineSuccess
 * @returns {Object[]}
 */
function calculateVFC(packStats, baselineSuccess) {
  const results = [];

  for (const [packId, stats] of packStats) {
    const successRate = stats.usage_count > 0
      ? stats.success_count / stats.usage_count
      : 0;

    const driftRate = stats.usage_count > 0
      ? stats.drift_count / stats.usage_count
      : 0;

    const avgTokens = stats.usage_count > 0
      ? stats.total_tokens / stats.usage_count
      : 0;

    // VFC = ((success_rate - baseline) * (1 - drift_rate)) / (avg_tokens / 1000)
    // Avoid division by zero
    const tokenFactor = avgTokens > 0 ? avgTokens / 1000 : 1;
    const vfc = ((successRate - baselineSuccess) * (1 - driftRate)) / tokenFactor;

    // Determine verdict
    let verdict = "REVIEW";
    if (vfc >= THRESHOLDS.vfc.high && driftRate <= THRESHOLDS.drift_risk.low) {
      verdict = "KEEP";
    } else if (vfc <= THRESHOLDS.vfc.low && driftRate >= THRESHOLDS.drift_risk.high) {
      verdict = "DROP";
    }

    results.push({
      pack_id: packId,
      usage_count: stats.usage_count,
      avg_tokens: Math.round(avgTokens),
      success_rate: successRate,
      drift_rate: driftRate,
      vfc: vfc,
      verdict: verdict,
      failure_tags: [...new Set(stats.failure_tags)] // Unique tags
    });
  }

  return results;
}

// ============================================================================
// Phase 0: Console Output
// ============================================================================

function runPhase0(traces) {
  console.log("\n" + "=".repeat(60));
  console.log("Epiplexity Report - Phase 0 (Observation)");
  console.log("=".repeat(60) + "\n");

  const baseline = calculateBaseline(traces);
  const packStats = calculatePackStats(traces);
  const vfcResults = calculateVFC(packStats, baseline.baseline_success);

  // Basic stats
  console.log("📊 Basic Statistics");
  console.log("-".repeat(40));
  console.log(`Total traces:       ${baseline.total_traces}`);
  console.log(`Baseline success:   ${(baseline.baseline_success * 100).toFixed(2)}%`);
  console.log(`Average tokens:     ${baseline.avg_tokens}`);
  console.log(`Average duration:   ${baseline.avg_duration_ms}ms`);
  console.log();

  // Pack usage top 20
  console.log("📦 Pack Usage (Top 20)");
  console.log("-".repeat(40));
  const byUsage = [...vfcResults].sort((a, b) => b.usage_count - a.usage_count).slice(0, 20);
  for (const p of byUsage) {
    console.log(`  ${p.pack_id.padEnd(30)} ${p.usage_count} uses`);
  }
  console.log();

  // Pack success rate top 20
  console.log("✅ Pack Success Rate (Top 20)");
  console.log("-".repeat(40));
  const bySuccess = [...vfcResults]
    .filter(p => p.usage_count >= 3) // Minimum 3 uses for statistical relevance
    .sort((a, b) => b.success_rate - a.success_rate)
    .slice(0, 20);
  for (const p of bySuccess) {
    console.log(`  ${p.pack_id.padEnd(30)} ${(p.success_rate * 100).toFixed(1)}% (${p.usage_count} uses)`);
  }
  console.log();

  // Pack drift top 20
  console.log("⚠️  Pack Drift Risk (Top 20)");
  console.log("-".repeat(40));
  const byDrift = [...vfcResults]
    .filter(p => p.usage_count >= 3)
    .sort((a, b) => b.drift_rate - a.drift_rate)
    .slice(0, 20);
  for (const p of byDrift) {
    console.log(`  ${p.pack_id.padEnd(30)} ${(p.drift_rate * 100).toFixed(1)}% drift (${p.usage_count} uses)`);
  }
  console.log();

  // VFC top 20
  console.log("💎 Pack VFC (Top 20)");
  console.log("-".repeat(40));
  const byVFC = [...vfcResults]
    .filter(p => p.usage_count >= 3)
    .sort((a, b) => b.vfc - a.vfc)
    .slice(0, 20);
  for (const p of byVFC) {
    console.log(`  ${p.pack_id.padEnd(30)} VFC=${p.vfc.toFixed(4)} [${p.verdict}]`);
  }
  console.log();

  console.log("=".repeat(60));
  console.log("Phase 0 complete. Use --phase1 to generate markdown reports.");
  console.log("=".repeat(60) + "\n");

  return { baseline, packStats, vfcResults };
}

// ============================================================================
// Phase 1: Markdown Reports
// ============================================================================

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function generatePackValueForContext(vfcResults, baseline) {
  const lines = [
    "# Pack Value-for-Context Report",
    "",
    `**Generated**: ${new Date().toISOString()}`,
    `**Total Traces**: ${baseline.total_traces}`,
    `**Baseline Success Rate**: ${(baseline.baseline_success * 100).toFixed(2)}%`,
    "",
    "## VFC Formula",
    "",
    "```",
    "VFC(pack) = ((success_rate(pack) - baseline_success) * (1 - drift_rate(pack))) / (avg_tokens(pack) / 1000)",
    "```",
    "",
    "**Interpretation**: Net success improvement per 1000 tokens.",
    "",
    "## Thresholds",
    "",
    "| Signal | High | Low |",
    "|--------|------|-----|",
    `| VFC | ≥${THRESHOLDS.vfc.high} | ≤${THRESHOLDS.vfc.low} |`,
    `| Drift Risk | ≥${THRESHOLDS.drift_risk.high} | ≤${THRESHOLDS.drift_risk.low} |`,
    "",
    "## Verdict Rules",
    "",
    "- **KEEP**: VFC ≥ high AND drift_risk ≤ low",
    "- **DROP**: VFC ≤ low AND drift_risk ≥ high",
    "- **REVIEW**: Otherwise",
    "",
    "## Pack Analysis",
    "",
    "| Pack ID | Usage | Avg Tokens | Success Rate | Drift Rate | VFC | Verdict |",
    "|---------|-------|------------|--------------|------------|-----|---------|"
  ];

  // Sort by VFC descending
  const sorted = [...vfcResults].sort((a, b) => b.vfc - a.vfc);
  for (const p of sorted) {
    lines.push(
      `| ${p.pack_id} | ${p.usage_count} | ${p.avg_tokens} | ${(p.success_rate * 100).toFixed(1)}% | ${(p.drift_rate * 100).toFixed(1)}% | ${p.vfc.toFixed(4)} | ${p.verdict} |`
    );
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*Report generated by epiplexity_report.mjs*");

  return lines.join("\n");
}

function generateTopPacksByVFC(vfcResults) {
  const lines = [
    "# Top Packs by VFC (Value-for-Context)",
    "",
    `**Generated**: ${new Date().toISOString()}`,
    "",
    "## Top 20 High-Value Packs",
    "",
    "These packs provide the best \"bang for buck\" - high success contribution with low token cost.",
    "",
    "| Rank | Pack ID | VFC | Success Rate | Drift Rate | Avg Tokens | Verdict |",
    "|------|---------|-----|--------------|------------|------------|---------|"
  ];

  const top20 = [...vfcResults]
    .filter(p => p.usage_count >= 3)
    .sort((a, b) => b.vfc - a.vfc)
    .slice(0, 20);

  top20.forEach((p, idx) => {
    lines.push(
      `| ${idx + 1} | ${p.pack_id} | ${p.vfc.toFixed(4)} | ${(p.success_rate * 100).toFixed(1)}% | ${(p.drift_rate * 100).toFixed(1)}% | ${p.avg_tokens} | ${p.verdict} |`
    );
  });

  lines.push("");
  lines.push("## Insights");
  lines.push("");

  const keepCount = top20.filter(p => p.verdict === "KEEP").length;
  const reviewCount = top20.filter(p => p.verdict === "REVIEW").length;

  lines.push(`- **KEEP** verdicts in top 20: ${keepCount}`);
  lines.push(`- **REVIEW** verdicts in top 20: ${reviewCount}`);
  lines.push("");

  if (top20.length > 0) {
    const avgVFC = top20.reduce((sum, p) => sum + p.vfc, 0) / top20.length;
    lines.push(`- Average VFC of top 20: ${avgVFC.toFixed(4)}`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*Report generated by epiplexity_report.mjs*");

  return lines.join("\n");
}

function generateDriftSources(vfcResults) {
  const lines = [
    "# Drift Sources Report",
    "",
    `**Generated**: ${new Date().toISOString()}`,
    "",
    "## Top 20 High-Drift Packs",
    "",
    "These packs have high failure/drift rates and may be polluting the system.",
    "",
    "| Rank | Pack ID | Drift Rate | Success Rate | VFC | Usage | Verdict |",
    "|------|---------|------------|--------------|-----|-------|---------|"
  ];

  const top20Drift = [...vfcResults]
    .filter(p => p.usage_count >= 3)
    .sort((a, b) => b.drift_rate - a.drift_rate)
    .slice(0, 20);

  top20Drift.forEach((p, idx) => {
    lines.push(
      `| ${idx + 1} | ${p.pack_id} | ${(p.drift_rate * 100).toFixed(1)}% | ${(p.success_rate * 100).toFixed(1)}% | ${p.vfc.toFixed(4)} | ${p.usage_count} | ${p.verdict} |`
    );
  });

  lines.push("");
  lines.push("## Common Failure Mode Tags");
  lines.push("");

  // Aggregate all failure tags
  const tagCounts = new Map();
  for (const p of vfcResults) {
    for (const tag of p.failure_tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const sortedTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (sortedTags.length > 0) {
    lines.push("| Rank | Failure Tag | Count |");
    lines.push("|------|-------------|-------|");
    sortedTags.forEach(([tag, count], idx) => {
      lines.push(`| ${idx + 1} | ${tag} | ${count} |`);
    });
  } else {
    lines.push("*No failure tags recorded yet.*");
  }

  lines.push("");
  lines.push("## Recommendations");
  lines.push("");

  const dropCandidates = vfcResults.filter(p => p.verdict === "DROP");
  if (dropCandidates.length > 0) {
    lines.push(`- **${dropCandidates.length} packs** marked as DROP candidates`);
    for (const p of dropCandidates.slice(0, 5)) {
      lines.push(`  - \`${p.pack_id}\`: VFC=${p.vfc.toFixed(4)}, Drift=${(p.drift_rate * 100).toFixed(1)}%`);
    }
  } else {
    lines.push("- No packs currently marked as DROP candidates");
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*Report generated by epiplexity_report.mjs*");

  return lines.join("\n");
}

function generateScaleOrKillDecision(vfcResults, baseline) {
  const lines = [
    "# Scale or Kill Decision - Epiplexity Phase 0-1",
    "",
    `**Generated**: ${new Date().toISOString()}`,
    `**Decision Deadline**: 2 weeks from Phase 0 start`,
    "",
    "---",
    "",
    "## Data Summary",
    "",
    `- **Total Traces**: ${baseline.total_traces}`,
    `- **Baseline Success Rate**: ${(baseline.baseline_success * 100).toFixed(2)}%`,
    `- **Unique Packs Analyzed**: ${vfcResults.length}`,
    ""
  ];

  // Calculate decision criteria
  const validPacks = vfcResults.filter(p => p.usage_count >= 3);
  const sortedByVFC = [...validPacks].sort((a, b) => b.vfc - a.vfc);

  // Criterion 1: Top 20% VFC vs median
  const top20PercentCount = Math.ceil(validPacks.length * 0.2);
  const top20Packs = sortedByVFC.slice(0, top20PercentCount);
  const medianIdx = Math.floor(validPacks.length / 2);
  const medianVFC = sortedByVFC[medianIdx]?.vfc || 0;
  const avgTop20VFC = top20Packs.length > 0
    ? top20Packs.reduce((sum, p) => sum + p.vfc, 0) / top20Packs.length
    : 0;
  const criterion1 = avgTop20VFC > medianVFC * 1.5; // "Significantly higher"

  // Criterion 2: High usage, low VFC packs exist
  const highUsageLowVFC = validPacks.filter(p =>
    p.usage_count >= 5 && p.vfc < THRESHOLDS.vfc.low
  );
  const criterion2 = highUsageLowVFC.length > 0;

  // Criterion 3: Low usage, high VFC packs exist
  const lowUsageHighVFC = validPacks.filter(p =>
    p.usage_count < 5 && p.vfc > THRESHOLDS.vfc.high
  );
  const criterion3 = lowUsageHighVFC.length > 0;

  // Criterion 4: Clear drift sources
  const highDrift = validPacks.filter(p => p.drift_rate > THRESHOLDS.drift_risk.high);
  const criterion4 = highDrift.length > 0;

  // Kill criteria
  const allVFCNearZero = validPacks.every(p => Math.abs(p.vfc) < 0.01);
  const insufficientData = baseline.total_traces < 20;

  lines.push("## Scale Conditions (≥2 required to continue)");
  lines.push("");
  lines.push("| # | Condition | Met? | Evidence |");
  lines.push("|---|-----------|------|----------|");
  lines.push(`| 1 | Top 20% VFC > median | ${criterion1 ? "✅" : "❌"} | Top 20% avg: ${avgTop20VFC.toFixed(4)}, Median: ${medianVFC.toFixed(4)} |`);
  lines.push(`| 2 | High-usage low-VFC packs exist | ${criterion2 ? "✅" : "❌"} | ${highUsageLowVFC.length} packs found |`);
  lines.push(`| 3 | Low-usage high-VFC packs exist | ${criterion3 ? "✅" : "❌"} | ${lowUsageHighVFC.length} packs found |`);
  lines.push(`| 4 | Clear drift sources identified | ${criterion4 ? "✅" : "❌"} | ${highDrift.length} high-drift packs |`);
  lines.push("");

  const scaleCriteriaMet = [criterion1, criterion2, criterion3, criterion4].filter(Boolean).length;

  lines.push("## Kill Conditions (≥1 triggers pause)");
  lines.push("");
  lines.push("| # | Condition | Met? | Evidence |");
  lines.push("|---|-----------|------|----------|");
  lines.push(`| 1 | VFC shows no differentiation | ${allVFCNearZero ? "✅" : "❌"} | All VFC near zero: ${allVFCNearZero} |`);
  lines.push(`| 2 | Insufficient trace data | ${insufficientData ? "✅" : "❌"} | ${baseline.total_traces} traces (need ≥20) |`);
  lines.push(`| 3 | Observation impacts efficiency | ❓ | Manual assessment required |`);
  lines.push("");

  const killCriteriaMet = allVFCNearZero || insufficientData;

  lines.push("---");
  lines.push("");
  lines.push("## VERDICT");
  lines.push("");

  if (killCriteriaMet) {
    lines.push("### ❌ KILL (Pause Epiplexity Integration)");
    lines.push("");
    lines.push("**Reason**: Kill condition(s) met.");
    if (allVFCNearZero) {
      lines.push("- VFC shows no meaningful differentiation between packs");
    }
    if (insufficientData) {
      lines.push("- Insufficient trace data for reliable analysis");
    }
    lines.push("");
    lines.push("**Recommended Actions**:");
    lines.push("1. Continue collecting traces without VFC optimization");
    lines.push("2. Re-evaluate after 2x more data collected");
    lines.push("3. Consider alternative proxy signals");
  } else if (scaleCriteriaMet >= 2) {
    lines.push("### ✅ SCALE (Proceed to Phase 2)");
    lines.push("");
    lines.push(`**Reason**: ${scaleCriteriaMet}/4 scale conditions met (≥2 required).`);
    lines.push("");
    lines.push("**Recommended Actions**:");
    lines.push("1. Implement VFC-based pack reranking (Phase 2)");
    lines.push("2. Create skill maturation criteria (Phase 3)");
    lines.push("3. Begin P2 Amazon Growth Engine integration");
  } else {
    lines.push("### ⏸️ HOLD (Continue Observation)");
    lines.push("");
    lines.push(`**Reason**: Only ${scaleCriteriaMet}/4 scale conditions met, no kill conditions.`);
    lines.push("");
    lines.push("**Recommended Actions**:");
    lines.push("1. Continue Phase 0-1 observation");
    lines.push("2. Collect more traces to improve signal quality");
    lines.push("3. Re-run decision analysis in 1 week");
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Appendix: Decision Criteria Reference");
  lines.push("");
  lines.push("From ADR-EPIPLEXITY-IN-LIYE-OS.md:");
  lines.push("");
  lines.push("**Scale Conditions** (≥2 required):");
  lines.push("1. Top 20% packs have VFC significantly higher than median");
  lines.push("2. \"High usage, low VFC\" packs exist (optimization opportunity)");
  lines.push("3. \"Low usage, high VFC\" packs exist (recall optimization opportunity)");
  lines.push("4. Clear drift sources identified (governance opportunity)");
  lines.push("");
  lines.push("**Kill Conditions** (≥1 triggers pause):");
  lines.push("1. Pack vs success rate shows no differentiation (VFC ≈ 0)");
  lines.push("2. Trace data insufficient or too noisy");
  lines.push("3. Observation impacts execution efficiency unacceptably");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*Report generated by epiplexity_report.mjs*");

  return lines.join("\n");
}

function runPhase1(traces) {
  console.log("\n" + "=".repeat(60));
  console.log("Epiplexity Report - Phase 1 (Markdown Reports)");
  console.log("=".repeat(60) + "\n");

  ensureReportsDir();

  const baseline = calculateBaseline(traces);
  const packStats = calculatePackStats(traces);
  const vfcResults = calculateVFC(packStats, baseline.baseline_success);

  // Generate reports
  const reports = [
    {
      name: "PACK_VALUE_FOR_CONTEXT.md",
      content: generatePackValueForContext(vfcResults, baseline)
    },
    {
      name: "TOP_PACKS_BY_VFC.md",
      content: generateTopPacksByVFC(vfcResults)
    },
    {
      name: "DRIFT_SOURCES.md",
      content: generateDriftSources(vfcResults)
    },
    {
      name: "SCALE_OR_KILL_DECISION.md",
      content: generateScaleOrKillDecision(vfcResults, baseline)
    }
  ];

  for (const report of reports) {
    const filePath = path.join(REPORTS_DIR, report.name);
    fs.writeFileSync(filePath, report.content, "utf8");
    console.log(`✅ Generated: ${filePath}`);
  }

  console.log();
  console.log("=".repeat(60));
  console.log("Phase 1 complete. Reports generated in Artifacts_Vault/reports/");
  console.log("=".repeat(60) + "\n");

  return { baseline, packStats, vfcResults };
}

// ============================================================================
// CLI Interface
// ============================================================================

function printUsage() {
  console.log(`
Epiplexity Report Generator - Phase 0-1 Analysis Tool

Usage:
  node epiplexity_report.mjs              # Phase 0: Console output
  node epiplexity_report.mjs --phase1     # Phase 1: Generate markdown reports
  node epiplexity_report.mjs --help       # Show this help

Output:
  Phase 0: Console statistics (traces, baseline, pack rankings)
  Phase 1: Markdown reports in Artifacts_Vault/reports/
    - PACK_VALUE_FOR_CONTEXT.md
    - TOP_PACKS_BY_VFC.md
    - DRIFT_SOURCES.md
    - SCALE_OR_KILL_DECISION.md

Trace File:
  ${TRACE_FILE}
`);
}

// ============================================================================
// Main
// ============================================================================

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  printUsage();
  process.exit(0);
}

const traces = readTraces();

if (traces.length === 0) {
  console.log("\n⚠️  No traces found. Start collecting traces first:");
  console.log(`   node .claude/scripts/epiplexity_trace.mjs --task_type=amazon --packs_loaded=operations --task_success=true\n`);
  process.exit(0);
}

if (args.includes("--phase1")) {
  runPhase1(traces);
} else {
  runPhase0(traces);
}
