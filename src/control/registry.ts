/**
 * LiYe AI Capability Registry
 * Location: src/control/registry.ts
 *
 * Singleton registry for agent capabilities.
 * Reuses DomainRegistry's scan+register pattern.
 * [Fix #1] findByCapability returns AgentCapabilityCandidate[] (capability-level)
 */

import {
  AgentCard,
  AgentCapabilityCandidate,
  CapabilityContract,
  TrustProfile,
  ICapabilityRegistry,
} from './types';
import { scanAgentYAMLs } from './extractor';

const DEFAULT_TRUST: TrustProfile = {
  overall_score: 0.5,
  read_score: 0.5,
  write_score: 0.5,
  total_executions: 0,
  last_updated: new Date().toISOString(),
};

/**
 * Compute Jaccard similarity between two tag sets
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(x => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

export class CapabilityRegistry implements ICapabilityRegistry {
  private agents: Map<string, AgentCard> = new Map();

  /**
   * Scan Agent YAML directories and register all agents + capabilities
   */
  scanAgents(dirs: string[]): void {
    const extracted = scanAgentYAMLs(dirs);

    for (const entry of extracted) {
      const card: AgentCard = {
        agent_id: entry.agentId,
        name: entry.name,
        domain: entry.domain,
        contracts: entry.contracts,
        trust: { ...DEFAULT_TRUST },
        status: 'available',
        source_path: entry.sourcePath,
      };
      this.agents.set(entry.agentId, card);
    }
  }

  /**
   * Register a single AgentCard (for testing or manual registration)
   */
  registerAgent(card: AgentCard): void {
    this.agents.set(card.agent_id, card);
  }

  /**
   * Update trust profile for an agent
   */
  updateTrust(agentId: string, trust: TrustProfile): void {
    const card = this.agents.get(agentId);
    if (card) {
      card.trust = trust;
    }
  }

  /**
   * [Fix #1] Find capabilities matching given tags (capability-level)
   * Returns AgentCapabilityCandidate[] — each contract that has tag overlap
   * produces one candidate, sorted by Jaccard similarity descending
   */
  findByCapability(tags: string[], domain?: string): AgentCapabilityCandidate[] {
    const candidates: AgentCapabilityCandidate[] = [];

    for (const [, card] of this.agents) {
      // Domain filter
      if (domain && card.domain !== domain) continue;

      for (const contract of card.contracts) {
        const matchedTags = tags.filter(t => contract.tags.includes(t));
        if (matchedTags.length === 0) continue;

        candidates.push({
          agent_id: card.agent_id,
          capability_id: contract.id,
          matched_tags: matchedTags,
          side_effect: contract.side_effect,
          trust: card.trust,
          source_contract: contract,
        });
      }
    }

    // Sort by Jaccard similarity descending
    candidates.sort((a, b) => {
      const jA = jaccardSimilarity(tags, a.source_contract.tags);
      const jB = jaccardSimilarity(tags, b.source_contract.tags);
      return jB - jA;
    });

    return candidates;
  }

  /**
   * Find a specific agent by ID
   */
  findAgent(agentId: string): AgentCard | undefined {
    return this.agents.get(agentId);
  }

  /**
   * List all registered agents
   */
  listAll(): AgentCard[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get total agent count
   */
  count(): number {
    return this.agents.size;
  }
}

// === Singleton ===

let instance: CapabilityRegistry | null = null;

export function getCapabilityRegistry(): CapabilityRegistry {
  if (!instance) {
    instance = new CapabilityRegistry();
  }
  return instance;
}

export default CapabilityRegistry;
