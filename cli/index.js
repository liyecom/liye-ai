#!/usr/bin/env node

/**
 * LiYe AI CLI
 * Main entry point
 *
 * Usage:
 *   liye agent validate <agent-name>
 *   liye agent scaffold v5 --from v3
 *   liye skill list
 *   liye skill validate <skill-name>
 */

const path = require('path');
const fs = require('fs');

// CLI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Parse arguments
const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];
const target = args[2];

// Find repo root
function findRepoRoot() {
  let dir = process.cwd();
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot();

// Command router
async function main() {
  if (!command) {
    showHelp();
    return;
  }

  switch (command) {
    case 'agent':
      await handleAgent(subcommand, target, args.slice(3));
      break;
    case 'skill':
      await handleSkill(subcommand, target, args.slice(3));
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    case 'version':
    case '--version':
    case '-v':
      console.log('liye-ai v5.0.0');
      break;
    default:
      log(`❌ Unknown command: ${command}`, 'red');
      showHelp();
      process.exit(1);
  }
}

function showHelp() {
  console.log(`
${colors.bold}LiYe AI CLI v5.0${colors.reset}

${colors.cyan}Usage:${colors.reset}
  liye <command> <subcommand> [options]

${colors.cyan}Commands:${colors.reset}
  ${colors.bold}agent${colors.reset}
    validate <name>           Validate agent against v5.0 spec
    scaffold v5 --from <src>  Scaffold v5 agent from v3
    list                      List all agents

  ${colors.bold}skill${colors.reset}
    validate <name>           Validate skill against v5.0 spec
    list                      List all skills

${colors.cyan}Examples:${colors.reset}
  liye agent validate diagnostic-architect
  liye agent scaffold v5 --from market-analyst
  liye skill list
`);
}

// Agent commands
async function handleAgent(subcommand, target, extraArgs) {
  const validateAgent = require('./commands/agent-validate');
  const scaffoldAgent = require('./commands/agent-scaffold');
  const listAgents = require('./commands/agent-list');

  switch (subcommand) {
    case 'validate':
      if (!target) {
        log('❌ Missing agent name. Usage: liye agent validate <name>', 'red');
        process.exit(1);
      }
      await validateAgent(target, REPO_ROOT);
      break;
    case 'scaffold':
      const fromIdx = extraArgs.indexOf('--from');
      const sourceAgent = fromIdx >= 0 ? extraArgs[fromIdx + 1] : null;
      if (target !== 'v5' || !sourceAgent) {
        log('❌ Usage: liye agent scaffold v5 --from <source-agent>', 'red');
        process.exit(1);
      }
      await scaffoldAgent(sourceAgent, REPO_ROOT);
      break;
    case 'list':
      await listAgents(REPO_ROOT);
      break;
    default:
      log(`❌ Unknown agent subcommand: ${subcommand}`, 'red');
      process.exit(1);
  }
}

// Skill commands
async function handleSkill(subcommand, target, extraArgs) {
  const listSkills = require('./commands/skill-list');
  const validateSkill = require('./commands/skill-validate');

  switch (subcommand) {
    case 'list':
      await listSkills(REPO_ROOT);
      break;
    case 'validate':
      if (!target) {
        log('❌ Missing skill name. Usage: liye skill validate <name>', 'red');
        process.exit(1);
      }
      await validateSkill(target, REPO_ROOT);
      break;
    default:
      log(`❌ Unknown skill subcommand: ${subcommand}`, 'red');
      process.exit(1);
  }
}

main().catch(err => {
  log(`❌ ${err.message}`, 'red');
  process.exit(1);
});
