// src/runtime/execution/quota_gate.mjs
// P6-C Quota Gate - Hard limits on live writes
// These limits are NOT configurable - they are safety guardrails

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// P6-C Hard Limits (not configurable)
const MAX_LIVE_WRITES_PER_DAY = 1;
const MAX_NEGATIVE_KEYWORDS_PER_ACTION = 5;
const DEFAULT_STATE_DIR = '.liye/state';

/**
 * Get today's date key in YYYY-MM-DD format
 */
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Load quota state from disk
 */
function loadQuotaState(stateDir) {
  const statePath = join(stateDir, 'write_quota.json');
  if (!existsSync(statePath)) {
    return { daily_writes: {}, last_reset: getTodayKey() };
  }
  try {
    return JSON.parse(readFileSync(statePath, 'utf-8'));
  } catch (e) {
    return { daily_writes: {}, last_reset: getTodayKey() };
  }
}

/**
 * Save quota state to disk
 */
function saveQuotaState(stateDir, state) {
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  writeFileSync(
    join(stateDir, 'write_quota.json'),
    JSON.stringify(state, null, 2),
    'utf-8'
  );
}

/**
 * Check if a write action is allowed under P6-C quota limits
 *
 * @param {Object} opts - Options
 * @param {number} opts.keyword_count - Number of negative keywords in this action
 * @param {string} opts.stateDir - Directory to store quota state
 * @returns {Object} { allowed, daily_writes_remaining, reason, ... }
 */
export function checkQuotaGate(opts = {}) {
  const { keyword_count = 0, stateDir = DEFAULT_STATE_DIR } = opts;

  // Check keyword limit first (per-action limit)
  if (keyword_count > MAX_NEGATIVE_KEYWORDS_PER_ACTION) {
    return {
      allowed: false,
      daily_writes_remaining: null,
      reason: `Keyword count ${keyword_count} exceeds limit of ${MAX_NEGATIVE_KEYWORDS_PER_ACTION}`
    };
  }

  // Load and auto-reset state if new day
  const state = loadQuotaState(stateDir);
  const today = getTodayKey();
  if (state.last_reset !== today) {
    state.daily_writes = {};
    state.last_reset = today;
    saveQuotaState(stateDir, state);
  }

  // Check daily write limit
  const todayWrites = state.daily_writes[today] || 0;
  const remaining = MAX_LIVE_WRITES_PER_DAY - todayWrites;

  if (remaining <= 0) {
    return {
      allowed: false,
      daily_writes_remaining: 0,
      reason: `Daily write limit (${MAX_LIVE_WRITES_PER_DAY}) exhausted`
    };
  }

  return {
    allowed: true,
    daily_writes_remaining: remaining,
    keyword_count,
    max_keywords: MAX_NEGATIVE_KEYWORDS_PER_ACTION,
    reason: 'Quota check passed'
  };
}

/**
 * Record a write usage (call after successful write)
 *
 * @param {Object} opts - Options
 * @param {number} opts.keyword_count - Number of keywords written
 * @param {string} opts.stateDir - Directory to store quota state
 * @returns {Object} Updated state
 */
export function recordWriteUsage(opts = {}) {
  const { keyword_count = 0, stateDir = DEFAULT_STATE_DIR } = opts;

  const state = loadQuotaState(stateDir);
  const today = getTodayKey();

  // Auto-reset on new day
  if (state.last_reset !== today) {
    state.daily_writes = {};
    state.last_reset = today;
  }

  // Increment today's write count
  state.daily_writes[today] = (state.daily_writes[today] || 0) + 1;
  state.last_write = {
    timestamp: new Date().toISOString(),
    keyword_count
  };

  saveQuotaState(stateDir, state);
  return state;
}

/**
 * Reset quota (for testing or manual override)
 *
 * @param {string} stateDir - Directory to store quota state
 * @returns {Object} Fresh state
 */
export function resetQuota(stateDir = DEFAULT_STATE_DIR) {
  const state = { daily_writes: {}, last_reset: getTodayKey() };
  saveQuotaState(stateDir, state);
  return state;
}

/**
 * Get current quota status
 *
 * @param {string} stateDir - Directory to store quota state
 * @returns {Object} Current quota status
 */
export function getQuotaStatus(stateDir = DEFAULT_STATE_DIR) {
  const state = loadQuotaState(stateDir);
  const today = getTodayKey();
  const todayWrites = state.daily_writes[today] || 0;

  return {
    today,
    writes_used: todayWrites,
    writes_remaining: Math.max(0, MAX_LIVE_WRITES_PER_DAY - todayWrites),
    max_writes_per_day: MAX_LIVE_WRITES_PER_DAY,
    max_keywords_per_action: MAX_NEGATIVE_KEYWORDS_PER_ACTION,
    last_write: state.last_write || null
  };
}

// Named exports for individual functions
export { MAX_LIVE_WRITES_PER_DAY, MAX_NEGATIVE_KEYWORDS_PER_ACTION };

// Default export with all functions and constants
export default {
  checkQuotaGate,
  recordWriteUsage,
  resetQuota,
  getQuotaStatus,
  MAX_LIVE_WRITES_PER_DAY,
  MAX_NEGATIVE_KEYWORDS_PER_ACTION
};
