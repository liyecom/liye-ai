/**
 * Context Compiler Module
 *
 * Compiles domain-specific context for Claude Code consumption.
 * Does NOT execute tasks - that's Claude Code's job.
 *
 * liye CLI = context compiler (development tool)
 * Claude Code = task executor
 */

const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// Domain to OS system mapping
const DOMAIN_OS = {
  amazon: {
    name: 'Amazon Growth OS',
    pack: '.claude/packs/operations.md',
    agents: 'Agents/amazon-growth',
    skills: ['Skills/02_Commerce_Operations', 'Skills/04_Market_Research'],
  },
  investment: {
    name: 'Investment OS',
    pack: null,
    agents: 'src/domain/investment-os/agents',
    skills: ['Skills/03_Investment_Intelligence'],
  },
  medical: {
    name: 'Medical OS',
    pack: '.claude/packs/research.md',
    agents: 'src/domain/medical-os/agents',
    skills: ['Skills/01_Research_Intelligence', 'Skills/09_Medical_Research'],
  },
  code: {
    name: 'Code Assistant',
    pack: null,
    agents: 'Agents/core',
    skills: ['Skills/00_Core_Utilities'],
  },
  general: {
    name: 'General',
    pack: null,
    agents: 'Agents/core',
    skills: [],
  },
};

/**
 * Compile context for a task
 * @param {Object} intent - Recognized intent
 * @param {string} repoRoot - Repository root path
 */
async function compileContext(intent, repoRoot) {
  const os = DOMAIN_OS[intent.domain] || DOMAIN_OS.general;

  // Display intent analysis
  console.log(`\n${colors.cyan}${colors.bold}LiYe AI Context Compiler${colors.reset}`);
  console.log(`${colors.dim}─────────────────────────────────────${colors.reset}`);
  console.log(`${colors.blue}任务:${colors.reset}   ${intent.raw}`);
  console.log(`${colors.blue}领域:${colors.reset}   ${os.name}`);
  if (intent.entity) {
    console.log(`${colors.blue}实体:${colors.reset}   ${intent.entity}`);
  }
  console.log(`${colors.dim}─────────────────────────────────────${colors.reset}\n`);

  // Build context
  const sections = [];

  // Header
  sections.push(`# LiYe OS Context`);
  sections.push(`\n> Task: ${intent.raw}`);
  sections.push(`> Domain: ${intent.domain} (${os.name})`);
  if (intent.entity) {
    sections.push(`> Entity: ${intent.entity}`);
  }
  sections.push(`\n---\n`);

  // Load pack
  if (os.pack) {
    const packPath = path.join(repoRoot, os.pack);
    if (fs.existsSync(packPath)) {
      const content = fs.readFileSync(packPath, 'utf8');
      sections.push(`\n## Domain Knowledge\n\n${content}\n`);
      console.log(`  ${colors.green}✓${colors.reset} Loaded: ${os.pack}`);
    }
  }

  // List agents
  if (os.agents) {
    const agentPath = path.join(repoRoot, os.agents);
    if (fs.existsSync(agentPath)) {
      const agents = fs.readdirSync(agentPath).filter(f => f.endsWith('.yaml'));
      if (agents.length > 0) {
        sections.push(`\n## Available Agents\n`);
        sections.push(`\nLocation: \`${os.agents}/\`\n`);
        for (const agent of agents) {
          sections.push(`- ${agent}`);
        }
        // Load first 2 agent definitions
        sections.push(`\n### Agent Definitions\n`);
        for (const agent of agents.slice(0, 2)) {
          const content = fs.readFileSync(path.join(agentPath, agent), 'utf8');
          sections.push(`\n#### ${agent}\n\`\`\`yaml\n${content}\`\`\`\n`);
        }
        console.log(`  ${colors.green}✓${colors.reset} Found ${agents.length} agents`);
      }
    }
  }

  // List skills
  if (os.skills && os.skills.length > 0) {
    sections.push(`\n## Available Skills\n`);
    for (const skillDir of os.skills) {
      const skillPath = path.join(repoRoot, skillDir);
      if (fs.existsSync(skillPath)) {
        const items = fs.readdirSync(skillPath).slice(0, 8);
        sections.push(`\n### ${path.basename(skillDir)}\n`);
        for (const item of items) {
          sections.push(`- ${item}`);
        }
      }
    }
    console.log(`  ${colors.green}✓${colors.reset} Listed skills`);
  }

  // Entity-specific guidance
  if (intent.entities.asin) {
    sections.push(`\n## Task Guidance\n`);
    sections.push(`\nTarget ASIN: **${intent.entities.asin}**\n`);
    sections.push(`\nRecommended approach:`);
    sections.push(`1. Load product data`);
    sections.push(`2. Analyze listing, keywords, reviews`);
    sections.push(`3. Provide actionable insights`);
  }

  if (intent.entities.keyword) {
    sections.push(`\n## Task Guidance\n`);
    sections.push(`\nTarget Keyword: **${intent.entities.keyword}**\n`);
    sections.push(`\nRecommended approach:`);
    sections.push(`1. Research search volume and competition`);
    sections.push(`2. Identify related keywords`);
    sections.push(`3. Map to product opportunities`);
  }

  // Write context file
  const outputDir = path.join(repoRoot, '.claude/.compiled');
  const outputPath = path.join(outputDir, 'context.md');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, sections.join('\n'));

  // Output
  console.log(`\n${colors.green}${colors.bold}✓ 上下文已编译${colors.reset}`);
  console.log(`  ${colors.dim}${outputPath}${colors.reset}`);
  console.log(`\n${colors.cyan}使用方式:${colors.reset}`);
  console.log(`  在 Claude Code 中执行任务时，CC 会自动读取此上下文`);
  console.log(`  或手动: Read .claude/.compiled/context.md\n`);

  return { contextPath: outputPath, intent, os };
}

module.exports = {
  compileContext,
  DOMAIN_OS,
};
