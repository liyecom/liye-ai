#!/usr/bin/env node

/**
 * LiYe AI CLI
 * Main entry point for the LiYe OS Control Plane
 *
 * Usage:
 *   liye "任务描述"                    # 快捷方式：编译上下文
 *   liye ask "question" [--broker]    # Quick ask with broker routing
 *   liye mission new/run/ingest       # Mission pack management
 *   liye broker list/check            # Broker management
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
    // Mission commands (Multi-Broker Architecture)
    case 'mission':
      await handleMission(subcommand, args.slice(2), REPO_ROOT);
      break;
    case 'ask':
      // liye ask "question" [--broker codex|gemini]
      const question = subcommand;
      await handleAsk(question, args.slice(2), REPO_ROOT);
      break;
    case 'broker':
      await handleBroker(subcommand, args.slice(2), REPO_ROOT);
      break;
    case 'cost':
      await handleCost(subcommand, args.slice(2), REPO_ROOT);
      break;

    // Legacy commands
    case 'agent':
      await handleAgent(subcommand, target, args.slice(3));
      break;
    case 'skill':
      await handleSkill(subcommand, target, args.slice(3));
      break;
    case 'report':
      await handleReport(subcommand, args.slice(2));
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    case 'version':
    case '--version':
    case '-v':
      console.log('liye-ai v5.1.0');
      break;
    default:
      // 不是已知命令，当作任务描述处理
      const task = args.join(' ');
      await handleTask(task);
      break;
  }
}

// Task handler - 调用 assembler 编译上下文
async function handleTask(task) {
  if (!task || task.trim() === '') {
    showHelp();
    return;
  }

  const { execSync } = require('child_process');
  const assemblerPath = path.join(REPO_ROOT, '.claude/scripts/assembler.mjs');

  if (!fs.existsSync(assemblerPath)) {
    log('❌ assembler.mjs not found. Are you in a LiYe OS project?', 'red');
    process.exit(1);
  }

  log(`\n🚀 LiYe AI - 编译任务上下文`, 'cyan');
  log(`📋 任务: ${task}\n`, 'reset');

  try {
    execSync(`node "${assemblerPath}" --task "${task}"`, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
  } catch (err) {
    log('❌ 编译失败', 'red');
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
${colors.bold}LiYe AI CLI v5.1${colors.reset}
${colors.cyan}Personal AI Infrastructure - Control Plane${colors.reset}

${colors.cyan}快捷用法:${colors.reset}
  liye "任务描述"             根据任务自动编译专家上下文
  liye ask "问题"            快速提问 (默认 codex broker)

${colors.cyan}Mission Commands (Multi-Broker):${colors.reset}
  liye mission new --slug <s> 创建任务包
  liye mission run <dir>      运行任务
  liye mission ingest <dir>   摄取任务产物
  liye mission list           列出任务
  liye mission stats          统计信息

${colors.cyan}Broker Commands:${colors.reset}
  liye broker list            列出所有 Broker
  liye broker check           检查 Broker 可用性
  liye broker routes          查看默认路由策略

${colors.cyan}Cost Governance:${colors.reset}
  liye cost report            成本治理报告 (默认 7 天)
  liye cost report --days 30  指定天数
  liye cost report --broker codex  过滤 Broker

${colors.cyan}Agent & Skill:${colors.reset}
  liye agent list             列出所有智能体
  liye agent validate <name>  验证智能体配置
  liye skill list             列出所有技能
  liye report architecture    生成架构合规报告

${colors.cyan}示例:${colors.reset}
  liye ask "分析这段代码" --broker codex
  liye mission new --slug analyze-keywords --broker gemini --project amazon
  liye mission run 20251231-1200__amazon__analyze-keywords

${colors.cyan}帮助:${colors.reset}
  liye --help                 显示此帮助
  liye --version              显示版本号
`);
}

// Mission commands (Multi-Broker Architecture)
function handleMission(subcommand, args, repoRoot) {
  const missionHandler = require('./commands/mission');
  return missionHandler(subcommand, args, repoRoot);
}

// Ask command - quick shortcut
function handleAsk(question, args, repoRoot) {
  const askHandler = require('./commands/ask');
  return askHandler(question, args, repoRoot);
}

// Broker commands
function handleBroker(subcommand, args, repoRoot) {
  const brokerHandler = require('./commands/broker');
  return brokerHandler(subcommand, args, repoRoot);
}

// Cost commands
function handleCost(subcommand, args, repoRoot) {
  const costHandler = require('./commands/cost');
  return costHandler(subcommand, args, repoRoot);
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

// Report commands
async function handleReport(subcommand, extraArgs) {
  const architectureReport = require('./report/architecture');

  switch (subcommand) {
    case 'architecture':
      const options = {
        json: extraArgs.includes('--json'),
        failOnly: extraArgs.includes('--fail-only'),
        domain: null,
      };
      const domainIdx = extraArgs.indexOf('--domain');
      if (domainIdx >= 0 && extraArgs[domainIdx + 1]) {
        options.domain = extraArgs[domainIdx + 1];
      }
      await architectureReport(REPO_ROOT, options);
      break;
    default:
      log(`❌ Unknown report type: ${subcommand}`, 'red');
      log('Available: architecture', 'dim');
      process.exit(1);
  }
}

main().catch(err => {
  log(`❌ ${err.message}`, 'red');
  process.exit(1);
});
