
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

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

async function listAgents(repoRoot) {
  console.log('\n' + colors.bold + '📋 Agents' + colors.reset + '\n');

  const agentDir = path.join(repoRoot, 'Agents');
  const files = findYamlFiles(agentDir);

  const agents = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const yml = yaml.load(content);
      const domain = path.relative(agentDir, path.dirname(file));
      const hasV5 = yml.agent?.version && yml.skills && yml.runtime;
      agents.push({
        id: yml.agent?.id || path.basename(file, '.yaml'),
        name: yml.agent?.name || 'Unknown',
        domain: domain || 'root',
        version: yml.agent?.version || 'v3',
        v5: hasV5,
      });
    } catch (e) {}
  }

  console.log('Domain          | Agent                | Version | v5.0');
  console.log('----------------|----------------------|---------|-----');
  for (const a of agents) {
    const v5Mark = a.v5 ? colors.green + '✅' + colors.reset : colors.yellow + '⚠️ ' + colors.reset;
    console.log(a.domain.padEnd(15) + ' | ' + a.id.padEnd(20) + ' | ' + a.version.padEnd(7) + ' | ' + v5Mark);
  }
  console.log('\n' + colors.dim + 'Total: ' + agents.length + ' agents' + colors.reset + '\n');
}

module.exports = listAgents;
