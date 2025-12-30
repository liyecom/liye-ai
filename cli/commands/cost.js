/**
 * Cost Commands
 * liye cost report [options]
 */

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * Handle cost subcommands
 */
async function handleCost(subcommand, args, repoRoot) {
  switch (subcommand) {
    case 'report':
      return await costReport(args, repoRoot);
    default:
      showCostHelp();
  }
}

/**
 * liye cost report
 */
async function costReport(args, repoRoot) {
  const { generateCostReport, saveReport } = require('../../src/analytics/cost-report');

  // Parse arguments
  const options = parseArgs(args);

  console.log(`\n${colors.cyan}📊 Cost Governance Report${colors.reset}\n`);

  // Generate report
  const { report, metrics, dateRange, format } = generateCostReport(repoRoot, options);

  // Print to stdout
  console.log(report);

  // Save to file
  const filepath = saveReport(repoRoot, report, format);
  console.log(`\n${colors.dim}Report saved to: ${filepath}${colors.reset}\n`);

  return { metrics, filepath };
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--days') {
      options.days = parseInt(args[++i], 10) || 7;
    } else if (arg === '--from') {
      options.from = args[++i];
    } else if (arg === '--to') {
      options.to = args[++i];
    } else if (arg === '--broker') {
      options.broker = args[++i];
    } else if (arg === '--route') {
      options.route = args[++i];
    } else if (arg === '--format') {
      options.format = args[++i];
    }

    i++;
  }

  return options;
}

/**
 * Show cost help
 */
function showCostHelp() {
  console.log(`
${colors.bold}Cost Commands${colors.reset}

${colors.cyan}Usage:${colors.reset}
  liye cost report              Generate cost governance report (default: 7 days)

${colors.cyan}Options:${colors.reset}
  --days <n>                    Report period in days (7/30/90)
  --from <YYYY-MM-DD>           Start date
  --to <YYYY-MM-DD>             End date
  --broker <type>               Filter by broker (codex/gemini/claude/antigravity)
  --route <type>                Filter by route (ask/build/research/...)
  --format <type>               Output format (md/json, default: md)

${colors.cyan}Examples:${colors.reset}
  liye cost report                          Last 7 days
  liye cost report --days 30                Last 30 days
  liye cost report --broker codex           Filter by codex broker
  liye cost report --format json            JSON output
  liye cost report --from 2025-12-01 --to 2025-12-31

${colors.cyan}Output:${colors.reset}
  - Printed to stdout
  - Saved to: reports/cost/<YYYYMMDD>_cost_report.md

${colors.cyan}Metrics:${colors.reset}
  - Success rate, needs_manual rate
  - Average runtime by broker/route
  - Error code distribution
  - Actionable recommendations
`);
}

module.exports = handleCost;
