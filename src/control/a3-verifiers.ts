/**
 * A3 Batch 1 Verifiers & Rollback Functions
 *
 * Each whitelist entry needs:
 *   - verifier:  read-back check after write
 *   - rollback:  undo if verify fails
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Verifiers
// ============================================================

/**
 * Verify orchestrator trace write.
 * Reads the JSON file and checks intent_id + tasks array.
 */
export function verifyOrchestratorTrace(
  filePath: string,
  expectedIntentId: string,
): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const trace = JSON.parse(content);
    return trace.intent_id === expectedIntentId && Array.isArray(trace.tasks);
  } catch {
    return false;
  }
}

/**
 * Verify gateway trace append.
 * Reads the JSONL events file and checks that the expected seq exists.
 */
export function verifyTraceAppend(
  eventsPath: string,
  expectedSeq: number,
): boolean {
  try {
    const content = fs.readFileSync(eventsPath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
    const events = lines.map((line) => JSON.parse(line));
    return events.some(
      (event: { seq: number }) => event.seq === expectedSeq,
    );
  } catch {
    return false;
  }
}

/**
 * Verify approval init write.
 * Reads approval.json and checks status=DRAFT + trace_id match.
 */
export function verifyApprovalInit(
  approvalPath: string,
  expectedTraceId: string,
): boolean {
  try {
    const content = fs.readFileSync(approvalPath, 'utf-8');
    const approval = JSON.parse(content);
    return approval.status === 'DRAFT' && approval.trace_id === expectedTraceId;
  } catch {
    return false;
  }
}

// ============================================================
// Rollback Functions
// ============================================================

/**
 * Rollback orchestrator trace: delete the file (it was newly created).
 */
export function rollbackOrchestratorTrace(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Rollback gateway trace append: remove lines with seq >= targetSeq.
 */
export function rollbackTraceAppend(
  eventsPath: string,
  targetSeq: number,
): boolean {
  try {
    const content = fs.readFileSync(eventsPath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
    const kept = lines.filter((line) => {
      const event = JSON.parse(line);
      return event.seq < targetSeq;
    });
    const newContent = kept.length > 0 ? kept.join('\n') + '\n' : '';
    fs.writeFileSync(eventsPath, newContent, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Rollback approval init: delete the approval.json (it was newly created).
 */
export function rollbackApprovalInit(approvalPath: string): boolean {
  try {
    if (fs.existsSync(approvalPath)) {
      fs.unlinkSync(approvalPath);
    }
    return true;
  } catch {
    return false;
  }
}
