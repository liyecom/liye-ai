/**
 * Error Handling & Sanitization
 *
 * Converts internal errors to user-safe messages.
 * Ensures no sensitive data (tokens, secrets, credentials) is leaked.
 */

export interface UserSafeError {
  message: string;
  traceId?: string;
  code: string;
  canRetry: boolean;
}

/**
 * Sensitive patterns to redact from error messages.
 */
const SENSITIVE_PATTERNS = [
  // Slack tokens
  /xoxb-[a-zA-Z0-9-]+/gi,
  /xoxp-[a-zA-Z0-9-]+/gi,
  /xapp-[a-zA-Z0-9-]+/gi,
  /xoxa-[a-zA-Z0-9-]+/gi,

  // AWS/Amazon credentials
  /AKIA[A-Z0-9]{16}/gi,
  /aws_access_key_id\s*[=:]\s*\S+/gi,
  /aws_secret_access_key\s*[=:]\s*\S+/gi,

  // Generic secrets
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /api[_-]?key\s*[=:]\s*\S+/gi,
  /secret\s*[=:]\s*\S+/gi,
  /password\s*[=:]\s*\S+/gi,
  /token\s*[=:]\s*\S+/gi,

  // HMAC secrets
  /hmac[_-]?secret\s*[=:]\s*\S+/gi,

  // URLs with credentials
  /:[^:@\/\s]+@/g,
];

/**
 * Redact sensitive information from a string.
 */
export function redactSensitive(text: string): string {
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Convert an error to a user-safe format.
 */
export function toUserSafeError(error: unknown, traceId?: string): UserSafeError {
  const errorStr = error instanceof Error ? error.message : String(error);
  const sanitized = redactSensitive(errorStr);

  // Classify error type
  const { code, canRetry, userMessage } = classifyError(sanitized);

  return {
    message: userMessage,
    traceId,
    code,
    canRetry,
  };
}

/**
 * Classify error and determine retry behavior.
 */
function classifyError(message: string): {
  code: string;
  canRetry: boolean;
  userMessage: string;
} {
  const lower = message.toLowerCase();

  // Network/Connection errors (retryable)
  if (
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('enotfound') ||
    lower.includes('network')
  ) {
    return {
      code: 'NETWORK_ERROR',
      canRetry: true,
      userMessage: '网络连接错误。请稍后重试。',
    };
  }

  // Timeout errors (retryable)
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return {
      code: 'TIMEOUT',
      canRetry: true,
      userMessage: '请求超时。系统正在处理，请稍后查询结果。',
    };
  }

  // Rate limit errors (retryable after delay)
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
    return {
      code: 'RATE_LIMITED',
      canRetry: true,
      userMessage: '请求过于频繁。请稍后再试。',
    };
  }

  // Authentication errors (not retryable)
  if (
    lower.includes('unauthorized') ||
    lower.includes('authentication') ||
    lower.includes('invalid token') ||
    lower.includes('403')
  ) {
    return {
      code: 'AUTH_ERROR',
      canRetry: false,
      userMessage: '认证失败。请联系管理员。',
    };
  }

  // Contract validation errors (not retryable)
  if (lower.includes('contract') || lower.includes('validation')) {
    return {
      code: 'CONTRACT_INVALID',
      canRetry: false,
      userMessage: '请求格式错误。请联系支持团队。',
    };
  }

  // WebSocket specific errors (retryable)
  if (lower.includes('websocket') || lower.includes('ws')) {
    return {
      code: 'WS_ERROR',
      canRetry: true,
      userMessage: '连接中断。正在尝试重连...',
    };
  }

  // Generic server errors (potentially retryable)
  if (lower.includes('500') || lower.includes('502') || lower.includes('503')) {
    return {
      code: 'SERVER_ERROR',
      canRetry: true,
      userMessage: '服务暂时不可用。请稍后重试。',
    };
  }

  // Unknown error
  return {
    code: 'UNKNOWN',
    canRetry: false,
    userMessage: '发生未知错误。请联系支持团队。',
  };
}

/**
 * Format error for Slack display.
 */
export function formatSlackError(error: UserSafeError): string {
  const parts = [
    `❌ *错误*: ${error.message}`,
  ];

  if (error.traceId) {
    parts.push(`📋 *Trace ID*: \`${error.traceId}\``);
    parts.push(`💡 使用 trace ID 可查询详细状态`);
  }

  if (error.canRetry) {
    parts.push(`🔄 可以稍后重试`);
  }

  return parts.join('\n');
}

/**
 * Create a structured log entry (safe for logging).
 */
export function createLogEntry(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: Record<string, unknown> = {}
): Record<string, unknown> {
  // Sanitize all string values in context
  const sanitizedContext: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string') {
      sanitizedContext[key] = redactSensitive(value);
    } else {
      sanitizedContext[key] = value;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    level,
    message: redactSensitive(message),
    ...sanitizedContext,
  };
}

/**
 * Log with trace_id context.
 */
export function logWithTrace(
  level: 'info' | 'warn' | 'error',
  traceId: string,
  message: string,
  context: Record<string, unknown> = {}
): void {
  const entry = createLogEntry(level, message, { trace_id: traceId, ...context });
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logFn(JSON.stringify(entry));
}
