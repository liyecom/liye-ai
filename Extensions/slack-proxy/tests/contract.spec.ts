/**
 * Contract Validation Tests
 *
 * Tests for GovToolCallRequestV1 and StreamChunkV1 validation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateGovRequestV1,
  validateStreamChunkV1,
  formatValidationError,
} from '../src/contracts/validate.js';

describe('validateGovRequestV1', () => {
  const validRequest = {
    version: 'GOV_TOOL_CALL_REQUEST_V1',
    trace_id: 'trace-abc123',
    idempotency_key: 'idem-xyz789',
    tenant_id: 'slack:T123456',
    task: 'Analyze wasted spend',
    policy_version: 'phase1-v1.0.0',
    proposed_actions: [
      {
        action_type: 'read',
        tool: 'amazon://strategy/wasted-spend-detect',
        arguments: {
          start_date: '2026-02-01',
          end_date: '2026-02-22',
        },
      },
    ],
    context: {
      source: 'openclaw',
      channel: 'slack',
      session_id: 'slack:C123',
      user_id: 'slack:U456',
      message_id: '1234567890.123456',
    },
  };

  it('should pass valid request', () => {
    const result = validateGovRequestV1(validRequest);

    expect(result.ok).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should fail on null input', () => {
    const result = validateGovRequestV1(null);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Request must be an object');
  });

  it('should fail on missing version', () => {
    const invalid = { ...validRequest };
    delete (invalid as Record<string, unknown>).version;

    const result = validateGovRequestV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Missing required field: version');
  });

  it('should fail on wrong version', () => {
    const invalid = { ...validRequest, version: 'WRONG_VERSION' };

    const result = validateGovRequestV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('Invalid version');
  });

  it('should fail on empty trace_id', () => {
    const invalid = { ...validRequest, trace_id: '' };

    const result = validateGovRequestV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('trace_id must be a non-empty string');
  });

  it('should fail on invalid policy_version format', () => {
    const invalid = { ...validRequest, policy_version: 'invalid-format' };

    const result = validateGovRequestV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('Invalid policy_version format');
  });

  it('should fail on multiple proposed_actions', () => {
    const invalid = {
      ...validRequest,
      proposed_actions: [
        validRequest.proposed_actions[0],
        validRequest.proposed_actions[0],
      ],
    };

    const result = validateGovRequestV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('proposed_actions must have exactly 1 item');
  });

  it('should fail on wrong action_type', () => {
    const invalid = {
      ...validRequest,
      proposed_actions: [
        { ...validRequest.proposed_actions[0], action_type: 'write' },
      ],
    };

    const result = validateGovRequestV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('Invalid action_type');
  });

  it('should fail on wrong tool', () => {
    const invalid = {
      ...validRequest,
      proposed_actions: [
        { ...validRequest.proposed_actions[0], tool: 'wrong://tool' },
      ],
    };

    const result = validateGovRequestV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('Invalid tool');
  });

  it('should fail on invalid date format', () => {
    const invalid = {
      ...validRequest,
      proposed_actions: [
        {
          ...validRequest.proposed_actions[0],
          arguments: { start_date: '02-01-2026', end_date: '2026-02-22' },
        },
      ],
    };

    const result = validateGovRequestV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('start_date must be a valid date string');
  });

  it('should fail on wrong context.source', () => {
    const invalid = {
      ...validRequest,
      context: { ...validRequest.context, source: 'other' },
    };

    const result = validateGovRequestV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('Invalid context.source');
  });

  it('should fail on wrong context.channel', () => {
    const invalid = {
      ...validRequest,
      context: { ...validRequest.context, channel: 'discord' },
    };

    const result = validateGovRequestV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('Invalid context.channel');
  });
});

describe('validateStreamChunkV1', () => {
  const validChunk = {
    version: 'STREAM_CHUNK_V1',
    type: 'chunk',
    trace_id: 'trace-abc123',
    phase: 'execute',
    progress: 50,
  };

  it('should pass valid chunk', () => {
    const result = validateStreamChunkV1(validChunk);

    expect(result.ok).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should pass valid chunk with data', () => {
    const chunk = { ...validChunk, data: { status: 'running' } };

    const result = validateStreamChunkV1(chunk);

    expect(result.ok).toBe(true);
  });

  it('should fail on null input', () => {
    const result = validateStreamChunkV1(null);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Chunk must be an object');
  });

  it('should fail on wrong version', () => {
    const invalid = { ...validChunk, version: 'WRONG' };

    const result = validateStreamChunkV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('Invalid version');
  });

  it('should fail on invalid type', () => {
    const invalid = { ...validChunk, type: 'invalid' };

    const result = validateStreamChunkV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('Invalid type');
  });

  it('should pass complete type', () => {
    const chunk = { ...validChunk, type: 'complete', progress: 100 };

    const result = validateStreamChunkV1(chunk);

    expect(result.ok).toBe(true);
  });

  it('should pass error type', () => {
    const chunk = { ...validChunk, type: 'error', data: { error: 'failed' } };

    const result = validateStreamChunkV1(chunk);

    expect(result.ok).toBe(true);
  });

  it('should fail on empty trace_id', () => {
    const invalid = { ...validChunk, trace_id: '' };

    const result = validateStreamChunkV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('trace_id must be a non-empty string');
  });

  it('should fail on invalid phase', () => {
    const invalid = { ...validChunk, phase: 'invalid_phase' };

    const result = validateStreamChunkV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('Invalid phase');
  });

  it('should fail on progress out of range', () => {
    const invalid = { ...validChunk, progress: 150 };

    const result = validateStreamChunkV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('progress must be between 0 and 100');
  });

  it('should fail on negative progress', () => {
    const invalid = { ...validChunk, progress: -10 };

    const result = validateStreamChunkV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain('progress must be between 0 and 100');
  });

  it('should fail on non-object data', () => {
    const invalid = { ...validChunk, data: 'string' };

    const result = validateStreamChunkV1(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('data must be an object if present');
  });
});

describe('formatValidationError', () => {
  it('should return empty string for valid result', () => {
    const result = formatValidationError({ ok: true }, 'Test');

    expect(result).toBe('');
  });

  it('should format errors with context', () => {
    const result = formatValidationError(
      { ok: false, errors: ['Error 1', 'Error 2'] },
      'GovRequestV1'
    );

    expect(result).toContain('Contract validation failed (GovRequestV1)');
    expect(result).toContain('Error 1');
    expect(result).toContain('Error 2');
  });
});
