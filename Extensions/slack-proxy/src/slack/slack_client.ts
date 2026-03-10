/**
 * Slack Client
 *
 * Wrapper for Slack Web API operations with:
 * - Proxy support (HTTP_PROXY/HTTPS_PROXY)
 * - Rate limit backoff (429 Retry-After)
 * - Message posting, updating, and reactions
 */

import webApi from '@slack/web-api';
const { WebClient } = webApi;
type WebClientOptions = ConstructorParameters<typeof WebClient>[1];
import type { ProxyEnv } from '../net/proxy.js';
import { buildHttpAgent } from '../net/proxy.js';
import { logWithTrace } from '../util/errors.js';

export interface SlackClientConfig {
  botToken: string;
  proxy?: ProxyEnv;
}

// Rate limit constants
const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

export class SlackClient {
  private web: InstanceType<typeof WebClient>;
  private traceId: string = '';

  constructor(config: SlackClientConfig) {
    const options: WebClientOptions = {};

    // Configure proxy agent for Slack API (HTTPS)
    if (config.proxy) {
      const agent = buildHttpAgent('https://slack.com', config.proxy);
      if (agent) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (options as any).agent = agent;
      }
    }

    this.web = new WebClient(config.botToken, options);
  }

  /**
   * Set trace ID for logging context.
   */
  setTraceId(traceId: string): void {
    this.traceId = traceId;
  }

  /**
   * Post a new message to a channel.
   */
  async postMessage(
    channel: string,
    text: string,
    threadTs?: string
  ): Promise<{ ts: string; channel: string }> {
    return this.requestWithBackoff(async () => {
      const result = await this.web.chat.postMessage({
        channel,
        text,
        thread_ts: threadTs,
      });

      if (!result.ok || !result.ts) {
        throw new Error(`Failed to post message: ${result.error}`);
      }

      return {
        ts: result.ts,
        channel: result.channel as string,
      };
    });
  }

  /**
   * Update an existing message.
   */
  async updateMessage(
    channel: string,
    ts: string,
    text: string
  ): Promise<void> {
    return this.requestWithBackoff(async () => {
      const result = await this.web.chat.update({
        channel,
        ts,
        text,
      });

      if (!result.ok) {
        throw new Error(`Failed to update message: ${result.error}`);
      }
    });
  }

  /**
   * Add a reaction to a message.
   */
  async addReaction(
    channel: string,
    ts: string,
    emoji: string
  ): Promise<void> {
    try {
      await this.requestWithBackoff(async () => {
        await this.web.reactions.add({
          channel,
          timestamp: ts,
          name: emoji,
        });
      });
    } catch (error) {
      // Ignore "already_reacted" errors
      const errorStr = String(error);
      if (!errorStr.includes('already_reacted')) {
        throw error;
      }
    }
  }

  /**
   * Remove a reaction from a message.
   */
  async removeReaction(
    channel: string,
    ts: string,
    emoji: string
  ): Promise<void> {
    try {
      await this.requestWithBackoff(async () => {
        await this.web.reactions.remove({
          channel,
          timestamp: ts,
          name: emoji,
        });
      });
    } catch (error) {
      // Ignore "no_reaction" errors
      const errorStr = String(error);
      if (!errorStr.includes('no_reaction')) {
        throw error;
      }
    }
  }

  /**
   * Execute a request with automatic backoff on rate limit (429).
   */
  private async requestWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let retryDelay = DEFAULT_RETRY_DELAY_MS;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorStr = String(error);

        // Check for rate limit error
        if (this.isRateLimitError(errorStr)) {
          const retryAfter = this.extractRetryAfter(error);
          // Prefer Retry-After, fallback to exponential backoff
          const baseDelay = retryAfter || Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
          // Add ±20% jitter to avoid thundering herd
          retryDelay = this.addJitter(baseDelay, 0.2);

          if (attempt < MAX_RETRIES) {
            logWithTrace('warn', this.traceId, `Slack rate limited, retrying after ${retryDelay}ms`, {
              attempt: attempt + 1,
              maxRetries: MAX_RETRIES,
              retryAfterHeader: retryAfter ? 'yes' : 'no',
            });
            await this.sleep(retryDelay);
            continue;
          }
        }

        // Non-retryable error or max retries reached
        throw lastError;
      }
    }

    throw lastError || new Error('Request failed after max retries');
  }

  /**
   * Check if error is a rate limit error.
   */
  private isRateLimitError(errorStr: string): boolean {
    return (
      errorStr.includes('ratelimited') ||
      errorStr.includes('rate_limited') ||
      errorStr.includes('429') ||
      errorStr.includes('too_many_requests')
    );
  }

  /**
   * Extract Retry-After value from error (in milliseconds).
   */
  private extractRetryAfter(error: unknown): number | null {
    // Slack errors may include retryAfter in the error object
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      if (typeof err.retryAfter === 'number') {
        return err.retryAfter * 1000; // Convert seconds to ms
      }
      if (err.data && typeof err.data === 'object') {
        const data = err.data as Record<string, unknown>;
        if (typeof data.retry_after === 'number') {
          return data.retry_after * 1000;
        }
      }
    }
    return null;
  }

  /**
   * Add jitter to a delay value (±percentage).
   */
  private addJitter(baseMs: number, jitterFraction: number): number {
    const jitter = baseMs * jitterFraction * (Math.random() * 2 - 1);
    return Math.max(100, Math.round(baseMs + jitter)); // Min 100ms
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
