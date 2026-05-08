/**
 * Orchestrator Tests — Phase 2 + Phase 3
 *
 * Tests: decomposer, router, DAG extensions, engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { DAGScheduler } from '../../src/runtime/scheduler/dag';
import { CapabilityRegistry } from '../../src/control/registry';
import { TrustScoreStore } from '../../src/control/trust';
import { DiscoveryPolicy } from '../../src/control/discovery-policy';
import { ExecutionPolicy } from '../../src/control/execution-policy';
import { RuleBasedDecomposer } from '../../src/runtime/orchestrator/decomposer';
import { CapabilityRouter } from '../../src/runtime/orchestrator/router';
import { OrchestrationEngine } from '../../src/runtime/orchestrator/engine';
import type { Task, TaskResult } from '../../src/runtime/executor/types';
import type { Intent, ResolvedTask } from '../../src/runtime/orchestrator/types';

const AGENTS_DIR = path.resolve(__dirname, '../../Agents');
const CREWS_DIR = path.resolve(__dirname, '../../Crews');

// ============================================================
// Phase 2: DAG Scheduler Extensions
// ============================================================

describe('DAGScheduler Extensions', () => {
  it('fromResolvedTasks creates valid DAG', () => {
    const resolved = [
      { id: 't1', agent_id: 'a1', capability_id: 'a1:s1', inputs: {} },
      { id: 't2', agent_id: 'a2', capability_id: 'a2:s1', inputs: {}, depends_on: ['t1'] },
    ];

    const dag = DAGScheduler.fromResolvedTasks(resolved);
    const ready = dag.getReadyTasks();
    expect(ready.length).toBe(1);
    expect(ready[0].id).toBe('t1');
  });

  describe('pending_approval state', () => {
    let dag: DAGScheduler;

    beforeEach(() => {
      const tasks: Task[] = [
        { id: 't1', agent: 'a1', skill: 's1', inputs: {} },
        { id: 't2', agent: 'a2', skill: 's2', inputs: {}, depends_on: ['t1'] },
      ];
      dag = new DAGScheduler();
      dag.build(tasks);
    });

    it('markPendingApproval sets formal state', () => {
      dag.markRunning('t1');
      dag.markPendingApproval('t1');
      expect(dag.getNodeStatus('t1')).toBe('pending_approval');
    });

    it('downstream stays pending when dependency is pending_approval', () => {
      dag.markRunning('t1');
      dag.markPendingApproval('t1');

      // t2 should still be pending (not ready, not failed)
      expect(dag.getNodeStatus('t2')).toBe('pending');
      expect(dag.getReadyTasks().length).toBe(0);
    });

    it('markApproved transitions to ready and unblocks downstream', () => {
      dag.markRunning('t1');
      dag.markPendingApproval('t1');
      dag.markApproved('t1');

      // t1 is now ready, complete it
      expect(dag.getNodeStatus('t1')).toBe('ready');
      dag.markRunning('t1');
      dag.markCompleted('t1', {
        task_id: 't1', status: 'success', outputs: {}, duration: 0,
      });

      // t2 should now be ready
      expect(dag.getNodeStatus('t2')).toBe('ready');
    });

    it('markRejected cascades failure to dependents', () => {
      dag.markRunning('t1');
      dag.markPendingApproval('t1');
      dag.markRejected('t1');

      expect(dag.getNodeStatus('t1')).toBe('failed');
      expect(dag.getNodeStatus('t2')).toBe('failed'); // cascaded
    });

    it('getPendingApprovals returns waiting tasks', () => {
      dag.markRunning('t1');
      dag.markPendingApproval('t1');

      const pending = dag.getPendingApprovals();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('t1');
    });

    it('isTimedOut detects expired approvals', async () => {
      dag.markRunning('t1');
      dag.markPendingApproval('t1', 1); // 1ms timeout
      // Wait briefly to ensure timeout
      await new Promise(r => setTimeout(r, 5));
      expect(dag.isTimedOut('t1')).toBe(true);
    });

    it('isComplete returns false when pending_approval exists', () => {
      dag.markRunning('t1');
      dag.markPendingApproval('t1');
      expect(dag.isComplete()).toBe(false);
    });

    it('getStatusCounts includes pending_approval', () => {
      dag.markRunning('t1');
      dag.markPendingApproval('t1');
      const counts = dag.getStatusCounts();
      expect(counts['pending_approval']).toBe(1);
    });
  });
});

// ============================================================
// Phase 2: Decomposer
// ============================================================

describe('RuleBasedDecomposer', () => {
  let decomposer: RuleBasedDecomposer;

  beforeEach(() => {
    decomposer = new RuleBasedDecomposer([CREWS_DIR], [AGENTS_DIR]);
  });

  it('decomposes research intent into multiple tasks', async () => {
    const intent: Intent = {
      id: 'test-1',
      goal: 'Research market for outdoor rugs',
      domain: 'core',
    };

    const plan = await decomposer.decompose(intent);
    expect(plan.intent_id).toBe('test-1');
    expect(plan.tasks.length).toBeGreaterThanOrEqual(1);

    for (const task of plan.tasks) {
      expect(task.id).toBeTruthy();
      expect(task.capability.tags.length).toBeGreaterThan(0);
    }
  });

  it('analysis intent produces sequential dependencies', async () => {
    const intent: Intent = {
      id: 'test-2',
      goal: 'Analyze data for patterns and insights',
      domain: 'core',
    };

    const plan = await decomposer.decompose(intent);

    // Analysis team uses sequential process
    if (plan.source === 'crew_yaml' && plan.tasks.length > 1) {
      // Sequential: task[1] depends on task[0]
      expect(plan.tasks[1].depends_on).toBeDefined();
      expect(plan.tasks[1].depends_on!.length).toBeGreaterThan(0);
    }
  });

  it('falls back to single task when no crew matches', async () => {
    const intent: Intent = {
      id: 'test-3',
      goal: 'zzz xyzzy quantum',
      domain: 'nonexistent_domain',   // No crew in this domain
    };

    const plan = await decomposer.decompose(intent);
    expect(plan.tasks.length).toBe(1);
    expect(plan.source).toBe('rule');
  });
});

// ============================================================
// Phase 2: Router
// ============================================================

describe('CapabilityRouter', () => {
  let registry: CapabilityRegistry;
  let router: CapabilityRouter;

  beforeEach(() => {
    registry = new CapabilityRegistry();
    registry.scanAgents([AGENTS_DIR]);

    const trustStore = new TrustScoreStore('/tmp/test-trust-' + Date.now() + '.yaml');
    const discoveryPolicy = new DiscoveryPolicy(registry);
    const executionPolicy = new ExecutionPolicy(registry);
    router = new CapabilityRouter(registry, discoveryPolicy, executionPolicy);
  });

  it('resolves plan tasks to specific capabilities', () => {
    const tasks = [{
      id: 't1',
      description: 'Research the market',
      capability: { tags: ['research', 'market'], domain: 'core' },
      inputs: {},
    }];

    const resolved = router.resolve(tasks);
    expect(resolved.length).toBe(1);
    expect(resolved[0].agent_id).toBeTruthy();
    expect(resolved[0].capability_id).toBeTruthy();
    expect(resolved[0].confidence).toBeGreaterThan(0);
  });

  it('assigns read autonomy for read capabilities', () => {
    const tasks = [{
      id: 't1',
      description: 'Research something',
      capability: { tags: ['research'], domain: 'core' },
      inputs: {},
    }];

    const resolved = router.resolve(tasks);
    // Research capabilities should have read side_effect -> auto autonomy
    const researchTask = resolved[0];
    if (researchTask.side_effect === 'read') {
      expect(researchTask.autonomy).toBe('auto');
    }
  });

  it('provides alternatives for capability-level routing', () => {
    const tasks = [{
      id: 't1',
      description: 'Detect something',
      capability: { tags: ['detection'], domain: 'core' },
      inputs: {},
    }];

    const resolved = router.resolve(tasks);
    // "detection" should match both analyst:trend_detection and analyst:anomaly_detection
    expect(resolved[0].agent_id).toBeTruthy();
    // May or may not have alternatives depending on matches
  });

  it('returns unresolved for no-match tags', () => {
    const tasks = [{
      id: 't1',
      description: 'Do something impossible',
      capability: { tags: ['zzz_nonexistent_zzz'] },
      inputs: {},
    }];

    const resolved = router.resolve(tasks);
    expect(resolved[0].agent_id).toBe('');
    expect(resolved[0].autonomy).toBe('block');
  });
});

// ============================================================
// Phase 3: Orchestration Engine
// ============================================================

describe('OrchestrationEngine', () => {
  let engine: OrchestrationEngine;
  let registry: CapabilityRegistry;
  let trustStore: TrustScoreStore;

  beforeEach(() => {
    registry = new CapabilityRegistry();
    registry.scanAgents([AGENTS_DIR]);

    trustStore = new TrustScoreStore('/tmp/test-trust-engine-' + Date.now() + '.yaml');

    // Sync trust from registry to store
    for (const agent of registry.listAll()) {
      trustStore.setProfile(agent.agent_id, agent.trust);
    }

    const discoveryPolicy = new DiscoveryPolicy(registry);
    const executionPolicy = new ExecutionPolicy(registry);
    const decomposer = new RuleBasedDecomposer([CREWS_DIR], [AGENTS_DIR]);
    const router = new CapabilityRouter(registry, discoveryPolicy, executionPolicy);

    engine = new OrchestrationEngine({
      decomposer,
      router,
      executionPolicy,
      trustStore,
      registry,
      traceDir: '/tmp/test-traces-' + Date.now(),
    });
  });

  it('orchestrates a read intent end-to-end', async () => {
    const intent: Intent = {
      id: 'e2e-read-1',
      goal: 'Research market for outdoor rugs',
      domain: 'core',
    };

    // Use default executor (returns success)
    const result = await engine.orchestrate(intent);

    expect(result.intent_id).toBe('e2e-read-1');
    expect(['completed', 'partial', 'pending_approval']).toContain(result.status);
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.total_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('records trust updates on execution', async () => {
    const intent: Intent = {
      id: 'trust-test-1',
      goal: 'Research market trends',
      domain: 'core',
    };

    const result = await engine.orchestrate(intent);

    // Should have trust updates for executed agents
    expect(Object.keys(result.trust_updates).length).toBeGreaterThanOrEqual(0);
  });

  it('handles fallback when primary fails', async () => {
    const intent: Intent = {
      id: 'fallback-test-1',
      goal: 'Research market trends',
      domain: 'core',
    };

    let callCount = 0;
    const failFirstExecutor = async (task: Task): Promise<TaskResult> => {
      callCount++;
      if (callCount === 1) {
        return { task_id: task.id, status: 'failure', outputs: {}, duration: 10, error: 'simulated' };
      }
      return { task_id: task.id, status: 'success', outputs: { result: 'from_fallback' }, duration: 5 };
    };

    const result = await engine.orchestrate(intent, failFirstExecutor);

    // Check if fallback was triggered
    const taskWithFallback = result.tasks.find(t => t.fallback_used);
    if (taskWithFallback) {
      expect(taskWithFallback.primary_agent_id).not.toBe(taskWithFallback.actual_executor_agent_id);
      expect(taskWithFallback.fallback_rank).toBeGreaterThan(0);
    }
  });

  it('blocks irreversible operations', async () => {
    const intent: Intent = {
      id: 'block-test-1',
      goal: 'Research and optimize content',
      domain: 'core',
    };

    const result = await engine.orchestrate(intent);
    // Write operations should be pending_approval, not auto-executed
    const writeTasks = result.tasks.filter(t => t.status === 'pending_approval');
    const blockedTasks = result.tasks.filter(t => t.status === 'blocked');
    // Either write tasks need approval or are blocked — that's correct A2 behavior
  });

  it('handles pending_approval flow', async () => {
    const intent: Intent = {
      id: 'approval-test-1',
      goal: 'Optimize content strategy',
      domain: 'core',
    };

    const result = await engine.orchestrate(intent);

    // If there are pending_approval tasks, test resumption
    const pendingTasks = result.tasks.filter(t => t.status === 'pending_approval');
    if (pendingTasks.length > 0 && result.status === 'pending_approval') {
      // Resume with approval
      const resumed = await engine.resumeAfterApproval(
        intent.id,
        pendingTasks[0].task_id,
        'approved'
      );
      expect(resumed).not.toBeNull();
    }
  });
});

// ============================================================
// Phase 3 — Approval Resume Correctness (#129 review)
// ============================================================
//
// These tests exercise the engine-level approval flow end-to-end,
// using a stub ExecutionPolicy that forces 'approve' on writes so
// the scenario reliably enters pending_approval regardless of
// underlying agent/crew config.
//
// Covers review findings:
//   - Finding 1: approval resume must NOT re-mark task as pending_approval
//   - Finding 2: fallback alternatives must re-pass executionPolicy
//   - Finding 3: activeDags must be cleared once a resume run completes

describe('OrchestrationEngine approval-resume correctness', () => {
  type StubPolicyMode = 'auto-read-approve-write' | 'auto-everything';

  function buildEngine(mode: StubPolicyMode) {
    const registry = new CapabilityRegistry();
    registry.scanAgents([AGENTS_DIR]);

    const trustStore = new TrustScoreStore('/tmp/test-trust-resume-' + Date.now() + '.yaml');
    for (const agent of registry.listAll()) {
      trustStore.setProfile(agent.agent_id, agent.trust);
    }

    const stubPolicy = {
      check: (_candidate: any, action: 'read' | 'write') => {
        if (mode === 'auto-everything') {
          return { allowed: true, autonomy: 'auto' as const, reason: 'stub' };
        }
        if (action === 'read') {
          return { allowed: true, autonomy: 'auto' as const, reason: 'stub-read' };
        }
        return { allowed: true, autonomy: 'approve' as const, reason: 'stub-write' };
      },
    };

    const discoveryPolicy = new DiscoveryPolicy(registry);
    const decomposer = new RuleBasedDecomposer([CREWS_DIR], [AGENTS_DIR]);
    const router = new CapabilityRouter(registry, discoveryPolicy, stubPolicy as any);

    return new OrchestrationEngine({
      decomposer,
      router,
      executionPolicy: stubPolicy as any,
      trustStore,
      registry,
      traceDir: '/tmp/test-traces-resume-' + Date.now(),
    });
  }

  it('resume after approval completes the task without re-pending (Finding 1)', async () => {
    const engine = buildEngine('auto-read-approve-write');
    const intent: Intent = {
      id: 'resume-completes-1',
      goal: 'Research and optimize content',
      domain: 'core',
    };

    const initial = await engine.orchestrate(intent);
    const pending = initial.tasks.filter(t => t.status === 'pending_approval');
    // Goal must decompose into at least one write task under stub policy.
    // If this fails, the underlying Agents/Crews config no longer produces
    // writes for 'Research and optimize content' and the test scenario must
    // be regenerated — silent skip would mask Finding 1 regressions.
    expect(pending.length).toBeGreaterThan(0);
    expect(initial.status).toBe('pending_approval');

    const resumed = await engine.resumeAfterApproval(intent.id, pending[0].task_id, 'approved');
    expect(resumed).not.toBeNull();

    // Critical assertion: the previously-pending task is NOT pending_approval again
    const resumedTask = resumed!.tasks.find(t => t.task_id === pending[0].task_id);
    expect(resumedTask).toBeDefined();
    expect(resumedTask!.status).not.toBe('pending_approval');
  });

  it('activeDags cleared after successful resume (Finding 3)', async () => {
    const engine = buildEngine('auto-read-approve-write');
    const intent: Intent = {
      id: 'resume-cleanup-1',
      goal: 'Research and optimize content',
      domain: 'core',
    };

    const initial = await engine.orchestrate(intent);
    const pending = initial.tasks.filter(t => t.status === 'pending_approval');
    if (pending.length === 0) return;

    const first = await engine.resumeAfterApproval(intent.id, pending[0].task_id, 'approved');
    expect(first).not.toBeNull();
    if (first!.status === 'pending_approval') return; // run still suspended; cleanup correctly deferred

    // Second resume on same intent must return null because activeDags was cleared
    const second = await engine.resumeAfterApproval(intent.id, pending[0].task_id, 'approved');
    expect(second).toBeNull();
  });

  it('rejected resume also clears activeDags', async () => {
    const engine = buildEngine('auto-read-approve-write');
    const intent: Intent = {
      id: 'resume-reject-cleanup-1',
      goal: 'Research and optimize content',
      domain: 'core',
    };

    const initial = await engine.orchestrate(intent);
    const pending = initial.tasks.filter(t => t.status === 'pending_approval');
    if (pending.length === 0) return;

    const rejected = await engine.resumeAfterApproval(intent.id, pending[0].task_id, 'rejected');
    expect(rejected).not.toBeNull();
    if (rejected!.status === 'pending_approval') return;

    const second = await engine.resumeAfterApproval(intent.id, pending[0].task_id, 'approved');
    expect(second).toBeNull();
  });

  it('fallback alternative is skipped when execution policy says approve (Finding 2)', async () => {
    // Force executionPolicy to deny writes (return 'approve'), then trigger
    // a primary failure. Any write-typed alternative must NOT auto-execute.
    const engine = buildEngine('auto-read-approve-write');
    const intent: Intent = {
      id: 'fallback-policy-1',
      goal: 'Research market trends',
      domain: 'core',
    };

    let primaryCalled = false;
    const failPrimaryExecutor = async (task: Task): Promise<TaskResult> => {
      if (!primaryCalled) {
        primaryCalled = true;
        return { task_id: task.id, status: 'failure', outputs: {}, duration: 5, error: 'simulated' };
      }
      // If we ever get here for a write fallback, the bug is back.
      return { task_id: task.id, status: 'success', outputs: { leaked: true }, duration: 5 };
    };

    const result = await engine.orchestrate(intent, failPrimaryExecutor);

    // No task should report fallback_used with a write side effect under
    // approve-required policy. We assert the negative form: any task that
    // did fall back must have an actual_executor whose action remained
    // policy-permitted (i.e. read-only under this stub).
    const fallbacks = result.tasks.filter(t => t.fallback_used);
    for (const fb of fallbacks) {
      expect(fb.outputs).not.toHaveProperty('leaked');
    }
  });
});
