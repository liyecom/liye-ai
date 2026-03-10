/**
 * Job Runner
 *
 * Core governance logic: Gate → Enforce → Route → Execute → Verdict
 * Converts AGE job events to WS stream chunks.
 */

import type {
  GovToolCallRequestV1,
  StreamChunkV1,
  GovToolCallResponseV1,
  Phase,
  Decision,
  AgeJobStatus,
} from './types';
import { TraceStore } from './trace_store';
import {
  ageCreateJob,
  ageGetJob,
  ageGetJobResult,
  type AgeClientConfig,
} from './age_job_client';

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 300; // 5 minutes max

export interface JobRunnerDeps {
  trace: TraceStore;
  ageConfig: AgeClientConfig;
}

/**
 * Create a stream chunk.
 */
function chunk(
  traceId: string,
  type: 'chunk' | 'complete' | 'error',
  phase: Phase,
  progress: number,
  data?: Record<string, unknown>
): StreamChunkV1 {
  return {
    version: 'STREAM_CHUNK_V1',
    type,
    trace_id: traceId,
    phase,
    progress,
    data,
  };
}

/**
 * Validate request (Gate phase).
 * M0: Only allow amazon://strategy/wasted-spend-detect, read-only.
 */
function validateRequest(
  req: GovToolCallRequestV1
): { valid: boolean; reason?: string } {
  // Must have exactly 1 action
  if (req.proposed_actions.length !== 1) {
    return { valid: false, reason: 'Must have exactly 1 proposed action' };
  }

  const action = req.proposed_actions[0];

  // Must be read-only
  if (action.action_type !== 'read') {
    return { valid: false, reason: 'Only read actions are allowed' };
  }

  // Must be wasted-spend-detect
  if (action.tool !== 'amazon://strategy/wasted-spend-detect') {
    return {
      valid: false,
      reason: `Unsupported tool: ${action.tool}. Only amazon://strategy/wasted-spend-detect is allowed.`,
    };
  }

  // Validate arguments
  const args = action.arguments;
  if (!args.start_date || !args.end_date) {
    return { valid: false, reason: 'start_date and end_date are required' };
  }

  return { valid: true };
}

/**
 * Run a governed tool call.
 *
 * This is an async generator that yields StreamChunkV1 and returns
 * GovToolCallResponseV1 when complete.
 */
export async function* runGovernedToolCall(
  req: GovToolCallRequestV1,
  deps: JobRunnerDeps
): AsyncGenerator<StreamChunkV1, GovToolCallResponseV1, void> {
  const { trace, ageConfig } = deps;
  const traceId = req.trace_id;

  // Initialize trace
  await trace.init(traceId);

  let decision: Decision = 'ALLOW';
  let verdictSummary = '';
  let executionResult: Record<string, unknown> | undefined;
  let evidencePackage: Record<string, unknown> | undefined;

  try {
    // === GATE Phase (0-10%) ===
    await trace.append(traceId, {
      ts: Date.now(),
      phase: 'gate',
      progress: 0,
      kind: 'info',
      message: 'Starting gate check',
    });
    yield chunk(traceId, 'chunk', 'gate', 0, { status: 'checking' });

    const validation = validateRequest(req);

    if (!validation.valid) {
      decision = 'BLOCK';
      verdictSummary = validation.reason || 'Request blocked by gate';

      await trace.append(traceId, {
        ts: Date.now(),
        phase: 'gate',
        progress: 10,
        kind: 'error',
        message: verdictSummary,
      });

      yield chunk(traceId, 'chunk', 'gate', 10, {
        status: 'blocked',
        reason: verdictSummary,
      });

      // Skip to verdict
      const response: GovToolCallResponseV1 = {
        version: 'GOV_TOOL_CALL_RESPONSE_V1',
        trace_id: traceId,
        decision,
        verdict_summary: verdictSummary,
        policy_version: req.policy_version,
      };

      await trace.setResult(traceId, response);

      // Yield complete chunk with response
      yield chunk(traceId, 'complete', 'verdict', 100, response);

      return response;
    }

    await trace.append(traceId, {
      ts: Date.now(),
      phase: 'gate',
      progress: 10,
      kind: 'info',
      message: 'Gate passed',
    });
    yield chunk(traceId, 'chunk', 'gate', 10, { status: 'passed' });

    // === ENFORCE Phase (10-20%) ===
    await trace.append(traceId, {
      ts: Date.now(),
      phase: 'enforce',
      progress: 15,
      kind: 'info',
      message: 'Enforcing policy constraints',
    });
    yield chunk(traceId, 'chunk', 'enforce', 15, { status: 'enforcing' });

    // M0: Simple policy - just check read-only (already done in gate)
    await trace.append(traceId, {
      ts: Date.now(),
      phase: 'enforce',
      progress: 20,
      kind: 'info',
      message: 'Policy enforced',
    });
    yield chunk(traceId, 'chunk', 'enforce', 20, { status: 'enforced' });

    // === ROUTE Phase (20-30%) ===
    const action = req.proposed_actions[0];
    await trace.append(traceId, {
      ts: Date.now(),
      phase: 'route',
      progress: 25,
      kind: 'info',
      message: `Routing to ${action.tool}`,
    });
    yield chunk(traceId, 'chunk', 'route', 25, {
      status: 'routing',
      tool: action.tool,
    });

    await trace.append(traceId, {
      ts: Date.now(),
      phase: 'route',
      progress: 30,
      kind: 'info',
      message: 'Route resolved to AGE',
    });
    yield chunk(traceId, 'chunk', 'route', 30, {
      status: 'resolved',
      target: 'AGE',
    });

    // === EXECUTE Phase (30-90%) ===
    await trace.append(traceId, {
      ts: Date.now(),
      phase: 'execute',
      progress: 30,
      kind: 'info',
      message: 'Starting execution',
    });
    yield chunk(traceId, 'chunk', 'execute', 30, { status: 'starting' });

    // Create job in AGE
    const { job_id } = await ageCreateJob(ageConfig, {
      trace_id: traceId,
      capability: action.tool,
      arguments: action.arguments,
    });

    await trace.append(traceId, {
      ts: Date.now(),
      phase: 'execute',
      progress: 35,
      kind: 'info',
      message: `Job created: ${job_id}`,
      data: { job_id },
    });
    yield chunk(traceId, 'chunk', 'execute', 35, {
      status: 'job_created',
      job_id,
    });

    // Poll for completion
    let lastEventSeq = 0;
    let attempts = 0;

    while (attempts < MAX_POLL_ATTEMPTS) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const jobStatus: AgeJobStatus = await ageGetJob(ageConfig, job_id);

      // Process new events from AGE
      for (const event of jobStatus.events) {
        if (event.seq >= lastEventSeq) {
          lastEventSeq = event.seq + 1;

          // Map AGE progress (0-100) to execute phase (30-90)
          const mappedProgress = 30 + Math.floor(event.progress * 0.6);

          await trace.append(traceId, {
            ts: Date.now(),
            phase: 'execute',
            progress: mappedProgress,
            kind: 'info',
            message: event.message,
            data: event.data,
          });

          yield chunk(traceId, 'chunk', 'execute', mappedProgress, {
            status: 'executing',
            message: event.message,
            ...event.data,
          });
        }
      }

      // Check if done
      if (jobStatus.status === 'done') {
        const result = await ageGetJobResult(ageConfig, job_id);
        executionResult = result.result;
        evidencePackage = result.result?.evidence as Record<string, unknown>;

        await trace.append(traceId, {
          ts: Date.now(),
          phase: 'execute',
          progress: 90,
          kind: 'data',
          message: 'Execution complete',
          data: { job_id, status: 'done' },
        });
        yield chunk(traceId, 'chunk', 'execute', 90, {
          status: 'complete',
          job_id,
        });
        break;
      }

      if (jobStatus.status === 'failed') {
        decision = 'DEGRADE';
        verdictSummary = jobStatus.error || 'Job execution failed';

        await trace.append(traceId, {
          ts: Date.now(),
          phase: 'execute',
          progress: 90,
          kind: 'error',
          message: verdictSummary,
          data: { job_id, error: jobStatus.error },
        });
        yield chunk(traceId, 'chunk', 'execute', 90, {
          status: 'failed',
          error: verdictSummary,
        });
        break;
      }
    }

    if (attempts >= MAX_POLL_ATTEMPTS) {
      decision = 'PENDING';
      verdictSummary = 'Job execution timed out';

      await trace.append(traceId, {
        ts: Date.now(),
        phase: 'execute',
        progress: 90,
        kind: 'error',
        message: verdictSummary,
      });
      yield chunk(traceId, 'chunk', 'execute', 90, {
        status: 'timeout',
        message: verdictSummary,
      });
    }

    // === VERDICT Phase (90-100%) ===
    if (decision === 'ALLOW' && executionResult) {
      verdictSummary = 'Execution completed successfully';
    }

    await trace.append(traceId, {
      ts: Date.now(),
      phase: 'verdict',
      progress: 100,
      kind: 'info',
      message: verdictSummary,
      data: { decision },
    });
    yield chunk(traceId, 'chunk', 'verdict', 100, {
      decision,
      summary: verdictSummary,
    });

  } catch (error) {
    decision = 'DEGRADE';
    verdictSummary =
      error instanceof Error ? error.message : 'Unknown error occurred';

    await trace.append(traceId, {
      ts: Date.now(),
      phase: 'verdict',
      progress: 100,
      kind: 'error',
      message: verdictSummary,
    });
    yield chunk(traceId, 'error', 'verdict', 100, {
      decision,
      error: verdictSummary,
    });
  }

  // Build final response
  const response: GovToolCallResponseV1 = {
    version: 'GOV_TOOL_CALL_RESPONSE_V1',
    trace_id: traceId,
    decision,
    verdict_summary: verdictSummary,
    execution_result: executionResult,
    evidence_package: evidencePackage,
    policy_version: req.policy_version,
  };

  await trace.setResult(traceId, response);

  // Yield complete chunk
  yield chunk(traceId, 'complete', 'verdict', 100, response);

  return response;
}
