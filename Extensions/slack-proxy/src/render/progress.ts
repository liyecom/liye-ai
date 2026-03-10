/**
 * Progress Renderer
 *
 * Converts StreamChunkV1 to concise Slack message updates.
 * Designed for single-line updates to minimize Slack API calls.
 *
 * Throttling is handled by src/util/throttle.ts (createChunkThrottler).
 */

import type { StreamChunkV1 } from '../liye/ws_client.js';

const PHASE_EMOJI: Record<string, string> = {
  gate: '🔒',
  enforce: '📜',
  route: '🔀',
  execute: '⚙️',
  verdict: '✅',
};

const PHASE_LABELS: Record<string, string> = {
  gate: 'Gate',
  enforce: 'Enforce',
  route: 'Route',
  execute: 'Execute',
  verdict: 'Verdict',
};

/**
 * Render a concise single-line progress from current chunk.
 * Format: "🔀 Route 50% · Processing..."
 */
export function renderProgressLine(chunk: StreamChunkV1): string {
  const emoji = PHASE_EMOJI[chunk.phase] || '❓';
  const label = PHASE_LABELS[chunk.phase] || chunk.phase;
  const progress = chunk.progress;

  // Get status message (prefer message over status)
  let status = '';
  if (chunk.data) {
    if (chunk.data.message) {
      status = ` · ${chunk.data.message}`;
    } else if (chunk.data.status) {
      status = ` · ${chunk.data.status}`;
    }
  }

  return `${emoji} ${label} ${progress}%${status}`;
}

/**
 * Render compact progress display with trace_id always visible.
 * Single-line format for efficient Slack updates.
 */
export function renderProgressDisplay(chunk: StreamChunkV1, traceId: string): string {
  const progressLine = renderProgressLine(chunk);
  return `*🤖 Processing...* ${progressLine}\n\`trace: ${traceId}\``;
}

/**
 * Render reconnection status message.
 */
export function renderReconnecting(attempt: number, maxAttempts: number, traceId: string): string {
  return `*🔄 Reconnecting...* (${attempt}/${maxAttempts})\n\`trace: ${traceId}\``;
}

/**
 * Build progress bar (for detailed views if needed).
 */
export function buildProgressBar(progress: number, width: number = 10): string {
  const filled = Math.floor(progress / (100 / width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}
