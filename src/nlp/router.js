/**
 * NL Router Module
 *
 * Routes recognized intent to Claude Code execution:
 * - Identifies which OS system to use (Amazon Growth OS, Investment OS, etc.)
 * - Loads relevant agents, skills, and workflows
 * - Calls claude CLI with appropriate context
 *
 * liye CLI → intent recognition → call cc with OS context → cc executes
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

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
// Note: GEO OS is core infrastructure (knowledge engine), not a user-facing domain
// It provides geo_units.json to other OS systems
const DOMAIN_OS = {
  amazon: {
    name: 'Amazon Growth OS',
    path: 'src/domain/amazon-growth',
    agents: 'Agents/amazon-growth',
    skills: ['Skills/02_Commerce_Operations', 'Skills/04_Market_Research'],
    pack: '.claude/packs/operations.md',
  },
  investment: {
    name: 'Investment OS',
    path: 'src/domain/investment-os',
    agents: 'src/domain/investment-os/agents',
    skills: ['Skills/03_Investment_Intelligence'],
    pack: null,
  },
  medical: {
    name: 'Medical OS',
    path: 'src/domain/medical-os',
    agents: 'src/domain/medical-os/agents',
    skills: ['Skills/01_Research_Intelligence', 'Skills/09_Medical_Research'],
    pack: '.claude/packs/research.md',
  },
  code: {
    name: 'Code Assistant',
    path: null,
    agents: 'Agents/core',
    skills: ['Skills/00_Core_Utilities'],
    pack: null,
  },
  general: {
    name: 'General Assistant',
    path: null,
    agents: 'Agents/core',
    skills: [],
    pack: null,
  },
};

/**
 * Route intent to Claude Code execution
 * @param {Object} intent - Recognized intent
 * @param {string} repoRoot - Repository root path
 */
async function routeIntent(intent, repoRoot) {
  const os = DOMAIN_OS[intent.domain] || DOMAIN_OS.general;

  // Display intent analysis
  console.log(`\n${colors.cyan}${colors.bold}LiYe AI${colors.reset}`);
  console.log(`${colors.dim}─────────────────────────────────────${colors.reset}`);
  console.log(`${colors.blue}任务:${colors.reset}   ${intent.raw}`);
  console.log(`${colors.blue}系统:${colors.reset}   ${os.name}`);
  if (intent.entity) {
    console.log(`${colors.blue}实体:${colors.reset}   ${intent.entity}`);
  }
  console.log(`${colors.dim}─────────────────────────────────────${colors.reset}\n`);

  // Build context for Claude Code
  const context = buildContext(intent, os, repoRoot);

  // Call Claude Code
  return await callClaudeCode(intent.raw, context, repoRoot);
}

/**
 * Build context string for Claude Code
 */
function buildContext(intent, os, repoRoot) {
  const sections = [];

  // OS system directive
  sections.push(`# LiYe OS Context`);
  sections.push(`\nYou are operating within **${os.name}**.`);
  sections.push(`Task: ${intent.raw}`);

  // Load pack if available
  if (os.pack) {
    const packPath = path.join(repoRoot, os.pack);
    if (fs.existsSync(packPath)) {
      const packContent = fs.readFileSync(packPath, 'utf8');
      sections.push(`\n## Domain Knowledge\n${packContent}`);
    }
  }

  // List available agents
  if (os.agents) {
    const agentPath = path.join(repoRoot, os.agents);
    if (fs.existsSync(agentPath)) {
      const agents = fs.readdirSync(agentPath).filter(f => f.endsWith('.yaml'));
      if (agents.length > 0) {
        sections.push(`\n## Available Agents (${os.agents}/)`);
        agents.forEach(a => sections.push(`- ${a}`));

        // Load first 3 agent definitions for reference
        sections.push(`\n### Agent Definitions`);
        for (const agent of agents.slice(0, 3)) {
          const content = fs.readFileSync(path.join(agentPath, agent), 'utf8');
          sections.push(`\n#### ${agent}\n\`\`\`yaml\n${content}\`\`\``);
        }
      }
    }
  }

  // List available skills
  if (os.skills && os.skills.length > 0) {
    sections.push(`\n## Available Skills`);
    for (const skillDir of os.skills) {
      const skillPath = path.join(repoRoot, skillDir);
      if (fs.existsSync(skillPath)) {
        const items = fs.readdirSync(skillPath).slice(0, 10);
        sections.push(`\n### ${path.basename(skillDir)}`);
        items.forEach(item => sections.push(`- ${item}`));
      }
    }
  }

  // Entity-specific guidance
  if (intent.entities.asin) {
    sections.push(`\n## ASIN Analysis Task`);
    sections.push(`Target ASIN: **${intent.entities.asin}**`);
    sections.push(`\nRecommended approach:`);
    sections.push(`1. Load product data for ${intent.entities.asin}`);
    sections.push(`2. Analyze listing quality, keywords, reviews`);
    sections.push(`3. Provide actionable insights`);
  }

  if (intent.entities.keyword) {
    sections.push(`\n## Keyword Analysis Task`);
    sections.push(`Target Keyword: **${intent.entities.keyword}**`);
    sections.push(`\nRecommended approach:`);
    sections.push(`1. Research search volume and competition`);
    sections.push(`2. Identify related keywords`);
    sections.push(`3. Map to product opportunities`);
  }

  // OS path for reference
  if (os.path) {
    sections.push(`\n## System Location`);
    sections.push(`OS implementation: ${os.path}/`);
  }

  return sections.join('\n');
}

/**
 * Call Claude Code CLI with context
 */
async function callClaudeCode(task, context, repoRoot) {
  return new Promise((resolve, reject) => {
    console.log(`${colors.dim}调用 Claude Code...${colors.reset}\n`);

    // Use claude CLI with append-system-prompt
    const args = [
      '--append-system-prompt', context,
      task,
    ];

    const claude = spawn('claude', args, {
      cwd: repoRoot,
      stdio: 'inherit',  // Pass through I/O for interactive session
      env: { ...process.env },
    });

    claude.on('close', (code) => {
      if (code === 0) {
        resolve({ status: 'COMPLETED', code });
      } else {
        resolve({ status: 'ERROR', code });
      }
    });

    claude.on('error', (err) => {
      console.error(`${colors.red}Failed to start Claude Code: ${err.message}${colors.reset}`);
      reject(err);
    });
  });
}

/**
 * Format domain for display
 */
function formatDomain(domain) {
  const map = {
    amazon: 'Amazon 电商',
    investment: '投资分析',
    medical: '医疗研究',
    code: '代码开发',
    general: '通用',
  };
  return map[domain] || domain;
}

module.exports = {
  routeIntent,
  buildContext,
  DOMAIN_OS,
};
