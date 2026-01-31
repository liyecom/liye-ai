// src/runtime/execution/kill_switch.mjs
// Kill Switch - P6-C Emergency Stop Mechanism
//
// When KILL_SWITCH=true, all dangerous operations are blocked immediately.
// No grace period, no retry - immediate halt.

/**
 * Actions blocked when kill switch is active.
 * These are operations that could modify state or cause harm.
 */
const BLOCKED_ACTIONS = ['suggest', 'live_write', 'retry', 'replay'];

/**
 * Check if the kill switch is currently active.
 * @returns {boolean} true if KILL_SWITCH=true, false otherwise
 */
export function isKillSwitchActive() {
  return process.env.KILL_SWITCH === 'true';
}

/**
 * Get detailed kill switch status.
 * @returns {{ active: boolean, blocked_actions: string[], reason: string }}
 */
export function checkKillSwitch() {
  const active = isKillSwitchActive();
  return {
    active,
    blocked_actions: active ? [...BLOCKED_ACTIONS] : [],
    reason: active
      ? 'KILL_SWITCH=true - all operations blocked'
      : 'Kill switch inactive'
  };
}

/**
 * Assert that the kill switch is not active.
 * Throws an error if the kill switch is active.
 * @param {string} operation - The operation being attempted
 * @throws {Error} If kill switch is active
 */
export function assertKillSwitchInactive(operation) {
  if (isKillSwitchActive()) {
    throw new Error(`KILL_SWITCH active: ${operation} blocked`);
  }
}

export default {
  isKillSwitchActive,
  checkKillSwitch,
  assertKillSwitchInactive,
  BLOCKED_ACTIONS
};
