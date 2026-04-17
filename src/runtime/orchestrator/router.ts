/**
 * LiYe AI Capability Router
 * Location: src/runtime/orchestrator/router.ts
 *
 * [Fix #1+3+6] filter -> score -> rank pipeline (capability-level, 3-factor)
 */

import type {
  ICapabilityRegistry,
  IDiscoveryPolicy,
  IExecutionPolicy,
  AgentCapabilityCandidate,
} from '../../control/types';
import { PlanTask, ResolvedTask } from './types';

const MAX_ALTERNATIVES = 3;

/**
 * Compute Jaccard similarity between two tag sets
 */
function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(x => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

export class CapabilityRouter {
  private registry: ICapabilityRegistry;
  private discoveryPolicy: IDiscoveryPolicy;
  private executionPolicy: IExecutionPolicy;

  constructor(
    registry: ICapabilityRegistry,
    discoveryPolicy: IDiscoveryPolicy,
    executionPolicy: IExecutionPolicy
  ) {
    this.registry = registry;
    this.discoveryPolicy = discoveryPolicy;
    this.executionPolicy = executionPolicy;
  }

  /**
   * Resolve a list of PlanTasks into ResolvedTasks
   * Each PlanTask gets matched to a specific agent capability
   */
  resolve(tasks: PlanTask[]): ResolvedTask[] {
    return tasks.map(task => this.resolveOne(task));
  }

  /**
   * Resolve a single PlanTask
   * Pipeline: query -> filter -> score -> rank -> execution-policy
   */
  private resolveOne(task: PlanTask): ResolvedTask {
    // 1. Query: find candidates at capability level
    const candidates = this.registry.findByCapability(
      task.capability.tags,
      task.capability.domain
    );

    // 2. Filter: discovery policy (pre-route)
    const filtered = this.discoveryPolicy.filter(
      candidates,
      task.capability.min_trust
    );

    if (filtered.length === 0) {
      return this.unresolvedTask(task, 'No candidates found after filtering');
    }

    // 3. Score: 3-factor evaluation
    const scored = filtered.map(candidate => ({
      candidate,
      score: this.score3Factor(task, candidate),
    }));

    // 4. Rank: descending by score
    scored.sort((a, b) => b.score - a.score);

    const primary = scored[0];
    const alternatives = scored.slice(1, 1 + MAX_ALTERNATIVES);

    // 5. Execution policy check (post-route)
    const action = primary.candidate.side_effect === 'write' ||
                   primary.candidate.side_effect === 'irreversible'
      ? 'write' as const
      : 'read' as const;
    const policyResult = this.executionPolicy.check(primary.candidate, action);

    return {
      ...task,
      agent_id: primary.candidate.agent_id,
      capability_id: primary.candidate.capability_id,
      confidence: primary.score,
      autonomy: policyResult.autonomy,
      side_effect: primary.candidate.side_effect,
      alternatives: alternatives.map(a => ({
        agent_id: a.candidate.agent_id,
        capability_id: a.candidate.capability_id,
        confidence: a.score,
      })),
    };
  }

  /**
   * 3-factor scoring:
   *   TagOverlap (Jaccard) x 0.5
   * + TrustScore (overall) x 0.3     -- for ranking only
   * + DomainAffinity       x 0.2
   */
  private score3Factor(task: PlanTask, candidate: AgentCapabilityCandidate): number {
    // Factor 1: Tag overlap (Jaccard similarity)
    const tagOverlap = jaccard(task.capability.tags, candidate.source_contract.tags);

    // Factor 2: Trust score (overall, for ranking)
    const trustScore = candidate.trust.overall_score;

    // Factor 3: Domain affinity
    let domainAffinity = 0.3; // default: no domain specified
    if (task.capability.domain) {
      domainAffinity = candidate.source_contract.domain === task.capability.domain
        ? 1.0   // same domain
        : 0.5;  // cross-domain
    }

    return tagOverlap * 0.5 + trustScore * 0.3 + domainAffinity * 0.2;
  }

  /**
   * Create an unresolved task (no candidates found)
   */
  private unresolvedTask(task: PlanTask, reason: string): ResolvedTask {
    return {
      ...task,
      agent_id: '',
      capability_id: '',
      confidence: 0,
      autonomy: 'block',
      side_effect: 'write',   // conservative
      alternatives: [],
    };
  }
}

export default CapabilityRouter;
