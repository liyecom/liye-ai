/**
 * LiYe AI Control Plane Type Definitions
 * Location: src/control/types.ts
 *
 * Frozen v1 types — 7-field CapabilityContract, capability-level binding
 */

// === CapabilityContract — minimal required set (7 fields, frozen) ===

export interface CapabilityContract {
  id: string;                          // Format: "{agent_id}:{skill_id}"
  kind: 'agent' | 'skill' | 'workflow';
  name: string;
  domain: string;
  tags: string[];
  side_effect: 'none' | 'read' | 'write' | 'irreversible';
  source_path: string;
}

// === AgentCard — agent representation in registry ===

export interface AgentCard {
  agent_id: string;
  name: string;
  domain: string;
  contracts: CapabilityContract[];     // One contract per capability
  trust: TrustProfile;
  status: 'available' | 'busy' | 'deprecated';
  source_path: string;
}

// === AgentCapabilityCandidate — capability-level binding unit ===
// [Fix #1] findByCapability returns these, not AgentCard[]

export interface AgentCapabilityCandidate {
  agent_id: string;
  capability_id: string;              // = contract.id
  matched_tags: string[];             // Tags that matched the query
  side_effect: 'none' | 'read' | 'write' | 'irreversible';
  trust: TrustProfile;
  source_contract: CapabilityContract;
}

// === TrustProfile — 3-dimensional trust scoring ===

export interface TrustProfile {
  overall_score: number;               // 0-1, used for ranking only (not write gating)
  read_score: number;                  // Read operation trust
  write_score: number;                 // Write operation trust (used for write gating)
  total_executions: number;
  last_updated: string;                // ISO timestamp
}

// === Interface Definitions (for orchestrator to depend on) ===

export interface ICapabilityRegistry {
  findByCapability(tags: string[], domain?: string): AgentCapabilityCandidate[];
  findAgent(agentId: string): AgentCard | undefined;
  listAll(): AgentCard[];
}

export interface IDiscoveryPolicy {
  filter(candidates: AgentCapabilityCandidate[], minTrust?: number): AgentCapabilityCandidate[];
}

export interface IExecutionPolicy {
  check(candidate: AgentCapabilityCandidate, action: 'read' | 'write'): ExecutionPolicyResult;
}

export interface ExecutionPolicyResult {
  allowed: boolean;
  autonomy: 'auto' | 'approve' | 'block';
  reason: string;
}

export interface ITrustStore {
  getProfile(agentId: string): TrustProfile;
  recordOutcome(agentId: string, kind: 'read' | 'write', success: boolean): void;
}

// === Side Effect Type ===

export type SideEffect = 'none' | 'read' | 'write' | 'irreversible';
