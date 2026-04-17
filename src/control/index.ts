/**
 * LiYe AI Control Plane
 * Location: src/control/index.ts
 *
 * Barrel export — orchestrator depends on these interfaces, not implementations
 */

// Types & Interfaces
export type {
  CapabilityContract,
  AgentCard,
  AgentCapabilityCandidate,
  TrustProfile,
  ExecutionPolicyResult,
  SideEffect,
  ICapabilityRegistry,
  IDiscoveryPolicy,
  IExecutionPolicy,
  ITrustStore,
} from './types';

// Implementations
export { CapabilityRegistry, getCapabilityRegistry } from './registry';
export { TrustScoreStore } from './trust';
export { DiscoveryPolicy } from './discovery-policy';
export { ExecutionPolicy } from './execution-policy';
export {
  extractFromAgentYAML,
  extractAgentMeta,
  scanAgentYAMLs,
  inferSideEffect,
} from './extractor';

// A3 Write Policy
export {
  runA3PreFlight,
  RollbackManager,
  A3KillSwitch,
  A3MetricsCollector,
  A3_WHITELIST,
} from './a3-write-policy';
export type {
  A3TaskType,
  A3WhitelistEntry,
  A3PreFlightResult,
  A3CheckItem,
  RollbackContext,
  RollbackResult,
  KillSwitchState,
  A3Metrics,
  A3TaskRecord,
} from './a3-write-policy';

// A3 Verifiers & Rollbacks
export {
  verifyOrchestratorTrace,
  verifyTraceAppend,
  verifyApprovalInit,
  rollbackOrchestratorTrace,
  rollbackTraceAppend,
  rollbackApprovalInit,
} from './a3-verifiers';
