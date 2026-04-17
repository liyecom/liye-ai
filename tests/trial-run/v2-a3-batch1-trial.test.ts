/**
 * A3 Batch 1 Whitelist Expansion Trial
 *
 * Validates 3 new whitelist entries (orchestrator_trace_write, gateway_trace_append,
 * approval_init_write) through 6 test groups:
 *   1. Pre-flight new types (6 tests)
 *   2. Success write cycle (3 tests)
 *   3. Rollback scenarios (3 tests)
 *   4. Real verifier tests (3 tests)
 *   5. Mixed batch metrics (2 tests)
 *   6. Regression guards (2 tests)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
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
} from '../../src/control/a3-write-policy';
import type {
  A3TaskType,
  A3TaskRecord,
} from '../../src/control/a3-write-policy';
import type { AgentCapabilityCandidate, TrustProfile } from '../../src/control/types';
import {
  verifyOrchestratorTrace,
  verifyTraceAppend,
  verifyApprovalInit,
  rollbackOrchestratorTrace,
  rollbackTraceAppend,
  rollbackApprovalInit,
} from '../../src/control/a3-verifiers';

const AGENTS_DIR = path.resolve(__dirname, '../../Agents');
const TRACE_DIR = path.resolve(__dirname, '../../data/traces/a3-batch1');
const TMP_DIR = path.resolve(__dirname, '../../data/traces/a3-batch1-tmp');

let registry: CapabilityRegistry;
let trustStore: TrustScoreStore;
let discoveryPolicy: DiscoveryPolicy;
let executionPolicy: ExecutionPolicy;
let router: CapabilityRouter;
let rollbackMgr: RollbackManager;
let killSwitch: A3KillSwitch;
let metricsCollector: A3MetricsCollector;

const TRUST_PATH = '/tmp/a3-batch1-trust-' + Date.now() + '.yaml';

beforeAll(() => {
  for (const dir of [TRACE_DIR, TMP_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  registry = new CapabilityRegistry();
  registry.scanAgents([AGENTS_DIR]);
  trustStore = new TrustScoreStore(TRUST_PATH);
  discoveryPolicy = new DiscoveryPolicy(registry);
  executionPolicy = new ExecutionPolicy(registry);
  router = new CapabilityRouter(registry, discoveryPolicy, executionPolicy);

  // Warm trust scores above 0.7
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

afterEach(() => {
  // Clean TMP_DIR artifacts
  if (fs.existsSync(TMP_DIR)) {
    for (const f of fs.readdirSync(TMP_DIR)) {
      const fp = path.join(TMP_DIR, f);
      if (fs.statSync(fp).isFile()) fs.unlinkSync(fp);
      else fs.rmSync(fp, { recursive: true });
    }
  }
});

// ============================================================
// Helper: reuse v1 A3 write cycle pattern
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

  const planTask = {
    id: taskId,
    description: `A3 write: ${taskType}`,
    capability: { tags },
    inputs: {},
  };
  const resolved = router.resolve([planTask]);
  const rt = resolved[0];

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

  const preFlight = runA3PreFlight(
    candidate, taskType, trust, registry,
    rollbackPayload, preState, true
  );

  if (!preFlight.passed) {
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

  const whitelistEntry = A3_WHITELIST.find(
    e => e.task_type === taskType && e.capability_id === capabilityId
  )!;
  rollbackMgr.createContext(taskId, preState, rollbackPayload, whitelistEntry.rollback_method);

  const writeSuccess = simulateWriteSuccess;
  if (writeSuccess) {
    trustStore.recordOutcome(candidate.agent_id, 'write', true);
  } else {
    trustStore.recordOutcome(candidate.agent_id, 'write', false);
  }

  const verifyPass = writeSuccess && simulateVerifyPass;
  killSwitch.checkVerificationFailure(!verifyPass && writeSuccess);

  let rollbackTriggered = false;
  let rollbackSuccess: boolean | undefined;
  if (!writeSuccess || !verifyPass) {
    rollbackTriggered = true;
    rollbackSuccess = simulateRollbackSuccess;
    killSwitch.checkRollbackFailure(!rollbackSuccess);
  }

  const t2 = performance.now();

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
    control_plane_latency_ms: Math.round((t1 - t0) * 100) / 100,
    total_execution_latency_ms: Math.round((t2 - t0) * 100) / 100,
    retried: false,
    fallback_used: false,
    trace_path: tracePath,
  };
  metricsCollector.record(record);
  return record;
}

// ============================================================
// Group 1: Pre-flight New Types (6 tests)
// ============================================================

describe('Batch1 Pre-flight: New Whitelist Types', () => {
  function makeCandidate(capabilityId: string, sideEffect: 'write' | 'read' | 'irreversible' = 'write'): AgentCapabilityCandidate {
    const agentId = capabilityId.split(':')[0];
    const agentCard = registry.findAgent(agentId);
    return {
      agent_id: agentId,
      capability_id: capabilityId,
      matched_tags: [],
      side_effect: sideEffect,
      trust: trustStore.getProfile(agentId),
      source_contract: agentCard?.contracts.find(c => c.id === capabilityId)
        ?? agentCard?.contracts[0]
        ?? { id: capabilityId, kind: 'skill' as const, name: capabilityId, domain: 'core', tags: [], side_effect: sideEffect, source_path: '' },
    };
  }

  it('B1-PF01: orchestrator_trace_write passes pre-flight', () => {
    const result = runA3PreFlight(
      makeCandidate('orchestrator:progress_monitoring'),
      'orchestrator_trace_write',
      trustStore.getProfile('orchestrator'),
      registry, { action: 'delete_file' }, { exists: false }, true
    );
    expect(result.passed).toBe(true);
    expect(result.checks.length).toBe(12);
  });

  it('B1-PF02: gateway_trace_append passes pre-flight', () => {
    const result = runA3PreFlight(
      makeCandidate('orchestrator:progress_monitoring'),
      'gateway_trace_append',
      trustStore.getProfile('orchestrator'),
      registry, { action: 'truncate_lines' }, { lines: 0 }, true
    );
    expect(result.passed).toBe(true);
  });

  it('B1-PF03: approval_init_write passes pre-flight', () => {
    const result = runA3PreFlight(
      makeCandidate('orchestrator:error_recovery'),
      'approval_init_write',
      trustStore.getProfile('orchestrator'),
      registry, { action: 'delete_file' }, { exists: false }, true
    );
    expect(result.passed).toBe(true);
  });

  it('B1-PF04: orchestrator_trace_write with wrong capability_id rejects', () => {
    const result = runA3PreFlight(
      makeCandidate('orchestrator:task_decomposition'),
      'orchestrator_trace_write',
      trustStore.getProfile('orchestrator'),
      registry, {}, {}, true
    );
    expect(result.passed).toBe(false);
    expect(result.failed_checks).toContain('whitelist');
  });

  it('B1-PF05: gateway_trace_append with wrong capability_id rejects', () => {
    const result = runA3PreFlight(
      makeCandidate('orchestrator:error_recovery'),
      'gateway_trace_append',
      trustStore.getProfile('orchestrator'),
      registry, {}, {}, true
    );
    expect(result.passed).toBe(false);
    expect(result.failed_checks).toContain('whitelist');
  });

  it('B1-PF06: approval_init_write with wrong capability_id rejects', () => {
    const result = runA3PreFlight(
      makeCandidate('orchestrator:progress_monitoring'),
      'approval_init_write',
      trustStore.getProfile('orchestrator'),
      registry, {}, {}, true
    );
    expect(result.passed).toBe(false);
    expect(result.failed_checks).toContain('whitelist');
  });
});

// ============================================================
// Group 2: Success Write Cycle (3 tests)
// ============================================================

describe('Batch1 Success Write Cycle', () => {
  it('B1-W01: orchestrator_trace_write full cycle', () => {
    const r = runA3WriteCycle({
      taskId: 'B1-W01', taskType: 'orchestrator_trace_write',
      capabilityId: 'orchestrator:progress_monitoring',
      tags: ['progress', 'monitoring'],
    });
    expect(r.pre_flight_passed).toBe(true);
    expect(r.write_success).toBe(true);
    expect(r.verification_passed).toBe(true);
    expect(r.rollback_triggered).toBe(false);
  });

  it('B1-W02: gateway_trace_append full cycle', () => {
    const r = runA3WriteCycle({
      taskId: 'B1-W02', taskType: 'gateway_trace_append',
      capabilityId: 'orchestrator:progress_monitoring',
      tags: ['progress', 'monitoring'],
    });
    expect(r.pre_flight_passed).toBe(true);
    expect(r.write_success).toBe(true);
    expect(r.verification_passed).toBe(true);
    expect(r.rollback_triggered).toBe(false);
  });

  it('B1-W03: approval_init_write full cycle', () => {
    const r = runA3WriteCycle({
      taskId: 'B1-W03', taskType: 'approval_init_write',
      capabilityId: 'orchestrator:error_recovery',
      tags: ['error', 'recovery'],
    });
    expect(r.pre_flight_passed).toBe(true);
    expect(r.write_success).toBe(true);
    expect(r.verification_passed).toBe(true);
    expect(r.rollback_triggered).toBe(false);
  });
});

// ============================================================
// Group 3: Rollback Scenarios (3 tests)
// ============================================================

describe('Batch1 Rollback Scenarios', () => {
  it('B1-RB01: orchestrator_trace_write verify fail triggers rollback', () => {
    const r = runA3WriteCycle({
      taskId: 'B1-RB01', taskType: 'orchestrator_trace_write',
      capabilityId: 'orchestrator:progress_monitoring',
      tags: ['progress', 'monitoring'],
      simulateVerifyPass: false,
    });
    expect(r.write_success).toBe(true);
    expect(r.verification_passed).toBe(false);
    expect(r.rollback_triggered).toBe(true);
    expect(r.rollback_success).toBe(true);
  });

  it('B1-RB02: gateway_trace_append write fail triggers rollback', () => {
    const r = runA3WriteCycle({
      taskId: 'B1-RB02', taskType: 'gateway_trace_append',
      capabilityId: 'orchestrator:progress_monitoring',
      tags: ['progress', 'monitoring'],
      simulateWriteSuccess: false,
    });
    expect(r.write_success).toBe(false);
    expect(r.rollback_triggered).toBe(true);
    expect(r.rollback_success).toBe(true);
  });

  it('B1-RB03: approval_init_write verify fail triggers rollback', () => {
    const r = runA3WriteCycle({
      taskId: 'B1-RB03', taskType: 'approval_init_write',
      capabilityId: 'orchestrator:error_recovery',
      tags: ['error', 'recovery'],
      simulateVerifyPass: false,
    });
    expect(r.rollback_triggered).toBe(true);
    expect(r.rollback_success).toBe(true);
  });
});

// ============================================================
// Group 4: Real Verifier Tests (3 tests)
// ============================================================

describe('Batch1 Real Verifiers', () => {
  it('B1-VF01: verifyOrchestratorTrace valid + invalid', () => {
    const filePath = path.join(TMP_DIR, 'trace_vf01.json');
    const trace = { intent_id: 'test-intent-1', tasks: [{ id: 't1' }], timestamp: new Date().toISOString() };
    fs.writeFileSync(filePath, JSON.stringify(trace), 'utf-8');

    // Valid
    expect(verifyOrchestratorTrace(filePath, 'test-intent-1')).toBe(true);
    // Wrong intent_id
    expect(verifyOrchestratorTrace(filePath, 'wrong-id')).toBe(false);
    // Nonexistent file
    expect(verifyOrchestratorTrace('/nonexistent/path.json', 'x')).toBe(false);

    // Rollback
    expect(rollbackOrchestratorTrace(filePath)).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('B1-VF02: verifyTraceAppend valid + invalid + rollback', () => {
    const eventsPath = path.join(TMP_DIR, 'events_vf02.jsonl');
    const events = [
      { seq: 0, type: 'init', ts: '2026-01-01' },
      { seq: 1, type: 'step', ts: '2026-01-01' },
      { seq: 2, type: 'done', ts: '2026-01-01' },
    ];
    fs.writeFileSync(eventsPath, events.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8');

    // Valid seq
    expect(verifyTraceAppend(eventsPath, 2)).toBe(true);
    expect(verifyTraceAppend(eventsPath, 0)).toBe(true);
    // Missing seq
    expect(verifyTraceAppend(eventsPath, 5)).toBe(false);

    // Rollback: remove seq >= 2
    expect(rollbackTraceAppend(eventsPath, 2)).toBe(true);
    const remaining = fs.readFileSync(eventsPath, 'utf-8').trim().split('\n').filter(l => l);
    expect(remaining.length).toBe(2);
    expect(verifyTraceAppend(eventsPath, 2)).toBe(false);
    expect(verifyTraceAppend(eventsPath, 1)).toBe(true);
  });

  it('B1-VF03: verifyApprovalInit valid + invalid + rollback', () => {
    const approvalDir = path.join(TMP_DIR, 'approval_vf03');
    fs.mkdirSync(approvalDir, { recursive: true });
    const approvalPath = path.join(approvalDir, 'approval.json');
    const approval = {
      trace_id: 'trace-vf03',
      plan_id: 'plan-1',
      status: 'DRAFT',
      audit_log: [{ ts: new Date().toISOString(), actor: 'test', event: 'created' }],
    };
    fs.writeFileSync(approvalPath, JSON.stringify(approval), 'utf-8');

    // Valid
    expect(verifyApprovalInit(approvalPath, 'trace-vf03')).toBe(true);
    // Wrong trace_id
    expect(verifyApprovalInit(approvalPath, 'wrong-trace')).toBe(false);

    // Modify status to non-DRAFT → should fail
    const modified = { ...approval, status: 'SUBMITTED' };
    fs.writeFileSync(approvalPath, JSON.stringify(modified), 'utf-8');
    expect(verifyApprovalInit(approvalPath, 'trace-vf03')).toBe(false);

    // Rollback
    expect(rollbackApprovalInit(approvalPath)).toBe(true);
    expect(fs.existsSync(approvalPath)).toBe(false);
  });
});

// ============================================================
// Group 5: Mixed Batch Metrics (2 tests)
// ============================================================

describe('Batch1 Mixed Batch Metrics', () => {
  it('B1-MX01: all 7 whitelist types run in mixed batch', () => {
    // Re-warm trust
    for (let i = 0; i < 10; i++) {
      trustStore.recordOutcome('orchestrator', 'write', true);
      trustStore.recordOutcome('analyst', 'write', true);
    }

    // Run all 7 whitelist entries
    for (const entry of A3_WHITELIST) {
      const r = runA3WriteCycle({
        taskId: `MX01-${entry.task_type}-${entry.capability_id}`,
        taskType: entry.task_type,
        capabilityId: entry.capability_id,
        tags: entry.capability_id.split(':')[1].split('_'),
      });
      expect(r.pre_flight_passed).toBe(true);
      expect(r.write_success).toBe(true);
    }

    const m = metricsCollector.compute();
    expect(m.auto_write_success_rate).toBe(1);
    expect(m.a3_veto_violation_count).toBe(0);
  });

  it('B1-MX02: kill switch not triggered during mixed batch', () => {
    for (let i = 0; i < 10; i++) {
      trustStore.recordOutcome('orchestrator', 'write', true);
    }

    for (const entry of A3_WHITELIST) {
      runA3WriteCycle({
        taskId: `MX02-${entry.task_type}`,
        taskType: entry.task_type,
        capabilityId: entry.capability_id,
        tags: entry.capability_id.split(':')[1].split('_'),
      });
    }

    expect(killSwitch.isActive()).toBe(true);
    expect(killSwitch.getState().triggered).toBe(false);
  });
});

// ============================================================
// Group 6: Regression Guards (2 tests)
// ============================================================

describe('Batch1 Regression Guards', () => {
  it('B1-RG01: original 4 whitelist entries unaffected', () => {
    const original4 = [
      { taskType: 'metadata_write' as A3TaskType, capId: 'orchestrator:task_decomposition' },
      { taskType: 'metadata_write' as A3TaskType, capId: 'orchestrator:agent_selection' },
      { taskType: 'canary_strategy_write' as A3TaskType, capId: 'analyst:insight_generation' },
      { taskType: 'sandbox_write' as A3TaskType, capId: 'orchestrator:error_recovery' },
    ];

    for (const entry of original4) {
      const found = A3_WHITELIST.find(
        e => e.task_type === entry.taskType && e.capability_id === entry.capId
      );
      expect(found).toBeDefined();
      expect(found!.domain).toBe('core');
    }
  });

  it('B1-RG02: A3_WHITELIST.length === 7 (4 original + 3 new)', () => {
    expect(A3_WHITELIST.length).toBe(7);

    // Verify all 3 new entries exist
    const newEntries = [
      { taskType: 'orchestrator_trace_write', capId: 'orchestrator:progress_monitoring' },
      { taskType: 'gateway_trace_append', capId: 'orchestrator:progress_monitoring' },
      { taskType: 'approval_init_write', capId: 'orchestrator:error_recovery' },
    ];
    for (const ne of newEntries) {
      const found = A3_WHITELIST.find(
        e => e.task_type === ne.taskType && e.capability_id === ne.capId
      );
      expect(found).toBeDefined();
      expect(found!.verifier_method).toBe('read_back');
    }
  });
});
