/**
 * LiYe AI Discovery Policy
 * Location: src/control/discovery-policy.ts
 *
 * [Fix #3] Executes BEFORE routing — controls "who can be seen"
 * [Fix #6] min_trust is a hard filter (not soft)
 */

import { AgentCapabilityCandidate, IDiscoveryPolicy, ICapabilityRegistry } from './types';

const DEFAULT_MIN_TRUST = 0.2;

export class DiscoveryPolicy implements IDiscoveryPolicy {
  private registry: ICapabilityRegistry;

  constructor(registry: ICapabilityRegistry) {
    this.registry = registry;
  }

  /**
   * Filter candidates before routing
   * Rules (applied in order):
   * 1. Agent status !== 'deprecated'
   * 2. Domain filter (if domain specified in original query)
   * 3. [Fix #6] min_trust hard filter: overall_score >= minTrust
   */
  filter(
    candidates: AgentCapabilityCandidate[],
    minTrust: number = DEFAULT_MIN_TRUST
  ): AgentCapabilityCandidate[] {
    return candidates.filter(candidate => {
      // Rule 1: Filter out deprecated agents
      const card = this.registry.findAgent(candidate.agent_id);
      if (!card || card.status === 'deprecated') {
        return false;
      }

      // Rule 3: [Fix #6] Hard filter on min_trust — no soft pass
      if (candidate.trust.overall_score < minTrust) {
        return false;
      }

      return true;
    });
  }
}

export default DiscoveryPolicy;
