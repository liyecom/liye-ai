
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function findSkills(dir, type) {
  const skills = [];
  if (!fs.existsSync(dir)) return skills;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      const specPath = path.join(dir, item.name, 'spec.yaml');
      if (fs.existsSync(specPath)) {
        skills.push({ id: item.name, type: type, path: dir });
      }
    }
  }
  return skills;
}

async function listSkills(repoRoot) {
  console.log('\n' + colors.bold + '📋 Skills' + colors.reset + '\n');

  const skills = [];
  
  // Global skills
  skills.push(...findSkills(path.join(repoRoot, 'src/skill/atomic'), 'atomic'));
  skills.push(...findSkills(path.join(repoRoot, 'src/skill/composite'), 'composite'));
  
  // Domain skills
  const domainDir = path.join(repoRoot, 'src/domain');
  if (fs.existsSync(domainDir)) {
    const domains = fs.readdirSync(domainDir, { withFileTypes: true });
    for (const domain of domains) {
      if (domain.isDirectory()) {
        skills.push(...findSkills(path.join(domainDir, domain.name, 'skills/atomic'), 'atomic').map(s => ({...s, domain: domain.name})));
        skills.push(...findSkills(path.join(domainDir, domain.name, 'skills/composite'), 'composite').map(s => ({...s, domain: domain.name})));
      }
    }
  }

  console.log('Type      | Domain         | Skill ID');
  console.log('----------|----------------|---------------------------');
  for (const s of skills) {
    console.log((s.type || 'atomic').padEnd(9) + ' | ' + (s.domain || 'global').padEnd(14) + ' | ' + s.id);
  }
  console.log('\n' + colors.dim + 'Total: ' + skills.length + ' skills' + colors.reset + '\n');
}

module.exports = listSkills;
