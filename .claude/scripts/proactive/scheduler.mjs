#!/usr/bin/env node
/**
 * Proactive Scheduler v1.0.0
 * SSOT: .claude/scripts/proactive/scheduler.mjs
 *
 * 最小可用调度器：
 * - 读取 state/runtime/proactive/state.json
 * - cooldown 过期则触发一次 run
 * - 写回 last_run_at/run_count
 *
 * 运行方式:
 *   node .claude/scripts/proactive/scheduler.mjs
 *   node .claude/scripts/proactive/scheduler.mjs --dry-run
 *
 * 输出 JSON:
 *   { action: 'RUN' | 'SKIP', reason: string, ... }
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const STATE_PATH = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'state.json');

// ===============================================================
// 颜色输出
// ===============================================================

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// ===============================================================
// 工具函数
// ===============================================================

/**
 * 加载调度状态
 */
function loadState() {
  if (!existsSync(STATE_PATH)) {
    throw new Error(`State file not found: ${STATE_PATH}`);
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
}

/**
 * 保存调度状态
 */
function saveState(state) {
  state.metadata.updated_at = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

/**
 * 检查是否在静默时间
 */
function isQuietHour(config) {
  if (!config.enabled) return false;

  const now = new Date();
  const tz = config.timezone || 'UTC';

  // 简化实现：只检查小时
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: tz
  });
  const currentHour = parseInt(formatter.format(now), 10);

  const startHour = parseInt(config.start.split(':')[0], 10);
  const endHour = parseInt(config.end.split(':')[0], 10);

  // 处理跨午夜的情况
  if (startHour > endHour) {
    return currentHour >= startHour || currentHour < endHour;
  }
  return currentHour >= startHour && currentHour < endHour;
}

/**
 * 生成唯一 run_id
 */
function generateRunId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
  const random = Math.random().toString(36).slice(2, 8);
  return `run-${dateStr}-${timeStr}-${random}`;
}

// ===============================================================
// Scheduler 主逻辑
// ===============================================================

/**
 * 执行调度检查
 */
async function schedule(options = {}) {
  const dryRun = options.dryRun || false;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Proactive Scheduler v1.0.0');
  console.log('═══════════════════════════════════════════════════════════\n');

  const state = loadState();

  // 1. 检查是否启用
  if (!state.learning_enabled) {
    const result = {
      action: 'SKIP',
      reason: 'learning_disabled',
      message: 'Proactive learning is disabled'
    };
    console.log(`${YELLOW}⏭️  SKIP: ${result.message}${RESET}`);
    return result;
  }

  // 2. 检查静默时间
  if (isQuietHour(state.quiet_hours)) {
    const result = {
      action: 'SKIP',
      reason: 'quiet_hours',
      message: `Currently in quiet hours (${state.quiet_hours.start} - ${state.quiet_hours.end})`
    };
    console.log(`${YELLOW}⏭️  SKIP: ${result.message}${RESET}`);
    return result;
  }

  // 3. Cooldown 检查（硬约束）
  const cooldownMs = state.cooldown_minutes * 60 * 1000;
  const lastRun = state.last_run ? new Date(state.last_run).getTime() : 0;
  const elapsed = Date.now() - lastRun;

  if (elapsed < cooldownMs) {
    const remainingMs = cooldownMs - elapsed;
    const remainingMinutes = Math.ceil(remainingMs / 60000);

    const result = {
      action: 'SKIP',
      reason: 'cooldown_active',
      message: `Cooldown active, ${remainingMinutes} minutes remaining`,
      cooldown_remaining_minutes: remainingMinutes,
      last_run: state.last_run
    };

    console.log(`${YELLOW}⏭️  SKIP: ${result.message}${RESET}`);
    console.log(`   Last run: ${state.last_run || 'never'}`);
    console.log(`   Cooldown: ${state.cooldown_minutes} minutes`);

    return result;
  }

  // 4. 可以运行
  const runId = generateRunId();

  console.log(`${GREEN}▶️  RUN: Cooldown expired, triggering proactive run${RESET}`);
  console.log(`   Run ID: ${runId}`);
  console.log(`   Last run: ${state.last_run || 'never'}`);
  console.log(`   Elapsed: ${Math.floor(elapsed / 60000)} minutes\n`);

  // 5. 更新状态
  if (!dryRun) {
    state.last_run = new Date().toISOString();
    state.run_count += 1;
    saveState(state);

    console.log(`${CYAN}📝 State updated:${RESET}`);
    console.log(`   last_run: ${state.last_run}`);
    console.log(`   run_count: ${state.run_count}`);
  } else {
    console.log(`${YELLOW}🔍 Dry run: state not updated${RESET}`);
  }

  const result = {
    action: 'RUN',
    reason: 'cooldown_expired',
    run_id: runId,
    run_count: state.run_count,
    execution_tier: state.execution_tier,
    message: 'Proactive run triggered'
  };

  console.log(`\n${GREEN}✅ Scheduler result: RUN${RESET}`);

  return result;
}

// ===============================================================
// CLI 入口
// ===============================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const jsonOutput = args.includes('--json');

  try {
    const result = await schedule({ dryRun });

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    }

    // 退出码：RUN=0, SKIP=0（正常），ERROR=1
    process.exit(0);
  } catch (e) {
    console.error(`❌ Scheduler error: ${e.message}`);
    if (jsonOutput) {
      console.log(JSON.stringify({ action: 'ERROR', reason: e.message }));
    }
    process.exit(1);
  }
}

// 导出供其他模块使用
export { schedule, loadState, saveState, generateRunId };

// 直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
