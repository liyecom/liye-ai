/**
 * liye agent validate <agent-name>
 * Validates an agent against AGENT_SPEC.md v5.0
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

async function validateAgent(agentName, repoRoot) {
  console.log('\n' + colors.bold + '🔍 Validating Agent: ' + agentName + colors.reset + '\n');

  const agentFile = findAgentFile(agentName, repoRoot);
  if (!agentFile) {
    console.log(colors.red + '❌ Agent not found: ' + agentName + colors.reset);
    console.log(colors.dim + 'Searched in: Agents/, src/domain/*/agents/' + colors.reset);
    process.exit(1);
  }

  console.log(colors.cyan + '📄 File: ' + path.relative(repoRoot, agentFile) + colors.reset + '\n');

  let agentYaml;
  try {
    const content = fs.readFileSync(agentFile, 'utf8');
    agentYaml = yaml.load(content);
  } catch (err) {
    console.log(colors.red + '❌ YAML parse error: ' + err.message + colors.reset);
    process.exit(1);
  }

  const { errors, warnings, passed } = validateAgentV5(agentYaml, agentName);

  console.log(colors.bold + 'AGENT_SPEC.md v5.0 Validation' + colors.reset);
  console.log('─'.repeat(50));

  if (passed.length > 0) {
    console.log('\n' + colors.green + '✅ Passed (' + passed.length + ')' + colors.reset);
    for (const p of passed.slice(0, 5)) {
      console.log('   ' + colors.dim + '• ' + p + colors.reset);
    }
    if (passed.length > 5) {
      console.log('   ' + colors.dim + '  ... and ' + (passed.length - 5) + ' more' + colors.reset);
    }
  }

  if (warnings.length > 0) {
    console.log('\n' + colors.yellow + '⚠️  Warnings (' + warnings.length + ')' + colors.reset);
    for (const w of warnings) {
      console.log('   • ' + w.field + ': ' + w.message);
      console.log('     ' + colors.dim + 'Ref: ' + w.spec + colors.reset);
    }
  }

  if (errors.length > 0) {
    console.log('\n' + colors.red + '❌ Errors (' + errors.length + ')' + colors.reset);
    for (const e of errors) {
      const severity = e.severity === 'critical' ? '🔴' : '❌';
      console.log('   ' + severity + ' ' + e.field + ': ' + e.message);
      console.log('     ' + colors.dim + 'Ref: ' + e.spec + colors.reset);
    }
  }

  console.log('\n' + '─'.repeat(50));
  if (errors.length === 0) {
    console.log(colors.green + colors.bold + '✅ VALID: Agent complies with v5.0 spec' + colors.reset + '\n');
    return true;
  } else {
    console.log(colors.red + colors.bold + '❌ INVALID: ' + errors.length + ' error(s) found' + colors.reset);
    console.log(colors.dim + "Run 'liye agent scaffold v5 --from " + agentName + "' to auto-fix" + colors.reset + '\n');
    process.exit(1);
  }
}

module.exports = validateAgent;
