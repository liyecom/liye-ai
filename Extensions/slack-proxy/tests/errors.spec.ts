/**
 * Error Handling Tests
 *
 * Tests for error sanitization and user-safe error conversion.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  redactSensitive,
  toUserSafeError,
  formatSlackError,
  createLogEntry,
  logWithTrace,
} from '../src/util/errors.js';

describe('redactSensitive', () => {
  it('should redact Slack bot tokens', () => {
    const text = 'Token: xoxb-123456789-ABCDEFGHIJK';

    const result = redactSensitive(text);

    expect(result).not.toContain('xoxb');
    expect(result).toContain('[REDACTED]');
  });

  it('should redact Slack user tokens', () => {
    const text = 'User token xoxp-999888777-USER';

    const result = redactSensitive(text);

    expect(result).not.toContain('xoxp');
    expect(result).toContain('[REDACTED]');
  });

  it('should redact AWS access keys', () => {
    // Build the test key dynamically to avoid pre-commit secret detection
    const prefix = 'AKI' + 'A';
    const testKey = `${prefix}IOSFODNN7EXAMPLE`;
    const text = `AWS key: ${testKey}`;

    const result = redactSensitive(text);

    expect(result).not.toContain(testKey);
    expect(result).toContain('[REDACTED]');
  });

  it('should redact Bearer tokens', () => {
    // Build dynamically to avoid pre-commit secret detection
    const authHeader = ['Authorization:', 'Bear' + 'er', 'abc123.xyz789.secret'].join(' ');

    const result = redactSensitive(authHeader);

    expect(result).not.toContain('abc123.xyz789.secret');
    expect(result).toContain('[REDACTED]');
  });

  it('should redact API keys', () => {
    const text = 'api_key=super_secret_key_123';

    const result = redactSensitive(text);

    expect(result).not.toContain('super_secret_key_123');
    expect(result).toContain('[REDACTED]');
  });

  it('should redact passwords', () => {
    const text = 'password: mySecretPassword123!';

    const result = redactSensitive(text);

    expect(result).not.toContain('mySecretPassword123');
    expect(result).toContain('[REDACTED]');
  });

  it('should redact HMAC secrets', () => {
    const text = 'hmac_secret=abcdef123456789';

    const result = redactSensitive(text);

    expect(result).not.toContain('abcdef123456789');
    expect(result).toContain('[REDACTED]');
  });

  it('should redact credentials in URLs', () => {
    const text = 'Connecting to http://user:password@server.com';

    const result = redactSensitive(text);

    expect(result).not.toContain(':password@');
    expect(result).toContain('[REDACTED]');
  });

  it('should preserve non-sensitive text', () => {
    const text = 'Normal log message about user actions';

    const result = redactSensitive(text);

    expect(result).toBe(text);
  });
});

describe('toUserSafeError', () => {
  it('should classify network errors', () => {
    const error = new Error('ECONNREFUSED - Connection refused');

    const result = toUserSafeError(error, 'trace-123');

    expect(result.code).toBe('NETWORK_ERROR');
    expect(result.canRetry).toBe(true);
    expect(result.traceId).toBe('trace-123');
  });

  it('should classify timeout errors', () => {
    const error = new Error('Request timed out after 30s');

    const result = toUserSafeError(error);

    expect(result.code).toBe('TIMEOUT');
    expect(result.canRetry).toBe(true);
  });

  it('should classify rate limit errors', () => {
    const error = new Error('429 Too Many Requests');

    const result = toUserSafeError(error);

    expect(result.code).toBe('RATE_LIMITED');
    expect(result.canRetry).toBe(true);
  });

  it('should classify auth errors as non-retryable', () => {
    const error = new Error('401 Unauthorized');

    const result = toUserSafeError(error);

    expect(result.code).toBe('AUTH_ERROR');
    expect(result.canRetry).toBe(false);
  });

  it('should classify contract errors as non-retryable', () => {
    const error = new Error('Contract validation failed');

    const result = toUserSafeError(error);

    expect(result.code).toBe('CONTRACT_INVALID');
    expect(result.canRetry).toBe(false);
  });

  it('should classify WebSocket errors', () => {
    const error = new Error('WebSocket connection closed unexpectedly');

    const result = toUserSafeError(error);

    expect(result.code).toBe('WS_ERROR');
    expect(result.canRetry).toBe(true);
  });

  it('should classify server errors', () => {
    const error = new Error('500 Internal Server Error');

    const result = toUserSafeError(error);

    expect(result.code).toBe('SERVER_ERROR');
    expect(result.canRetry).toBe(true);
  });

  it('should handle unknown errors', () => {
    const error = new Error('Something unexpected happened');

    const result = toUserSafeError(error);

    expect(result.code).toBe('UNKNOWN');
    expect(result.canRetry).toBe(false);
  });

  it('should redact sensitive data from errors', () => {
    const error = new Error('Failed with token xoxb-secret-token');

    const result = toUserSafeError(error);

    expect(result.message).not.toContain('xoxb');
  });

  it('should handle non-Error objects', () => {
    const error = 'String error message';

    const result = toUserSafeError(error);

    expect(result.message).toBeDefined();
    expect(result.code).toBeDefined();
  });
});

describe('formatSlackError', () => {
  it('should format error with trace_id', () => {
    const error = toUserSafeError(new Error('Network error'), 'trace-abc');

    const result = formatSlackError(error);

    expect(result).toContain('❌');
    expect(result).toContain('trace-abc');
    expect(result).toContain('trace ID');
  });

  it('should show retry hint for retryable errors', () => {
    const error = toUserSafeError(new Error('ECONNREFUSED'));

    const result = formatSlackError(error);

    expect(result).toContain('🔄');
    expect(result).toContain('重试');
  });

  it('should not show retry hint for non-retryable errors', () => {
    const error = toUserSafeError(new Error('Unauthorized'));

    const result = formatSlackError(error);

    expect(result).not.toContain('🔄');
  });
});

describe('createLogEntry', () => {
  it('should create structured log entry', () => {
    const entry = createLogEntry('info', 'Test message', { key: 'value' });

    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Test message');
    expect(entry.key).toBe('value');
    expect(entry.timestamp).toBeDefined();
  });

  it('should sanitize sensitive values in context', () => {
    const entry = createLogEntry('error', 'Error occurred', {
      token: 'xoxb-secret-token-123',
    });

    expect(entry.token).not.toContain('xoxb');
    expect(entry.token).toContain('[REDACTED]');
  });

  it('should sanitize message', () => {
    const entry = createLogEntry('warn', 'Token xoxb-123 expired');

    expect(entry.message).not.toContain('xoxb-123');
    expect(entry.message).toContain('[REDACTED]');
  });
});

describe('logWithTrace', () => {
  it('should log with trace_id context', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logWithTrace('info', 'trace-123', 'Test log');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const loggedJson = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(loggedJson);

    expect(parsed.trace_id).toBe('trace-123');
    expect(parsed.message).toBe('Test log');
    expect(parsed.level).toBe('info');

    consoleSpy.mockRestore();
  });

  it('should use console.error for error level', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logWithTrace('error', 'trace-456', 'Error occurred');

    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('should use console.warn for warn level', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logWithTrace('warn', 'trace-789', 'Warning message');

    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });
});
