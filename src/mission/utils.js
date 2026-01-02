/**
 * Mission Pack Utilities
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Generate mission ID in format: YYYYMMDD-HHMM__project__slug
 */
function generateMissionId(project, slug) {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 12)
    .replace(/(\d{8})(\d{4})/, '$1-$2');

  const safeProject = sanitizeSlug(project || 'default');
  const safeSlug = sanitizeSlug(slug || 'task');

  return `${timestamp}__${safeProject}__${safeSlug}`;
}

/**
 * Generate unique run ID
 */
function generateRunId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Sanitize string for use in directory names
 */
function sanitizeSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Find LiYe OS data directory
 * Priority: ~/liye/context > repo/data
 */
function findDataDir(repoRoot) {
  const homeDataDir = path.join(process.env.HOME, 'liye', 'context');
  if (fs.existsSync(homeDataDir)) {
    return homeDataDir;
  }
  return path.join(repoRoot, 'data');
}

/**
 * Find missions directory
 */
function findMissionsDir(repoRoot) {
  const dataDir = findDataDir(repoRoot);
  const missionsDir = path.join(dataDir, 'missions');
  if (!fs.existsSync(missionsDir)) {
    fs.mkdirSync(missionsDir, { recursive: true });
  }
  return missionsDir;
}

/**
 * Find events.jsonl path
 */
function findEventsPath(repoRoot) {
  const dataDir = findDataDir(repoRoot);
  return path.join(dataDir, 'events.jsonl');
}

/**
 * Read YAML file
 */
function readYaml(filePath) {
  const yaml = require('js-yaml');
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
}

/**
 * Write YAML file
 */
function writeYaml(filePath, data) {
  const yaml = require('js-yaml');
  const content = yaml.dump(data, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
  fs.writeFileSync(filePath, content);
}

/**
 * Read JSON file
 */
function readJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Write JSON file
 */
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * List files in directory
 */
function listFiles(dirPath, extensions = []) {
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath)
    .filter(f => {
      if (extensions.length === 0) return true;
      return extensions.some(ext => f.endsWith(ext));
    })
    .map(f => path.join(dirPath, f));
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Parse mission directory name
 */
function parseMissionId(missionId) {
  const parts = missionId.split('__');
  if (parts.length >= 3) {
    return {
      timestamp: parts[0],
      project: parts[1],
      slug: parts.slice(2).join('__'),
    };
  }
  return { timestamp: '', project: '', slug: missionId };
}

module.exports = {
  generateMissionId,
  generateRunId,
  sanitizeSlug,
  findDataDir,
  findMissionsDir,
  findEventsPath,
  readYaml,
  writeYaml,
  readJson,
  writeJson,
  ensureDir,
  listFiles,
  formatTimestamp,
  parseMissionId,
};
