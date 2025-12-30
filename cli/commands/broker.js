/**
 * Broker Commands
 * liye broker list/check/config
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
 * Handle broker subcommands
 */
async function handleBroker(subcommand, args, repoRoot) {
  switch (subcommand) {
    case 'list':
      return await brokerList();
    case 'check':
      return await brokerCheck();
    case 'routes':
      return brokerRoutes(repoRoot);
    default:
      showBrokerHelp();
  }
}

/**
 * liye broker list
 */
async function brokerList() {
  const { listBrokers } = require('../../src/brokers/registry');

  console.log(`\n${colors.cyan}📦 Available Brokers${colors.reset}\n`);

  const brokers = await listBrokers();

  for (const broker of brokers) {
    const icon = broker.available ? '✅' : '❌';
    const kind = broker.kind === 'cli' ? '(CLI)' : '(Manual)';

    console.log(`${icon} ${colors.bold}${broker.id}${colors.reset} ${kind}`);
    console.log(`   ${colors.dim}${broker.detail}${colors.reset}`);
    console.log('');
  }
}

/**
 * liye broker check
 */
async function brokerCheck() {
  const { checkBrokers } = require('../../src/brokers/registry');

  console.log(`\n${colors.cyan}🔍 Checking Broker Availability${colors.reset}\n`);

  const status = await checkBrokers();

  for (const [broker, check] of Object.entries(status)) {
    const icon = check.ok ? '✅' : '❌';
    console.log(`${icon} ${colors.bold}${broker}${colors.reset}: ${check.detail}`);
  }

  console.log('');
}

/**
 * liye broker routes
 * Now reads from config/brokers.yaml
 */
function brokerRoutes(repoRoot) {
  const { getAllRoutes, getDefaults } = require('../../src/config/load');

  console.log(`\n${colors.cyan}🗺️  Broker Routes (from config/brokers.yaml)${colors.reset}\n`);

  const routes = getAllRoutes(repoRoot);
  const defaults = getDefaults(repoRoot);

  console.log(`${colors.bold}Defaults:${colors.reset}`);
  console.log(`  Broker:   ${defaults.broker}`);
  console.log(`  Model:    ${defaults.model}`);
  console.log(`  Approval: ${defaults.approval}`);
  console.log(`  Sandbox:  ${defaults.sandbox}`);
  console.log('');

  console.log(`${colors.bold}Route-specific configurations:${colors.reset}\n`);

  const routeNames = Object.keys(routes);
  const maxLen = Math.max(...routeNames.map(k => k.length));

  for (const [command, config] of Object.entries(routes)) {
    const broker = config.broker || defaults.broker;
    const model = config.model || defaults.model;
    const approval = config.approval || defaults.approval;

    console.log(`  ${colors.cyan}${command.padEnd(maxLen)}${colors.reset}  →  ${colors.bold}${broker}${colors.reset}`);
    console.log(`  ${' '.repeat(maxLen)}     model: ${model}, approval: ${approval}`);
  }

  console.log(`\n${colors.dim}Override with --broker <type> --model <model> flags${colors.reset}`);
  console.log(`${colors.dim}Config priority: CLI args > mission.yaml > routes > defaults${colors.reset}\n`);
}

/**
 * Show broker help
 */
function showBrokerHelp() {
  console.log(`
${colors.bold}Broker Commands${colors.reset}

${colors.cyan}Usage:${colors.reset}
  liye broker list     List all available brokers
  liye broker check    Check broker availability
  liye broker routes   Show routing config (from config/brokers.yaml)

${colors.cyan}Available Brokers:${colors.reset}
  codex        OpenAI Codex CLI (gpt-5.2-thinking default)
  gemini       Google Gemini CLI (cost-optimized)
  antigravity  Manual browser automation platform
  claude       Claude Code CLI (engineering tasks)

${colors.cyan}Default Routing:${colors.reset}
  ask          → codex + gpt-5.2-thinking (semi-auto)
  build/ship   → claude (semi-auto)
  batch/outline→ gemini (semi-auto)
  research     → antigravity (manual)

${colors.cyan}Configuration:${colors.reset}
  config/brokers.yaml  - Routing & model config
  config/policy.yaml   - Approval & sandbox policy

${colors.cyan}Priority:${colors.reset}
  CLI args > mission.yaml > routes > defaults
`);
}

module.exports = handleBroker;
