/**
 * Mission Pack Types and Constants
 * LiYe OS Multi-Broker Architecture
 */

// Mission status enum
const MissionStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

// Broker types
const BrokerType = {
  CODEX: 'codex',
  GEMINI: 'gemini',
  ANTIGRAVITY: 'antigravity',
  CLAUDE: 'claude',
};

// Broker kind
const BrokerKind = {
  CLI: 'cli',
  MANUAL: 'manual',
};

// Approval policies
const ApprovalPolicy = {
  NONE: 'none',
  ON_REQUEST: 'on-request',
  ALWAYS: 'always',
};

// Default configurations
const DEFAULT_CONFIG = {
  broker: BrokerType.CODEX,
  model: 'gpt-4.1',
  approval: ApprovalPolicy.ON_REQUEST,
  sandbox: 'read-only',
  budget: {
    maxSteps: 50,
    maxTokens: 100000,
    maxTimeMinutes: 30,
  },
};

// Broker routing rules
const BROKER_ROUTING = {
  // Default routes by command type
  ask: BrokerType.CODEX,
  build: BrokerType.CLAUDE,
  ship: BrokerType.CLAUDE,
  refactor: BrokerType.CLAUDE,
  batch: BrokerType.GEMINI,
  outline: BrokerType.GEMINI,
  summarize: BrokerType.GEMINI,
  research: BrokerType.ANTIGRAVITY,
  browser: BrokerType.ANTIGRAVITY,
};

/**
 * Mission Pack structure:
 *
 * missions/<YYYYMMDD-HHMM>__<project>__<slug>/
 *   mission.yaml            # Objective, done_definition, broker, model, budget
 *   context.md              # Required context for the mission
 *   constraints.md          # Boundaries, forbidden zones, approval rules
 *   outputs/                # Deliverables (required)
 *   evidence/               # Evidence chain (recommended)
 *   meta.json               # Runtime metadata (written by system)
 */

module.exports = {
  MissionStatus,
  BrokerType,
  BrokerKind,
  ApprovalPolicy,
  DEFAULT_CONFIG,
  BROKER_ROUTING,
};
