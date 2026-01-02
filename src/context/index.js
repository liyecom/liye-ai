/**
 * Mission Index
 * Maintains a searchable index of all missions
 * The index is rebuildable from events.jsonl and mission directories
 */

const fs = require('fs');
const path = require('path');
const { findDataDir, findMissionsDir, readYaml, readJson } = require('../mission/utils');

/**
 * Get index file path
 */
function getIndexPath(repoRoot) {
  const dataDir = findDataDir(repoRoot);
  return path.join(dataDir, 'index.json');
}

/**
 * Read index
 * @param {string} repoRoot - Repository root path
 * @returns {Object} Index data
 */
function readIndex(repoRoot) {
  const indexPath = getIndexPath(repoRoot);

  if (!fs.existsSync(indexPath)) {
    return {
      version: '1.0',
      updated_at: null,
      missions: {},
    };
  }

  return readJson(indexPath);
}

/**
 * Write index
 * @param {string} repoRoot - Repository root path
 * @param {Object} index - Index data
 */
function writeIndex(repoRoot, index) {
  const indexPath = getIndexPath(repoRoot);
  const dir = path.dirname(indexPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  index.updated_at = new Date().toISOString();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

/**
 * Update index with mission data
 * @param {string} repoRoot - Repository root path
 * @param {Object} missionData - Mission data to add/update
 */
async function updateIndex(repoRoot, missionData) {
  const index = readIndex(repoRoot);

  index.missions[missionData.mission_id] = {
    id: missionData.mission_id,
    dir: missionData.mission_dir,
    objective: missionData.objective,
    broker: missionData.broker,
    status: missionData.status,
    outputs: missionData.outputs || [],
    evidence: missionData.evidence || [],
    created_at: missionData.created_at,
    finished_at: missionData.finished_at,
    tags: missionData.tags || [],
    indexed_at: new Date().toISOString(),
  };

  writeIndex(repoRoot, index);
}

/**
 * Remove mission from index
 * @param {string} repoRoot - Repository root path
 * @param {string} missionId - Mission ID to remove
 */
function removeFromIndex(repoRoot, missionId) {
  const index = readIndex(repoRoot);

  if (index.missions[missionId]) {
    delete index.missions[missionId];
    writeIndex(repoRoot, index);
  }
}

/**
 * Search missions in index
 * @param {string} repoRoot - Repository root path
 * @param {Object} query - Search query
 * @returns {Array} Matching missions
 */
function searchIndex(repoRoot, query = {}) {
  const index = readIndex(repoRoot);
  const missions = Object.values(index.missions);

  return missions.filter(mission => {
    // Filter by broker
    if (query.broker && mission.broker !== query.broker) {
      return false;
    }

    // Filter by status
    if (query.status && mission.status !== query.status) {
      return false;
    }

    // Filter by tag
    if (query.tag && !mission.tags.includes(query.tag)) {
      return false;
    }

    // Filter by text search (objective)
    if (query.text) {
      const text = query.text.toLowerCase();
      if (!mission.objective.toLowerCase().includes(text)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Rebuild index from mission directories
 * @param {string} repoRoot - Repository root path
 * @returns {Object} Rebuilt index stats
 */
async function rebuildIndex(repoRoot) {
  const missionsDir = findMissionsDir(repoRoot);

  if (!fs.existsSync(missionsDir)) {
    return { count: 0, errors: [] };
  }

  const index = {
    version: '1.0',
    updated_at: new Date().toISOString(),
    missions: {},
  };

  const dirs = fs.readdirSync(missionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const errors = [];

  for (const dir of dirs) {
    const missionDir = path.join(missionsDir, dir);
    const missionPath = path.join(missionDir, 'mission.yaml');

    if (!fs.existsSync(missionPath)) {
      errors.push(`Missing mission.yaml: ${dir}`);
      continue;
    }

    try {
      const mission = readYaml(missionPath);
      const metaPath = path.join(missionDir, 'meta.json');
      const meta = fs.existsSync(metaPath) ? readJson(metaPath) : {};

      const outputsDir = path.join(missionDir, 'outputs');
      const evidenceDir = path.join(missionDir, 'evidence');

      index.missions[mission.id] = {
        id: mission.id,
        dir: missionDir,
        objective: mission.objective,
        broker: mission.broker,
        status: meta.status || 'pending',
        outputs: fs.existsSync(outputsDir) ? fs.readdirSync(outputsDir) : [],
        evidence: fs.existsSync(evidenceDir) ? fs.readdirSync(evidenceDir) : [],
        created_at: mission.created_at,
        finished_at: meta.finished_at || null,
        tags: mission.tags || [],
        indexed_at: new Date().toISOString(),
      };
    } catch (err) {
      errors.push(`Error indexing ${dir}: ${err.message}`);
    }
  }

  writeIndex(repoRoot, index);

  return {
    count: Object.keys(index.missions).length,
    errors,
  };
}

/**
 * Get index statistics
 * @param {string} repoRoot - Repository root path
 * @returns {Object} Index statistics
 */
function getIndexStats(repoRoot) {
  const index = readIndex(repoRoot);
  const missions = Object.values(index.missions);

  const stats = {
    total: missions.length,
    byBroker: {},
    byStatus: {},
    byTag: {},
    updated_at: index.updated_at,
  };

  for (const mission of missions) {
    // Count by broker
    stats.byBroker[mission.broker] = (stats.byBroker[mission.broker] || 0) + 1;

    // Count by status
    stats.byStatus[mission.status] = (stats.byStatus[mission.status] || 0) + 1;

    // Count by tag
    for (const tag of mission.tags || []) {
      stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
    }
  }

  return stats;
}

module.exports = {
  readIndex,
  writeIndex,
  updateIndex,
  removeFromIndex,
  searchIndex,
  rebuildIndex,
  getIndexStats,
  getIndexPath,
};
