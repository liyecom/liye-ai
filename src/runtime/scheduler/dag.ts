/**
 * LiYe AI DAG Scheduler
 * Location: src/runtime/scheduler/dag.ts
 *
 * Directed Acyclic Graph task scheduler
 * [Fix #5] pending_approval is a formal DAG node state
 */

import { Task, TaskResult } from '../executor/types';

type DAGNodeStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed'
                   | 'pending_approval';

interface DAGNode {
  task: Task;
  dependencies: string[];
  dependents: string[];
  status: DAGNodeStatus;
  approval_requested_at?: string;      // ISO timestamp
  approval_timeout_ms?: number;        // Default: 300000 (5min)
}

/**
 * DAG Scheduler
 * Manages task dependencies and execution order
 */
export class DAGScheduler {
  private nodes: Map<string, DAGNode> = new Map();
  private results: Map<string, TaskResult> = new Map();

  /**
   * Build DAG from tasks
   */
  build(tasks: Task[]): void {
    this.nodes.clear();
    this.results.clear();

    // Create nodes
    for (const task of tasks) {
      this.nodes.set(task.id, {
        task,
        dependencies: task.depends_on || [],
        dependents: [],
        status: 'pending'
      });
    }

    // Build reverse dependencies
    for (const [id, node] of this.nodes) {
      for (const depId of node.dependencies) {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(id);
        }
      }
    }

    // Validate DAG (check for cycles)
    this.validateDAG();

    // Mark ready tasks
    this.updateReadyTasks();
  }

  /**
   * Factory method: build DAG from ResolvedTask-compatible objects
   * Zero-disruption integration with orchestrator
   */
  static fromResolvedTasks(resolvedTasks: Array<{
    id: string;
    agent_id: string;
    capability_id: string;
    inputs: Record<string, any>;
    depends_on?: string[];
  }>): DAGScheduler {
    const tasks: Task[] = resolvedTasks.map(rt => ({
      id: rt.id,
      agent: rt.agent_id,
      skill: rt.capability_id,
      inputs: rt.inputs,
      depends_on: rt.depends_on,
    }));
    const scheduler = new DAGScheduler();
    scheduler.build(tasks);
    return scheduler;
  }

  /**
   * Get next tasks ready for execution
   */
  getReadyTasks(): Task[] {
    const ready: Task[] = [];
    for (const [, node] of this.nodes) {
      if (node.status === 'ready') {
        ready.push(node.task);
      }
    }
    return ready;
  }

  /**
   * Mark task as running
   */
  markRunning(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (node && node.status === 'ready') {
      node.status = 'running';
    }
  }

  /**
   * Mark task as completed
   */
  markCompleted(taskId: string, result: TaskResult): void {
    const node = this.nodes.get(taskId);
    if (node) {
      node.status = result.status === 'success' ? 'completed' : 'failed';
      this.results.set(taskId, result);
      this.updateReadyTasks();
    }
  }

  // === [Fix #5] Approval Protocol ===

  /**
   * Mark task as pending approval
   */
  markPendingApproval(taskId: string, timeoutMs: number = 300000): void {
    const node = this.nodes.get(taskId);
    if (node) {
      node.status = 'pending_approval';
      node.approval_requested_at = new Date().toISOString();
      node.approval_timeout_ms = timeoutMs;
      // Track in approval history
      this.approvalHistory.set(taskId, {
        task_id: taskId,
        requested_at: node.approval_requested_at,
        timeout_ms: timeoutMs,
        outcome: 'still_pending',
      });
    }
  }

  /**
   * Approve a pending task -> transitions to ready
   */
  markApproved(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (node && node.status === 'pending_approval') {
      node.status = 'ready';
      node.approval_requested_at = undefined;
      node.approval_timeout_ms = undefined;
      // Update approval history
      const entry = this.approvalHistory.get(taskId);
      if (entry) {
        entry.outcome = 'approved';
        entry.resolved_at = new Date().toISOString();
      }
      this.updateReadyTasks();
    }
  }

  /**
   * Reject a pending task -> transitions to failed (terminal), cascades to dependents
   */
  markRejected(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (node && node.status === 'pending_approval') {
      node.status = 'failed';
      this.results.set(taskId, {
        task_id: taskId,
        status: 'failure',
        outputs: {},
        duration: 0,
        error: 'Approval rejected',
      });
      // Update approval history — rejection is terminal
      const entry = this.approvalHistory.get(taskId);
      if (entry) {
        entry.outcome = 'rejected';
        entry.resolved_at = new Date().toISOString();
      }
      this.updateReadyTasks(); // Cascades failure to dependents
    }
  }

  /**
   * Check if a pending_approval task has timed out
   */
  isTimedOut(taskId: string): boolean {
    const node = this.nodes.get(taskId);
    if (!node || node.status !== 'pending_approval') return false;
    if (!node.approval_requested_at || !node.approval_timeout_ms) return false;

    const elapsed = Date.now() - new Date(node.approval_requested_at).getTime();
    return elapsed >= node.approval_timeout_ms;
  }

  /**
   * Mark a timed-out approval as failed (terminal).
   * Called by engine when isTimedOut() returns true.
   */
  markTimedOut(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (node && node.status === 'pending_approval') {
      node.status = 'failed';
      this.results.set(taskId, {
        task_id: taskId,
        status: 'failure',
        outputs: {},
        duration: 0,
        error: 'Approval timeout',
      });
      // Update approval history — timeout is terminal
      const entry = this.approvalHistory.get(taskId);
      if (entry) {
        entry.outcome = 'timeout';
        entry.resolved_at = new Date().toISOString();
      }
      this.updateReadyTasks();
    }
  }

  /**
   * Get all tasks waiting for approval
   */
  getPendingApprovals(): Task[] {
    const pending: Task[] = [];
    for (const [, node] of this.nodes) {
      if (node.status === 'pending_approval') {
        pending.push(node.task);
      }
    }
    return pending;
  }

  /**
   * Check if all tasks are done
   * pending_approval is NOT done — system still waiting
   */
  isComplete(): boolean {
    for (const [, node] of this.nodes) {
      if (node.status !== 'completed' && node.status !== 'failed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if DAG is stalled (nothing ready, but not complete)
   */
  isStalled(): boolean {
    if (this.isComplete()) return false;
    return this.getReadyTasks().length === 0 &&
           this.getPendingApprovals().length === 0 &&
           !this.hasRunning();
  }

  /**
   * Get execution results
   */
  getResults(): TaskResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Get task output for dependency resolution
   */
  getTaskOutput(taskId: string): Record<string, any> | undefined {
    const result = this.results.get(taskId);
    return result?.status === 'success' ? result.outputs : undefined;
  }

  /**
   * Get node status for a task
   */
  getNodeStatus(taskId: string): DAGNodeStatus | undefined {
    return this.nodes.get(taskId)?.status;
  }

  /**
   * Update tasks that are ready to execute
   * [Fix #5] pending_approval dependencies keep downstream in pending (not ready, not failed)
   */
  private updateReadyTasks(): void {
    for (const [, node] of this.nodes) {
      if (node.status !== 'pending') continue;

      // Check if any dependency failed
      const anyDepFailed = node.dependencies.some(depId => {
        const depNode = this.nodes.get(depId);
        return depNode?.status === 'failed';
      });

      if (anyDepFailed) {
        node.status = 'failed';
        continue;
      }

      // Check if any dependency is pending_approval — stay pending
      const anyDepPendingApproval = node.dependencies.some(depId => {
        const depNode = this.nodes.get(depId);
        return depNode?.status === 'pending_approval';
      });

      if (anyDepPendingApproval) {
        continue; // Stay pending, don't promote to ready
      }

      // Check if all dependencies are completed
      const allDepsCompleted = node.dependencies.every(depId => {
        const depNode = this.nodes.get(depId);
        return depNode?.status === 'completed';
      });

      if (allDepsCompleted) {
        node.status = 'ready';
      }
    }
  }

  /**
   * Check if any tasks are currently running
   */
  private hasRunning(): boolean {
    for (const [, node] of this.nodes) {
      if (node.status === 'running') return true;
    }
    return false;
  }

  /**
   * Validate DAG has no cycles
   */
  private validateDAG(): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string): void => {
      if (visiting.has(id)) {
        throw new Error(`Cycle detected in task dependencies at ${id}`);
      }
      if (visited.has(id)) return;

      visiting.add(id);
      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }
      visiting.delete(id);
      visited.add(id);
    };

    for (const id of this.nodes.keys()) {
      visit(id);
    }
  }

  /**
   * Get task count by status
   */
  getStatusCounts(): Record<string, number> {
    const counts: Record<string, number> = {
      pending: 0,
      ready: 0,
      running: 0,
      completed: 0,
      failed: 0,
      pending_approval: 0,
    };

    for (const [, node] of this.nodes) {
      counts[node.status]++;
    }

    return counts;
  }

  // === Approval Queue (Closure) ===

  /**
   * Get detailed approval queue — all tasks that have entered or passed through
   * the pending_approval state, with their terminal outcome.
   * Returns entries for every task that was ever marked pending_approval.
   */
  getApprovalQueue(): ApprovalQueueEntry[] {
    return Array.from(this.approvalHistory.values());
  }

  /**
   * Get approval state conservation stats.
   * Guarantees: total = approved + rejected + timeout + still_pending
   */
  getApprovalStats(): ApprovalStats {
    let approved = 0;
    let rejected = 0;
    let timeout = 0;
    let still_pending = 0;

    for (const entry of this.approvalHistory.values()) {
      switch (entry.outcome) {
        case 'approved': approved++; break;
        case 'rejected': rejected++; break;
        case 'timeout': timeout++; break;
        case 'still_pending': still_pending++; break;
      }
    }

    return {
      total: this.approvalHistory.size,
      approved,
      rejected,
      timeout,
      still_pending,
    };
  }

  /** Track approval history (set when marking pending_approval) */
  private approvalHistory: Map<string, ApprovalQueueEntry> = new Map();
}

/** Approval queue entry — tracks lifecycle of a single approval request */
export interface ApprovalQueueEntry {
  task_id: string;
  requested_at: string;          // ISO timestamp
  timeout_ms: number;
  outcome: 'approved' | 'rejected' | 'timeout' | 'still_pending';
  resolved_at?: string;          // ISO timestamp when outcome was determined
}

/** Approval statistics — state conservation invariant: total = approved + rejected + timeout + still_pending */
export interface ApprovalStats {
  total: number;
  approved: number;
  rejected: number;
  timeout: number;
  still_pending: number;
}

export default DAGScheduler;
