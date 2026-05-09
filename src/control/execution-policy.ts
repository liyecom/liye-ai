/**
 * LiYe AI Execution Policy
 * Location: src/control/execution-policy.ts
 *
 * [Fix #3] Executes AFTER routing — controls "can this binding execute"
 * Reuses WriteGate's fail-closed pattern
 */

import {
  AgentCapabilityCandidate,
  ExecutionPolicyResult,
  IExecutionPolicy,
  ICapabilityRegistry,
} from './types';

const MIN_WRITE_TRUST = 0.3;

export class ExecutionPolicy implements IExecutionPolicy {
  private registry: ICapabilityRegistry;

  constructor(registry: ICapabilityRegistry) {
    this.registry = registry;
  }

  /**
   * Check if a resolved candidate can execute
   * [Fix #3] Has full candidate info (side_effect, trust, capability_id)
   *
   * Rules (fail-fast chain, like WriteGate):
   * 1. Agent must be available
   * 2. side_effect determines autonomy level (A2):
   *    - none/read -> auto
   *    - write -> approve
   *    - irreversible -> block
   * 3. Write ops gated by write_score (not overall)
   */
  check(
    candidate: AgentCapabilityCandidate,
    action: 'read' | 'write'
  ): ExecutionPolicyResult {
    // Rule 1: Agent must be available
    const card = this.registry.findAgent(candidate.agent_id);
    if (!card || card.status !== 'available') {
      return {
        allowed: false,
        autonomy: 'block',
        reason: `Agent ${candidate.agent_id} is not available (status: ${card?.status ?? 'not_found'})`,
      };
    }

    // Rule 2: side_effect determines autonomy
    const sideEffect = candidate.side_effect;

    if (sideEffect === 'irreversible') {
      return {
        allowed: false,
        autonomy: 'block',
        reason: `Capability ${candidate.capability_id} has irreversible side_effect — blocked by policy`,
      };
    }

    if (sideEffect === 'write') {
      // Rule 3: Write gating uses write_score specifically
      if (candidate.trust.write_score < MIN_WRITE_TRUST) {
        return {
          allowed: false,
          autonomy: 'block',
          reason: `Agent ${candidate.agent_id} write_score (${candidate.trust.write_score.toFixed(2)}) below threshold (${MIN_WRITE_TRUST})`,
        };
      }

      return {
        allowed: true,
        autonomy: 'approve',   // A2: write requires approval
        reason: 'Write operation — requires human approval (A2)',
      };
    }

    // none or read -> auto-execute
    return {
      allowed: true,
      autonomy: 'auto',
      reason: `${sideEffect} operation — auto-execute (A2)`,
    };
  }
}

export default ExecutionPolicy;
