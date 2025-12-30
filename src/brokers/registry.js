/**
 * Broker Registry
 * Central registry for all broker implementations
 */

const { CodexBroker } = require('./codex');
const { GeminiBroker } = require('./gemini');
const { AntigravityBroker } = require('./antigravity');
const { ClaudeBroker } = require('./claude');
const { BrokerType } = require('../mission/types');

// Broker instances
const brokers = {
  [BrokerType.CODEX]: new CodexBroker(),
  [BrokerType.GEMINI]: new GeminiBroker(),
  [BrokerType.ANTIGRAVITY]: new AntigravityBroker(),
  [BrokerType.CLAUDE]: new ClaudeBroker(),
};

/**
 * Get broker by type
 * @param {string} brokerType
 * @returns {BaseBroker}
 */
function getBroker(brokerType) {
  const broker = brokers[brokerType];
  if (!broker) {
    throw new Error(`Unknown broker: ${brokerType}. Available: ${Object.keys(brokers).join(', ')}`);
  }
  return broker;
}

/**
 * List all available brokers
 * @returns {Array<{id: string, kind: string, available: boolean}>}
 */
async function listBrokers() {
  const result = [];
  for (const [type, broker] of Object.entries(brokers)) {
    const check = await broker.check();
    result.push({
      id: broker.id(),
      kind: broker.kind(),
      available: check.ok,
      detail: check.detail,
    });
  }
  return result;
}

/**
 * Check all brokers
 * @returns {Object} Broker availability status
 */
async function checkBrokers() {
  const status = {};
  for (const [type, broker] of Object.entries(brokers)) {
    status[type] = await broker.check();
  }
  return status;
}

module.exports = {
  getBroker,
  listBrokers,
  checkBrokers,
  brokers,
};
