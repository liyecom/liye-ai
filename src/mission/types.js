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
  NEEDS_MANUAL: 'needs_manual',  // Broker unavailable, manual fallback
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
  SEMI_AUTO: 'semi-auto',  // Approve once per mission, reapprove dangerous actions
  MANUAL: 'manual',         // Approve each action
};

// Default configurations (now loaded from config/brokers.yaml)
// These are fallback values when config files are missing
const DEFAULT_CONFIG = {
  broker: BrokerType.CODEX,
  model: 'gpt-5.2-thinking',  // New default model
  approval: ApprovalPolicy.SEMI_AUTO,
  sandbox: 'read-only',
  budget: {
    maxSteps: 30,
    maxTokens: 100000,
    maxRuntimeSec: 900,
  },
};

// Error codes for broker failures
const ErrorCode = {
  BROKER_NOT_INSTALLED: 'BROKER_NOT_INSTALLED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  APPROVAL_DENIED: 'APPROVAL_DENIED',
  SANDBOX_VIOLATION: 'SANDBOX_VIOLATION',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
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
  ErrorCode,
  DEFAULT_CONFIG,
  BROKER_ROUTING,
};
