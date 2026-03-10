/**
 * Slack Socket Mode Handler
 *
 * Connects to Slack via Socket Mode and dispatches events.
 * Uses structured logging with error sanitization.
 */

import bolt from '@slack/bolt';
const { App } = bolt;
import type { EnvConfig } from '../env.js';
import { SlackClient } from './slack_client.js';
import { buildGovRequest, type SlackMessageContext } from '../liye/request_builder.js';
import { governedToolCallStream, type LiYeWsClientConfig, type StreamChunkV1, type StreamCallbacks } from '../liye/ws_client.js';
import { renderProgressDisplay, renderReconnecting } from '../render/progress.js';
import { renderFinalResult, renderError, type GovToolCallResponseV1 } from '../render/final.js';
import { logWithTrace } from '../util/errors.js';
import { createChunkThrottler, loadThrottleConfig } from '../util/throttle.js';

export interface SocketModeConfig {
  env: EnvConfig;
}

/**
 * Create and start the Slack Socket Mode app.
 */
export async function createSocketModeApp(config: SocketModeConfig): Promise<InstanceType<typeof App>> {
  const { env } = config;

  // Initialize Bolt app with Socket Mode
  const app = new App({
    token: env.slackBotToken,
    appToken: env.slackAppToken,
    socketMode: true,
  });

  // Initialize Slack client for message updates
  const slackClient = new SlackClient({ botToken: env.slackBotToken });

  // LiYe WS client config
  const wsConfig: LiYeWsClientConfig = {
    wsUrl: env.liyeGatewayWs,
    hmacSecret: env.liyeHmacSecret,
    timeoutMs: 360000, // 6 minutes (AGE report can take up to 300s)
    maxReconnects: 3,
  };

  // Listen to all messages mentioning the bot
  app.event('app_mention', async ({ event, say }) => {
    await handleMessage(event, say, slackClient, wsConfig, env.liyePolicyVersion);
  });

  // Listen to direct messages
  app.event('message', async ({ event, say }) => {
    // Only handle DMs (channel type 'im')
    if ('channel_type' in event && event.channel_type === 'im') {
      // Filter out bot messages and message edits to prevent infinite loop
      if ('bot_id' in event || 'subtype' in event) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handleMessage(event as any, say, slackClient, wsConfig, env.liyePolicyVersion);
    }
  });

  return app;
}

/**
 * Handle incoming message and process via LiYe Gateway.
 */
async function handleMessage(
  event: {
    text?: string;
    user?: string;
    channel: string;
    ts: string;
    team?: string;
  },
  say: (message: string) => Promise<unknown>,
  slackClient: SlackClient,
  wsConfig: LiYeWsClientConfig,
  policyVersion: string
): Promise<void> {
  const text = event.text || '';
  const userId = event.user || 'unknown';
  const channelId = event.channel;
  const messageTs = event.ts;
  const teamId = event.team || 'unknown';

  // Build Slack message context
  const ctx: SlackMessageContext = {
    teamId,
    channelId,
    userId,
    messageTs,
    text,
  };

  // Build governance request
  const govRequest = buildGovRequest(ctx, policyVersion);
  const traceId = govRequest.trace_id;

  // Set trace ID for Slack client logging
  slackClient.setTraceId(traceId);

  logWithTrace('info', traceId, 'Processing Slack message', {
    channel_id: channelId,
    user_id: userId,
  });

  // Post initial placeholder message
  let statusMessage: { ts: string; channel: string };
  try {
    statusMessage = await slackClient.postMessage(
      channelId,
      `*🤖 Processing your request...*\n\`trace: ${traceId}\``,
      messageTs // Reply in thread
    );
  } catch (error) {
    logWithTrace('error', traceId, 'Failed to post initial message', {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  // Initialize throttler for this job
  const throttleConfig = loadThrottleConfig();
  const throttler = createChunkThrottler(throttleConfig);

  let finalResponse: GovToolCallResponseV1 | null = null;

  try {
    // Add processing reaction
    await slackClient.addReaction(channelId, messageTs, 'hourglass_flowing_sand');

    // Stream callbacks with throttled updates
    const callbacks: StreamCallbacks = {
      onChunk: async (chunk: StreamChunkV1) => {
        // Handle complete chunk
        if (chunk.type === 'complete' && chunk.data) {
          finalResponse = chunk.data as unknown as GovToolCallResponseV1;
          return;
        }

        // Handle error chunk
        if (chunk.type === 'error') {
          throw new Error(chunk.data?.error as string || 'Stream error');
        }

        // Throttle progress updates (only for 'chunk' type at this point)
        const decision = throttler.decide({
          traceId,
          phase: chunk.phase,
          progress: chunk.progress,
          isFinal: false,
        });

        if (decision.shouldUpdate) {
          try {
            const progressText = renderProgressDisplay(chunk, traceId);
            await slackClient.updateMessage(statusMessage.channel, statusMessage.ts, progressText);
          } catch (updateError) {
            logWithTrace('warn', traceId, 'Failed to update progress', {
              error: updateError instanceof Error ? updateError.message : String(updateError),
              reason: decision.reason,
            });
          }
        }
      },

      onReconnecting: async (attempt: number, maxAttempts: number) => {
        try {
          const reconnectText = renderReconnecting(attempt, maxAttempts, traceId);
          await slackClient.updateMessage(statusMessage.channel, statusMessage.ts, reconnectText);
        } catch {
          logWithTrace('warn', traceId, 'Failed to update reconnect status');
        }
      },

      onError: async (error: Error, errorTraceId: string) => {
        logWithTrace('error', errorTraceId, 'Stream error after retries', {
          error: error.message,
        });
      },
    };

    // Stream from LiYe Gateway
    await governedToolCallStream(wsConfig, govRequest, callbacks);

    // Render final result
    // Note: finalResponse is set in async callback, TypeScript can't track this
    const response = finalResponse as GovToolCallResponseV1 | null;
    if (response) {
      const finalText = renderFinalResult(response);
      await slackClient.updateMessage(statusMessage.channel, statusMessage.ts, finalText);

      // Update reaction based on decision
      await slackClient.removeReaction(channelId, messageTs, 'hourglass_flowing_sand');
      if (response.decision === 'ALLOW') {
        await slackClient.addReaction(channelId, messageTs, 'white_check_mark');
      } else if (response.decision === 'BLOCK') {
        await slackClient.addReaction(channelId, messageTs, 'no_entry');
      } else {
        await slackClient.addReaction(channelId, messageTs, 'warning');
      }
    }

    logWithTrace('info', traceId, 'Message processing completed', {
      decision: response?.decision ?? 'unknown',
    });

  } catch (error) {
    logWithTrace('error', traceId, 'Error processing message', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Update message with error (renderError sanitizes the error)
    const errorText = renderError(error, traceId);

    try {
      await slackClient.updateMessage(statusMessage.channel, statusMessage.ts, errorText);
      await slackClient.removeReaction(channelId, messageTs, 'hourglass_flowing_sand');
      await slackClient.addReaction(channelId, messageTs, 'x');
    } catch (updateError) {
      logWithTrace('error', traceId, 'Failed to update error message', {
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }
  } finally {
    // Clean up throttler state
    throttler.reset(traceId);
  }
}
