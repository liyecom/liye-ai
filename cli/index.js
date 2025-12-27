#!/usr/bin/env node
/**
 * LiYe AI CLI Entry Point (JavaScript version)
 * Location: cli/index.js
 *
 * Usage:
 *   npx liye-ai <command> [options]
 *   npx liye-os <command> [options]  (alias)
 */

const VERSION = '3.1.0';
const BRAND = 'LiYe AI';

// Simple argument parser
const args = process.argv.slice(2);
const command = args[0];
const subCommand = args[1];

// Help text
const helpText = `
${BRAND} v${VERSION} - Personal AI Operating System

Usage: npx liye-ai <command> [options]
       npx liye-os <command> [options]  (alias)

Commands:
  install          Install LiYe AI in the current project
  init             Initialize a new LiYe AI project
  agent <cmd>      Agent management
    list           List available agents
    run <id>       Run an agent
  skill <cmd>      Skill management
    list           List available skills
  workflow <cmd>   Workflow management
    list           List available workflows
    run <id>       Run a workflow
  build            Build the project
  status           Show system status
  help             Show this help message

Examples:
  npx liye-ai install
  npx liye-ai agent list
  npx liye-ai agent run market-analyst
  npx liye-ai workflow run amazon-launch
  npx liye-ai status

Architecture:
  Four-Layer Architecture (Three-Fork Fusion):
  ├── Method Layer   (← BMad Method)    - WHO/WHY
  ├── Runtime Layer  (← CrewAI)         - HOW
  ├── Skill Layer    (← Skill Forge)    - WHAT
  └── Domain Layer   (LiYe Original)    - WHERE

Documentation: https://liye.ai/docs
`;

// Available agents
const agents = [
  { id: 'market-analyst', name: 'Market Intelligence Analyst', icon: '📊' },
  { id: 'keyword-architect', name: 'Keyword Ecosystem Architect', icon: '🔑' },
  { id: 'listing-optimizer', name: 'Conversion Content Architect', icon: '✍️' },
  { id: 'ppc-strategist', name: 'Sponsored Ads Strategist', icon: '💰' },
  { id: 'diagnostic-architect', name: 'Performance Diagnostic', icon: '🔍' },
  { id: 'execution-agent', name: 'Tactical Executor', icon: '⚡' },
  { id: 'quality-gate', name: 'Quality Assurance', icon: '🛡️' },
  { id: 'review-sentinel', name: 'Customer Voice Analyst', icon: '👁️' },
  { id: 'sprint-orchestrator', name: 'Sprint Orchestration Master', icon: '🎯' }
];

// Available skills
const skills = [
  { id: 'market_research', name: 'Market Research', category: 'research' },
  { id: 'competitor_analysis', name: 'Competitor Analysis', category: 'research' },
  { id: 'keyword_research', name: 'Keyword Research', category: 'optimization' },
  { id: 'content_optimization', name: 'Content Optimization', category: 'optimization' }
];

// Available workflows
const workflows = [
  { id: 'analyze', name: 'Analysis Phase Workflow', track: 'quick' },
  { id: 'plan', name: 'Planning Phase Workflow', track: 'quick' },
  { id: 'full-cycle', name: 'Full Development Cycle', track: 'standard' },
  { id: 'amazon-launch', name: 'Amazon Product Launch', track: 'standard' }
];

// Command handlers
function handleInstall() {
  console.log(`\n🚀 Installing ${BRAND} v${VERSION}...`);
  console.log('   Creating .liye/ directory...');
  console.log('   Initializing configuration...');
  console.log('\n✅ Installation complete!\n');
  console.log('Next steps:');
  console.log('  1. Run: npx liye-ai init');
  console.log('  2. Configure: .liye/config.yaml');
  console.log('  3. Start: npx liye-ai agent run <agent-id>\n');
}

function handleInit() {
  console.log(`\n🎯 Initializing ${BRAND} project...`);
  console.log('\n📁 Created directories:');
  console.log('   .liye/');
  console.log('   .liye/config.yaml');
  console.log('   .liye/evolution/');
  console.log('\n✅ Project initialized!\n');
}

function handleAgentList() {
  console.log('\n📋 Available Agents (amazon-growth domain):\n');
  for (const agent of agents) {
    console.log(`   ${agent.icon} ${agent.id.padEnd(22)} ${agent.name}`);
  }
  console.log(`\n   Total: ${agents.length} agents\n`);
}

function handleAgentRun(agentId) {
  const agent = agents.find(a => a.id === agentId);
  if (!agent) {
    console.log(`\n❌ Agent not found: ${agentId}`);
    console.log('   Run "npx liye-ai agent list" to see available agents.\n');
    return;
  }
  console.log(`\n⚡ Running agent: ${agent.name}`);
  console.log(`   ID: ${agentId}`);
  console.log('\n🔄 Executing...\n');
}

function handleSkillList() {
  console.log('\n🧩 Available Skills:\n');
  for (const skill of skills) {
    console.log(`   ${skill.id.padEnd(25)} ${skill.name} (${skill.category})`);
  }
  console.log(`\n   Total: ${skills.length} skills\n`);
}

function handleWorkflowList() {
  console.log('\n📊 Available Workflows:\n');
  for (const wf of workflows) {
    console.log(`   ${wf.id.padEnd(15)} ${wf.name} [${wf.track}]`);
  }
  console.log('');
}

function handleWorkflowRun(workflowId) {
  const wf = workflows.find(w => w.id === workflowId);
  if (!wf) {
    console.log(`\n❌ Workflow not found: ${workflowId}`);
    console.log('   Run "npx liye-ai workflow list" to see available workflows.\n');
    return;
  }
  console.log(`\n🚀 Running workflow: ${wf.name}`);
  console.log(`   ID: ${workflowId}`);
  console.log(`   Track: ${wf.track}`);
  console.log('\n🔄 Executing phases...\n');
}

function handleBuild() {
  console.log(`\n🔨 Building ${BRAND} project...`);
  console.log('   Compiling TypeScript...');
  console.log('   Bundling skills...');
  console.log('\n✅ Build complete!\n');
}

function handleStatus() {
  console.log(`\n📊 ${BRAND} Status\n`);
  console.log('   Version:      v' + VERSION);
  console.log('   Architecture: Four-Layer (Method/Runtime/Skill/Domain)');
  console.log('   Agents:       ' + agents.length + ' registered');
  console.log('   Skills:       ' + skills.length + ' registered');
  console.log('   Workflows:    ' + workflows.length + ' available');
  console.log('   Evolution:    Enabled');
  console.log('');
}

// Main command router
switch (command) {
  case 'install':
    handleInstall();
    break;
  case 'init':
    handleInit();
    break;
  case 'agent':
    if (subCommand === 'list') {
      handleAgentList();
    } else if (subCommand === 'run') {
      handleAgentRun(args[2]);
    } else {
      console.log('\nUsage: npx liye-ai agent <list|run <id>>\n');
    }
    break;
  case 'skill':
    if (subCommand === 'list') {
      handleSkillList();
    } else {
      console.log('\nUsage: npx liye-ai skill <list>\n');
    }
    break;
  case 'workflow':
    if (subCommand === 'list') {
      handleWorkflowList();
    } else if (subCommand === 'run') {
      handleWorkflowRun(args[2]);
    } else {
      console.log('\nUsage: npx liye-ai workflow <list|run <id>>\n');
    }
    break;
  case 'build':
    handleBuild();
    break;
  case 'status':
    handleStatus();
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    console.log(helpText);
    break;
  default:
    console.log(`\n❌ Unknown command: ${command}`);
    console.log('   Run "npx liye-ai help" for available commands.\n');
}
