/**
 * Contract Validation (Fail-Closed)
 *
 * Validates GovToolCallRequestV1 and StreamChunkV1 against contracts.
 * Invalid data causes immediate failure (fail-closed).
 *
 * Forward Compatibility:
 * - Only validates required/known fields
 * - Unknown additional fields are allowed (not rejected)
 * - This enables rolling upgrades without breaking older clients
 */

export interface ValidationResult {
  ok: boolean;
  errors?: string[];
}

/**
 * Validate GovToolCallRequestV1 against the contract schema.
 * Fail-closed: Returns errors if validation fails.
 */
export function validateGovRequestV1(obj: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof obj !== 'object' || obj === null) {
    return { ok: false, errors: ['Request must be an object'] };
  }

  const req = obj as Record<string, unknown>;

  // Required fields
  const requiredFields = [
    'version',
    'trace_id',
    'idempotency_key',
    'tenant_id',
    'task',
    'policy_version',
    'proposed_actions',
    'context',
  ];

  for (const field of requiredFields) {
    if (!(field in req)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Version must be exact
  if (req.version !== 'GOV_TOOL_CALL_REQUEST_V1') {
    errors.push(`Invalid version: expected GOV_TOOL_CALL_REQUEST_V1, got ${req.version}`);
  }

  // Validate trace_id format
  if (typeof req.trace_id !== 'string' || !req.trace_id) {
    errors.push('trace_id must be a non-empty string');
  }

  // Validate idempotency_key
  if (typeof req.idempotency_key !== 'string' || !req.idempotency_key) {
    errors.push('idempotency_key must be a non-empty string');
  }

  // Validate tenant_id
  if (typeof req.tenant_id !== 'string' || !req.tenant_id) {
    errors.push('tenant_id must be a non-empty string');
  }

  // Validate task
  if (typeof req.task !== 'string') {
    errors.push('task must be a string');
  }

  // Validate policy_version format
  if (typeof req.policy_version !== 'string') {
    errors.push('policy_version must be a string');
  } else if (!/^phase[0-9]+-v[0-9]+\.[0-9]+\.[0-9]+$/.test(req.policy_version)) {
    errors.push(`Invalid policy_version format: ${req.policy_version}`);
  }

  // Validate proposed_actions
  if (!Array.isArray(req.proposed_actions)) {
    errors.push('proposed_actions must be an array');
  } else if (req.proposed_actions.length !== 1) {
    errors.push(`proposed_actions must have exactly 1 item, got ${req.proposed_actions.length}`);
  } else {
    const action = req.proposed_actions[0] as Record<string, unknown>;
    if (typeof action !== 'object' || action === null) {
      errors.push('proposed_actions[0] must be an object');
    } else {
      if (action.action_type !== 'read') {
        errors.push(`Invalid action_type: expected read, got ${action.action_type}`);
      }
      if (action.tool !== 'amazon://strategy/wasted-spend-detect') {
        errors.push(`Invalid tool: expected amazon://strategy/wasted-spend-detect, got ${action.tool}`);
      }
      if (typeof action.arguments !== 'object' || action.arguments === null) {
        errors.push('arguments must be an object');
      } else {
        const args = action.arguments as Record<string, unknown>;
        if (!isValidDateString(args.start_date)) {
          errors.push('arguments.start_date must be a valid date string (YYYY-MM-DD)');
        }
        if (!isValidDateString(args.end_date)) {
          errors.push('arguments.end_date must be a valid date string (YYYY-MM-DD)');
        }
      }
    }
  }

  // Validate context
  if (typeof req.context !== 'object' || req.context === null) {
    errors.push('context must be an object');
  } else {
    const ctx = req.context as Record<string, unknown>;
    const ctxRequiredFields = ['source', 'channel', 'session_id', 'user_id', 'message_id'];
    for (const field of ctxRequiredFields) {
      if (!(field in ctx)) {
        errors.push(`Missing context.${field}`);
      }
    }
    if (ctx.source !== 'openclaw') {
      errors.push(`Invalid context.source: expected openclaw, got ${ctx.source}`);
    }
    if (ctx.channel !== 'slack') {
      errors.push(`Invalid context.channel: expected slack, got ${ctx.channel}`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * Validate StreamChunkV1 against the contract schema.
 * Fail-closed: Returns errors if validation fails.
 */
export function validateStreamChunkV1(obj: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof obj !== 'object' || obj === null) {
    return { ok: false, errors: ['Chunk must be an object'] };
  }

  const chunk = obj as Record<string, unknown>;

  // Required fields
  const requiredFields = ['version', 'type', 'trace_id', 'phase', 'progress'];
  for (const field of requiredFields) {
    if (!(field in chunk)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Version must be exact
  if (chunk.version !== 'STREAM_CHUNK_V1') {
    errors.push(`Invalid version: expected STREAM_CHUNK_V1, got ${chunk.version}`);
  }

  // Validate type
  const validTypes = ['chunk', 'complete', 'error'];
  if (!validTypes.includes(chunk.type as string)) {
    errors.push(`Invalid type: expected one of ${validTypes.join(', ')}, got ${chunk.type}`);
  }

  // Validate trace_id
  if (typeof chunk.trace_id !== 'string' || !chunk.trace_id) {
    errors.push('trace_id must be a non-empty string');
  }

  // Validate phase
  const validPhases = ['gate', 'enforce', 'route', 'execute', 'verdict'];
  if (!validPhases.includes(chunk.phase as string)) {
    errors.push(`Invalid phase: expected one of ${validPhases.join(', ')}, got ${chunk.phase}`);
  }

  // Validate progress
  if (typeof chunk.progress !== 'number') {
    errors.push('progress must be a number');
  } else if (chunk.progress < 0 || chunk.progress > 100) {
    errors.push(`progress must be between 0 and 100, got ${chunk.progress}`);
  }

  // Optional data field
  if ('data' in chunk && chunk.data !== null && typeof chunk.data !== 'object') {
    errors.push('data must be an object if present');
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * Helper: Check if a value is a valid date string (YYYY-MM-DD).
 */
function isValidDateString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Create a contract validation error for logging.
 */
export function formatValidationError(result: ValidationResult, context: string): string {
  if (result.ok) return '';
  return `Contract validation failed (${context}):\n  - ${result.errors?.join('\n  - ')}`;
}
