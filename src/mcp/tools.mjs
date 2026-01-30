/**
 * LiYe Governance MCP Tools v1
 *
 * Four governance tools exposed via MCP protocol:
 * - governance_gate: Risk assessment before action
 * - governance_enforce: Contract compliance checking
 * - governance_verdict: Human-readable decision semantics
 * - governance_replay: Deterministic trace verification
 */

import { createTrace, traceExists } from '../governance/trace/trace_writer.mjs';
import { readTrace } from '../governance/trace/trace_reader.mjs';
import { gate } from '../governance/gate.mjs';
import { enforce, validateContract } from '../governance/enforce.mjs';
import { generateVerdict, formatVerdictMarkdown } from '../governance/verdict.mjs';
import { replay, ReplayStatus } from '../governance/replay.mjs';
import { generateTraceId, TraceEventType } from '../governance/types.mjs';
import { validateGateReport, validateVerdict, validateTraceEvent } from './validator.mjs';

/**
 * Default trace output directory
 */
const DEFAULT_TRACE_DIR = '.liye/traces';

/**
 * Tool definitions for MCP
 */
export const toolDefinitions = [
  {
    name: 'governance_gate',
    description: 'Evaluate proposed actions for risks before execution. Returns a GateReport with decision (ALLOW/BLOCK/DEGRADE/UNKNOWN).',
    inputSchema: {
      type: 'object',
      required: ['task', 'proposed_actions'],
      properties: {
        task: {
          type: 'string',
          description: 'Task description (what you want to do)'
        },
        context: {
          type: 'object',
          description: 'Optional context (e.g., evidence_provided array)',
          default: {}
        },
        proposed_actions: {
          type: 'array',
          description: 'Actions to evaluate (each with action_type, optionally tool/resource)',
          items: {
            type: 'object',
            required: ['action_type'],
            properties: {
              action_type: { type: 'string' },
              tool: { type: 'string' },
              resource: { type: 'string' }
            }
          }
        },
        trace_id: {
          type: 'string',
          description: 'Optional trace ID to append to existing trace'
        }
      }
    }
  },
  {
    name: 'governance_enforce',
    description: 'Check proposed actions against a contract. Returns EnforceResult with allowed/blocked actions.',
    inputSchema: {
      type: 'object',
      required: ['contract', 'actions'],
      properties: {
        trace_id: {
          type: 'string',
          description: 'Optional trace ID to append to existing trace'
        },
        contract: {
          type: 'object',
          description: 'Contract (v1 schema with version, scope, rules)',
          required: ['version', 'scope', 'rules'],
          properties: {
            version: { type: 'string' },
            scope: {
              type: 'object',
              properties: {
                name: { type: 'string' }
              }
            },
            rules: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'effect', 'rationale'],
                properties: {
                  id: { type: 'string' },
                  effect: { type: 'string', enum: ['ALLOW', 'DENY', 'DEGRADE', 'REQUIRE_EVIDENCE'] },
                  match: { type: 'object' },
                  rationale: { type: 'string' },
                  evidence_required: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        actions: {
          type: 'array',
          description: 'Actions to check against contract',
          items: {
            type: 'object',
            required: ['action_type'],
            properties: {
              action_type: { type: 'string' },
              tool: { type: 'string' },
              resource: { type: 'string' },
              path_prefix: { type: 'string' }
            }
          }
        }
      }
    }
  },
  {
    name: 'governance_verdict',
    description: 'Generate human-readable verdict from gate report and enforce result. Returns Verdict (v1 schema).',
    inputSchema: {
      type: 'object',
      required: ['gate_report'],
      properties: {
        trace_id: {
          type: 'string',
          description: 'Optional trace ID'
        },
        gate_report: {
          type: 'object',
          description: 'GateReport from governance_gate'
        },
        enforce_result: {
          type: 'object',
          description: 'Optional EnforceResult from governance_enforce'
        },
        notes: {
          type: 'string',
          description: 'Optional additional notes'
        }
      }
    }
  },
  {
    name: 'governance_replay',
    description: 'Verify a trace for integrity (schema, hash chain, structure). Returns ReplayResult with PASS/FAIL.',
    inputSchema: {
      type: 'object',
      required: ['trace_id'],
      properties: {
        trace_id: {
          type: 'string',
          description: 'Trace ID to verify'
        }
      }
    }
  }
];

/**
 * Get or create trace for a tool call
 *
 * NOTE: For v1, we always create a new trace. Trace continuation is complex
 * (requires preserving seq + lastHash) and not needed for MVP.
 *
 * @param {string} [traceId] - Optional trace ID hint (ignored for now)
 * @param {string} [baseDir] - Base directory for traces
 * @returns {TraceWriter}
 */
function getOrCreateTrace(traceId, baseDir = DEFAULT_TRACE_DIR) {
  // Always create new trace - continuation is complex and not needed for MVP
  return createTrace(undefined, baseDir);
}

/**
 * Tool handler: governance_gate
 *
 * @param {Object} input - Tool input
 * @param {string} input.task - Task description
 * @param {Object} [input.context] - Task context
 * @param {Array} input.proposed_actions - Proposed actions
 * @param {string} [input.trace_id] - Optional trace ID
 * @returns {Object} - Result with gate_report and trace_id
 */
export async function governanceGate(input) {
  const trace = getOrCreateTrace(input.trace_id);

  try {
    const gateInput = {
      task: input.task,
      context: input.context || {},
      proposed_actions: input.proposed_actions || []
    };

    // Run gate
    const gateReport = gate(gateInput, { trace });

    // Validate output
    const validation = validateGateReport(gateReport);
    if (!validation.valid) {
      return {
        error: 'GateReport validation failed',
        validation_errors: validation.errors,
        trace_id: trace.trace_id
      };
    }

    return {
      gate_report: gateReport,
      trace_id: trace.trace_id
    };
  } catch (err) {
    // Record error
    trace.append(TraceEventType.ERROR, {
      tool: 'governance_gate',
      error: err.message
    });

    return {
      error: err.message,
      trace_id: trace.trace_id
    };
  }
}

/**
 * Tool handler: governance_enforce
 *
 * @param {Object} input - Tool input
 * @param {string} [input.trace_id] - Optional trace ID
 * @param {Object} input.contract - Contract to enforce
 * @param {Array} input.actions - Actions to check
 * @returns {Object} - Result with enforce_result and trace_id
 */
export async function governanceEnforce(input) {
  const trace = getOrCreateTrace(input.trace_id);

  try {
    // Validate contract
    const contractValidation = validateContract(input.contract);
    if (!contractValidation.valid) {
      return {
        error: 'Contract validation failed',
        validation_errors: contractValidation.errors,
        trace_id: trace.trace_id
      };
    }

    // Run enforce
    const enforceResult = enforce(input.contract, input.actions || [], { trace });

    // Build result with required fields
    const result = {
      enforce_result: {
        contract_id: enforceResult.contract_id,
        decision_summary: enforceResult.decision_summary,
        blocked_rule_ids: enforceResult.blocked.map(b => b.rule_id).filter(Boolean),
        allowed_count: enforceResult.allowed.length,
        blocked_count: enforceResult.blocked.length,
        degraded_count: enforceResult.degraded.length,
        // Include full details
        allowed: enforceResult.allowed,
        blocked: enforceResult.blocked,
        degraded: enforceResult.degraded
      },
      trace_id: trace.trace_id
    };

    return result;
  } catch (err) {
    trace.append(TraceEventType.ERROR, {
      tool: 'governance_enforce',
      error: err.message
    });

    return {
      error: err.message,
      trace_id: trace.trace_id
    };
  }
}

/**
 * Tool handler: governance_verdict
 *
 * @param {Object} input - Tool input
 * @param {string} [input.trace_id] - Optional trace ID
 * @param {Object} input.gate_report - GateReport
 * @param {Object} [input.enforce_result] - Optional EnforceResult
 * @param {string} [input.notes] - Optional notes
 * @returns {Object} - Result with verdict and trace_id
 */
export async function governanceVerdict(input) {
  const trace = getOrCreateTrace(input.trace_id);

  try {
    // Generate verdict
    const verdict = generateVerdict(
      input.gate_report,
      input.enforce_result,
      { trace }
    );

    // Validate verdict
    const validation = validateVerdict(verdict);
    if (!validation.valid) {
      return {
        error: 'Verdict validation failed',
        validation_errors: validation.errors,
        trace_id: trace.trace_id
      };
    }

    // Write verdict files
    trace.writeFile('verdict.json', verdict);
    trace.writeFile('verdict.md', formatVerdictMarkdown(verdict));

    return {
      verdict,
      verdict_md: formatVerdictMarkdown(verdict),
      trace_id: trace.trace_id
    };
  } catch (err) {
    trace.append(TraceEventType.ERROR, {
      tool: 'governance_verdict',
      error: err.message
    });

    return {
      error: err.message,
      trace_id: trace.trace_id
    };
  }
}

/**
 * Tool handler: governance_replay
 *
 * @param {Object} input - Tool input
 * @param {string} input.trace_id - Trace ID to verify
 * @returns {Object} - Result with replay status and trace_id
 */
export async function governanceReplay(input) {
  const traceId = input.trace_id;

  // Check trace exists
  if (!traceExists(traceId)) {
    return {
      error: `Trace not found: ${traceId}`,
      trace_id: traceId
    };
  }

  try {
    // Run replay
    const replayResult = replay(traceId, {
      baseDir: DEFAULT_TRACE_DIR,
      writeResults: true
    });

    // Build result
    const result = {
      replay: {
        status: replayResult.status,
        pass: replayResult.status === ReplayStatus.PASS,
        event_count: replayResult.event_count,
        error_count: replayResult.errors.length,
        errors: replayResult.errors.slice(0, 10),
        checks: replayResult.checks
      },
      diff: replayResult.status === ReplayStatus.FAIL ? {
        error_count: replayResult.errors.length,
        errors: replayResult.errors.slice(0, 10)
      } : null,
      trace_id: traceId
    };

    return result;
  } catch (err) {
    return {
      error: err.message,
      trace_id: traceId
    };
  }
}

/**
 * Tool dispatcher - routes MCP tool calls to handlers
 *
 * @param {string} toolName - Tool name
 * @param {Object} input - Tool input
 * @returns {Promise<Object>} - Tool result
 */
export async function handleToolCall(toolName, input) {
  switch (toolName) {
    case 'governance_gate':
      return governanceGate(input);

    case 'governance_enforce':
      return governanceEnforce(input);

    case 'governance_verdict':
      return governanceVerdict(input);

    case 'governance_replay':
      return governanceReplay(input);

    default:
      return {
        error: `Unknown tool: ${toolName}`
      };
  }
}
