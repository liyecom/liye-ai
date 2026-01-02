/**
 * Event Log
 * Append-only JSONL event log for mission tracking
 *
 * Events are immutable - once written, they cannot be modified.
 * This ensures auditability and reproducibility.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { findEventsPath } = require('../mission/utils');

/**
 * Event types
 */
const EventType = {
  START: 'start',
  END: 'end',
  ARTIFACT: 'artifact',
  ERROR: 'error',
};

/**
 * Generate event ID
 */
function generateEventId() {
  return `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Append event to log
 * @param {string} repoRoot - Repository root path
 * @param {Object} event - Event data
 * @returns {Promise<Object>} Written event with id and timestamp
 */
async function appendEvent(repoRoot, event) {
  const eventsPath = findEventsPath(repoRoot);

  // Ensure directory exists
  const dir = path.dirname(eventsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Build event record
  const record = {
    id: generateEventId(),
    ts: new Date().toISOString(),
    ...event,
  };

  // Append to JSONL file (atomic append)
  const line = JSON.stringify(record) + '\n';
  fs.appendFileSync(eventsPath, line);

  return record;
}

/**
 * Read all events
 * @param {string} repoRoot - Repository root path
 * @returns {Array} List of events
 */
function readEvents(repoRoot) {
  const eventsPath = findEventsPath(repoRoot);

  if (!fs.existsSync(eventsPath)) {
    return [];
  }

  const content = fs.readFileSync(eventsPath, 'utf8');
  const lines = content.trim().split('\n').filter(l => l.length > 0);

  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(e => e !== null);
}

/**
 * Query events by filter
 * @param {string} repoRoot - Repository root path
 * @param {Object} filter - Filter criteria
 * @returns {Array} Filtered events
 */
function queryEvents(repoRoot, filter = {}) {
  const events = readEvents(repoRoot);

  return events.filter(event => {
    for (const [key, value] of Object.entries(filter)) {
      if (event[key] !== value) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Get events for a specific mission
 * @param {string} repoRoot - Repository root path
 * @param {string} missionId - Mission ID
 * @returns {Array} Mission events
 */
function getMissionEvents(repoRoot, missionId) {
  return queryEvents(repoRoot, { mission_id: missionId });
}

/**
 * Get recent events
 * @param {string} repoRoot - Repository root path
 * @param {number} limit - Maximum number of events
 * @returns {Array} Recent events
 */
function getRecentEvents(repoRoot, limit = 50) {
  const events = readEvents(repoRoot);
  return events.slice(-limit);
}

/**
 * Get event statistics
 * @param {string} repoRoot - Repository root path
 * @returns {Object} Statistics
 */
function getEventStats(repoRoot) {
  const events = readEvents(repoRoot);

  const stats = {
    total: events.length,
    byType: {},
    byBroker: {},
    byStatus: {},
  };

  for (const event of events) {
    // Count by type
    stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;

    // Count by broker
    if (event.broker) {
      stats.byBroker[event.broker] = (stats.byBroker[event.broker] || 0) + 1;
    }

    // Count by status
    if (event.status) {
      stats.byStatus[event.status] = (stats.byStatus[event.status] || 0) + 1;
    }
  }

  return stats;
}

module.exports = {
  EventType,
  appendEvent,
  readEvents,
  queryEvents,
  getMissionEvents,
  getRecentEvents,
  getEventStats,
  generateEventId,
};
