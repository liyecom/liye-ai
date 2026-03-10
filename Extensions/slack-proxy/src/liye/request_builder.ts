/**
 * Request Builder
 *
 * Converts Slack message context to GovToolCallRequestV1.
 * Fixed capability: amazon://strategy/wasted-spend-detect
 *
 * Includes contract validation (fail-closed):
 * - Validates request against GovToolCallRequestV1 schema
 * - Throws immediately if validation fails
 */

import { generateIdempotencyKey, generateTraceId } from '../util/idempotency.js';
import { validateGovRequestV1, formatValidationError } from '../contracts/validate.js';

export interface SlackMessageContext {
  teamId: string;
  channelId: string;
  userId: string;
  messageTs: string;
  text: string;
}

export interface GovToolCallRequestV1 {
  version: 'GOV_TOOL_CALL_REQUEST_V1';
  trace_id: string;
  idempotency_key: string;
  tenant_id: string;
  task: string;
  policy_version: string;
  proposed_actions: Array<{
    action_type: 'read';
    tool: 'amazon://strategy/wasted-spend-detect';
    arguments: {
      start_date: string;
      end_date: string;
      min_spend?: number;
      min_clicks?: number;
      max_rows?: number;
    };
  }>;
  context: {
    source: 'openclaw';
    channel: 'slack';
    session_id: string;
    user_id: string;
    message_id: string;
  };
}

/**
 * Contract validation error.
 */
export class ContractValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
    public readonly traceId?: string
  ) {
    super(message);
    this.name = 'ContractValidationError';
  }
}

/**
 * Parse date range from user text.
 * Defaults to last 7 days if not specified.
 */
function parseDateRange(_text: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1); // Yesterday (data available)

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6); // 7 days total

  // TODO: Parse date range from text if specified
  // For M0, just use default 7 days

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Build GovToolCallRequestV1 from Slack message context.
 *
 * FAIL-CLOSED: Validates the request against the contract schema.
 * Throws ContractValidationError if validation fails.
 */
export function buildGovRequest(
  ctx: SlackMessageContext,
  policyVersion: string
): GovToolCallRequestV1 {
  const traceId = generateTraceId();
  const idempotencyKey = generateIdempotencyKey(ctx.teamId, ctx.channelId, ctx.messageTs);
  const { startDate, endDate } = parseDateRange(ctx.text);

  const request: GovToolCallRequestV1 = {
    version: 'GOV_TOOL_CALL_REQUEST_V1',
    trace_id: traceId,
    idempotency_key: idempotencyKey,
    tenant_id: `slack:${ctx.teamId}`,
    task: ctx.text,
    policy_version: policyVersion,
    proposed_actions: [
      {
        action_type: 'read',
        tool: 'amazon://strategy/wasted-spend-detect',
        arguments: {
          start_date: startDate,
          end_date: endDate,
          min_spend: 20.0,
          min_clicks: 10,
          max_rows: 50,
        },
      },
    ],
    context: {
      source: 'openclaw',
      channel: 'slack',
      session_id: `slack:${ctx.channelId}`,
      user_id: `slack:${ctx.userId}`,
      message_id: ctx.messageTs,
    },
  };

  // FAIL-CLOSED: Validate before returning
  const validation = validateGovRequestV1(request);
  if (!validation.ok) {
    throw new ContractValidationError(
      `Request contract validation failed: ${formatValidationError(validation, 'GovToolCallRequestV1')}`,
      validation.errors || [],
      traceId
    );
  }

  return request;
}

/**
 * Extract trace_id from a request (for error handling).
 */
export function extractTraceId(request: unknown): string | undefined {
  if (typeof request === 'object' && request !== null) {
    return (request as { trace_id?: string }).trace_id;
  }
  return undefined;
}
