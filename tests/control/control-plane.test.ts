/**
 * Control Plane Tests — Phase 0 + Phase 1
 *
 * Tests: extractor, registry, trust, discovery-policy, execution-policy
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import {
  inferSideEffect,
  extractFromAgentYAML,
} from '../../src/control/extractor';
import { CapabilityRegistry } from '../../src/control/registry';
import { TrustScoreStore } from '../../src/control/trust';
import { DiscoveryPolicy } from '../../src/control/discovery-policy';
import { ExecutionPolicy } from '../../src/control/execution-policy';
import type {
  AgentCard,
  AgentCapabilityCandidate,
  TrustProfile,
  CapabilityContract,
} from '../../src/control/types';

// ============================================================
// Phase 0: Extractor
// ============================================================

describe('inferSideEffect', () => {
  it('classifies *_research as read', () => {
    expect(inferSideEffect('market_research')).toBe('read');
  });

  it('classifies *_analysis as read', () => {
    expect(inferSideEffect('statistical_analysis')).toBe('read');
  });

  it('classifies *_detection as read', () => {
    expect(inferSideEffect('trend_detection')).toBe('read');
    expect(inferSideEffect('anomaly_detection')).toBe('read');
  });

  it('classifies *_monitoring as read', () => {
    expect(inferSideEffect('progress_monitoring')).toBe('read');
  });

  it('classifies *_optimization as write', () => {
    expect(inferSideEffect('content_optimization')).toBe('write');
  });

  it('classifies *_adjustment as write', () => {
    expect(inferSideEffect('bid_adjustment')).toBe('write');
  });

  it('classifies *_creation as write', () => {
    expect(inferSideEffect('report_creation')).toBe('write');
  });

  it('defaults unknown to write (conservative, fail-closed)', () => {
    expect(inferSideEffect('task_decomposition')).toBe('write');
    expect(inferSideEffect('agent_selection')).toBe('write');
    expect(inferSideEffect('unknown_skill_name')).toBe('write');
  });
});

describe('extractFromAgentYAML', () => {
  it('extracts contracts from researcher YAML', () => {
    const yamlContent = `
agent:
  id: researcher
  name: Research Specialist
  version: 1.0.0
  domain: core
persona:
  role: "Research Specialist"
skills:
  atomic:
    - web_search
    - document_analysis
    - source_verification
    - citation_management
    - knowledge_extraction
runtime:
  delegation: false
`;
    const contracts = extractFromAgentYAML('/fake/path.yaml', yamlContent);

    expect(contracts.length).toBe(5);

    // Check web_search contract
    const webSearch = contracts.find(c => c.id === 'researcher:web_search');
    expect(webSearch).toBeDefined();
    expect(webSearch!.tags).toContain('web');
    expect(webSearch!.tags).toContain('search');
    expect(webSearch!.tags).toContain('research');  // from persona role
    expect(webSearch!.tags).toContain('specialist'); // from persona role

    // Check side_effect inference
    const docAnalysis = contracts.find(c => c.id === 'researcher:document_analysis');
    expect(docAnalysis!.side_effect).toBe('read');

    // knowledge_extraction = read
    const ke = contracts.find(c => c.id === 'researcher:knowledge_extraction');
    expect(ke!.side_effect).toBe('read');
  });

  it('generates contract.id as agent_id:skill_id', () => {
    const yamlContent = `
agent:
  id: analyst
  name: Data Analyst
  domain: core
skills:
  atomic:
    - pattern_recognition
`;
    const contracts = extractFromAgentYAML('/fake/path.yaml', yamlContent);
    expect(contracts[0].id).toBe('analyst:pattern_recognition');
  });

  it('returns empty for invalid YAML', () => {
    const contracts = extractFromAgentYAML('/fake/path.yaml', 'invalid: {}');
    expect(contracts.length).toBe(0);
  });
});

// ============================================================
// Phase 0: Registry
// ============================================================

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();

    // Register agents from actual YAML files
    const agentsDir = path.resolve(__dirname, '../../Agents');
    registry.scanAgents([agentsDir]);
  });

  it('scans and registers agents from Agents/ directory', () => {
    const all = registry.listAll();
    expect(all.length).toBeGreaterThanOrEqual(3); // orchestrator, researcher, analyst
  });

  it('orchestrator has 5 atomic skill contracts', () => {
    const card = registry.findAgent('orchestrator');
    expect(card).toBeDefined();
    expect(card!.contracts.length).toBe(5);
  });

  it('researcher has 5 atomic skill contracts', () => {
    const card = registry.findAgent('researcher');
    expect(card).toBeDefined();
    expect(card!.contracts.length).toBe(5);
  });

  it('findByCapability returns AgentCapabilityCandidate[]', () => {
    const candidates = registry.findByCapability(['research']);
    expect(candidates.length).toBeGreaterThan(0);

    for (const c of candidates) {
      expect(c).toHaveProperty('agent_id');
      expect(c).toHaveProperty('capability_id');
      expect(c).toHaveProperty('matched_tags');
      expect(c).toHaveProperty('side_effect');
      expect(c.matched_tags).toContain('research');
    }
  });

  it('findByCapability with domain filter', () => {
    const coreCandidates = registry.findByCapability(['research'], 'core');
    expect(coreCandidates.length).toBeGreaterThan(0);
    for (const c of coreCandidates) {
      expect(c.source_contract.domain).toBe('core');
    }

    const nonExistDomain = registry.findByCapability(['research'], 'nonexistent');
    expect(nonExistDomain.length).toBe(0);
  });

  it('findByCapability returns capability-level, not agent-level', () => {
    // "analysis" should match both researcher:document_analysis and analyst:statistical_analysis
    const candidates = registry.findByCapability(['analysis']);
    const agentIds = new Set(candidates.map(c => c.agent_id));
    // Could match researcher (document_analysis) and analyst (statistical_analysis)
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// Phase 0: Trust
// ============================================================

describe('TrustScoreStore', () => {
  let store: TrustScoreStore;

  beforeEach(() => {
    // Use temp path to avoid persisting
    store = new TrustScoreStore('/tmp/test-trust-scores-' + Date.now() + '.yaml');
  });

  it('cold-starts at 0.5 for all dimensions', () => {
    const profile = store.getProfile('new_agent');
    expect(profile.overall_score).toBe(0.5);
    expect(profile.read_score).toBe(0.5);
    expect(profile.write_score).toBe(0.5);
    expect(profile.total_executions).toBe(0);
  });

  it('recordOutcome(read, true) increases read_score', () => {
    for (let i = 0; i < 5; i++) {
      store.recordOutcome('researcher', 'read', true);
    }
    const profile = store.getProfile('researcher');
    expect(profile.read_score).toBeGreaterThan(0.5);
  });

  it('recordOutcome(write, false) decreases write_score', () => {
    for (let i = 0; i < 3; i++) {
      store.recordOutcome('researcher', 'write', false);
    }
    const profile = store.getProfile('researcher');
    expect(profile.write_score).toBeLessThan(0.5);
  });

  it('overall_score = read * 0.4 + write * 0.6', () => {
    store.recordOutcome('test_agent', 'read', true);
    const profile = store.getProfile('test_agent');
    const expected = profile.read_score * 0.4 + profile.write_score * 0.6;
    expect(profile.overall_score).toBeCloseTo(expected, 10);
  });

  it('increments total_executions', () => {
    store.recordOutcome('agent1', 'read', true);
    store.recordOutcome('agent1', 'write', false);
    store.recordOutcome('agent1', 'read', true);
    expect(store.getProfile('agent1').total_executions).toBe(3);
  });
});

// ============================================================
// Phase 1: Discovery Policy
// ============================================================

describe('DiscoveryPolicy', () => {
  let registry: CapabilityRegistry;
  let policy: DiscoveryPolicy;

  beforeEach(() => {
    registry = new CapabilityRegistry();

    const trust: TrustProfile = {
      overall_score: 0.5,
      read_score: 0.5,
      write_score: 0.5,
      total_executions: 0,
      last_updated: new Date().toISOString(),
    };

    const lowTrust: TrustProfile = {
      overall_score: 0.1,
      read_score: 0.1,
      write_score: 0.1,
      total_executions: 0,
      last_updated: new Date().toISOString(),
    };

    const contract: CapabilityContract = {
      id: 'agent1:skill1',
      kind: 'skill',
      name: 'test',
      domain: 'core',
      tags: ['research'],
      side_effect: 'read',
      source_path: '/test',
    };

    registry.registerAgent({
      agent_id: 'agent1',
      name: 'Agent 1',
      domain: 'core',
      contracts: [contract],
      trust,
      status: 'available',
      source_path: '/test',
    });

    registry.registerAgent({
      agent_id: 'deprecated_agent',
      name: 'Deprecated',
      domain: 'core',
      contracts: [{ ...contract, id: 'deprecated_agent:skill1' }],
      trust,
      status: 'deprecated',
      source_path: '/test',
    });

    registry.registerAgent({
      agent_id: 'low_trust_agent',
      name: 'Low Trust',
      domain: 'core',
      contracts: [{ ...contract, id: 'low_trust_agent:skill1' }],
      trust: lowTrust,
      status: 'available',
      source_path: '/test',
    });

    policy = new DiscoveryPolicy(registry);
  });

  it('filters out deprecated agents', () => {
    const candidates: AgentCapabilityCandidate[] = [
      {
        agent_id: 'agent1',
        capability_id: 'agent1:skill1',
        matched_tags: ['research'],
        side_effect: 'read',
        trust: registry.findAgent('agent1')!.trust,
        source_contract: registry.findAgent('agent1')!.contracts[0],
      },
      {
        agent_id: 'deprecated_agent',
        capability_id: 'deprecated_agent:skill1',
        matched_tags: ['research'],
        side_effect: 'read',
        trust: registry.findAgent('deprecated_agent')!.trust,
        source_contract: registry.findAgent('deprecated_agent')!.contracts[0],
      },
    ];

    const filtered = policy.filter(candidates);
    expect(filtered.length).toBe(1);
    expect(filtered[0].agent_id).toBe('agent1');
  });

  it('hard-filters trust below minTrust threshold', () => {
    const candidates: AgentCapabilityCandidate[] = [
      {
        agent_id: 'low_trust_agent',
        capability_id: 'low_trust_agent:skill1',
        matched_tags: ['research'],
        side_effect: 'read',
        trust: registry.findAgent('low_trust_agent')!.trust,
        source_contract: registry.findAgent('low_trust_agent')!.contracts[0],
      },
    ];

    // Default min_trust = 0.2; agent has 0.1
    const filtered = policy.filter(candidates);
    expect(filtered.length).toBe(0);
  });
});

// ============================================================
// Phase 1: Execution Policy
// ============================================================

describe('ExecutionPolicy', () => {
  let registry: CapabilityRegistry;
  let policy: ExecutionPolicy;

  beforeEach(() => {
    registry = new CapabilityRegistry();

    const trust: TrustProfile = {
      overall_score: 0.5,
      read_score: 0.5,
      write_score: 0.5,
      total_executions: 0,
      last_updated: new Date().toISOString(),
    };

    const contract: CapabilityContract = {
      id: 'agent1:skill1',
      kind: 'skill',
      name: 'test',
      domain: 'core',
      tags: ['research'],
      side_effect: 'read',
      source_path: '/test',
    };

    registry.registerAgent({
      agent_id: 'agent1',
      name: 'Agent 1',
      domain: 'core',
      contracts: [contract],
      trust,
      status: 'available',
      source_path: '/test',
    });

    policy = new ExecutionPolicy(registry);
  });

  it('read side_effect -> auto (A2)', () => {
    const candidate: AgentCapabilityCandidate = {
      agent_id: 'agent1',
      capability_id: 'agent1:skill1',
      matched_tags: ['research'],
      side_effect: 'read',
      trust: registry.findAgent('agent1')!.trust,
      source_contract: registry.findAgent('agent1')!.contracts[0],
    };

    const result = policy.check(candidate, 'read');
    expect(result.allowed).toBe(true);
    expect(result.autonomy).toBe('auto');
  });

  it('write side_effect -> approve (A2)', () => {
    const candidate: AgentCapabilityCandidate = {
      agent_id: 'agent1',
      capability_id: 'agent1:skill1',
      matched_tags: ['optimize'],
      side_effect: 'write',
      trust: registry.findAgent('agent1')!.trust,
      source_contract: registry.findAgent('agent1')!.contracts[0],
    };

    const result = policy.check(candidate, 'write');
    expect(result.allowed).toBe(true);
    expect(result.autonomy).toBe('approve');
  });

  it('irreversible side_effect -> block', () => {
    const candidate: AgentCapabilityCandidate = {
      agent_id: 'agent1',
      capability_id: 'agent1:skill1',
      matched_tags: [],
      side_effect: 'irreversible',
      trust: registry.findAgent('agent1')!.trust,
      source_contract: registry.findAgent('agent1')!.contracts[0],
    };

    const result = policy.check(candidate, 'write');
    expect(result.allowed).toBe(false);
    expect(result.autonomy).toBe('block');
  });

  it('low write_score blocks write operations', () => {
    const lowWriteTrust: TrustProfile = {
      overall_score: 0.5,
      read_score: 0.8,
      write_score: 0.2, // Below 0.3 threshold
      total_executions: 0,
      last_updated: new Date().toISOString(),
    };

    const candidate: AgentCapabilityCandidate = {
      agent_id: 'agent1',
      capability_id: 'agent1:skill1',
      matched_tags: [],
      side_effect: 'write',
      trust: lowWriteTrust,
      source_contract: registry.findAgent('agent1')!.contracts[0],
    };

    const result = policy.check(candidate, 'write');
    expect(result.allowed).toBe(false);
    expect(result.autonomy).toBe('block');
  });
});
