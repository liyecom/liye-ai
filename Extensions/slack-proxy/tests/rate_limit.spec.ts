/**
 * Rate Limit Tests
 *
 * Tests for Slack 429 backoff with Retry-After in SlackClient.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackClient } from '../src/slack/slack_client.js';

// We need to set up mocks before importing SlackClient
const mockChat = {
  postMessage: vi.fn(),
  update: vi.fn(),
};
const mockReactions = {
  add: vi.fn(),
  remove: vi.fn(),
};

vi.mock('@slack/web-api', () => {
  const MockWebClient = vi.fn(() => ({
    chat: mockChat,
    reactions: mockReactions,
  }));
  return {
    default: { WebClient: MockWebClient },
  };
});

vi.mock('../src/net/proxy.js', () => ({
  buildHttpAgent: vi.fn(() => undefined),
}));

describe('SlackClient rate limit handling', () => {
  let client: SlackClient;

  beforeEach(() => {
    vi.useFakeTimers();
    mockChat.postMessage.mockReset();
    mockChat.update.mockReset();
    mockReactions.add.mockReset();
    mockReactions.remove.mockReset();

    client = new SlackClient({ botToken: 'xoxb-test' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should succeed on first try when no rate limit', async () => {
    mockChat.postMessage.mockResolvedValueOnce({ ok: true, ts: '123.456', channel: 'C123' });

    const result = await client.postMessage('C123', 'hello');

    expect(result.ts).toBe('123.456');
    expect(mockChat.postMessage).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 rate limit with exponential backoff', async () => {
    const rateLimitError = new Error('ratelimited');

    mockChat.postMessage
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ ok: true, ts: '123.456', channel: 'C123' });

    const promise = client.postMessage('C123', 'hello');

    // Advance past backoff delay
    await vi.advanceTimersByTimeAsync(5000);

    const result = await promise;

    expect(result.ts).toBe('123.456');
    expect(mockChat.postMessage).toHaveBeenCalledTimes(2);
  });

  it('should respect Retry-After header from error', async () => {
    const rateLimitError = Object.assign(new Error('ratelimited'), {
      retryAfter: 5, // 5 seconds
    });

    mockChat.postMessage
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ ok: true, ts: '123.456', channel: 'C123' });

    const promise = client.postMessage('C123', 'hello');

    // Must wait for the Retry-After period (5s * 1000ms ± jitter)
    await vi.advanceTimersByTimeAsync(7000);

    const result = await promise;

    expect(result.ts).toBe('123.456');
    expect(mockChat.postMessage).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exhausted', async () => {
    const rateLimitError = new Error('ratelimited');

    // Fail all 4 attempts (1 initial + 3 retries)
    mockChat.postMessage
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError);

    // Start the call and immediately attach error handler to avoid unhandled rejection
    const promise = client.postMessage('C123', 'hello').catch((e) => e);

    // Advance through all backoff delays
    await vi.advanceTimersByTimeAsync(120000);

    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('ratelimited');
    expect(mockChat.postMessage).toHaveBeenCalledTimes(4); // 1 + MAX_RETRIES(3)
  });

  it('should not retry non-rate-limit errors', async () => {
    const authError = new Error('invalid_auth');

    mockChat.postMessage.mockRejectedValueOnce(authError);

    await expect(client.postMessage('C123', 'hello')).rejects.toThrow('invalid_auth');
    expect(mockChat.postMessage).toHaveBeenCalledTimes(1);
  });

  it('should handle updateMessage rate limits', async () => {
    const rateLimitError = new Error('rate_limited');

    mockChat.update
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ ok: true });

    const promise = client.updateMessage('C123', '123.456', 'updated');

    await vi.advanceTimersByTimeAsync(5000);

    await promise; // should not throw
    expect(mockChat.update).toHaveBeenCalledTimes(2);
  });

  it('should ignore already_reacted errors in addReaction', async () => {
    mockReactions.add.mockRejectedValueOnce(new Error('already_reacted'));

    // Should not throw
    await client.addReaction('C123', '123.456', 'thumbsup');
    expect(mockReactions.add).toHaveBeenCalledTimes(1);
  });

  it('should ignore no_reaction errors in removeReaction', async () => {
    mockReactions.remove.mockRejectedValueOnce(new Error('no_reaction'));

    // Should not throw
    await client.removeReaction('C123', '123.456', 'thumbsup');
    expect(mockReactions.remove).toHaveBeenCalledTimes(1);
  });
});
