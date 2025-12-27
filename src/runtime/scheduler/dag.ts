/**
 * LiYe AI DAG Scheduler
 * Location: src/runtime/scheduler/dag.ts
 *
 * Directed Acyclic Graph task scheduler
 */

import { Task, TaskResult } from '../executor/types';

interface DAGNode {
  task: Task;
  dependencies: string[];
  dependents: string[];
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
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

  /**
   * Check if all tasks are done
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
   * Update tasks that are ready to execute
   */
  private updateReadyTasks(): void {
    for (const [, node] of this.nodes) {
      if (node.status !== 'pending') continue;

      // Check if all dependencies are completed
      const allDepsCompleted = node.dependencies.every(depId => {
        const depNode = this.nodes.get(depId);
        return depNode?.status === 'completed';
      });

      // Check if any dependency failed
      const anyDepFailed = node.dependencies.some(depId => {
        const depNode = this.nodes.get(depId);
        return depNode?.status === 'failed';
      });

      if (anyDepFailed) {
        node.status = 'failed';
      } else if (allDepsCompleted) {
        node.status = 'ready';
      }
    }
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
      failed: 0
    };

    for (const [, node] of this.nodes) {
      counts[node.status]++;
    }

    return counts;
  }
}

export default DAGScheduler;
