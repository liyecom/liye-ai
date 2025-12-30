/**
 * Mission Pack Creation
 * Creates a new mission directory with template files
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG, BrokerType } = require('./types');
const {
  generateMissionId,
  findMissionsDir,
  writeYaml,
  ensureDir,
} = require('./utils');
const { getRouteConfig } = require('../config/load');

/**
 * Create a new mission pack
 * @param {Object} options
 * @param {string} options.project - Project name
 * @param {string} options.slug - Task slug
 * @param {string} options.objective - Task objective
 * @param {string} options.broker - Broker type (codex/gemini/antigravity/claude)
 * @param {string} options.model - Model to use
 * @param {string} options.repoRoot - Repository root path
 * @returns {Object} { missionDir, missionId }
 */
function createMission(options) {
  const {
    project = 'default',
    slug = 'task',
    objective = '',
    broker = DEFAULT_CONFIG.broker,
    model,
    repoRoot,
  } = options;

  // Generate mission ID and directory
  const missionId = generateMissionId(project, slug);
  const missionsDir = findMissionsDir(repoRoot);
  const missionDir = path.join(missionsDir, missionId);

  // Create directory structure
  ensureDir(missionDir);
  ensureDir(path.join(missionDir, 'outputs'));
  ensureDir(path.join(missionDir, 'evidence'));

  // Create mission.yaml
  const missionYaml = {
    id: missionId,
    objective: objective || `Task: ${slug}`,
    done_definition: 'Deliverables in outputs/ directory',
    broker: broker,
    model: model || getDefaultModel(broker, repoRoot),
    budget: { ...DEFAULT_CONFIG.budget },
    approval: DEFAULT_CONFIG.approval,
    sandbox: DEFAULT_CONFIG.sandbox,
    tags: [project],
    created_at: new Date().toISOString(),
  };
  writeYaml(path.join(missionDir, 'mission.yaml'), missionYaml);

  // Create context.md
  const contextMd = `# Mission Context

## Objective
${objective || `Complete the task: ${slug}`}

## Project
${project}

## Required Reading
<!-- Add required context files here -->

## Background
<!-- Add background information here -->
`;
  fs.writeFileSync(path.join(missionDir, 'context.md'), contextMd);

  // Create constraints.md
  const constraintsMd = `# Mission Constraints

## Boundaries
- Stay within project scope
- Follow existing code patterns

## Forbidden Actions
- No destructive operations without explicit approval
- No external API calls without budget consideration

## Approval Rules
- Broker: ${broker}
- Approval Policy: ${DEFAULT_CONFIG.approval}
- Sandbox Mode: ${DEFAULT_CONFIG.sandbox}

## Budget
- Max Steps: ${DEFAULT_CONFIG.budget.maxSteps}
- Max Tokens: ${DEFAULT_CONFIG.budget.maxTokens}
- Max Time: ${DEFAULT_CONFIG.budget.maxTimeMinutes} minutes
`;
  fs.writeFileSync(path.join(missionDir, 'constraints.md'), constraintsMd);

  return { missionDir, missionId };
}

/**
 * Get default model for broker (now config-driven)
 * @param {string} broker - Broker type
 * @param {string} repoRoot - Repository root for config lookup
 */
function getDefaultModel(broker, repoRoot) {
  // Use config-driven defaults
  const routeConfig = getRouteConfig(repoRoot, 'ask');
  return routeConfig.model || 'gpt-5.2-thinking';
}

module.exports = { createMission, getDefaultModel };
