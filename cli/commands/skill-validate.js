
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function findSkill(skillName, repoRoot) {
  const searchPaths = [
    path.join(repoRoot, 'src/skill/atomic', skillName),
    path.join(repoRoot, 'src/skill/composite', skillName),
  ];
  
  const domainDir = path.join(repoRoot, 'src/domain');
  if (fs.existsSync(domainDir)) {
    const domains = fs.readdirSync(domainDir, { withFileTypes: true });
    for (const domain of domains) {
      if (domain.isDirectory()) {
        searchPaths.push(path.join(domainDir, domain.name, 'skills/atomic', skillName));
        searchPaths.push(path.join(domainDir, domain.name, 'skills/composite', skillName));
      }
    }
  }
  
  for (const p of searchPaths) {
    if (fs.existsSync(path.join(p, 'spec.yaml'))) {
      return p;
    }
  }
  return null;
}

async function validateSkill(skillName, repoRoot) {
  console.log('\n' + colors.bold + '🔍 Validating Skill: ' + skillName + colors.reset + '\n');
  
  const skillPath = findSkill(skillName, repoRoot);
  if (!skillPath) {
    console.log(colors.red + '❌ Skill not found: ' + skillName + colors.reset);
    process.exit(1);
  }
  
  const errors = [];
  const passed = [];
  
  // Check spec.yaml
  const specPath = path.join(skillPath, 'spec.yaml');
  if (fs.existsSync(specPath)) {
    passed.push('spec.yaml exists');
    try {
      const spec = yaml.load(fs.readFileSync(specPath, 'utf8'));
      if (spec.id) passed.push('spec.id defined');
      else errors.push('Missing spec.id');
      if (spec.type) passed.push('spec.type defined');
      else errors.push('Missing spec.type');
      if (spec.input) passed.push('spec.input defined');
      else errors.push('Missing spec.input');
      if (spec.output) passed.push('spec.output defined');
      else errors.push('Missing spec.output');
    } catch (e) {
      errors.push('spec.yaml parse error: ' + e.message);
    }
  } else {
    errors.push('Missing spec.yaml');
  }
  
  // Check index.ts
  const indexPath = path.join(skillPath, 'index.ts');
  if (fs.existsSync(indexPath)) {
    passed.push('index.ts exists');
  } else {
    errors.push('Missing index.ts');
  }
  
  // Check compose.yaml for composite
  if (skillPath.includes('composite')) {
    const composePath = path.join(skillPath, 'compose.yaml');
    if (fs.existsSync(composePath)) {
      passed.push('compose.yaml exists');
    } else {
      errors.push('Missing compose.yaml (required for composite)');
    }
  }
  
  // Report
  console.log('SKILL_SPEC.md v5.0 Validation');
  console.log('─'.repeat(50));
  
  if (passed.length > 0) {
    console.log('\n' + colors.green + '✅ Passed (' + passed.length + ')' + colors.reset);
    for (const p of passed) {
      console.log('   ' + colors.dim + '• ' + p + colors.reset);
    }
  }
  
  if (errors.length > 0) {
    console.log('\n' + colors.red + '❌ Errors (' + errors.length + ')' + colors.reset);
    for (const e of errors) {
      console.log('   ❌ ' + e);
    }
    console.log('');
    process.exit(1);
  } else {
    console.log('\n' + colors.green + colors.bold + '✅ VALID' + colors.reset + '\n');
  }
}

module.exports = validateSkill;
