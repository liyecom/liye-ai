/**
 * Mission Commands
 * liye mission new/run/ingest/list/status
 */

const path = require('path');
const fs = require('fs');

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

/**
 * Handle mission subcommands
 */
async function handleMission(subcommand, args, repoRoot) {
  switch (subcommand) {
    case 'new':
      return await missionNew(args, repoRoot);
    case 'run':
      return await missionRun(args, repoRoot);
    case 'ingest':
      return await missionIngest(args, repoRoot);
    case 'list':
      return await missionList(args, repoRoot);
    case 'status':
      return await missionStatus(args, repoRoot);
    case 'stats':
      return await missionStats(repoRoot);
    case 'approve':
      return await missionApprove(args, repoRoot);
    case 'revoke':
      return await missionRevoke(args, repoRoot);
    default:
      showMissionHelp();
  }
}

/**
 * liye mission new
 */
async function missionNew(args, repoRoot) {
  const { createMission } = require('../../src/mission/new');

  // Parse arguments
  const options = parseArgs(args, {
    broker: 'codex',
    project: 'default',
    slug: '',
    objective: '',
  });

  // Require at least a slug or objective
  if (!options.slug && !options.objective) {
    console.log(`${colors.red}❌ Missing required argument: --slug or --objective${colors.reset}`);
    console.log(`\nUsage: liye mission new --slug <slug> [--broker codex|gemini|antigravity|claude] [--project <name>]`);
    process.exit(1);
  }

  // Use objective as slug if not provided
  if (!options.slug) {
    options.slug = options.objective.slice(0, 30);
  }

  console.log(`\n${colors.cyan}📦 Creating Mission Pack${colors.reset}\n`);

  const { missionDir, missionId } = createMission({
    ...options,
    repoRoot,
  });

  console.log(`${colors.green}✅ Mission created${colors.reset}`);
  console.log(`\n   ID:      ${colors.bold}${missionId}${colors.reset}`);
  console.log(`   Broker:  ${options.broker}`);
  console.log(`   Project: ${options.project}`);
  console.log(`   Dir:     ${missionDir}`);
  console.log(`\n${colors.dim}Next steps:${colors.reset}`);
  console.log(`   1. Edit ${missionDir}/context.md with your context`);
  console.log(`   2. Run: liye mission run ${missionDir}`);
  console.log('');
}

/**
 * liye mission run
 */
async function missionRun(args, repoRoot) {
  const { runMission } = require('../../src/mission/run');

  const missionDir = args[0];
  if (!missionDir) {
    console.log(`${colors.red}❌ Missing mission directory${colors.reset}`);
    console.log(`\nUsage: liye mission run <missionDir> [--model <model>]`);
    process.exit(1);
  }

  // Resolve mission directory
  const fullMissionDir = path.isAbsolute(missionDir)
    ? missionDir
    : path.join(repoRoot, 'data/missions', missionDir);

  if (!fs.existsSync(fullMissionDir)) {
    console.log(`${colors.red}❌ Mission not found: ${missionDir}${colors.reset}`);
    process.exit(1);
  }

  const options = parseArgs(args.slice(1), { model: null });

  console.log(`\n${colors.cyan}🚀 Running Mission${colors.reset}\n`);

  try {
    const result = await runMission(fullMissionDir, {
      model: options.model,
      repoRoot,
    });

    console.log(`\n${colors.green}✅ Mission completed${colors.reset}`);
    console.log(`   Status:  ${result.status}`);
    console.log(`   Outputs: ${result.outputs.join(', ') || 'none'}`);
    console.log(`   Run ID:  ${result.runId}`);
    console.log('');
  } catch (err) {
    console.log(`\n${colors.red}❌ Mission failed: ${err.message}${colors.reset}\n`);
    process.exit(1);
  }
}

/**
 * liye mission ingest
 */
async function missionIngest(args, repoRoot) {
  const { ingestMission, ingestAllMissions } = require('../../src/mission/ingest');
  const { getMissionStatus } = require('../../src/mission/run');

  const missionDir = args[0];

  console.log(`\n${colors.cyan}📥 Ingesting Mission Artifacts${colors.reset}\n`);

  try {
    if (missionDir === '--all') {
      const result = await ingestAllMissions(repoRoot);
      console.log(`${colors.green}✅ Ingested ${result.count} missions${colors.reset}\n`);
    } else if (missionDir) {
      const fullMissionDir = path.isAbsolute(missionDir)
        ? missionDir
        : path.join(repoRoot, 'data/missions', missionDir);

      // Check for needs_manual status
      const meta = getMissionStatus(fullMissionDir);
      if (meta.status === 'needs_manual') {
        const answerPath = path.join(fullMissionDir, 'outputs', 'answer.md');
        const hasAnswer = fs.existsSync(answerPath) &&
          fs.readFileSync(answerPath, 'utf8').trim().length > 50;

        if (!hasAnswer) {
          console.log(`${colors.yellow}⚠️  Mission requires manual completion${colors.reset}`);
          console.log(`\n   Status: needs_manual`);
          console.log(`   Missing: outputs/answer.md (with your response)`);
          console.log(`\n   Steps:`);
          console.log(`   1. Review: ${fullMissionDir}/outputs/MANUAL_PROMPT.md`);
          console.log(`   2. Write your answer to: ${fullMissionDir}/outputs/answer.md`);
          console.log(`   3. Run this command again to complete ingestion\n`);
          return;
        }
      }

      const result = await ingestMission(fullMissionDir, { repoRoot });
      console.log(`${colors.green}✅ Ingested: ${result.missionId}${colors.reset}`);
      console.log(`   Outputs:  ${result.outputs.length} files`);
      console.log(`   Evidence: ${result.evidence.length} files`);

      // If was needs_manual and now has answer, update status
      if (meta.status === 'needs_manual') {
        console.log(`\n${colors.green}✅ Manual completion detected - mission updated${colors.reset}`);
      }
      console.log('');
    } else {
      console.log(`${colors.red}❌ Missing mission directory${colors.reset}`);
      console.log(`\nUsage: liye mission ingest <missionDir>`);
      console.log(`       liye mission ingest --all`);
      process.exit(1);
    }
  } catch (err) {
    console.log(`\n${colors.red}❌ Ingest failed: ${err.message}${colors.reset}\n`);
    process.exit(1);
  }
}

/**
 * liye mission list
 */
async function missionList(args, repoRoot) {
  const { searchIndex, getIndexStats } = require('../../src/context/index');

  const options = parseArgs(args, {
    broker: null,
    status: null,
    tag: null,
    limit: 20,
  });

  console.log(`\n${colors.cyan}📋 Mission List${colors.reset}\n`);

  const query = {};
  if (options.broker) query.broker = options.broker;
  if (options.status) query.status = options.status;
  if (options.tag) query.tag = options.tag;

  const missions = searchIndex(repoRoot, query);
  const limited = missions.slice(-options.limit).reverse();

  if (limited.length === 0) {
    console.log(`${colors.dim}No missions found${colors.reset}\n`);
    return;
  }

  for (const mission of limited) {
    const statusIcon = getStatusIcon(mission.status);
    const outputs = mission.outputs.length > 0 ? `(${mission.outputs.length} files)` : '';
    console.log(`${statusIcon} ${colors.bold}${mission.id}${colors.reset}`);
    console.log(`   ${colors.dim}${mission.objective.slice(0, 60)}${colors.reset} ${outputs}`);
    console.log(`   Broker: ${mission.broker} | Status: ${mission.status}`);
    console.log('');
  }

  console.log(`${colors.dim}Showing ${limited.length} of ${missions.length} missions${colors.reset}\n`);
}

/**
 * liye mission status
 */
async function missionStatus(args, repoRoot) {
  const { getMissionStatus } = require('../../src/mission/run');
  const { readYaml } = require('../../src/mission/utils');

  const missionDir = args[0];
  if (!missionDir) {
    console.log(`${colors.red}❌ Missing mission directory${colors.reset}`);
    process.exit(1);
  }

  const fullMissionDir = path.isAbsolute(missionDir)
    ? missionDir
    : path.join(repoRoot, 'data/missions', missionDir);

  if (!fs.existsSync(fullMissionDir)) {
    console.log(`${colors.red}❌ Mission not found: ${missionDir}${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.cyan}📊 Mission Status${colors.reset}\n`);

  const missionPath = path.join(fullMissionDir, 'mission.yaml');
  const mission = readYaml(missionPath);
  const meta = getMissionStatus(fullMissionDir);

  console.log(`${colors.bold}${mission.id}${colors.reset}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`Objective: ${mission.objective}`);
  console.log(`Broker:    ${mission.broker}`);
  console.log(`Model:     ${meta.model || mission.model}`);
  console.log(`Status:    ${getStatusIcon(meta.status)} ${meta.status}`);

  if (meta.started_at) {
    console.log(`Started:   ${meta.started_at}`);
  }
  if (meta.finished_at) {
    console.log(`Finished:  ${meta.finished_at}`);
  }
  if (meta.outputs && meta.outputs.length > 0) {
    console.log(`Outputs:   ${meta.outputs.join(', ')}`);
  }
  console.log('');
}

/**
 * liye mission stats
 */
async function missionStats(repoRoot) {
  const { getIndexStats } = require('../../src/context/index');
  const { getEventStats } = require('../../src/context/eventlog');

  console.log(`\n${colors.cyan}📈 Mission Statistics${colors.reset}\n`);

  const indexStats = getIndexStats(repoRoot);
  const eventStats = getEventStats(repoRoot);

  console.log(`${colors.bold}Missions${colors.reset}`);
  console.log(`  Total: ${indexStats.total}`);

  if (Object.keys(indexStats.byBroker).length > 0) {
    console.log(`\n  By Broker:`);
    for (const [broker, count] of Object.entries(indexStats.byBroker)) {
      console.log(`    ${broker}: ${count}`);
    }
  }

  if (Object.keys(indexStats.byStatus).length > 0) {
    console.log(`\n  By Status:`);
    for (const [status, count] of Object.entries(indexStats.byStatus)) {
      console.log(`    ${getStatusIcon(status)} ${status}: ${count}`);
    }
  }

  console.log(`\n${colors.bold}Events${colors.reset}`);
  console.log(`  Total: ${eventStats.total}`);

  if (Object.keys(eventStats.byType).length > 0) {
    console.log(`\n  By Type:`);
    for (const [type, count] of Object.entries(eventStats.byType)) {
      console.log(`    ${type}: ${count}`);
    }
  }

  console.log('');
}

/**
 * Show mission help
 */
function showMissionHelp() {
  console.log(`
${colors.bold}Mission Commands${colors.reset}

${colors.cyan}Core Commands:${colors.reset}
  liye mission new --slug <slug> [options]    Create new mission pack
  liye mission run <missionDir> [options]     Run a mission
  liye mission ingest <missionDir>            Ingest mission artifacts
  liye mission list [options]                 List missions
  liye mission status <missionDir>            Show mission status
  liye mission stats                          Show statistics

${colors.cyan}Approval Commands (semi-auto mode):${colors.reset}
  liye mission approve <missionDir>           Grant approval for mission
  liye mission revoke <missionDir>            Revoke approval

${colors.cyan}Options for 'new':${colors.reset}
  --broker <type>      Broker: codex, gemini, antigravity, claude (default: codex)
  --project <name>     Project name (default: default)
  --slug <slug>        Task slug (required)
  --objective <text>   Task objective
  --model <model>      Model to use (default: gpt-5.2-thinking)

${colors.cyan}Options for 'run':${colors.reset}
  --model <model>      Override model

${colors.cyan}Options for 'list':${colors.reset}
  --broker <type>      Filter by broker
  --status <status>    Filter by status (completed/failed/needs_manual/pending)
  --tag <tag>          Filter by tag
  --limit <n>          Limit results (default: 20)

${colors.cyan}Status Icons:${colors.reset}
  ✅ completed    📝 needs_manual    🔄 running    ❌ failed    ⏳ pending

${colors.cyan}Examples:${colors.reset}
  liye mission new --slug "analyze-keywords" --broker codex --project amazon
  liye mission approve 20251231-1200__amazon__analyze-keywords
  liye mission run 20251231-1200__amazon__analyze-keywords
  liye mission ingest --all
`);
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

/**
 * liye mission approve
 */
async function missionApprove(args, repoRoot) {
  const { grantApproval, getApprovalState, formatApprovalStatus } = require('../../src/config/approval');

  const missionDir = args[0];
  if (!missionDir) {
    console.log(`${colors.red}❌ Missing mission directory${colors.reset}`);
    console.log(`\nUsage: liye mission approve <missionDir>`);
    process.exit(1);
  }

  const fullMissionDir = path.isAbsolute(missionDir)
    ? missionDir
    : path.join(repoRoot, 'data/missions', missionDir);

  if (!fs.existsSync(fullMissionDir)) {
    console.log(`${colors.red}❌ Mission not found: ${missionDir}${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.cyan}🔓 Approving Mission${colors.reset}\n`);

  const result = grantApproval(fullMissionDir, 'user');

  if (result.success) {
    console.log(`${colors.green}✅ Approval granted${colors.reset}`);
    console.log(`   Granted at: ${result.granted_at}`);
    console.log(`   Scope: Same mission, until mission ends`);
    console.log(`\n${colors.dim}Note: Dangerous actions (rm -rf, sudo, git push, etc.) will still require re-approval.${colors.reset}\n`);
  } else {
    console.log(`${colors.red}❌ Failed to grant approval: ${result.reason}${colors.reset}\n`);
  }
}

/**
 * liye mission revoke
 */
async function missionRevoke(args, repoRoot) {
  const { revokeApproval, getApprovalState, formatApprovalStatus } = require('../../src/config/approval');

  const missionDir = args[0];
  if (!missionDir) {
    console.log(`${colors.red}❌ Missing mission directory${colors.reset}`);
    console.log(`\nUsage: liye mission revoke <missionDir>`);
    process.exit(1);
  }

  const fullMissionDir = path.isAbsolute(missionDir)
    ? missionDir
    : path.join(repoRoot, 'data/missions', missionDir);

  if (!fs.existsSync(fullMissionDir)) {
    console.log(`${colors.red}❌ Mission not found: ${missionDir}${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.cyan}🔒 Revoking Approval${colors.reset}\n`);

  const result = revokeApproval(fullMissionDir);

  if (result.success) {
    console.log(`${colors.green}✅ Approval revoked${colors.reset}`);
    console.log(`   Mission will require re-approval for future actions.\n`);
  } else {
    console.log(`${colors.red}❌ Failed to revoke: ${result.reason}${colors.reset}\n`);
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status) {
  switch (status) {
    case 'completed': return '✅';
    case 'running': return '🔄';
    case 'failed': return '❌';
    case 'cancelled': return '⏹️';
    case 'needs_manual': return '📝';
    default: return '⏳';
  }
}

module.exports = handleMission;
