/**
 * Idempotency Key Generation
 *
 * Generates unique keys for request deduplication.
 */

import { randomUUID } from 'crypto';

/**
 * Generate an idempotency key from Slack message context.
 * Format: slack:{team_id}:{channel_id}:{message_ts}
 */
export function generateIdempotencyKey(
  teamId: string,
  channelId: string,
  messageTs: string
): string {
  return `slack:${teamId}:${channelId}:${messageTs}`;
}

/**
 * Generate a trace ID.
 * Format: trace-{uuid}
 */
export function generateTraceId(): string {
  return `trace-${randomUUID()}`;
}
