/**
 * Mission Ingest
 * Scans mission outputs and evidence, updates event log and index
 */

const fs = require('fs');
const path = require('path');
const { readYaml, readJson, listFiles, formatTimestamp } = require('./utils');
const { appendEvent } = require('../context/eventlog');
const { updateIndex } = require('../context/index');

/**
 * Ingest mission artifacts
 * @param {string} missionDir - Mission directory path
 * @param {Object} options
 * @param {string} options.repoRoot - Repository root
 * @returns {Object} Ingest result
 */
async function ingestMission(missionDir, options = {}) {
  const { repoRoot } = options;

  // Read mission config
  const missionPath = path.join(missionDir, 'mission.yaml');
  if (!fs.existsSync(missionPath)) {
    throw new Error(`Mission not found: ${missionPath}`);
  }

  const mission = readYaml(missionPath);
  const outputsDir = path.join(missionDir, 'outputs');
  const evidenceDir = path.join(missionDir, 'evidence');

  // Scan outputs
  const outputs = [];
  if (fs.existsSync(outputsDir)) {
    const files = fs.readdirSync(outputsDir);
    for (const file of files) {
      const filePath = path.join(outputsDir, file);
      const stats = fs.statSync(filePath);
      outputs.push({
        name: file,
        path: filePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      });
    }
  }

  // Scan evidence
  const evidence = [];
  if (fs.existsSync(evidenceDir)) {
    const files = fs.readdirSync(evidenceDir);
    for (const file of files) {
      const filePath = path.join(evidenceDir, file);
      const stats = fs.statSync(filePath);
      evidence.push({
        name: file,
        path: filePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      });
    }
  }

  // Read meta if exists
  const metaPath = path.join(missionDir, 'meta.json');
  const meta = fs.existsSync(metaPath) ? readJson(metaPath) : {};

  // Log artifact event
  await appendEvent(repoRoot, {
    type: 'artifact',
    mission_dir: missionDir,
    mission_id: mission.id,
    objective: mission.objective,
    broker: mission.broker,
    run_id: meta.run_id || null,
    outputs: outputs.map(o => o.name),
    evidence: evidence.map(e => e.name),
    tags: mission.tags || [],
  });

  // Update index
  await updateIndex(repoRoot, {
    mission_id: mission.id,
    mission_dir: missionDir,
    objective: mission.objective,
    broker: mission.broker,
    status: meta.status || 'pending',
    outputs: outputs.map(o => o.name),
    evidence: evidence.map(e => e.name),
    created_at: mission.created_at,
    finished_at: meta.finished_at || null,
    tags: mission.tags || [],
  });

  return {
    missionId: mission.id,
    outputs,
    evidence,
    indexed: true,
  };
}

/**
 * Batch ingest all missions
 */
async function ingestAllMissions(repoRoot) {
  const { findMissionsDir } = require('./utils');
  const missionsDir = findMissionsDir(repoRoot);

  if (!fs.existsSync(missionsDir)) {
    return { count: 0, missions: [] };
  }

  const dirs = fs.readdirSync(missionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const results = [];
  for (const dir of dirs) {
    const missionDir = path.join(missionsDir, dir);
    try {
      const result = await ingestMission(missionDir, { repoRoot });
      results.push(result);
    } catch (err) {
      console.error(`Failed to ingest ${dir}: ${err.message}`);
    }
  }

  return { count: results.length, missions: results };
}

module.exports = { ingestMission, ingestAllMissions };
