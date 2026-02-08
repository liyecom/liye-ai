#!/usr/bin/env node
/**
 * Proactive Notifier v1.0.0
 * SSOT: .claude/scripts/proactive/notifier.mjs
 *
 * OS 统一通知入口：将 playbook_io 投递到飞书。
 * 复用 examples/feishu/feishu_client.mjs 的传输层。
 *
 * 用法:
 *   node notifier.mjs --input playbook_io.json
 *   node notifier.mjs --input playbook_io.json --chat-id oc_xxx
 *   echo '{"run_id":"..."}' | node notifier.mjs
 *
 * 环境变量:
 *   FEISHU_APP_ID       - 飞书应用 ID
 *   FEISHU_APP_SECRET   - 飞书应用密钥
 *   FEISHU_CHAT_ID      - 默认群聊 ID
 *   OPERATOR_CALLBACK_URL - 操作员回调 URL
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { renderRecommendationCard, renderTextSummary } from './render_recommendation_card.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// ===============================================================
// 飞书 API（内联简化版，避免模块解析问题）
// ===============================================================

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

let tokenCache = {
  token: null,
  expiresAt: 0
};

async function getToken() {
  const now = Date.now();
  const refreshBuffer = 5 * 60 * 1000;

  if (tokenCache.token && tokenCache.expiresAt > now + refreshBuffer) {
    return tokenCache.token;
  }

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('FEISHU_APP_ID and FEISHU_APP_SECRET are required');
  }

  const resp = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });

  const data = await resp.json();

  if (data.code !== 0) {
    throw new Error(`Feishu token error ${data.code}: ${data.msg}`);
  }

  tokenCache = {
    token: data.tenant_access_token,
    expiresAt: now + (data.expire * 1000)
  };

  console.error('[Notifier] Token refreshed');
  return tokenCache.token;
}

async function sendCard(chatId, card) {
  const token = await getToken();

  const resp = await fetch(`${FEISHU_API_BASE}/im/v1/messages?receive_id_type=chat_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(card)
    })
  });

  const data = await resp.json();

  if (data.code !== 0) {
    throw new Error(`Feishu send error ${data.code}: ${data.msg}`);
  }

  return data;
}

// ===============================================================
// Notifier 主函数
// ===============================================================

/**
 * 发送推荐通知
 */
export async function notify(playbookOutput, options = {}) {
  const chatId = options.chatId || process.env.FEISHU_CHAT_ID;
  const callbackUrl = options.callbackUrl || process.env.OPERATOR_CALLBACK_URL;
  const dryRun = options.dryRun || false;

  if (!chatId) {
    throw new Error('Chat ID is required. Set FEISHU_CHAT_ID or use --chat-id');
  }

  console.error(`[Notifier] Sending recommendation to chat: ${chatId}`);
  console.error(`[Notifier] Run ID: ${playbookOutput.run_id}`);
  console.error(`[Notifier] Verdict: ${playbookOutput.outputs.verdict}`);

  // 渲染卡片
  const card = renderRecommendationCard(playbookOutput, { callbackUrl });

  if (dryRun) {
    console.error('[Notifier] Dry run - card not sent');
    return {
      success: true,
      dry_run: true,
      card
    };
  }

  // 发送卡片
  try {
    const result = await sendCard(chatId, card);
    console.error(`[Notifier] Message sent: ${result.data?.message_id}`);

    return {
      success: true,
      message_id: result.data?.message_id,
      run_id: playbookOutput.run_id
    };
  } catch (e) {
    console.error(`[Notifier] Failed to send: ${e.message}`);

    // 尝试发送文本回退
    try {
      const textSummary = renderTextSummary(playbookOutput);
      console.error('[Notifier] Falling back to text message');
      // 这里可以添加文本发送逻辑
    } catch (e2) {
      // 忽略回退错误
    }

    throw e;
  }
}

// ===============================================================
// CLI 入口
// ===============================================================

function parseArgs(args) {
  const result = {
    inputPath: null,
    chatId: null,
    callbackUrl: null,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
      case '-i':
        result.inputPath = args[++i];
        break;
      case '--chat-id':
      case '-c':
        result.chatId = args[++i];
        break;
      case '--callback-url':
        result.callbackUrl = args[++i];
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Proactive Notifier - Send recommendations to Feishu

Usage:
  node notifier.mjs [options]

Options:
  --input, -i      Path to playbook_io.json (or use stdin)
  --chat-id, -c    Feishu chat ID (or set FEISHU_CHAT_ID)
  --callback-url   Operator callback URL
  --dry-run        Don't actually send, just render
  --help, -h       Show this help

Environment Variables:
  FEISHU_APP_ID       Feishu app ID
  FEISHU_APP_SECRET   Feishu app secret
  FEISHU_CHAT_ID      Default chat ID
  OPERATOR_CALLBACK_URL  Callback URL for operator actions

Examples:
  node notifier.mjs -i playbook_io.json --dry-run
  node notifier.mjs -i playbook_io.json -c oc_xxxxx
`);
        process.exit(0);
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  let inputJson;

  if (options.inputPath) {
    inputJson = readFileSync(options.inputPath, 'utf-8');
  } else if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    inputJson = Buffer.concat(chunks).toString('utf-8');
  } else {
    console.error('Error: No input provided. Use --input or pipe JSON to stdin.');
    process.exit(1);
  }

  try {
    const playbookOutput = JSON.parse(inputJson);

    const result = await notify(playbookOutput, {
      chatId: options.chatId,
      callbackUrl: options.callbackUrl,
      dryRun: options.dryRun
    });

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

// 导出
export { sendCard, getToken };

// 直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
