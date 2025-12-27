/**
 * liye agent scaffold v5 --from <source>
 * Scaffolds v5 agent from v3 agent
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function findAgentFile(agentName, repoRoot) {
  const searchPaths = [
    path.join(repoRoot, 'Agents'),
    path.join(repoRoot, 'src/domain'),
  ];

  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;
    const files = findYamlFiles(searchPath);
    for (const file of files) {
      if (path.basename(file, '.yaml') === agentName ||
          path.basename(file, '.yml') === agentName) {
        return file;
      }
    }
  }
  return null;
}

function findYamlFiles(dir) {
  const files = [];
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

function extractDomain(filePath) {
  const agentsMatch = filePath.match(/Agents\/([^\/]+)\//);
  const domainMatch = filePath.match(/domain\/([^\/]+)\//);
  return (agentsMatch || domainMatch) ? (agentsMatch || domainMatch)[1] : 'unknown';
}

function transformToV5(oldYaml, domain, agentId) {
  const v5 = {
    agent: {
      id: oldYaml.agent?.id || agentId,
      name: oldYaml.agent?.name || agentId,
      version: '1.0.0',
      domain: domain,
    },
    persona: {
      role: oldYaml.persona?.role || oldYaml.agent?.title || 'Agent Role',
      goal: oldYaml.persona?.identity || 'Define agent goal',
      backstory: oldYaml.persona?.identity || 'Define agent backstory',
      communication_style: oldYaml.persona?.style || 'Professional',
    },
    skills: {
      atomic: [],
      composite: [],
    },
    runtime: {
      process: 'sequential',
      memory: true,
      delegation: false,
      max_iterations: 5,
    },
    liyedata: {
      workflow_stage: oldYaml.bmaddata?.workflow_stage || oldYaml.liyedata?.workflow_stage || 'Define stage',
      acceptance_criteria: oldYaml.bmaddata?.acceptance_criteria || oldYaml.liyedata?.acceptance_criteria || [],
      guardrails: {
        max_change_magnitude: 0.20,
        require_review: true,
      },
    },
    evolution: {
      enabled: true,
    },
  };

  // Convert tools to skill suggestions
  if (oldYaml.tools && Array.isArray(oldYaml.tools)) {
    v5.skills.atomic = oldYaml.tools
      .map(t => {
        if (!t.name) return null;
        return t.name.toLowerCase()
          .replace(/tool$/i, '')
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '');
      })
      .filter(Boolean)
      .slice(0, 5);
  }

  // Preserve dependencies
  if (oldYaml.dependencies) {
    v5.dependencies = oldYaml.dependencies;
  }

  return v5;
}

function generateSkillSpec(skillName, domain) {
  return {
    id: skillName,
    type: 'atomic',
    domain: domain,
    description: 'TODO: Add skill description',
    input: {
      type: 'object',
      properties: {},
      required: [],
    },
    output: {
      type: 'object',
      properties: {},
    },
  };
}

async function scaffoldAgent(sourceAgent, repoRoot) {
  console.log('\n' + colors.bold + '🔧 Scaffolding v5 Agent from: ' + sourceAgent + colors.reset + '\n');

  const agentFile = findAgentFile(sourceAgent, repoRoot);
  if (!agentFile) {
    console.log(colors.red + '❌ Source agent not found: ' + sourceAgent + colors.reset);
    process.exit(1);
  }

  console.log(colors.cyan + '📄 Source: ' + path.relative(repoRoot, agentFile) + colors.reset + '\n');

  let oldYaml;
  try {
    const content = fs.readFileSync(agentFile, 'utf8');
    oldYaml = yaml.load(content);
  } catch (err) {
    console.log(colors.red + '❌ YAML parse error: ' + err.message + colors.reset);
    process.exit(1);
  }

  const domain = extractDomain(agentFile);
  const agentId = path.basename(agentFile, '.yaml');

  // Transform
  const v5Yaml = transformToV5(oldYaml, domain, agentId);

  // Generate output
  const outputDir = path.join(repoRoot, '.scaffold', 'v5');
  const agentOutputDir = path.join(outputDir, 'agents', domain);
  const skillOutputDir = path.join(outputDir, 'skills', domain, 'atomic');

  fs.mkdirSync(agentOutputDir, { recursive: true });
  fs.mkdirSync(skillOutputDir, { recursive: true });

  // Write agent
  const agentOutput = path.join(agentOutputDir, agentId + '.yaml');
  const header = '# =============================================================================\n# AGENT_SPEC.md v5.0 Compliant\n# Scaffolded from: ' + agentId + '\n# =============================================================================\n\n';
  fs.writeFileSync(agentOutput, header + yaml.dump(v5Yaml, { lineWidth: -1 }));
  console.log(colors.green + '✅ Agent: ' + path.relative(repoRoot, agentOutput) + colors.reset);

  // Write skill specs
  for (const skillName of v5Yaml.skills.atomic) {
    const skillDir = path.join(skillOutputDir, skillName);
    fs.mkdirSync(skillDir, { recursive: true });

    const specFile = path.join(skillDir, 'spec.yaml');
    const skillSpec = generateSkillSpec(skillName, domain);
    fs.writeFileSync(specFile, yaml.dump(skillSpec, { lineWidth: -1 }));
    console.log(colors.green + '✅ Skill: ' + path.relative(repoRoot, specFile) + colors.reset);
  }

  console.log('\n' + colors.bold + '📁 Output: ' + path.relative(repoRoot, outputDir) + colors.reset);
  console.log('\n' + colors.dim + 'Review scaffolded files, then copy to final location:' + colors.reset);
  console.log(colors.dim + '  cp -r .scaffold/v5/agents/' + domain + '/* Agents/' + domain + '/' + colors.reset);
  console.log(colors.dim + '  cp -r .scaffold/v5/skills/' + domain + '/* src/domain/' + domain + '/skills/' + colors.reset);
  console.log('');
}

module.exports = scaffoldAgent;
