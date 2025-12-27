/**
 * LiYe AI - Hello World Example
 *
 * Demonstrates basic skill execution
 */

import { getSkillRegistry } from '../../src/skill/registry';

async function main() {
  console.log('=== LiYe AI Hello World ===\n');

  // Get the skill registry
  const registry = getSkillRegistry();

  // List available skills
  console.log('Available skills:');
  const skills = registry.getAll();
  skills.forEach(skill => {
    console.log(`  - ${skill.id}: ${skill.name}`);
  });

  // Execute a skill (example with market_research)
  const skill = registry.get('market_research');
  if (skill) {
    console.log(`\nExecuting skill: ${skill.name}`);

    const input = {
      query: 'wireless earbuds',
      market: 'US',
      depth: 'basic'
    };

    console.log('Input:', JSON.stringify(input, null, 2));

    try {
      const output = await skill.execute(input);
      console.log('Output:', JSON.stringify(output, null, 2));
    } catch (error) {
      console.error('Execution failed:', error);
    }
  } else {
    console.log('\nSkill not found. Make sure skills are registered.');
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
