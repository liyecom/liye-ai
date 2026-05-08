/**
 * LiYe AI Orchestration Engine
 * Location: src/runtime/orchestrator/engine.ts
 *
 * 6-step pipeline: decompose -> route -> executionPolicyCheck -> buildDAG -> executeLoop -> aggregate
 * [Fix #3] Policy split: discovery (in router) + execution (post-route)
 * [Fix #4] Fallback with separate trust recording
 * [Fix #5] pending_approval as formal DAG state
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  ICapabilityRegistry,
  IExecutionPolicy,
  ITrustStore,
  TrustProfile,
} from '../../control/types';
import { DAGScheduler } from '../scheduler/dag';
import type { Task, TaskResult, ExecutionContext } from '../executor/types';
import { AgentExecutor } from '../executor/agent';
import {
  Intent,
  ResolvedTask,
  ResolvedTaskResult,
  OrchestrationResult,
  OrchestrationTrace,
} from './types';
import { RuleBasedDecomposer } from './decomposer';
import { CapabilityRouter } from './router';

const DEFAULT_APPROVAL_TIMEOUT_MS = 300_000; // 5 minutes
const TRACE_DIR = 'data/traces/orchestrator';

export class OrchestrationEngine {
  private decomposer: RuleBasedDecomposer;
  private router: CapabilityRouter;
  private executionPolicy: IExecutionPolicy;
  private trustStore: ITrustStore;
  private registry: ICapabilityRegistry;
  private traceDir: string;

  // In-flight state for approval resumption
  private activeDags: Map<string, {
    dag: DAGScheduler;
    resolved: ResolvedTask[];
    intent: Intent;
    startTime: number;
    results: Map<string, ResolvedTaskResult>;
  }> = new Map();

  constructor(opts: {
    decomposer: RuleBasedDecomposer;
    router: CapabilityRouter;
    executionPolicy: IExecutionPolicy;
    trustStore: ITrustStore;
    registry: ICapabilityRegistry;
    traceDir?: string;
  }) {
    this.decomposer = opts.decomposer;
    this.router = opts.router;
    this.executionPolicy = opts.executionPolicy;
    this.trustStore = opts.trustStore;
    this.registry = opts.registry;
    this.traceDir = opts.traceDir ?? TRACE_DIR;
  }

  /**
   * [Fix #3] 6-step pipeline
   */
  async orchestrate(
    intent: Intent,
    executor?: (task: Task, context?: ExecutionContext) => Promise<TaskResult>
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const taskResults = new Map<string, ResolvedTaskResult>();
    const trustUpdates: Record<string, Partial<TrustProfile>> = {};

    // 1. Decompose: Intent -> TaskPlan
    const plan = await this.decomposer.decompose(intent);

    // 2. Route (internally calls discoveryPolicy.filter -> score -> rank)
    const resolved = this.router.resolve(plan.tasks);

    // 3. Execution policy check (post-route, has full candidate info)
    for (const task of resolved) {
      if (!task.agent_id) {
        task.autonomy = 'block';
        continue;
      }
      const action = (task.side_effect === 'write' || task.side_effect === 'irreversible')
        ? 'write' as const
        : 'read' as const;
      const card = this.registry.findAgent(task.agent_id);
      if (card) {
        const policyResult = this.executionPolicy.check({
          agent_id: task.agent_id,
          capability_id: task.capability_id,
          matched_tags: task.capability.tags,
          side_effect: task.side_effect,
          trust: card.trust,
          source_contract: card.contracts.find(c => c.id === task.capability_id)!,
        }, action);
        task.autonomy = policyResult.autonomy;
      }
    }

    // 4. Build DAG
    const dag = DAGScheduler.fromResolvedTasks(resolved);

    // Store in-flight state for potential approval resumption
    this.activeDags.set(intent.id, { dag, resolved, intent, startTime, results: taskResults });

    // 5. Execute loop
    const result = await this.executeLoop(
      intent, dag, resolved, taskResults, trustUpdates, startTime, executor
    );

    // Clean up completed orchestrations
    if (result.status !== 'pending_approval') {
      this.activeDags.delete(intent.id);
    }

    return result;
  }

  /**
   * Resume orchestration after approval decision
   */
  async resumeAfterApproval(
    intentId: string,
    taskId: string,
    decision: 'approved' | 'rejected',
    executor?: (task: Task, context?: ExecutionContext) => Promise<TaskResult>
  ): Promise<OrchestrationResult | null> {
    const active = this.activeDags.get(intentId);
    if (!active) return null;

    const { dag, resolved, intent, startTime, results } = active;

    // [Fix #5d] Out-of-order approval bypass guard. Only act when the
    // target task is actually awaiting approval. dag.markApproved() and
    // dag.markRejected() silently no-op on non-pending_approval nodes,
    // so without this guard a caller could pre-approve a downstream
    // write task whose own pending_approval gate has not yet fired —
    // the autonomy promotion at line ~146 would still flip rt.autonomy
    // to 'auto', letting the task execute without approval when its
    // turn arrives. Reject the call early instead.
    if (dag.getNodeStatus(taskId) !== 'pending_approval') {
      return null;
    }

    if (decision === 'approved') {
      dag.markApproved(taskId);
      // [Fix #5b] Promote autonomy so executeLoop's autonomy check at line ~241
      // doesn't re-mark this task as pending_approval. The approval decision
      // IS the autonomy escalation; once granted it persists for this run.
      // Safe because the guard above proves the task was genuinely awaiting
      // approval — not a future downstream write being pre-cleared.
      const rt = resolved.find(r => r.id === taskId);
      if (rt) rt.autonomy = 'auto';
    } else {
      dag.markRejected(taskId);
      const rt = resolved.find(r => r.id === taskId);
      if (rt) {
        results.set(taskId, {
          task_id: taskId,
          primary_agent_id: rt.agent_id,
          actual_executor_agent_id: rt.agent_id,
          capability_id: rt.capability_id,
          status: 'blocked',
          fallback_used: false,
          duration_ms: 0,
          outputs: {},
        });
        this.trustStore.recordOutcome(rt.agent_id, 'write', false);
      }
    }

    const trustUpdates: Record<string, Partial<TrustProfile>> = {};
    const result = await this.executeLoop(intent, dag, resolved, results, trustUpdates, startTime, executor);

    // [Fix #5c] Mirror orchestrate() cleanup: drop in-flight state once
    // the run is no longer suspended on another approval.
    if (result.status !== 'pending_approval') {
      this.activeDags.delete(intentId);
    }

    return result;
  }

  /**
   * Core execution loop
   */
  private async executeLoop(
    intent: Intent,
    dag: DAGScheduler,
    resolved: ResolvedTask[],
    taskResults: Map<string, ResolvedTaskResult>,
    trustUpdates: Record<string, Partial<TrustProfile>>,
    startTime: number,
    executor?: (task: Task, context?: ExecutionContext) => Promise<TaskResult>
  ): Promise<OrchestrationResult> {
    const resolvedMap = new Map(resolved.map(r => [r.id, r]));
    const execFn = executor ?? this.defaultExecutor.bind(this);

    while (!dag.isComplete()) {
      // Check approval timeouts
      for (const pa of dag.getPendingApprovals()) {
        if (dag.isTimedOut(pa.id)) {
          dag.markTimedOut(pa.id);
          const rt = resolvedMap.get(pa.id);
          if (rt) {
            this.trustStore.recordOutcome(rt.agent_id, 'write', false);
            taskResults.set(pa.id, {
              task_id: pa.id,
              primary_agent_id: rt.agent_id,
              actual_executor_agent_id: rt.agent_id,
              capability_id: rt.capability_id,
              status: 'failure',
              fallback_used: false,
              duration_ms: 0,
              outputs: {},
            });
          }
        }
      }

      const ready = dag.getReadyTasks();

      // If nothing ready but approvals pending, return partial result
      if (ready.length === 0) {
        if (dag.getPendingApprovals().length > 0) {
          const partialResult = this.aggregateResult(intent, taskResults, trustUpdates, startTime, 'pending_approval');
          this.writeTrace(intent, partialResult);
          return partialResult;
        }
        // Stalled — no ready, no pending approvals, not complete
        break;
      }

      for (const task of ready) {
        dag.markRunning(task.id);
        const rt = resolvedMap.get(task.id);

        if (!rt || !rt.agent_id) {
          dag.markCompleted(task.id, {
            task_id: task.id,
            status: 'failure',
            outputs: {},
            duration: 0,
            error: 'No agent resolved',
          });
          taskResults.set(task.id, {
            task_id: task.id,
            primary_agent_id: '',
            actual_executor_agent_id: '',
            capability_id: '',
            status: 'failure',
            fallback_used: false,
            duration_ms: 0,
            outputs: {},
          });
          continue;
        }

        // [Fix #5] A2 autonomy enforcement
        if (rt.autonomy === 'approve') {
          dag.markPendingApproval(task.id, DEFAULT_APPROVAL_TIMEOUT_MS);
          taskResults.set(task.id, {
            task_id: task.id,
            primary_agent_id: rt.agent_id,
            actual_executor_agent_id: rt.agent_id,
            capability_id: rt.capability_id,
            status: 'pending_approval',
            fallback_used: false,
            duration_ms: 0,
            outputs: {},
          });
          continue;
        }

        if (rt.autonomy === 'block') {
          dag.markCompleted(task.id, {
            task_id: task.id,
            status: 'failure',
            outputs: {},
            duration: 0,
            error: 'blocked_by_policy',
          });
          taskResults.set(task.id, {
            task_id: task.id,
            primary_agent_id: rt.agent_id,
            actual_executor_agent_id: rt.agent_id,
            capability_id: rt.capability_id,
            status: 'blocked',
            fallback_used: false,
            duration_ms: 0,
            outputs: {},
          });
          continue;
        }

        // Execute primary
        const taskStartTime = Date.now();
        let result = await execFn(task);
        let actualAgent = rt.agent_id;
        let fallbackUsed = false;
        let fallbackRank = 0;
        const kind = (rt.side_effect === 'write' || rt.side_effect === 'irreversible')
          ? 'write' as const
          : 'read' as const;

        // [Fix #4] Fallback with separate trust recording
        // [Fix #4b] Each alternative must re-pass execution policy. The
        // primary's autonomy decision does NOT cover alternatives because
        // their side_effect / trust profile / contract may differ. Without
        // this check a read-auto primary could fall back to a write-approve
        // alternative and execute it without the required approval (A2 rule
        // violation).
        if (result.status === 'failure' && rt.alternatives.length > 0) {
          // Record primary failure
          this.trustStore.recordOutcome(rt.agent_id, kind, false);

          for (let i = 0; i < rt.alternatives.length; i++) {
            const alt = rt.alternatives[i];
            const altCard = this.registry.findAgent(alt.agent_id);
            if (!altCard) continue;
            const altContract = altCard.contracts.find(c => c.id === alt.capability_id);
            if (!altContract) continue;
            const altAction = (altContract.side_effect === 'write' || altContract.side_effect === 'irreversible')
              ? 'write' as const
              : 'read' as const;
            const altPolicy = this.executionPolicy.check({
              agent_id: alt.agent_id,
              capability_id: alt.capability_id,
              matched_tags: rt.capability.tags,
              side_effect: altContract.side_effect,
              trust: altCard.trust,
              source_contract: altContract,
            }, altAction);

            // Skip alternatives that need approval or are blocked. Fallback
            // is auto-resolution; an approve-required alternative cannot be
            // silently substituted for a failed primary.
            // [Fix #4c] Do NOT record a trust outcome here. The alternative
            // never executed — recording recordOutcome(..., false) would
            // inflate total_executions and decay write_score for an action
            // the agent never attempted, polluting the profile. Policy-skip
            // is a routing decision, not an execution result. (A dedicated
            // audit channel for policy-skipped fallbacks can be added later
            // without touching trust profiles.)
            if (altPolicy.autonomy !== 'auto') {
              continue;
            }

            const altTask: Task = {
              ...task,
              agent: alt.agent_id,
              skill: alt.capability_id,
            };
            const altResult = await execFn(altTask);

            if (altResult.status === 'success') {
              result = altResult;
              actualAgent = alt.agent_id;
              fallbackUsed = true;
              fallbackRank = i + 1;
              this.trustStore.recordOutcome(alt.agent_id, altAction, true);
              break;
            } else {
              this.trustStore.recordOutcome(alt.agent_id, altAction, false);
            }
          }
        } else {
          // Primary result — record to primary
          this.trustStore.recordOutcome(rt.agent_id, kind, result.status === 'success');
        }

        const duration = Date.now() - taskStartTime;
        dag.markCompleted(task.id, result);

        // Record trust updates
        const profile = this.trustStore.getProfile(actualAgent);
        trustUpdates[actualAgent] = {
          read_score: profile.read_score,
          write_score: profile.write_score,
          overall_score: profile.overall_score,
        };

        taskResults.set(task.id, {
          task_id: task.id,
          primary_agent_id: rt.agent_id,
          actual_executor_agent_id: actualAgent,
          capability_id: rt.capability_id,
          status: result.status === 'success' ? 'success' : 'failure',
          fallback_used: fallbackUsed,
          fallback_rank: fallbackRank || undefined,
          duration_ms: duration,
          outputs: result.outputs,
        });
      }
    }

    const finalResult = this.aggregateResult(intent, taskResults, trustUpdates, startTime);

    // Write trace
    this.writeTrace(intent, finalResult);

    return finalResult;
  }

  /**
   * Default executor (no-op, returns success)
   */
  private async defaultExecutor(task: Task): Promise<TaskResult> {
    return {
      task_id: task.id,
      status: 'success',
      outputs: {},
      duration: 0,
    };
  }

  /**
   * Aggregate final result
   */
  private aggregateResult(
    intent: Intent,
    taskResults: Map<string, ResolvedTaskResult>,
    trustUpdates: Record<string, Partial<TrustProfile>>,
    startTime: number,
    forceStatus?: 'pending_approval'
  ): OrchestrationResult {
    const results = Array.from(taskResults.values());
    const hasFailure = results.some(r => r.status === 'failure' || r.status === 'blocked');
    const hasPending = results.some(r => r.status === 'pending_approval');
    const allSuccess = results.every(r => r.status === 'success');

    let status: OrchestrationResult['status'];
    if (forceStatus) {
      status = forceStatus;
    } else if (allSuccess) {
      status = 'completed';
    } else if (hasPending) {
      status = 'pending_approval';
    } else if (hasFailure && results.some(r => r.status === 'success')) {
      status = 'partial';
    } else {
      status = 'failed';
    }

    return {
      intent_id: intent.id,
      status,
      tasks: results,
      total_duration_ms: Date.now() - startTime,
      trust_updates: trustUpdates,
    };
  }

  /**
   * Write orchestration trace to file
   */
  private writeTrace(intent: Intent, result: OrchestrationResult): void {
    try {
      const traceDir = path.resolve(this.traceDir);
      if (!fs.existsSync(traceDir)) {
        fs.mkdirSync(traceDir, { recursive: true });
      }

      const trace: OrchestrationTrace = {
        intent_id: intent.id,
        timestamp: new Date().toISOString(),
        tasks: result.tasks,
        trust_updates: result.trust_updates,
        total_duration_ms: result.total_duration_ms,
      };

      const fileName = `${intent.id}_${Date.now()}.json`;
      const filePath = path.join(traceDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(trace, null, 2), 'utf-8');
    } catch {
      // Trace write failure is non-fatal
    }
  }
}

export default OrchestrationEngine;
