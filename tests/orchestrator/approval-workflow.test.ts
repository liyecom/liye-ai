/**
 * Approval Workflow Tests
 *
 * Validates the approval lifecycle closure:
 *   - Approval queue visibility
 *   - State transitions: pending → approved → resume, pending → rejected → terminal, pending → timeout → terminal
 *   - State conservation: total = approved + rejected + timeout + still_pending
 *   - Terminal state guarantees
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DAGScheduler } from '../../src/runtime/scheduler/dag';
import type { Task, TaskResult } from '../../src/runtime/executor/types';

// ============================================================
// State Transition Table
// ============================================================
//
// | Current State      | Action         | Next State     | Terminal? | Downstream Effect       |
// |--------------------|----------------|----------------|-----------|-------------------------|
// | ready/running      | markPending    | pending_approval | No      | Downstream stays pending|
// | pending_approval   | markApproved   | ready          | No        | Downstream may ready    |
// | pending_approval   | markRejected   | failed         | Yes       | Downstream cascade fail |
// | pending_approval   | markTimedOut   | failed         | Yes       | Downstream cascade fail |
//

function buildTwoTaskDAG(): DAGScheduler {
  const tasks: Task[] = [
    { id: 't1', agent: 'a1', skill: 's1', inputs: {} },
    { id: 't2', agent: 'a2', skill: 's2', inputs: {}, depends_on: ['t1'] },
  ];
  const dag = new DAGScheduler();
  dag.build(tasks);
  return dag;
}

function buildThreeTaskFanOut(): DAGScheduler {
  const tasks: Task[] = [
    { id: 't1', agent: 'a1', skill: 's1', inputs: {} },
    { id: 't2', agent: 'a2', skill: 's2', inputs: {}, depends_on: ['t1'] },
    { id: 't3', agent: 'a3', skill: 's3', inputs: {}, depends_on: ['t1'] },
  ];
  const dag = new DAGScheduler();
  dag.build(tasks);
  return dag;
}

// ============================================================
// Path 1: pending → approved → resume → completed
// ============================================================

describe('Approval Path: Approve → Resume → Complete', () => {
  let dag: DAGScheduler;

  beforeEach(() => {
    dag = buildTwoTaskDAG();
  });

  it('markPendingApproval transitions to pending_approval', () => {
    const ready = dag.getReadyTasks();
    expect(ready.length).toBe(1);
    dag.markRunning('t1');
    dag.markPendingApproval('t1', 300000);
    expect(dag.getNodeStatus('t1')).toBe('pending_approval');
  });

  it('downstream stays pending while approval pending', () => {
    dag.markRunning('t1');
    dag.markPendingApproval('t1', 300000);
    expect(dag.getNodeStatus('t2')).toBe('pending');
    expect(dag.getReadyTasks().length).toBe(0);
  });

  it('markApproved transitions to ready and unblocks downstream', () => {
    dag.markRunning('t1');
    dag.markPendingApproval('t1', 300000);
    dag.markApproved('t1');
    expect(dag.getNodeStatus('t1')).toBe('ready');

    // Execute t1 to completion
    dag.markRunning('t1');
    dag.markCompleted('t1', { task_id: 't1', status: 'success', outputs: {}, duration: 0 });
    expect(dag.getNodeStatus('t1')).toBe('completed');

    // t2 should now be ready
    expect(dag.getNodeStatus('t2')).toBe('ready');
  });

  it('full path trace: pending → approved → resume → completed → downstream', () => {
    // t1: ready → running → pending_approval → approved → ready → running → completed
    dag.markRunning('t1');
    dag.markPendingApproval('t1');
    dag.markApproved('t1');
    dag.markRunning('t1');
    dag.markCompleted('t1', { task_id: 't1', status: 'success', outputs: {}, duration: 0 });

    // t2: should be ready → run → complete
    expect(dag.getNodeStatus('t2')).toBe('ready');
    dag.markRunning('t2');
    dag.markCompleted('t2', { task_id: 't2', status: 'success', outputs: {}, duration: 0 });

    expect(dag.isComplete()).toBe(true);
    expect(dag.getStatusCounts().completed).toBe(2);
  });

  it('approval history records approved outcome', () => {
    dag.markRunning('t1');
    dag.markPendingApproval('t1');
    dag.markApproved('t1');

    const stats = dag.getApprovalStats();
    expect(stats.total).toBe(1);
    expect(stats.approved).toBe(1);
    expect(stats.rejected).toBe(0);
    expect(stats.timeout).toBe(0);
    expect(stats.still_pending).toBe(0);
  });
});

// ============================================================
// Path 2: pending → rejected → terminal (failed)
// ============================================================

describe('Approval Path: Reject → Terminal', () => {
  let dag: DAGScheduler;

  beforeEach(() => {
    dag = buildThreeTaskFanOut();
  });

  it('markRejected transitions to failed', () => {
    dag.markRunning('t1');
    dag.markPendingApproval('t1');
    dag.markRejected('t1');
    expect(dag.getNodeStatus('t1')).toBe('failed');
  });

  it('rejection cascades failure to all dependents', () => {
    dag.markRunning('t1');
    dag.markPendingApproval('t1');
    dag.markRejected('t1');

    expect(dag.getNodeStatus('t2')).toBe('failed');
    expect(dag.getNodeStatus('t3')).toBe('failed');
  });

  it('rejection is terminal — cannot re-approve', () => {
    dag.markRunning('t1');
    dag.markPendingApproval('t1');
    dag.markRejected('t1');

    // Attempting to approve after rejection should have no effect
    dag.markApproved('t1');
    expect(dag.getNodeStatus('t1')).toBe('failed'); // still failed
  });

  it('approval history records rejected outcome', () => {
    dag.markRunning('t1');
    dag.markPendingApproval('t1');
    dag.markRejected('t1');

    const stats = dag.getApprovalStats();
    expect(stats.total).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.approved).toBe(0);

    const queue = dag.getApprovalQueue();
    expect(queue[0].outcome).toBe('rejected');
    expect(queue[0].resolved_at).toBeDefined();
  });
});

// ============================================================
// Path 3: pending → timeout → terminal (failed)
// ============================================================

describe('Approval Path: Timeout → Terminal', () => {
  it('isTimedOut detects expired approval', () => {
    const dag = buildTwoTaskDAG();
    dag.markRunning('t1');
    dag.markPendingApproval('t1', 1); // 1ms timeout
    // Wait a tick
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    expect(dag.isTimedOut('t1')).toBe(true);
  });

  it('markTimedOut transitions to failed (terminal)', () => {
    const dag = buildTwoTaskDAG();
    dag.markRunning('t1');
    dag.markPendingApproval('t1', 1);
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    dag.markTimedOut('t1');
    expect(dag.getNodeStatus('t1')).toBe('failed');
  });

  it('timeout cascades failure to dependents', () => {
    const dag = buildTwoTaskDAG();
    dag.markRunning('t1');
    dag.markPendingApproval('t1', 1);
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    dag.markTimedOut('t1');
    expect(dag.getNodeStatus('t2')).toBe('failed');
  });

  it('approval history records timeout outcome', () => {
    const dag = buildTwoTaskDAG();
    dag.markRunning('t1');
    dag.markPendingApproval('t1', 1);
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    dag.markTimedOut('t1');

    const stats = dag.getApprovalStats();
    expect(stats.total).toBe(1);
    expect(stats.timeout).toBe(1);
    expect(stats.approved).toBe(0);
    expect(stats.rejected).toBe(0);
    expect(stats.still_pending).toBe(0);
  });
});

// ============================================================
// State Conservation Invariant
// ============================================================

describe('Approval State Conservation', () => {
  it('total = approved + rejected + timeout + still_pending', () => {
    const tasks: Task[] = [
      { id: 'a1', agent: 'x', skill: 's', inputs: {} },
      { id: 'a2', agent: 'x', skill: 's', inputs: {} },
      { id: 'a3', agent: 'x', skill: 's', inputs: {} },
      { id: 'a4', agent: 'x', skill: 's', inputs: {} },
    ];
    const dag = new DAGScheduler();
    dag.build(tasks);

    // All 4 become pending_approval
    for (const t of tasks) {
      dag.markRunning(t.id);
      dag.markPendingApproval(t.id, 1);
    }

    // a1: approve
    dag.markApproved('a1');

    // a2: reject
    dag.markRejected('a2');

    // a3: timeout
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    dag.markTimedOut('a3');

    // a4: still pending (not resolved)
    // Note: a4 timeout hasn't elapsed yet since we set it to 1ms and already spun.
    // But let's manually check the stats

    const stats = dag.getApprovalStats();
    expect(stats.total).toBe(4);
    expect(stats.approved).toBe(1);
    expect(stats.rejected).toBe(1);
    // a3 timed out, a4 may or may not have timed out
    // The conservation invariant must hold regardless
    expect(stats.approved + stats.rejected + stats.timeout + stats.still_pending)
      .toBe(stats.total);
  });

  it('empty DAG has zero approval stats', () => {
    const dag = new DAGScheduler();
    dag.build([]);
    const stats = dag.getApprovalStats();
    expect(stats.total).toBe(0);
    expect(stats.approved + stats.rejected + stats.timeout + stats.still_pending).toBe(0);
  });
});

// ============================================================
// Approval Queue
// ============================================================

describe('Approval Queue', () => {
  it('lists all approval requests with details', () => {
    const dag = buildThreeTaskFanOut();
    dag.markRunning('t1');
    dag.markPendingApproval('t1', 60000);

    const queue = dag.getApprovalQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].task_id).toBe('t1');
    expect(queue[0].requested_at).toBeDefined();
    expect(queue[0].timeout_ms).toBe(60000);
    expect(queue[0].outcome).toBe('still_pending');
  });

  it('queue entries have resolved_at after approval decision', () => {
    const dag = buildTwoTaskDAG();
    dag.markRunning('t1');
    dag.markPendingApproval('t1');
    dag.markApproved('t1');

    const queue = dag.getApprovalQueue();
    expect(queue[0].outcome).toBe('approved');
    expect(queue[0].resolved_at).toBeDefined();
  });
});
