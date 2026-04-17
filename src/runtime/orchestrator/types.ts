/**
 * LiYe AI Orchestrator Type Definitions
 * Location: src/runtime/orchestrator/types.ts
 *
 * Intent / PlanTask / ResolvedTask — capability-level binding
 */

import type { TrustProfile } from '../../control/types';

// === Intent — what the user wants ===

export interface Intent {
  id: string;
  goal: string;
  domain?: string;
  constraints?: {
    max_agents?: number;
    max_duration_sec?: number;
  };
  context?: Record<string, any>;
}

// === Capability Requirement — what a task needs ===

export interface CapabilityRequirement {
  tags: string[];
  domain?: string;
  min_trust?: number;    // [Fix #6] Hard filter in discovery phase
}

// === PlanTask — decomposed task before routing ===

export interface PlanTask {
  id: string;
  description: string;
  capability: CapabilityRequirement;
  inputs: Record<string, any>;
  depends_on?: string[];
}

// === ResolvedTask — after routing, bound to specific capability ===
// [Fix #1+6] Binding granularity is capability-level

export interface ResolvedTask extends PlanTask {
  agent_id: string;
  capability_id: string;     // [Fix #6] Replaces skill_id, = contract.id
  confidence: number;
  autonomy: 'auto' | 'approve' | 'block';
  side_effect: 'none' | 'read' | 'write' | 'irreversible';
  alternatives: Array<{
    agent_id: string;
    capability_id: string;
    confidence: number;
  }>;
}

// === TaskPlan — decomposition output ===

export interface TaskPlan {
  intent_id: string;
  tasks: PlanTask[];
  source: 'crew_yaml' | 'rule' | 'llm';
}

// === Orchestration Result ===

export interface OrchestrationResult {
  intent_id: string;
  status: 'completed' | 'failed' | 'partial' | 'pending_approval';
  tasks: ResolvedTaskResult[];
  total_duration_ms: number;
  trust_updates: Record<string, Partial<TrustProfile>>;
}

// === Per-Task Result ===
// [Fix #4] Distinguishes primary vs actual executor

export interface ResolvedTaskResult {
  task_id: string;
  primary_agent_id: string;        // Originally selected agent
  actual_executor_agent_id: string; // Agent that actually executed
  capability_id: string;
  status: 'success' | 'failure' | 'pending_approval' | 'blocked';
  fallback_used: boolean;
  fallback_rank?: number;           // Which alternative succeeded (1-based)
  duration_ms: number;
  outputs: Record<string, any>;
}

// === Trace Entry ===

export interface OrchestrationTrace {
  intent_id: string;
  timestamp: string;
  tasks: ResolvedTaskResult[];
  trust_updates: Record<string, Partial<TrustProfile>>;
  total_duration_ms: number;
}
