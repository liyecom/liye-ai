#!/usr/bin/env node
/**
 * Kill Switch v1.0.0
 * SSOT: .claude/scripts/proactive/kill_switch.mjs
 *
 * Week 5 全局熄火开关：
 * - 单一配置立刻全局生效（<1 分钟）
 * - 两种方式：ENV 变量 或 配置文件
 * - scheduler/runner/gate 全链路读取
 *
 * 配置优先级：
 * 1. ENV: EXECUTE_LIMITED_ENABLED=0 （最高）
 * 2. 配置文件: state/runtime/proactive/kill_switch.json
 * 3. 默认: false（关闭）
 *
 * 用法：
 *   node kill_switch.mjs status                    # 查看状态
 *   node kill_switch.mjs enable                    # 启用 execute_limited
 *   node kill_switch.mjs disable [--reason "..."]  # 禁用（熄火）
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const KILL_SWITCH_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'kill_switch.json');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// ═══════════════════════════════════════════════════════════
// Kill Switch 读取（供其他脚本 import）
// ═══════════════════════════════════════════════════════════

/**
 * 检查 execute_limited 是否启用
 * 返回 { enabled: boolean, source: string, reason?: string }
 */
export function isExecuteLimitedEnabled() {
  // 1. 检查 ENV（最高优先级）
  const envValue = process.env.EXECUTE_LIMITED_ENABLED;
  if (envValue !== undefined) {
    const enabled = envValue === 'true' || envValue === '1';
    return {
      enabled,
      source: 'env',
      env_value: envValue
    };
  }

  // 2. 检查配置文件
  if (existsSync(KILL_SWITCH_FILE)) {
    try {
      const config = JSON.parse(readFileSync(KILL_SWITCH_FILE, 'utf-8'));
      return {
        enabled: config.enabled === true,
        source: 'config_file',
        reason: config.reason,
        updated_at: config.updated_at,
        updated_by: config.updated_by
      };
    } catch (e) {
      console.warn(`${YELLOW}[KillSwitch] Config file parse error: ${e.message}${RESET}`);
    }
  }

  // 3. 默认：关闭
  return {
    enabled: false,
    source: 'default',
    reason: 'No configuration found, defaulting to disabled'
  };
}

/**
 * 快速检查（用于 gate）
 */
export function checkKillSwitch() {
  const status = isExecuteLimitedEnabled();
  return status.enabled;
}

// ═══════════════════════════════════════════════════════════
// Kill Switch 写入
// ═══════════════════════════════════════════════════════════

/**
 * 更新 kill switch 配置
 */
function updateKillSwitch(enabled, reason = null, operator = 'cli') {
  const dir = dirname(KILL_SWITCH_FILE);
  mkdirSync(dir, { recursive: true });

  const config = {
    enabled,
    reason: reason || (enabled ? 'Enabled via CLI' : 'Disabled via CLI'),
    updated_at: new Date().toISOString(),
    updated_by: operator
  };

  writeFileSync(KILL_SWITCH_FILE, JSON.stringify(config, null, 2));

  return config;
}

/**
 * 启用 execute_limited
 */
export function enableExecuteLimited(operator = 'cli') {
  return updateKillSwitch(true, 'Enabled via CLI', operator);
}

/**
 * 禁用 execute_limited（熄火）
 */
export function disableExecuteLimited(reason = 'Manual kill switch', operator = 'cli') {
  return updateKillSwitch(false, reason, operator);
}

// ═══════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════

function printStatus() {
  const status = isExecuteLimitedEnabled();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Kill Switch Status (Week 5)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  if (status.enabled) {
    console.log(`${GREEN}EXECUTE_LIMITED: ENABLED${RESET}`);
  } else {
    console.log(`${RED}EXECUTE_LIMITED: DISABLED (KILL SWITCH ACTIVE)${RESET}`);
  }

  console.log('');
  console.log(`Source: ${status.source}`);

  if (status.source === 'env') {
    console.log(`ENV value: ${status.env_value}`);
    console.log(`${YELLOW}Note: ENV takes precedence over config file${RESET}`);
  } else if (status.source === 'config_file') {
    console.log(`Reason: ${status.reason || 'N/A'}`);
    console.log(`Updated: ${status.updated_at || 'N/A'}`);
    console.log(`By: ${status.updated_by || 'N/A'}`);
  } else {
    console.log(`${YELLOW}No explicit configuration found${RESET}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');

  // 提示如何更改
  if (!status.enabled) {
    console.log('');
    console.log('To enable:');
    console.log('  node kill_switch.mjs enable');
    console.log('  # or');
    console.log('  export EXECUTE_LIMITED_ENABLED=1');
  } else {
    console.log('');
    console.log('To disable (kill switch):');
    console.log('  node kill_switch.mjs disable --reason "Emergency stop"');
    console.log('  # or');
    console.log('  export EXECUTE_LIMITED_ENABLED=0');
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status':
    case undefined:
      printStatus();
      break;

    case 'enable':
      const enableResult = enableExecuteLimited();
      console.log(`${GREEN}Execute-limited ENABLED${RESET}`);
      console.log(JSON.stringify(enableResult, null, 2));
      break;

    case 'disable':
      let reason = 'Manual kill switch';
      const reasonIdx = args.indexOf('--reason');
      if (reasonIdx !== -1 && args[reasonIdx + 1]) {
        reason = args[reasonIdx + 1];
      }
      const disableResult = disableExecuteLimited(reason);
      console.log(`${RED}Execute-limited DISABLED (KILL SWITCH ACTIVE)${RESET}`);
      console.log(JSON.stringify(disableResult, null, 2));
      break;

    default:
      console.log('Usage: node kill_switch.mjs [status|enable|disable]');
      console.log('');
      console.log('Commands:');
      console.log('  status                    Show current status');
      console.log('  enable                    Enable execute_limited');
      console.log('  disable [--reason "..."]  Disable (activate kill switch)');
      process.exit(1);
  }
}

// 仅在直接运行时执行 main()
const isDirectRun = process.argv[1]?.endsWith('kill_switch.mjs');
if (isDirectRun) {
  main();
}
