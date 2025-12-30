/**
 * Quick Ask Command
 * liye ask "question" [--broker codex|gemini] [--model gpt-4.1]
 *
 * This is a shortcut for: mission new + run + ingest
 */

const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * Handle ask command
 * liye ask "question" [--broker codex|gemini] [--model gpt-4.1]
 */
async function handleAsk(question, args, repoRoot) {
  const { createMission } = require('../../src/mission/new');
  const { runMission } = require('../../src/mission/run');
  const { ingestMission } = require('../../src/mission/ingest');

  if (!question || question.trim() === '') {
    console.log(`${colors.red}❌ Missing question${colors.reset}`);
    console.log(`\nUsage: liye ask "your question" [--broker codex|gemini] [--model gpt-4.1]`);
    process.exit(1);
  }

  // Parse arguments
  const options = parseArgs(args, {
    broker: 'codex',
    model: null,
    project: 'quick-ask',
  });

  console.log(`\n${colors.cyan}🚀 LiYe Ask${colors.reset}\n`);
  console.log(`Question: ${question}`);
  console.log(`Broker:   ${options.broker}`);
  console.log('');

  try {
    // Step 1: Create mission
    console.log(`${colors.dim}Creating mission pack...${colors.reset}`);
    const slug = generateSlug(question);
    const { missionDir, missionId } = createMission({
      project: options.project,
      slug,
      objective: question,
      broker: options.broker,
      model: options.model,
      repoRoot,
    });

    // Step 2: Run mission
    console.log(`${colors.dim}Running mission...${colors.reset}`);
    const result = await runMission(missionDir, {
      model: options.model,
      repoRoot,
    });

    // Step 3: Ingest results
    console.log(`${colors.dim}Ingesting results...${colors.reset}`);
    await ingestMission(missionDir, { repoRoot });

    // Summary
    console.log(`\n${colors.green}✅ Ask completed${colors.reset}`);
    console.log(`   Mission: ${missionId}`);
    console.log(`   Status:  ${result.status}`);
    console.log(`   Outputs: ${result.outputs.join(', ') || 'see outputs/'}`);
    console.log(`\n📁 Results: ${missionDir}/outputs/`);
    console.log('');

  } catch (err) {
    console.log(`\n${colors.red}❌ Ask failed: ${err.message}${colors.reset}\n`);
    process.exit(1);
  }
}

/**
 * Generate slug from question
 */
function generateSlug(question) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Parse command line arguments
 */
function parseArgs(args, defaults = {}) {
  const result = { ...defaults };
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        result[key] = value;
        i += 2;
      } else {
        result[key] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }

  return result;
}

module.exports = handleAsk;
