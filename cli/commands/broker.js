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
      return brokerRoutes();
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
 */
function brokerRoutes() {
  const { BROKER_ROUTING } = require('../../src/mission/types');

  console.log(`\n${colors.cyan}🗺️  Default Broker Routes${colors.reset}\n`);

  console.log(`${colors.dim}These are the default broker assignments for each command type:${colors.reset}\n`);

  const maxLen = Math.max(...Object.keys(BROKER_ROUTING).map(k => k.length));

  for (const [command, broker] of Object.entries(BROKER_ROUTING)) {
    console.log(`  ${command.padEnd(maxLen)}  →  ${colors.bold}${broker}${colors.reset}`);
  }

  console.log(`\n${colors.dim}Override with --broker <type> flag${colors.reset}\n`);
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
  liye broker routes   Show default routing strategy

${colors.cyan}Available Brokers:${colors.reset}
  codex        OpenAI Codex CLI (gpt-4.1, gpt-5.2)
  gemini       Google Gemini CLI (low-cost, high-frequency)
  antigravity  Manual browser automation platform
  claude       Claude Code CLI (engineering tasks)

${colors.cyan}Routing Strategy:${colors.reset}
  ask/chat     → codex    (default text interaction)
  build/ship   → claude   (engineering tasks)
  batch/outline→ gemini   (cost-optimized)
  research     → antigravity (browser exploration)
`);
}

module.exports = handleBroker;
