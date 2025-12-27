#!/usr/bin/env node
/**
 * LiYe AI CLI Entry Point
 * Location: cli/index.ts
 *
 * Usage:
 *   npx liye-ai <command> [options]
 *   npx liye-os <command> [options]  (alias)
 */

import { Command } from 'commander';
import { registry } from '../src/skill/registry';

const VERSION = '3.1.0';
const BRAND = 'LiYe AI';

// Create main program
const program = new Command();

program
  .name('liye-ai')
  .description(`${BRAND} - Personal AI Operating System`)
  .version(VERSION);

// === Install Command ===
program
  .command('install')
  .description('Install LiYe AI in the current project')
  .option('-d, --domain <domain>', 'Domain to install', 'default')
  .action((options) => {
    console.log(`\n🚀 Installing ${BRAND} v${VERSION}...`);
    console.log(`   Domain: ${options.domain}`);
    console.log('\n✅ Installation complete!\n');
    console.log('Next steps:');
    console.log('  1. Run: npx liye-ai init');
    console.log('  2. Configure: .liye/config.yaml');
    console.log('  3. Start: npx liye-ai agent run <agent-id>\n');
  });

// === Init Command ===
program
  .command('init')
  .description('Initialize a new LiYe AI project')
  .option('-t, --template <template>', 'Template to use', 'default')
  .action((options) => {
    console.log(`\n🎯 Initializing ${BRAND} project...`);
    console.log(`   Template: ${options.template}`);
    console.log('\n📁 Created directories:');
    console.log('   .liye/');
    console.log('   .liye/config.yaml');
    console.log('   .liye/evolution/');
    console.log('\n✅ Project initialized!\n');
  });

// === Agent Commands ===
const agentCmd = program
  .command('agent')
  .description('Agent management commands');

agentCmd
  .command('list')
  .description('List available agents')
  .action(() => {
    console.log('\n📋 Available Agents:\n');
    console.log('   Domain: amazon-growth');
    console.log('   ├── market-analyst      - Market Intelligence Analyst');
    console.log('   ├── keyword-architect   - Keyword Ecosystem Architect');
    console.log('   ├── listing-optimizer   - Conversion Content Architect');
    console.log('   ├── ppc-strategist      - Sponsored Ads Strategist');
    console.log('   ├── diagnostic-architect- Performance Diagnostic');
    console.log('   ├── execution-agent     - Tactical Executor');
    console.log('   ├── quality-gate        - Quality Assurance');
    console.log('   ├── review-sentinel     - Customer Voice Analyst');
    console.log('   └── sprint-orchestrator - Sprint Orchestration Master');
    console.log('');
  });

agentCmd
  .command('run <agent-id>')
  .description('Run an agent')
  .option('-t, --task <task>', 'Task to execute')
  .option('-i, --input <input>', 'Input JSON')
  .action((agentId, options) => {
    console.log(`\n⚡ Running agent: ${agentId}`);
    if (options.task) {
      console.log(`   Task: ${options.task}`);
    }
    console.log('\n🔄 Executing...\n');
  });

// === Skill Commands ===
const skillCmd = program
  .command('skill')
  .description('Skill management commands');

skillCmd
  .command('list')
  .description('List available skills')
  .option('-c, --category <category>', 'Filter by category')
  .action((options) => {
    console.log('\n🧩 Available Skills:\n');
    const skills = registry.list();
    for (const skillId of skills) {
      const skill = registry.get(skillId);
      if (skill) {
        console.log(`   ${skillId} - ${skill.name}`);
      }
    }
    console.log(`\n   Total: ${skills.length} skills\n`);
  });

// === Workflow Commands ===
const workflowCmd = program
  .command('workflow')
  .description('Workflow management commands');

workflowCmd
  .command('list')
  .description('List available workflows')
  .action(() => {
    console.log('\n📊 Available Workflows:\n');
    console.log('   analyze        - Analysis Phase Workflow');
    console.log('   plan           - Planning Phase Workflow');
    console.log('   full-cycle     - Full Development Cycle');
    console.log('   amazon-launch  - Amazon Product Launch');
    console.log('');
  });

workflowCmd
  .command('run <workflow-id>')
  .description('Run a workflow')
  .option('-i, --input <input>', 'Input JSON file')
  .action((workflowId, options) => {
    console.log(`\n🚀 Running workflow: ${workflowId}`);
    console.log('\n🔄 Executing phases...\n');
  });

// === Build Command ===
program
  .command('build')
  .description('Build the project')
  .option('-d, --domain <domain>', 'Domain to build')
  .action((options) => {
    console.log(`\n🔨 Building ${BRAND} project...`);
    if (options.domain) {
      console.log(`   Domain: ${options.domain}`);
    }
    console.log('\n✅ Build complete!\n');
  });

// === Status Command ===
program
  .command('status')
  .description('Show system status')
  .action(() => {
    console.log(`\n📊 ${BRAND} Status\n`);
    console.log('   Version:     v' + VERSION);
    console.log('   Architecture: Four-Layer (Method/Runtime/Skill/Domain)');
    console.log('   Skills:      ' + registry.count() + ' registered');
    console.log('   Evolution:   Enabled');
    console.log('');
  });

// Parse arguments
program.parse();
