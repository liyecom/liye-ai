/**
 * Broker Adapter Interface
 * All brokers must implement this interface
 */

const { BrokerKind } = require('../mission/types');

/**
 * Base Broker class
 * Provides the interface that all brokers must implement
 */
class BaseBroker {
  /**
   * @returns {string} Broker identifier
   */
  id() {
    throw new Error('Not implemented: id()');
  }

  /**
   * @returns {string} Broker kind: 'cli' or 'manual'
   */
  kind() {
    return BrokerKind.CLI;
  }

  /**
   * Check if the broker is available
   * @returns {Promise<{ok: boolean, detail: string}>}
   */
  async check() {
    return { ok: true, detail: 'No check implemented' };
  }

  /**
   * Run a mission
   * @param {string} missionDir - Mission directory path
   * @param {Object} options - Runtime options
   * @param {string} options.model - Model to use
   * @param {Object} options.mission - Mission configuration
   * @param {string} options.repoRoot - Repository root
   * @returns {Promise<RunResult>}
   */
  async run(missionDir, options) {
    throw new Error('Not implemented: run()');
  }
}

/**
 * @typedef {Object} RunResult
 * @property {'ok'|'fail'} status - Run status
 * @property {string[]} outputs - List of output files
 * @property {string[]} evidence - List of evidence files
 * @property {string} [notes] - Additional notes
 */

/**
 * @typedef {Object} CheckResult
 * @property {boolean} ok - Whether the broker is available
 * @property {string} detail - Details about the check
 */

module.exports = { BaseBroker };
