/**
 * liye report architecture
 * Architecture Compliance Report (v5.0)
 *
 * CONSTRAINT: This command ONLY aggregates existing validate results.
 * NO new judgment rules are added here.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { validateAgentV5 } = require('../validators/agent-v5');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// ============================================================================
// DEBT TYPE MAPPING (Frozen)
// Maps validate errors to standardized debt categories
// ============================================================================

const AGENT_DEBT_TYPES = {
  // Field issues
  'Missing required section': 'MISSING_REQUIRED_FIELD',
  'Missing required field': 'MISSING_REQUIRED_FIELD',
  'Missing optional': 'MISSING_REQUIRED_FIELD',

  // Deprecated
  'bmaddata': 'DEPRECATED_FIELD_USED',
  'rename to': 'DEPRECATED_FIELD_USED',

  // Red lines
  'tools': 'TOOLS_USED_INSTEAD_OF_SKILLS',
  'use "skills"': 'TOOLS_USED_INSTEAD_OF_SKILLS',
  'workflow': 'AGENT_DEFINES_EXECUTION',
  'phases': 'AGENT_DEFINES_EXECUTION',
  'Evolution has extra': 'INVALID_EVOLUTION_CONFIG',
  'only "enabled"': 'INVALID_EVOLUTION_CONFIG',

  // Runtime
  'runtime': 'RUNTIME_INCOMPLETE',
  'process': 'RUNTIME_INCOMPLETE',
  'memory': 'RUNTIME_INCOMPLETE',
  'delegation': 'RUNTIME_INCOMPLETE',

  // Persona
  'Persona': 'PERSONA_OVERREACH',
  'execution logic': 'PERSONA_OVERREACH',
};

const SKILL_DEBT_TYPES = {
  'spec.yaml': 'SPEC_MISSING',
  'Missing spec': 'SPEC_MISSING',
  'index.ts': 'INVALID_SKILL_STRUCTURE',
  'compose.yaml': 'COMPOSITE_IMPLEMENTS_LOGIC',
  'Missing compose': 'INVALID_SKILL_STRUCTURE',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function findYamlFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...findYamlFiles(fullPath));
    } else if (item.name.endsWith('.yaml') || item.name.endsWith('.yml')) {
      files.push(fullPath);
    }
  }
  return files;
}

function findSkillDirs(dir) {
  const skills = [];
  if (!fs.existsSync(dir)) return skills;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      const specPath = path.join(dir, item.name, 'spec.yaml');
      if (fs.existsSync(specPath)) {
        skills.push({ name: item.name, path: path.join(dir, item.name) });
      }
    }
  }
  return skills;
}

function classifyDebtType(message, isSkill = false) {
  const mapping = isSkill ? SKILL_DEBT_TYPES : AGENT_DEBT_TYPES;
  for (const [pattern, debtType] of Object.entries(mapping)) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      return debtType;
    }
  }
  return isSkill ? 'INVALID_SKILL_STRUCTURE' : 'MISSING_REQUIRED_FIELD';
}

function getAgentPath(filePath, repoRoot) {
  const relative = path.relative(path.join(repoRoot, 'Agents'), filePath);
  return relative.replace('.yaml', '').replace('.yml', '');
}

// ============================================================================
// VALIDATE SKILL (Reuses existing logic pattern)
// ============================================================================

function validateSkill(skillPath, skillName) {
  const errors = [];
  const warnings = [];
  const passed = [];

  const specPath = path.join(skillPath, 'spec.yaml');
  const indexPath = path.join(skillPath, 'index.ts');
  const composePath = path.join(skillPath, 'compose.yaml');

  // Check spec.yaml
  if (fs.existsSync(specPath)) {
    passed.push('spec.yaml exists');
    try {
      const spec = yaml.load(fs.readFileSync(specPath, 'utf8'));
      if (spec.id) passed.push('spec.id');
      else errors.push({ message: 'Missing spec.id' });
      if (spec.type) passed.push('spec.type');
      else errors.push({ message: 'Missing spec.type' });
      if (spec.input) passed.push('spec.input');
      else errors.push({ message: 'Missing spec.input' });
      if (spec.output) passed.push('spec.output');
      else errors.push({ message: 'Missing spec.output' });
      if (!spec.description) warnings.push({ message: 'Missing spec.description' });
    } catch (e) {
      errors.push({ message: 'spec.yaml parse error' });
    }
  } else {
    errors.push({ message: 'Missing spec.yaml' });
  }

  // Check index.ts
  if (fs.existsSync(indexPath)) {
    passed.push('index.ts exists');
  } else {
    errors.push({ message: 'Missing index.ts' });
  }

  // Check compose.yaml for composite
  if (skillPath.includes('composite')) {
    if (fs.existsSync(composePath)) {
      passed.push('compose.yaml exists');
    } else {
      errors.push({ message: 'Missing compose.yaml (required for composite)' });
    }
  }

  return { errors, warnings, passed };
}

// ============================================================================
// MAIN REPORT GENERATOR
// ============================================================================

async function generateArchitectureReport(repoRoot, options = {}) {
  const { json = false, domain = null, failOnly = false } = options;

  const results = {
    version: 'v5.0',
    timestamp: new Date().toISOString(),
    summary: {
      agents: { total: 0, pass: 0, warn: 0, fail: 0 },
      skills: { total: 0, pass: 0, warn: 0, fail: 0 },
    },
    violations: {},
    agents: { pass: [], warn: [], fail: [] },
    skills: { pass: [], warn: [], fail: [] },
    details: { agents: {}, skills: {} },
  };

  // ========================================================================
  // PHASE 1: Collect all agents and validate
  // ========================================================================

  const agentDir = path.join(repoRoot, 'Agents');
  const agentFiles = findYamlFiles(agentDir);

  for (const agentFile of agentFiles) {
    const agentPath = getAgentPath(agentFile, repoRoot);

    // Filter by domain if specified
    if (domain && !agentPath.startsWith(domain)) continue;

    try {
      const content = fs.readFileSync(agentFile, 'utf8');
      const agentYaml = yaml.load(content);
      const { errors, warnings, passed } = validateAgentV5(agentYaml, agentPath);

      results.summary.agents.total++;

      // Determine status
      let status = 'pass';
      if (errors.length > 0) {
        const hasCritical = errors.some(e => e.severity === 'critical');
        status = hasCritical ? 'fail' : 'fail';
      } else if (warnings.length > 0) {
        status = 'warn';
      }

      if (status === 'fail') {
        results.summary.agents.fail++;
        results.agents.fail.push(agentPath);
      } else if (status === 'warn') {
        results.summary.agents.warn++;
        results.agents.warn.push(agentPath);
      } else {
        results.summary.agents.pass++;
        results.agents.pass.push(agentPath);
      }

      // Collect violations
      for (const err of errors) {
        const debtType = classifyDebtType(err.message, false);
        results.violations[debtType] = (results.violations[debtType] || 0) + 1;
      }

      // Store details
      results.details.agents[agentPath] = { status, errors, warnings };

    } catch (e) {
      results.summary.agents.total++;
      results.summary.agents.fail++;
      results.agents.fail.push(agentPath);
      results.violations['INVALID_AGENT_YAML'] = (results.violations['INVALID_AGENT_YAML'] || 0) + 1;
    }
  }

  // ========================================================================
  // PHASE 2: Collect all skills and validate
  // ========================================================================

  const skillSearchPaths = [
    path.join(repoRoot, 'src/skill/atomic'),
    path.join(repoRoot, 'src/skill/composite'),
  ];

  // Add domain skills
  const domainDir = path.join(repoRoot, 'src/domain');
  if (fs.existsSync(domainDir)) {
    const domains = fs.readdirSync(domainDir, { withFileTypes: true });
    for (const d of domains) {
      if (d.isDirectory()) {
        if (domain && d.name !== domain) continue;
        skillSearchPaths.push(path.join(domainDir, d.name, 'skills/atomic'));
        skillSearchPaths.push(path.join(domainDir, d.name, 'skills/composite'));
      }
    }
  }

  for (const searchPath of skillSearchPaths) {
    const skills = findSkillDirs(searchPath);
    for (const skill of skills) {
      const { errors, warnings, passed } = validateSkill(skill.path, skill.name);

      results.summary.skills.total++;

      let status = 'pass';
      if (errors.length > 0) {
        status = 'fail';
      } else if (warnings.length > 0) {
        status = 'warn';
      }

      if (status === 'fail') {
        results.summary.skills.fail++;
        results.skills.fail.push(skill.name);
      } else if (status === 'warn') {
        results.summary.skills.warn++;
        results.skills.warn.push(skill.name);
      } else {
        results.summary.skills.pass++;
        results.skills.pass.push(skill.name);
      }

      // Collect violations
      for (const err of errors) {
        const debtType = classifyDebtType(err.message, true);
        results.violations[debtType] = (results.violations[debtType] || 0) + 1;
      }

      results.details.skills[skill.name] = { status, errors, warnings };
    }
  }

  // ========================================================================
  // PHASE 3: Calculate debt estimate
  // ========================================================================

  let lowEffort = 0;
  let mediumEffort = 0;
  let highEffort = 0;

  // Count by agent
  for (const agentPath of Object.keys(results.details.agents)) {
    const detail = results.details.agents[agentPath];
    const failCount = detail.errors.length;
    const warnCount = detail.warnings.length;

    if (failCount === 0 && warnCount > 0) {
      lowEffort++;
    } else if (failCount === 1) {
      mediumEffort++;
    } else if (failCount >= 2) {
      highEffort++;
    }
  }

  // Count by skill
  for (const skillName of Object.keys(results.details.skills)) {
    const detail = results.details.skills[skillName];
    const failCount = detail.errors.length;
    const warnCount = detail.warnings.length;

    if (failCount === 0 && warnCount > 0) {
      lowEffort++;
    } else if (failCount === 1) {
      mediumEffort++;
    } else if (failCount >= 2) {
      highEffort++;
    }
  }

  results.debt_estimate = {
    low: lowEffort,
    medium: mediumEffort,
    high: highEffort,
  };

  // ========================================================================
  // OUTPUT
  // ========================================================================

  if (json) {
    // JSON output
    const jsonOutput = {
      version: results.version,
      summary: results.summary,
      violations: Object.entries(results.violations)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      agents: failOnly
        ? { fail: results.agents.fail }
        : results.agents,
      skills: failOnly
        ? { fail: results.skills.fail }
        : results.skills,
      debt_estimate: results.debt_estimate,
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    // Human-readable output
    printHumanReport(results, failOnly);
  }

  return results;
}

// ============================================================================
// HUMAN-READABLE OUTPUT
// ============================================================================

function printHumanReport(results, failOnly) {
  const { summary, violations, agents, skills, debt_estimate } = results;

  console.log('\n' + colors.bold + 'Architecture Compliance Report (v5.0)' + colors.reset);
  console.log('─'.repeat(60) + '\n');

  // Summary
  console.log(colors.bold + '📊 Summary' + colors.reset + '\n');

  const agentStatus = summary.agents.fail > 0 ? colors.red :
                      summary.agents.warn > 0 ? colors.yellow : colors.green;
  const skillStatus = skills.fail.length > 0 ? colors.red :
                      skills.warn.length > 0 ? colors.yellow : colors.green;

  console.log('  Agents:');
  console.log('    Total: ' + summary.agents.total);
  console.log('    ' + colors.green + 'PASS: ' + summary.agents.pass + colors.reset);
  console.log('    ' + colors.yellow + 'WARN: ' + summary.agents.warn + colors.reset);
  console.log('    ' + colors.red + 'FAIL: ' + summary.agents.fail + colors.reset);
  console.log('');
  console.log('  Skills:');
  console.log('    Total: ' + summary.skills.total);
  console.log('    ' + colors.green + 'PASS: ' + summary.skills.pass + colors.reset);
  console.log('    ' + colors.yellow + 'WARN: ' + summary.skills.warn + colors.reset);
  console.log('    ' + colors.red + 'FAIL: ' + summary.skills.fail + colors.reset);
  console.log('');

  // Top Violations
  const sortedViolations = Object.entries(violations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sortedViolations.length > 0) {
    console.log(colors.bold + '🔴 Top Architecture Violations' + colors.reset + '\n');
    sortedViolations.forEach(([type, count], idx) => {
      console.log('  ' + (idx + 1) + '. ' + type + ' (' + count + ')');
    });
    console.log('');
  }

  // Agents by Status
  console.log(colors.bold + '📋 Agents by Status' + colors.reset + '\n');

  if (agents.fail.length > 0) {
    console.log('  ' + colors.red + 'FAIL:' + colors.reset);
    agents.fail.forEach(a => console.log('    - ' + a));
  }

  if (!failOnly && agents.warn.length > 0) {
    console.log('  ' + colors.yellow + 'WARN:' + colors.reset);
    agents.warn.forEach(a => console.log('    - ' + a));
  }

  if (!failOnly && agents.pass.length > 0) {
    console.log('  ' + colors.green + 'PASS:' + colors.reset);
    agents.pass.forEach(a => console.log('    - ' + a));
  }
  console.log('');

  // Skills by Status
  if (summary.skills.total > 0) {
    console.log(colors.bold + '📋 Skills by Status' + colors.reset + '\n');

    if (skills.fail.length > 0) {
      console.log('  ' + colors.red + 'FAIL:' + colors.reset);
      skills.fail.forEach(s => console.log('    - ' + s));
    }

    if (!failOnly && skills.warn.length > 0) {
      console.log('  ' + colors.yellow + 'WARN:' + colors.reset);
      skills.warn.forEach(s => console.log('    - ' + s));
    }

    if (!failOnly && skills.pass.length > 0) {
      console.log('  ' + colors.green + 'PASS:' + colors.reset);
      skills.pass.forEach(s => console.log('    - ' + s));
    }
    console.log('');
  }

  // Debt Estimate
  console.log(colors.bold + '💰 Estimated Architecture Debt' + colors.reset + '\n');
  console.log('  ' + colors.yellow + 'Low effort (WARN only): ' + debt_estimate.low + ' items' + colors.reset);
  console.log('  ' + colors.red + 'Medium effort (1 FAIL): ' + debt_estimate.medium + ' items' + colors.reset);
  console.log('  ' + colors.red + colors.bold + 'High effort (2+ FAIL): ' + debt_estimate.high + ' items' + colors.reset);
  console.log('');

  // Final verdict
  console.log('─'.repeat(60));
  const totalFail = summary.agents.fail + summary.skills.fail;
  const totalWarn = summary.agents.warn + summary.skills.warn;

  if (totalFail > 0) {
    console.log(colors.red + colors.bold + '❌ ARCHITECTURE DEBT DETECTED: ' + totalFail + ' critical violations' + colors.reset);
    console.log(colors.dim + 'Run "liye agent scaffold v5 --from <agent>" to generate v5 templates' + colors.reset);
  } else if (totalWarn > 0) {
    console.log(colors.yellow + '⚠️  MINOR DEBT: ' + totalWarn + ' warnings to address' + colors.reset);
  } else {
    console.log(colors.green + colors.bold + '✅ ALL CLEAR: Architecture compliant with v5.0' + colors.reset);
  }
  console.log('');
}

module.exports = generateArchitectureReport;
