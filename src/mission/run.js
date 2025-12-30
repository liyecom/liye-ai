/**
 * Mission Runner
 * Executes a mission using the configured broker
 */

const fs = require('fs');
const path = require('path');
const { MissionStatus } = require('./types');
const {
  readYaml,
  writeJson,
  readJson,
  generateRunId,
  formatTimestamp,
} = require('./utils');
const { getBroker } = require('../brokers/registry');
const { appendEvent } = require('../context/eventlog');

/**
 * Run a mission
 * @param {string} missionDir - Mission directory path
 * @param {Object} options - Runtime options
 * @param {string} options.model - Override model
 * @param {string} options.repoRoot - Repository root
 * @returns {Object} Run result
 */
async function runMission(missionDir, options = {}) {
  const { repoRoot } = options;

  // Read mission config
  const missionPath = path.join(missionDir, 'mission.yaml');
  if (!fs.existsSync(missionPath)) {
    throw new Error(`Mission not found: ${missionPath}`);
  }

  const mission = readYaml(missionPath);
  const runId = generateRunId();
  const startedAt = new Date();

  // Create/update meta.json
  const meta = {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: null,
    status: MissionStatus.RUNNING,
    broker: mission.broker,
    model: options.model || mission.model,
    environment: {
      node_version: process.version,
      platform: process.platform,
      cwd: process.cwd(),
    },
  };
  writeJson(path.join(missionDir, 'meta.json'), meta);

  // Log start event
  await appendEvent(repoRoot, {
    type: 'start',
    broker: mission.broker,
    model: meta.model,
    mission_dir: missionDir,
    mission_id: mission.id,
    objective: mission.objective,
    run_id: runId,
    tags: mission.tags || [],
  });

  // Get and run broker
  const broker = getBroker(mission.broker);
  let result;

  try {
    // Check broker availability
    const check = await broker.check();
    if (!check.ok) {
      console.log(`\n⚠️  Broker check: ${check.detail}`);
    }

    // Run the mission
    result = await broker.run(missionDir, {
      model: meta.model,
      mission,
      repoRoot,
    });

    // Update meta with result
    meta.finished_at = new Date().toISOString();
    meta.status = result.status === 'ok' ? MissionStatus.COMPLETED : MissionStatus.FAILED;
    meta.outputs = result.outputs || [];
    meta.evidence = result.evidence || [];
    meta.notes = result.notes || '';
    writeJson(path.join(missionDir, 'meta.json'), meta);

    // Log end event
    await appendEvent(repoRoot, {
      type: 'end',
      broker: mission.broker,
      model: meta.model,
      mission_dir: missionDir,
      mission_id: mission.id,
      run_id: runId,
      status: meta.status,
      outputs: meta.outputs,
      evidence: meta.evidence,
      duration_ms: new Date() - startedAt,
      tags: mission.tags || [],
    });

  } catch (err) {
    meta.finished_at = new Date().toISOString();
    meta.status = MissionStatus.FAILED;
    meta.error = err.message;
    writeJson(path.join(missionDir, 'meta.json'), meta);

    // Log error event
    await appendEvent(repoRoot, {
      type: 'error',
      broker: mission.broker,
      mission_dir: missionDir,
      mission_id: mission.id,
      run_id: runId,
      error: err.message,
      tags: mission.tags || [],
    });

    throw err;
  }

  return {
    runId,
    missionId: mission.id,
    status: meta.status,
    outputs: result.outputs || [],
    evidence: result.evidence || [],
    notes: result.notes,
  };
}

/**
 * Get mission status
 */
function getMissionStatus(missionDir) {
  const metaPath = path.join(missionDir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    return { status: MissionStatus.PENDING };
  }
  return readJson(metaPath);
}

module.exports = { runMission, getMissionStatus };
