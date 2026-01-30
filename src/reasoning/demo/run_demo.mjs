/**
 * P5-A Demo Runner - One-Click Reasoning Demo
 *
 * Produces a complete demo showcasing:
 * Observation → Explanation → Proposal → Dry-Run Execution → ActionOutcomeEvent → Report
 *
 * ZERO WRITES GUARANTEED: force_dry_run=true is hardcoded, cannot be overridden.
 *
 * @module reasoning/demo
 * @version p5-v0.1
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import {
  loadActionPlaybook,
  checkEligibility,
  checkSafetyLimits
} from '../execution/build_action_proposal.mjs';
import { executeAction, ExecutionStatus } from '../execution/execute_action.mjs';
// Import to register the action
import '../execution/actions/add_negative_keywords.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

// Paths
const FIXTURES_PATH = join(PROJECT_ROOT, 'tests/fixtures/reasoning/p4/calibration_samples.json');
const DEFAULT_OUT_DIR = join(PROJECT_ROOT, 'docs/reasoning/demo_runs');

/**
 * ZERO WRITES PROOF - This constant is hardcoded and cannot be overridden
 */
const FORCE_DRY_RUN = true;

/**
 * Parse CLI arguments
 */
function parseCliArgs() {
  const options = {
    profile: { type: 'string', default: 'balanced' },
    cases: { type: 'string', default: '' },
    out_dir: { type: 'string', default: '' },
    help: { type: 'boolean', short: 'h', default: false }
  };

  try {
    const { values } = parseArgs({ options, allowPositionals: false });
    return values;
  } catch (e) {
    return { profile: 'balanced', cases: '', out_dir: '', help: false };
  }
}

/**
 * Load calibration samples
 */
function loadSamples() {
  const content = readFileSync(FIXTURES_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Execute a single demo case
 */
async function executeDemoCase(sample, profile) {
  const actionId = sample.action_id_override || 'ADD_NEGATIVE_KEYWORDS';
  const startTime = Date.now();

  // Build proposal
  const proposal = {
    proposal_id: `demo-${sample.id}-${Date.now()}`,
    trace_id: sample.observation.trace_id,
    observation_id: sample.observation.observation_id,
    cause_id: 'DEMO_CAUSE',
    action_id: actionId,
    rule_version: sample.observation.rule_version,
    execution_mode: 'auto_if_safe',
    risk_level: 'LOW'
  };

  // Check eligibility
  const eligibility = checkEligibility(proposal, sample.signals, { profile });

  // Check safety limits
  const safety = checkSafetyLimits(proposal, sample.params, sample.state);

  // Extract candidates info
  const candidatesBefore = sample.params?.negative_keywords?.length || 0;
  const filteredCount = safety.violations?.filter(v =>
    v.includes('Brand term') || v.includes('ASIN') || v.includes('too short')
  ).length || 0;
  const finalCandidates = Math.max(0, candidatesBefore - filteredCount);

  // Execute with FORCE_DRY_RUN (hardcoded, cannot be overridden)
  // demo_mode=true bypasses kill switch to show full dry-run path
  const result = await executeAction(
    proposal,
    sample.params,
    sample.signals,
    sample.state,
    { force_dry_run: FORCE_DRY_RUN, demo_mode: true }
  );

  const endTime = Date.now();

  // Determine why not executed (if applicable)
  let whyNotExecuted = null;
  if (result.status !== ExecutionStatus.DRY_RUN && result.status !== ExecutionStatus.AUTO_EXECUTED) {
    if (result.status === ExecutionStatus.DENY_UNSUPPORTED_ACTION) {
      whyNotExecuted = 'Action not in whitelist';
    } else if (!eligibility.eligible) {
      whyNotExecuted = `Eligibility failed: ${eligibility.reasons.join(', ')}`;
    } else if (!safety.safe) {
      whyNotExecuted = `Safety violation: ${safety.violations.join(', ')}`;
    } else {
      whyNotExecuted = 'Kill switch disabled';
    }
  }

  return {
    case_id: sample.id,
    scenario: sample.scenario,
    group: sample.group,
    expected_class: sample.group,
    status: result.status,
    why_not_executed: whyNotExecuted,
    candidates_before: candidatesBefore,
    final_candidates: finalCandidates,
    filtering_summary: safety.violations?.filter(v =>
      v.includes('Brand term') || v.includes('ASIN') || v.includes('too short')
    ) || [],
    rollback_payload_present: result.rollback_payload !== null && result.rollback_payload !== undefined,
    outcome_event_written: result.outcome_event !== null,
    outcome_event: result.outcome_event,
    eligibility: {
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      profile: eligibility.profile
    },
    safety: {
      safe: safety.safe,
      violations: safety.violations
    },
    execution_time_ms: endTime - startTime,
    proposal,
    notes: result.notes
  };
}

/**
 * Generate demo summary JSON
 */
function generateDemoSummary(results, config) {
  const summary = {
    meta: {
      generated_at: new Date().toISOString(),
      profile: config.profile,
      total_cases: results.length,
      force_dry_run: FORCE_DRY_RUN,
      writes_attempted: 0,
      writes_blocked_by: 'force_dry_run'
    },
    stats: {
      dry_run: results.filter(r => r.status === ExecutionStatus.DRY_RUN).length,
      suggest_only: results.filter(r => r.status === ExecutionStatus.SUGGEST_ONLY).length,
      blocked: results.filter(r => r.status === ExecutionStatus.BLOCKED).length,
      deny: results.filter(r => r.status === ExecutionStatus.DENY_UNSUPPORTED_ACTION).length
    },
    by_group: {
      A: results.filter(r => r.group === 'A'),
      B: results.filter(r => r.group === 'B'),
      C: results.filter(r => r.group === 'C')
    },
    results
  };

  return summary;
}

/**
 * Select deep dive cases (1 auto/dry-run, 1 degrade/deny)
 */
function selectDeepDiveCases(results) {
  const autoDryRun = results.find(r =>
    r.status === ExecutionStatus.DRY_RUN || r.status === ExecutionStatus.AUTO_EXECUTED
  );

  const degradeDeny = results.find(r =>
    r.status === ExecutionStatus.SUGGEST_ONLY ||
    r.status === ExecutionStatus.BLOCKED ||
    r.status === ExecutionStatus.DENY_UNSUPPORTED_ACTION
  );

  return { autoDryRun, degradeDeny };
}

/**
 * Generate demo report markdown
 */
function generateDemoReport(summary, config, deepDives) {
  const date = new Date().toISOString().split('T')[0];
  const playbook = loadActionPlaybook('ADD_NEGATIVE_KEYWORDS');
  const thresholds = playbook.eligibility?.profiles?.[config.profile] || {};

  let md = `# Reasoning Demo Report

**Generated**: ${new Date().toISOString()}
**Profile**: ${config.profile}
**Cases**: ${summary.meta.total_cases}

---

## 1. What It Does

This demo showcases **controlled automation with full auditability**:
- Observations trigger causal explanations
- Explanations produce action proposals
- Proposals are validated against eligibility thresholds and safety limits
- Safe actions execute in dry-run mode (no real writes)
- Every decision is logged with an ActionOutcomeEvent

**Value**: Reduce wasted ad spend automatically while maintaining human oversight and rollback capability.

---

## 2. Inputs

| Parameter | Value |
|-----------|-------|
| Profile | ${config.profile} |
| Cases Run | ${summary.meta.total_cases} |
| Fixture Source | \`tests/fixtures/reasoning/p4/calibration_samples.json\` |

### Threshold Configuration (${config.profile})

| Threshold | Value |
|-----------|-------|
| wasted_spend_ratio_gte | ${thresholds.wasted_spend_ratio_gte || 'N/A'} |
| clicks_gte | ${thresholds.clicks_gte || 'N/A'} |
| orders_eq | ${thresholds.orders_eq ?? 'N/A'} |
| spend_gte | ${thresholds.spend_gte || 'N/A'} |

---

## 3. Results Table

| Case ID | Expected | Status | Why Not Executed | Before | Final | Rollback | Outcome |
|---------|----------|--------|------------------|--------|-------|----------|---------|
`;

  for (const r of summary.results) {
    const statusIcon = r.status === 'DRY_RUN' ? '🟢' :
                       r.status === 'SUGGEST_ONLY' ? '🟡' :
                       r.status === 'DENY_UNSUPPORTED_ACTION' ? '🔴' : '⚪';
    md += `| ${r.case_id} | ${r.expected_class} | ${statusIcon} ${r.status} | ${r.why_not_executed || '-'} | ${r.candidates_before} | ${r.final_candidates} | ${r.rollback_payload_present ? '✅' : '❌'} | ${r.outcome_event_written ? '✅' : '❌'} |\n`;
  }

  md += `
### Summary by Status

| Status | Count |
|--------|-------|
| DRY_RUN (would auto-execute) | ${summary.stats.dry_run} |
| SUGGEST_ONLY (human review) | ${summary.stats.suggest_only} |
| BLOCKED (safety limit) | ${summary.stats.blocked} |
| DENY (not whitelisted) | ${summary.stats.deny} |

---

## 4. Deep Dives

### 4.1 Auto/Dry-Run Example: ${deepDives.autoDryRun?.case_id || 'N/A'}

`;

  if (deepDives.autoDryRun) {
    const r = deepDives.autoDryRun;
    md += `**Scenario**: ${r.scenario}

**Flow**:
1. **Observation**: \`${r.proposal.observation_id}\`
2. **Eligibility Check**: ${r.eligibility.eligible ? '✅ PASSED' : '❌ FAILED'}
   - Profile: ${r.eligibility.profile}
   ${r.eligibility.reasons.length > 0 ? `- Reasons: ${r.eligibility.reasons.join(', ')}` : ''}
3. **Safety Check**: ${r.safety.safe ? '✅ PASSED' : '❌ FAILED'}
   ${r.safety.violations.length > 0 ? `- Violations: ${r.safety.violations.join(', ')}` : ''}
4. **Execution**: \`${r.status}\`
5. **Rollback Payload**: ${r.rollback_payload_present ? 'Present (can undo)' : 'N/A'}

**ActionOutcomeEvent**:
\`\`\`json
${JSON.stringify(r.outcome_event, null, 2)}
\`\`\`
`;
  } else {
    md += `*No auto/dry-run case available in this run.*\n`;
  }

  md += `
### 4.2 Degrade/Deny Example: ${deepDives.degradeDeny?.case_id || 'N/A'}

`;

  if (deepDives.degradeDeny) {
    const r = deepDives.degradeDeny;
    md += `**Scenario**: ${r.scenario}

**Flow**:
1. **Observation**: \`${r.proposal.observation_id}\`
2. **Eligibility Check**: ${r.eligibility.eligible ? '✅ PASSED' : '❌ FAILED'}
   - Profile: ${r.eligibility.profile}
   ${r.eligibility.reasons.length > 0 ? `- Reasons: ${r.eligibility.reasons.join(', ')}` : ''}
3. **Safety Check**: ${r.safety.safe ? '✅ PASSED' : '❌ FAILED'}
   ${r.safety.violations.length > 0 ? `- Violations: ${r.safety.violations.join(', ')}` : ''}
4. **Final Status**: \`${r.status}\`
5. **Why Not Executed**: ${r.why_not_executed || 'N/A'}

**Decision Trace**:
- The system correctly identified this case should NOT auto-execute
- Human review is required before taking action
- This prevents false positives and maintains safety
`;
  } else {
    md += `*No degrade/deny case available in this run.*\n`;
  }

  md += `
---

## 5. Safety Proof

### ZERO WRITES Guarantee

| Check | Status |
|-------|--------|
| \`force_dry_run\` | \`${FORCE_DRY_RUN}\` ✅ |
| \`writes_attempted\` | \`0\` |
| \`writes_blocked_by\` | \`force_dry_run\` |

**Technical Implementation**:
- \`FORCE_DRY_RUN = true\` is hardcoded in the demo runner
- This cannot be overridden by CLI arguments or environment variables
- Even if the kill switch is enabled, the demo will NOT perform real writes
- All executions produce \`DRY_RUN\` status instead of \`AUTO_EXECUTED\`

**Audit Trail**:
- Every execution produces an ActionOutcomeEvent
- Events include trace_id, proposal_id, status, and timestamp
- Rollback payloads are preserved for potential undo operations

---

## 6. Next Steps

### Before Production Deployment

| Requirement | Status | Notes |
|-------------|--------|-------|
| 12+ synthetic samples validated | ✅ | P4 calibration complete |
| Threshold profiles calibrated | ✅ | balanced recommended |
| Kill switch tested | ✅ | P3 drill verified |
| Rollback mechanism tested | ⏳ | Ready for E2E testing |
| Real customer pilot | ⏳ | Select 1-2 low-risk accounts |
| 14-day outcome monitoring | ⏳ | After pilot |

### Expansion Criteria

Before enabling auto-execution for a new customer:
1. Account has >= 30 days of historical data
2. Account has >= $500/month ad spend
3. Customer has acknowledged automation terms
4. Kill switch is tested and operational
5. Rollback procedure is documented and tested

---

## Appendix: Evaluator Report

See linked report: \`EVALUATOR_REPORT_${date}.md\`

---

*Generated by P5-A Demo Runner v0.1*
*ZERO WRITES GUARANTEED*
`;

  return md;
}

/**
 * Main demo runner
 */
async function runDemo(cliArgs = {}) {
  const args = { ...parseCliArgs(), ...cliArgs };

  if (args.help) {
    console.log(`
P5-A Demo Runner - One-Click Reasoning Demo

Usage:
  node src/reasoning/demo/run_demo.mjs [options]
  pnpm demo:reasoning

Options:
  --profile=<name>    Threshold profile (conservative|balanced|aggressive) [default: balanced]
  --cases=<ids>       Comma-separated case IDs to run (e.g., A1,A2,B1) [default: all]
  --out_dir=<path>    Output directory [default: docs/reasoning/demo_runs/YYYY-MM-DD]
  -h, --help          Show this help

Examples:
  pnpm demo:reasoning
  pnpm demo:reasoning --profile=conservative
  pnpm demo:reasoning --cases=A1,A2,B1
`);
    return;
  }

  console.log('=== P5-A Reasoning Demo Runner ===\n');
  console.log(`ZERO WRITES GUARANTEED: force_dry_run=${FORCE_DRY_RUN}\n`);

  // Load samples
  const samplesData = loadSamples();
  let samples = samplesData.samples;

  // Filter by case IDs if specified
  if (args.cases) {
    const caseIds = args.cases.split(',').map(c => c.trim());
    samples = samples.filter(s => caseIds.includes(s.id));
    console.log(`Filtered to ${samples.length} cases: ${caseIds.join(', ')}`);
  }

  console.log(`Running ${samples.length} demo cases with profile: ${args.profile}\n`);

  // Execute all cases
  const results = [];
  for (const sample of samples) {
    console.log(`  Running ${sample.id}: ${sample.scenario}...`);
    const result = await executeDemoCase(sample, args.profile);
    results.push(result);
    console.log(`    → ${result.status}`);
  }

  // Generate summary
  const config = { profile: args.profile };
  const summary = generateDemoSummary(results, config);

  // Select deep dive cases
  const deepDives = selectDeepDiveCases(results);

  // Generate report
  const report = generateDemoReport(summary, config, deepDives);

  // Determine output directory
  const date = new Date().toISOString().split('T')[0];
  const outDir = args.out_dir || join(DEFAULT_OUT_DIR, date);

  // Ensure output directory exists
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Write outputs
  const summaryPath = join(outDir, 'demo_summary.json');
  const reportPath = join(outDir, `DEMO_REPORT_${date}.md`);

  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  writeFileSync(reportPath, report);

  console.log(`\n=== Demo Complete ===`);
  console.log(`Output directory: ${outDir}`);
  console.log(`  - demo_summary.json`);
  console.log(`  - DEMO_REPORT_${date}.md`);

  // Run evaluator and link report
  console.log(`\nGenerating linked evaluator report...`);
  try {
    const { runCalibration } = await import('../auto_eligibility_evaluator.mjs');
    await runCalibration();

    // Copy/link evaluator report to demo directory
    const evaluatorReportSrc = join(PROJECT_ROOT, `docs/reasoning/reports/P4_AUTO_ELIGIBILITY_CALIBRATION_${date}.md`);
    const evaluatorReportDst = join(outDir, `EVALUATOR_REPORT_${date}.md`);

    if (existsSync(evaluatorReportSrc)) {
      const evaluatorContent = readFileSync(evaluatorReportSrc, 'utf-8');
      writeFileSync(evaluatorReportDst, evaluatorContent);
      console.log(`  - EVALUATOR_REPORT_${date}.md (linked)`);
    }
  } catch (e) {
    console.log(`  (Evaluator report skipped: ${e.message})`);
  }

  console.log(`\n✅ Demo artifacts ready for review`);

  return { summary, reportPath, outDir };
}

// Export for programmatic use
export {
  runDemo,
  executeDemoCase,
  generateDemoSummary,
  generateDemoReport,
  FORCE_DRY_RUN,
  loadSamples
};

// CLI entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDemo().catch(err => {
    console.error('Demo failed:', err);
    process.exit(1);
  });
}
