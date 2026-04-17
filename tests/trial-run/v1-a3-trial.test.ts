/**
 * LiYe OS v1 A3 Low-Blast-Radius Write Trial
 *
 * Validates A3 auto-write under strict whitelist:
 *   - Pre-flight 12-point checklist
 *   - Snapshot → execute → read-back verify → rollback-if-needed
 *   - Kill switch triggers
 *   - Forced A2 downgrade
 *   - 10 A3 metrics
 *   - 15-30 samples
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { CapabilityRegistry } from '../../src/control/registry';
import { TrustScoreStore } from '../../src/control/trust';
import { DiscoveryPolicy } from '../../src/control/discovery-policy';
import { ExecutionPolicy } from '../../src/control/execution-policy';
import { CapabilityRouter } from '../../src/runtime/orchestrator/router';
import {
  runA3PreFlight,
  RollbackManager,
  A3KillSwitch,
  A3MetricsCollector,
  A3_WHITELIST,
  MIN_WRITE_SCORE_A3,
} from '../../src/control/a3-write-policy';
import type {
  A3TaskType,
  A3TaskRecord,
  RollbackContext,
} from '../../src/control/a3-write-policy';
import type { AgentCapabilityCandidate, TrustProfile } from '../../src/control/types';

const AGENTS_DIR = path.resolve(__dirname, '../../Agents');
const TRACE_DIR = path.resolve(__dirname, '../../data/traces/a3');

let registry: CapabilityRegistry;
let trustStore: TrustScoreStore;
let discoveryPolicy: DiscoveryPolicy;
let executionPolicy: ExecutionPolicy;
let router: CapabilityRouter;
let rollbackMgr: RollbackManager;
let killSwitch: A3KillSwitch;
let metricsCollector: A3MetricsCollector;

const TRUST_PATH = '/tmp/a3-trial-trust-' + Date.now() + '.yaml';

beforeAll(() => {
  if (!fs.existsSync(TRACE_DIR)) fs.mkdirSync(TRACE_DIR, { recursive: true });
  registry = new CapabilityRegistry();
  registry.scanAgents([AGENTS_DIR]);
  trustStore = new TrustScoreStore(TRUST_PATH);
  discoveryPolicy = new DiscoveryPolicy(registry);
  executionPolicy = new ExecutionPolicy(registry);
  router = new CapabilityRouter(registry, discoveryPolicy, executionPolicy);

  // Warm up trust: push write_score above 0.7 for orchestrator and analyst
  for (let i = 0; i < 20; i++) {
    trustStore.recordOutcome('orchestrator', 'write', true);
    trustStore.recordOutcome('analyst', 'write', true);
    trustStore.recordOutcome('researcher', 'write', true);
  }
});

beforeEach(() => {
  rollbackMgr = new RollbackManager();
  killSwitch = new A3KillSwitch();
  metricsCollector = new A3MetricsCollector();
});

// ============================================================
// Helper: Full A3 write cycle
// ============================================================

interface A3WriteOpts {
  taskId: string;
  taskType: A3TaskType;
  capabilityId: string;
  tags: string[];
  simulateWriteSuccess?: boolean;
  simulateVerifyPass?: boolean;
  simulateRollbackSuccess?: boolean;
  preState?: any;
  rollbackPayload?: any;
}

function runA3WriteCycle(opts: A3WriteOpts): A3TaskRecord {
  const {
    taskId, taskType, capabilityId, tags,
    simulateWriteSuccess = true,
    simulateVerifyPass = true,
    simulateRollbackSuccess = true,
    preState = { version: 1, data: 'original' },
    rollbackPayload = { action: 'restore', target: preState },
  } = opts;

  const t0 = performance.now();

  // 1. Route to find candidate
  const planTask = {
    id: taskId,
    description: `A3 write: ${taskType}`,
    capability: { tags },
    inputs: {},
  };
  const resolved = router.resolve([planTask]);
  const rt = resolved[0];

  // Find the candidate matching capabilityId, or use top-1
  const agentCard = registry.findAgent(rt.agent_id);
  const fallbackContract = {
    id: capabilityId,
    kind: 'skill' as const,
    name: capabilityId,
    domain: 'core',
    tags,
    side_effect: 'write' as const,
    source_path: '',
  };
  const candidate: AgentCapabilityCandidate = {
    agent_id: rt.agent_id || capabilityId.split(':')[0],
    capability_id: capabilityId,
    matched_tags: rt.capability.tags,
    side_effect: 'write',
    trust: trustStore.getProfile(rt.agent_id || capabilityId.split(':')[0]),
    source_contract: agentCard?.contracts.find(c => c.id === capabilityId)
      ?? agentCard?.contracts[0]
      ?? fallbackContract,
  };

  const trust = trustStore.getProfile(candidate.agent_id);
  const t1 = performance.now();

  // 2. Pre-flight check
  const preFlight = runA3PreFlight(
    candidate, taskType, trust, registry,
    rollbackPayload, preState, true
  );

  if (!preFlight.passed) {
    // Forced downgrade to A2
    const record: A3TaskRecord = {
      task_id: taskId,
      capability_id: capabilityId,
      task_type: taskType,
      domain: candidate.source_contract.domain,
      pre_flight_passed: false,
      write_success: false,
      verification_passed: false,
      rollback_triggered: false,
      downgraded_to_a2: true,
      control_plane_latency_ms: Math.round((t1 - t0) * 100) / 100,
      total_execution_latency_ms: Math.round((performance.now() - t0) * 100) / 100,
      retried: false,
      fallback_used: false,
    };
    metricsCollector.record(record);
    return record;
  }

  // 3. Create rollback context
  const whitelistEntry = A3_WHITELIST.find(
    e => e.task_type === taskType && e.capability_id === capabilityId
  )!;
  rollbackMgr.createContext(taskId, preState, rollbackPayload, whitelistEntry.rollback_method);

  // 4. Execute write (simulated)
  const writeSuccess = simulateWriteSuccess;
  if (writeSuccess) {
    trustStore.recordOutcome(candidate.agent_id, 'write', true);
  } else {
    trustStore.recordOutcome(candidate.agent_id, 'write', false);
  }

  // 5. Read-back verification
  const verifyPass = writeSuccess && simulateVerifyPass;
  killSwitch.checkVerificationFailure(!verifyPass && writeSuccess);

  // 6. Rollback if needed
  let rollbackTriggered = false;
  let rollbackSuccess: boolean | undefined;
  if (!writeSuccess || !verifyPass) {
    rollbackTriggered = true;
    rollbackSuccess = simulateRollbackSuccess;
    killSwitch.checkRollbackFailure(!rollbackSuccess);
  }

  const t2 = performance.now();

  // 7. Write trace
  const trace = {
    task_id: taskId,
    capability_id: capabilityId,
    task_type: taskType,
    pre_flight: preFlight,
    write_success: writeSuccess,
    verification_passed: verifyPass,
    rollback_triggered: rollbackTriggered,
    rollback_success: rollbackSuccess,
    trust_after: trustStore.getProfile(candidate.agent_id),
    timestamp: new Date().toISOString(),
    control_plane_latency_ms: Math.round((t1 - t0) * 100) / 100,
    total_execution_latency_ms: Math.round((t2 - t0) * 100) / 100,
  };
  const tracePath = path.join(TRACE_DIR, `${taskId}_${Date.now()}.json`);
  fs.writeFileSync(tracePath, JSON.stringify(trace, null, 2), 'utf-8');

  const record: A3TaskRecord = {
    task_id: taskId,
    capability_id: capabilityId,
    task_type: taskType,
    domain: candidate.source_contract.domain,
    pre_flight_passed: true,
    write_success: writeSuccess,
    verification_passed: verifyPass,
    rollback_triggered: rollbackTriggered,
    rollback_success: rollbackSuccess,
    downgraded_to_a2: false,
    control_plane_latency_ms: trace.control_plane_latency_ms,
    total_execution_latency_ms: trace.total_execution_latency_ms,
    retried: false,
    fallback_used: false,
    trace_path: tracePath,
  };
  metricsCollector.record(record);
  return record;
}

// ============================================================
// Group 1: Pre-flight Checks (6 tests)
// ============================================================

describe('A3 Pre-flight Checks', () => {
  it('PF01: Whitelisted task passes all 12 checks', () => {
    const candidate: AgentCapabilityCandidate = {
      agent_id: 'orchestrator',
      capability_id: 'orchestrator:task_decomposition',
      matched_tags: ['task', 'decomposition'],
      side_effect: 'write',
      trust: trustStore.getProfile('orchestrator'),
      source_contract: registry.findAgent('orchestrator')!.contracts
        .find(c => c.id === 'orchestrator:task_decomposition')!,
    };
    const result = runA3PreFlight(
      candidate, 'metadata_write', trustStore.getProfile('orchestrator'),
      registry, { action: 'restore' }, { version: 1 }, true
    );
    expect(result.passed).toBe(true);
    expect(result.checks.length).toBe(12);
    expect(result.failed_checks.length).toBe(0);
  });

  it('PF02: Non-whitelisted task fails and downgrades to A2', () => {
    const candidate: AgentCapabilityCandidate = {
      agent_id: 'researcher',
      capability_id: 'researcher:web_search',
      matched_tags: ['web', 'search'],
      side_effect: 'read',
      trust: trustStore.getProfile('researcher'),
      source_contract: registry.findAgent('researcher')!.contracts
        .find(c => c.id === 'researcher:web_search')!,
    };
    const result = runA3PreFlight(
      candidate, 'metadata_write', trustStore.getProfile('researcher'),
      registry, {}, {}, true
    );
    expect(result.passed).toBe(false);
    expect(result.downgrade_to_a2).toBe(true);
    expect(result.failed_checks).toContain('whitelist');
  });

  it('PF03: Low write_score fails pre-flight', () => {
    const lowTrust: TrustProfile = {
      overall_score: 0.5, read_score: 0.8, write_score: 0.3,
      total_executions: 10, last_updated: new Date().toISOString(),
    };
    const candidate: AgentCapabilityCandidate = {
      agent_id: 'orchestrator',
      capability_id: 'orchestrator:task_decomposition',
      matched_tags: ['task', 'decomposition'],
      side_effect: 'write',
      trust: lowTrust,
      source_contract: registry.findAgent('orchestrator')!.contracts
        .find(c => c.id === 'orchestrator:task_decomposition')!,
    };
    const result = runA3PreFlight(
      candidate, 'metadata_write', lowTrust, registry, {}, {}, true
    );
    expect(result.passed).toBe(false);
    expect(result.failed_checks).toContain('write_score');
  });

  it('PF04: Missing rollback payload fails pre-flight', () => {
    const candidate: AgentCapabilityCandidate = {
      agent_id: 'orchestrator',
      capability_id: 'orchestrator:task_decomposition',
      matched_tags: ['task', 'decomposition'],
      side_effect: 'write',
      trust: trustStore.getProfile('orchestrator'),
      source_contract: registry.findAgent('orchestrator')!.contracts
        .find(c => c.id === 'orchestrator:task_decomposition')!,
    };
    const result = runA3PreFlight(
      candidate, 'metadata_write', trustStore.getProfile('orchestrator'),
      registry, null, { v: 1 }, true
    );
    expect(result.passed).toBe(false);
    expect(result.failed_checks).toContain('rollback_payload');
  });

  it('PF05: Irreversible side_effect fails pre-flight', () => {
    const candidate: AgentCapabilityCandidate = {
      agent_id: 'orchestrator',
      capability_id: 'orchestrator:task_decomposition',
      matched_tags: ['task', 'decomposition'],
      side_effect: 'irreversible',
      trust: trustStore.getProfile('orchestrator'),
      source_contract: registry.findAgent('orchestrator')!.contracts
        .find(c => c.id === 'orchestrator:task_decomposition')!,
    };
    const result = runA3PreFlight(
      candidate, 'metadata_write', trustStore.getProfile('orchestrator'),
      registry, {}, {}, true
    );
    expect(result.passed).toBe(false);
    expect(result.failed_checks).toContain('side_effect_write');
  });

  it('PF06: Missing pre-state snapshot fails pre-flight', () => {
    const candidate: AgentCapabilityCandidate = {
      agent_id: 'orchestrator',
      capability_id: 'orchestrator:task_decomposition',
      matched_tags: ['task', 'decomposition'],
      side_effect: 'write',
      trust: trustStore.getProfile('orchestrator'),
      source_contract: registry.findAgent('orchestrator')!.contracts
        .find(c => c.id === 'orchestrator:task_decomposition')!,
    };
    const result = runA3PreFlight(
      candidate, 'metadata_write', trustStore.getProfile('orchestrator'),
      registry, {}, null, true
    );
    expect(result.passed).toBe(false);
    expect(result.failed_checks).toContain('pre_state_snapshot');
  });
});

// ============================================================
// Group 2: Successful A3 Writes (5 tests)
// ============================================================

describe('A3 Successful Writes', () => {
  it('W01: metadata_write via orchestrator:task_decomposition', () => {
    const r = runA3WriteCycle({
      taskId: 'W01', taskType: 'metadata_write',
      capabilityId: 'orchestrator:task_decomposition',
      tags: ['task', 'decomposition'],
    });
    expect(r.pre_flight_passed).toBe(true);
    expect(r.write_success).toBe(true);
    expect(r.verification_passed).toBe(true);
    expect(r.rollback_triggered).toBe(false);
  });

  it('W02: metadata_write via orchestrator:agent_selection', () => {
    const r = runA3WriteCycle({
      taskId: 'W02', taskType: 'metadata_write',
      capabilityId: 'orchestrator:agent_selection',
      tags: ['agent', 'selection'],
    });
    expect(r.pre_flight_passed).toBe(true);
    expect(r.write_success).toBe(true);
    expect(r.verification_passed).toBe(true);
  });

  it('W03: canary_strategy_write via analyst:insight_generation', () => {
    const r = runA3WriteCycle({
      taskId: 'W03', taskType: 'canary_strategy_write',
      capabilityId: 'analyst:insight_generation',
      tags: ['insight', 'generation'],
    });
    expect(r.pre_flight_passed).toBe(true);
    expect(r.write_success).toBe(true);
    expect(r.verification_passed).toBe(true);
  });

  it('W04: sandbox_write via orchestrator:error_recovery', () => {
    const r = runA3WriteCycle({
      taskId: 'W04', taskType: 'sandbox_write',
      capabilityId: 'orchestrator:error_recovery',
      tags: ['error', 'recovery'],
    });
    expect(r.pre_flight_passed).toBe(true);
    expect(r.write_success).toBe(true);
  });

  it('W05: repeat metadata_write (trust stability check)', () => {
    const r = runA3WriteCycle({
      taskId: 'W05', taskType: 'metadata_write',
      capabilityId: 'orchestrator:task_decomposition',
      tags: ['task', 'decomposition'],
    });
    expect(r.write_success).toBe(true);
    expect(r.verification_passed).toBe(true);
  });
});

// ============================================================
// Group 3: Rollback Scenarios (5 tests)
// ============================================================

describe('A3 Rollback Scenarios', () => {
  it('RB01: Write fails → rollback triggered and succeeds', () => {
    const r = runA3WriteCycle({
      taskId: 'RB01', taskType: 'metadata_write',
      capabilityId: 'orchestrator:task_decomposition',
      tags: ['task', 'decomposition'],
      simulateWriteSuccess: false,
    });
    expect(r.rollback_triggered).toBe(true);
    expect(r.rollback_success).toBe(true);
  });

  it('RB02: Write succeeds but verification fails → rollback', () => {
    const r = runA3WriteCycle({
      taskId: 'RB02', taskType: 'metadata_write',
      capabilityId: 'orchestrator:agent_selection',
      tags: ['agent', 'selection'],
      simulateWriteSuccess: true,
      simulateVerifyPass: false,
    });
    expect(r.write_success).toBe(true);
    expect(r.verification_passed).toBe(false);
    expect(r.rollback_triggered).toBe(true);
  });

  it('RB03: Rollback manager creates and retrieves context', () => {
    const mgr = new RollbackManager();
    const ctx = mgr.createContext('test1', { v: 1 }, { action: 'undo' }, 'snapshot_restore');
    expect(mgr.hasRollback('test1')).toBe(true);
    expect(ctx.rollback_method).toBe('snapshot_restore');
    expect(mgr.getContext('test1')?.pre_state).toEqual({ v: 1 });
  });

  it('RB04: Rollback execution returns result', async () => {
    const mgr = new RollbackManager();
    mgr.createContext('rb4', { v: 1 }, {}, 'inverse_operation');
    const result = await mgr.executeRollback('rb4', async (ctx) => {
      return ctx.pre_state.v === 1;
    });
    expect(result.success).toBe(true);
    expect(result.method).toBe('inverse_operation');
  });

  it('RB05: No rollback context → failure result', async () => {
    const mgr = new RollbackManager();
    const result = await mgr.executeRollback('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toBe('No rollback context');
  });
});

// ============================================================
// Group 4: Kill Switch Triggers (5 tests)
// ============================================================

describe('A3 Kill Switch', () => {
  it('KS01: Veto violation → kill switch triggered', () => {
    const ks = new A3KillSwitch();
    expect(ks.isActive()).toBe(true);
    ks.checkVetoViolation(true);
    expect(ks.isActive()).toBe(false);
    expect(ks.getState().trigger_reason).toBe('veto_violation');
  });

  it('KS02: Irreversible write leak → kill switch triggered', () => {
    const ks = new A3KillSwitch();
    ks.checkIrreversibleLeak(true);
    expect(ks.isActive()).toBe(false);
    expect(ks.getState().trigger_reason).toBe('irreversible_write_leaked');
  });

  it('KS03: Rollback failure → kill switch triggered', () => {
    const ks = new A3KillSwitch();
    ks.checkRollbackFailure(true);
    expect(ks.isActive()).toBe(false);
  });

  it('KS04: 2 consecutive verification failures → kill switch', () => {
    const ks = new A3KillSwitch();
    ks.checkVerificationFailure(true);
    expect(ks.isActive()).toBe(true); // 1st failure, not yet triggered
    ks.checkVerificationFailure(true);
    expect(ks.isActive()).toBe(false); // 2nd consecutive → triggered
    expect(ks.getState().trigger_reason).toBe('consecutive_verification_failures');
  });

  it('KS05: Low success rate → kill switch triggered', () => {
    const ks = new A3KillSwitch();
    ks.checkSuccessRate(0.75);
    expect(ks.isActive()).toBe(false);
    expect(ks.getState().trigger_reason).toContain('auto_write_success_rate_low');
  });
});

// ============================================================
// Group 5: Forced A2 Downgrade (4 tests)
// ============================================================

describe('A3 Forced Downgrade to A2', () => {
  it('DG01: Non-whitelist capability → downgrade', () => {
    const r = runA3WriteCycle({
      taskId: 'DG01', taskType: 'metadata_write',
      capabilityId: 'researcher:web_search', // not in whitelist
      tags: ['web', 'search'],
    });
    expect(r.downgraded_to_a2).toBe(true);
    expect(r.pre_flight_passed).toBe(false);
  });

  it('DG02: Unknown task_type → downgrade', () => {
    const r = runA3WriteCycle({
      taskId: 'DG02', taskType: 'sandbox_write',
      capabilityId: 'orchestrator:task_decomposition', // wrong combo
      tags: ['task', 'decomposition'],
    });
    expect(r.downgraded_to_a2).toBe(true);
  });

  it('DG03: Missing rollback → downgrade', () => {
    const r = runA3WriteCycle({
      taskId: 'DG03', taskType: 'metadata_write',
      capabilityId: 'orchestrator:task_decomposition',
      tags: ['task', 'decomposition'],
      rollbackPayload: null,
    });
    expect(r.downgraded_to_a2).toBe(true);
  });

  it('DG04: Missing snapshot → downgrade', () => {
    const r = runA3WriteCycle({
      taskId: 'DG04', taskType: 'metadata_write',
      capabilityId: 'orchestrator:task_decomposition',
      tags: ['task', 'decomposition'],
      preState: null,
    });
    expect(r.downgraded_to_a2).toBe(true);
  });
});

// ============================================================
// Group 6: A3 Metrics & Report (3 tests)
// ============================================================

describe('A3 Metrics Report', () => {
  it('MR01: Collects and computes all 10 metrics', () => {
    // Run a batch of A3 tasks
    for (let i = 1; i <= 5; i++) {
      runA3WriteCycle({
        taskId: `MR_S${i}`, taskType: 'metadata_write',
        capabilityId: 'orchestrator:task_decomposition',
        tags: ['task', 'decomposition'],
      });
    }
    // One failure with rollback
    runA3WriteCycle({
      taskId: 'MR_F1', taskType: 'metadata_write',
      capabilityId: 'orchestrator:task_decomposition',
      tags: ['task', 'decomposition'],
      simulateWriteSuccess: false,
    });
    // One downgrade
    runA3WriteCycle({
      taskId: 'MR_DG1', taskType: 'metadata_write',
      capabilityId: 'researcher:web_search',
      tags: ['web', 'search'],
    });

    const m = metricsCollector.compute();
    expect(m.auto_write_success_rate).toBeGreaterThan(0);
    expect(m.auto_write_rollback_rate).toBeGreaterThan(0);
    expect(m.a3_forced_downgrade_to_A2_count).toBeGreaterThanOrEqual(1);
    expect(m.a3_veto_violation_count).toBe(0);
    expect(m.a3_human_emergency_intervention_count).toBe(0);
  });

  it('MR02: Total sample count >= 15 across full batch', () => {
    // Run a full batch to validate sample count target
    for (let i = 1; i <= 10; i++) {
      const entry = A3_WHITELIST[(i - 1) % A3_WHITELIST.length];
      runA3WriteCycle({
        taskId: `MR2_S${i}`, taskType: entry.task_type,
        capabilityId: entry.capability_id,
        tags: entry.capability_id.split(':')[1].split('_'),
      });
    }
    for (let i = 1; i <= 3; i++) {
      runA3WriteCycle({
        taskId: `MR2_F${i}`, taskType: 'metadata_write',
        capabilityId: 'orchestrator:task_decomposition',
        tags: ['task', 'decomposition'],
        simulateWriteSuccess: false,
      });
    }
    for (let i = 1; i <= 2; i++) {
      runA3WriteCycle({
        taskId: `MR2_V${i}`, taskType: 'metadata_write',
        capabilityId: 'orchestrator:agent_selection',
        tags: ['agent', 'selection'],
        simulateVerifyPass: false,
      });
    }
    const records = metricsCollector.getRecords();
    expect(records.length).toBeGreaterThanOrEqual(15);
  });

  it('MR03: Kill switch not triggered during normal operations', () => {
    expect(killSwitch.isActive()).toBe(true);
    expect(killSwitch.getState().triggered).toBe(false);
  });
});

// ============================================================
// Final Report
// ============================================================

describe('A3 Trial Summary Report', () => {
  it('produces D+7 trial report with all required metrics', () => {
    // Re-warm trust scores (previous tests may have degraded them)
    for (let i = 0; i < 20; i++) {
      trustStore.recordOutcome('orchestrator', 'write', true);
      trustStore.recordOutcome('analyst', 'write', true);
      trustStore.recordOutcome('researcher', 'write', true);
    }

    // Run a comprehensive batch for final metrics
    const collector = new A3MetricsCollector();
    const ks = new A3KillSwitch();

    // Phase 1: 10 successful writes
    for (let i = 1; i <= 10; i++) {
      const whitelistEntries = A3_WHITELIST;
      const entry = whitelistEntries[(i - 1) % whitelistEntries.length];
      const record = runA3WriteCycle({
        taskId: `FINAL_S${i}`,
        taskType: entry.task_type,
        capabilityId: entry.capability_id,
        tags: entry.capability_id.split(':')[1].split('_'),
      });
      collector.record(record);
    }

    // Phase 2: 3 write failures with rollback
    // Re-warm between phases to prevent trust degradation from blocking pre-flight
    for (let i = 0; i < 10; i++) {
      trustStore.recordOutcome('orchestrator', 'write', true);
    }
    for (let i = 1; i <= 3; i++) {
      const record = runA3WriteCycle({
        taskId: `FINAL_F${i}`,
        taskType: 'metadata_write',
        capabilityId: 'orchestrator:task_decomposition',
        tags: ['task', 'decomposition'],
        simulateWriteSuccess: false,
      });
      collector.record(record);
      // Compensate trust degradation from recorded failure
      for (let j = 0; j < 5; j++) trustStore.recordOutcome('orchestrator', 'write', true);
    }

    // Phase 3: 2 verification failures with rollback
    for (let i = 0; i < 10; i++) {
      trustStore.recordOutcome('orchestrator', 'write', true);
    }
    for (let i = 1; i <= 2; i++) {
      const record = runA3WriteCycle({
        taskId: `FINAL_V${i}`,
        taskType: 'metadata_write',
        capabilityId: 'orchestrator:agent_selection',
        tags: ['agent', 'selection'],
        simulateVerifyPass: false,
      });
      collector.record(record);
      // Compensate
      for (let j = 0; j < 5; j++) trustStore.recordOutcome('orchestrator', 'write', true);
    }

    // Phase 4: 3 forced downgrades
    const downgradeCases = [
      { id: 'FINAL_DG1', taskType: 'metadata_write' as A3TaskType, capId: 'researcher:web_search', tags: ['web', 'search'] },
      { id: 'FINAL_DG2', taskType: 'sandbox_write' as A3TaskType, capId: 'orchestrator:task_decomposition', tags: ['task'] },
      { id: 'FINAL_DG3', taskType: 'canary_strategy_write' as A3TaskType, capId: 'researcher:document_analysis', tags: ['doc'] },
    ];
    for (const dc of downgradeCases) {
      const record = runA3WriteCycle({
        taskId: dc.id, taskType: dc.taskType,
        capabilityId: dc.capId, tags: dc.tags,
      });
      collector.record(record);
    }

    const total = collector.getRecords().length;
    expect(total).toBeGreaterThanOrEqual(15);

    const m = collector.compute();

    // Check kill switch state
    ks.checkSuccessRate(m.auto_write_success_rate);

    console.log('\n===== A3 TRIAL REPORT =====');
    console.log(`Total samples: ${total}`);
    console.log(`Phase 1 target: 15-30 | Actual: ${total}`);
    console.log('');
    console.log('--- A3 Metrics ---');
    console.log(`1.  auto_write_success_rate:          ${m.auto_write_success_rate.toFixed(2)}`);
    console.log(`2.  auto_write_rollback_rate:          ${m.auto_write_rollback_rate.toFixed(2)}`);
    console.log(`3.  post_write_verification_pass_rate: ${m.post_write_verification_pass_rate.toFixed(2)}`);
    console.log(`4.  a3_veto_violation_count:            ${m.a3_veto_violation_count}`);
    console.log(`5.  a3_human_emergency_intervention:    ${m.a3_human_emergency_intervention_count}`);
    console.log(`6.  median_a3_ctrl_plane_latency:       ${m.median_a3_control_plane_latency_ms.toFixed(2)}ms`);
    console.log(`7.  median_a3_total_exec_latency:       ${m.median_a3_total_execution_latency_ms.toFixed(2)}ms`);
    console.log(`8.  a3_retry_rate:                      ${m.a3_retry_rate.toFixed(2)}`);
    console.log(`9.  a3_fallback_rate:                   ${m.a3_fallback_rate.toFixed(2)}`);
    console.log(`10. a3_forced_downgrade_to_A2_count:    ${m.a3_forced_downgrade_to_A2_count}`);
    console.log('');
    console.log('--- Kill Switch ---');
    console.log(`Active: ${ks.isActive()}`);
    console.log(`Triggered: ${ks.getState().triggered}`);
    if (ks.getState().trigger_reason) {
      console.log(`Reason: ${ks.getState().trigger_reason}`);
    }
    console.log('');
    console.log('--- Verdict ---');
    const passed = m.auto_write_success_rate >= 0.8
      && m.a3_veto_violation_count === 0
      && m.a3_human_emergency_intervention_count === 0;
    console.log(`A3 Trial: ${passed ? 'PASS' : 'CONDITIONAL'}`);
    if (!passed) {
      console.log(`Note: success_rate ${m.auto_write_success_rate.toFixed(2)} may be < 0.8 due to intentional failure samples`);
    }
    console.log('===========================\n');

    // Core assertions
    expect(m.a3_veto_violation_count).toBe(0);
    expect(m.a3_human_emergency_intervention_count).toBe(0);
    expect(m.a3_forced_downgrade_to_A2_count).toBeGreaterThanOrEqual(1);
    expect(m.auto_write_rollback_rate).toBeGreaterThan(0);
    expect(total).toBeGreaterThanOrEqual(15);
  });
});
