/**
 * Enterprise WeChat Message Sender
 *
 * Sends markdown messages to users via WeChat API.
 */

import { getAccessToken, WecomEnv } from './token_manager';

const WECOM_SEND_URL = 'https://qyapi.weixin.qq.com/cgi-bin/message/send';

interface SendResponse {
  errcode: number;
  errmsg: string;
  msgid?: string;
}

/**
 * Send markdown message to a user
 *
 * @param env - Worker environment
 * @param userId - User ID to send to
 * @param content - Markdown content
 * @returns Message ID if successful
 */
export async function sendMarkdownMessage(
  env: WecomEnv,
  userId: string,
  content: string
): Promise<string> {
  const accessToken = await getAccessToken(env);
  const agentId = parseInt(env.WECOM_AGENT_ID, 10);

  // WeChat markdown has 4096 char limit
  const truncatedContent = content.length > 4000
    ? content.slice(0, 3900) + '\n\n...(内容已截断)'
    : content;

  const body = {
    touser: userId,
    msgtype: 'markdown',
    agentid: agentId,
    markdown: {
      content: truncatedContent
    }
  };

  const url = `${WECOM_SEND_URL}?access_token=${accessToken}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Send failed: ${response.status}`);
  }

  const result = (await response.json()) as SendResponse;

  if (result.errcode !== 0) {
    throw new Error(`WeChat error: ${result.errcode} - ${result.errmsg}`);
  }

  console.log('[MessageSender] Message sent to:', userId.slice(0, 4) + '****');
  return result.msgid || 'unknown';
}

/**
 * Send markdown message to a chat (group)
 *
 * @param env - Worker environment
 * @param chatId - Chat ID to send to
 * @param content - Markdown content
 * @returns Message ID if successful
 */
export async function sendChatMessage(
  env: WecomEnv,
  chatId: string,
  content: string
): Promise<string> {
  const accessToken = await getAccessToken(env);
  const agentId = parseInt(env.WECOM_AGENT_ID, 10);

  const truncatedContent = content.length > 4000
    ? content.slice(0, 3900) + '\n\n...(内容已截断)'
    : content;

  // For group chats, use application message with chatid parameter
  // Note: This requires the app to be added to the chat
  const body = {
    chatid: chatId,
    msgtype: 'markdown',
    agentid: agentId,
    markdown: {
      content: truncatedContent
    }
  };

  const url = `${WECOM_SEND_URL}?access_token=${accessToken}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Send failed: ${response.status}`);
  }

  const result = (await response.json()) as SendResponse;

  if (result.errcode !== 0) {
    throw new Error(`WeChat error: ${result.errcode} - ${result.errmsg}`);
  }

  console.log('[MessageSender] Message sent to chat:', chatId.slice(0, 8) + '...');
  return result.msgid || 'unknown';
}

/**
 * Send text message (fallback when markdown fails)
 */
export async function sendTextMessage(
  env: WecomEnv,
  userId: string,
  content: string
): Promise<string> {
  const accessToken = await getAccessToken(env);
  const agentId = parseInt(env.WECOM_AGENT_ID, 10);

  const body = {
    touser: userId,
    msgtype: 'text',
    agentid: agentId,
    text: {
      content: content.slice(0, 2048) // Text limit is 2048
    }
  };

  const url = `${WECOM_SEND_URL}?access_token=${accessToken}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Send failed: ${response.status}`);
  }

  const result = (await response.json()) as SendResponse;

  if (result.errcode !== 0) {
    throw new Error(`WeChat error: ${result.errcode} - ${result.errmsg}`);
  }

  return result.msgid || 'unknown';
}
