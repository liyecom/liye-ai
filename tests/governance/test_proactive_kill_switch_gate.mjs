#!/usr/bin/env node
/**
 * Proactive Kill Switch Tests (EXECUTE_LIMITED_ENABLED)
 * SSOT: tests/governance/test_proactive_kill_switch_gate.mjs
 *
 * ⚠ 文件名以 `_gate.mjs` 结尾（非 `_kill_switch.mjs`）= 刻意：被测模块 direct-run guard
 *   `.claude/scripts/proactive/kill_switch.mjs:221` 用 `process.argv[1]?.endsWith('kill_switch.mjs')`；
 *   若测试名也以 `kill_switch.mjs` 结尾，`node <test>` 会令 import 时触发被测模块 `main()` CLI 副作用
 *   （污染 Hard Gate 1 证据）。改名规避，生产模块字节零改（EVO-C D-10 code-review fold）。
 *
 * EVO-C D-7 (ADR-Learning-Stack-Generations §D-A6 / Hard Gate 1): behavior-freeze evidence for the
 * proactive kill_switch enforcement primitive (`.claude/scripts/proactive/kill_switch.mjs`).
 * 纯断言【既存行为】——零生产改动；reclassify-only header (D-2) 不得改其 ENV-driven 纯函数语义。
 *
 * 断言：
 *   1. default-disabled —— 无 ENV + 无 config file → { enabled:false, source:'default' }
 *   2. ENV-precedence-over-config —— ENV 覆盖 config file（两向：ENV=0 压 config:true / ENV=1 压 config:false）
 *   3. ENV truthy 枚举 —— 'true'/'1' → enabled；'false'/'0'/其它 → disabled
 *   4. config-file 语义（无 ENV）—— config.enabled===true → { enabled:true, source:'config_file' }
 *   5. consumer binding —— execute_limited_gate.mjs 消费 isExecuteLimitedEnabled()
 *
 * 运行：node tests/governance/test_proactive_kill_switch_gate.mjs
 *
 * Hermetic：备份并还原 EXECUTE_LIMITED_ENABLED ENV + tracked config 文件
 *   state/runtime/proactive/kill_switch.json（deliberately tracked，非 gitignored），测试结束后字节级恢复原状
 *   （备份内容写回；仅当原本不存在时才删除我们临时创建的文件）。
 */

import { isExecuteLimitedEnabled } from '../../.claude/scripts/proactive/kill_switch.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const CONFIG_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'kill_switch.json');
const GATE_FILE = join(PROJECT_ROOT, '.claude', 'scripts', 'proactive', 'execute_limited_gate.mjs');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let passCount = 0;
let failCount = 0;

function pass(name) {
  console.log(`${GREEN}✅ PASS${RESET}: ${name}`);
  passCount++;
}

function fail(name, reason) {
  console.log(`${RED}❌ FAIL${RESET}: ${name}`);
  console.log(`   Reason: ${reason}`);
  failCount++;
}

// ── ENV / config 隔离辅助（hermetic）──────────────────────────────
function setEnv(value) {
  if (value === undefined) delete process.env.EXECUTE_LIMITED_ENABLED;
  else process.env.EXECUTE_LIMITED_ENABLED = value;
}

function writeConfig(enabled) {
  mkdirSync(dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify({ enabled, reason: 'test fixture' }, null, 2));
}

function removeConfig() {
  if (existsSync(CONFIG_FILE)) unlinkSync(CONFIG_FILE);
}

// ── 测试 ────────────────────────────────────────────────────────
function test_default_disabled() {
  const name = 'default-disabled: 无 ENV + 无 config → enabled=false, source=default';
  setEnv(undefined);
  removeConfig();
  const r = isExecuteLimitedEnabled();
  if (r.enabled === false && r.source === 'default') pass(name);
  else fail(name, `got ${JSON.stringify(r)}`);
}

function test_env_overrides_config_disable() {
  const name = 'ENV-precedence: ENV=0 压制 config.enabled=true → enabled=false, source=env';
  writeConfig(true);
  setEnv('0');
  const r = isExecuteLimitedEnabled();
  if (r.enabled === false && r.source === 'env') pass(name);
  else fail(name, `got ${JSON.stringify(r)}`);
}

function test_env_overrides_config_enable() {
  const name = 'ENV-precedence: ENV=1 压制 config.enabled=false → enabled=true, source=env';
  writeConfig(false);
  setEnv('1');
  const r = isExecuteLimitedEnabled();
  if (r.enabled === true && r.source === 'env') pass(name);
  else fail(name, `got ${JSON.stringify(r)}`);
}

function test_env_truthy_enumeration() {
  const name = "ENV truthy 枚举: 'true'/'1' → enabled；'false'/'0'/'x' → disabled";
  removeConfig();
  const cases = [
    ['true', true], ['1', true],
    ['false', false], ['0', false], ['x', false], ['', false]
  ];
  for (const [val, expected] of cases) {
    setEnv(val);
    const r = isExecuteLimitedEnabled();
    if (r.enabled !== expected || r.source !== 'env') {
      fail(name, `EXECUTE_LIMITED_ENABLED='${val}' → ${JSON.stringify(r)} (expected enabled=${expected})`);
      return;
    }
  }
  pass(name);
}

function test_config_file_semantics() {
  const name = 'config-file（无 ENV）: config.enabled=true → enabled=true, source=config_file';
  setEnv(undefined);
  writeConfig(true);
  const r = isExecuteLimitedEnabled();
  if (r.enabled === true && r.source === 'config_file') pass(name);
  else fail(name, `got ${JSON.stringify(r)}`);
}

function test_consumer_binding() {
  const name = 'consumer binding: execute_limited_gate.mjs 消费 isExecuteLimitedEnabled()';
  if (!existsSync(GATE_FILE)) {
    fail(name, `gate 文件缺失: ${GATE_FILE}`);
    return;
  }
  const src = readFileSync(GATE_FILE, 'utf-8');
  if (src.includes('isExecuteLimitedEnabled') && src.includes('kill_switch.mjs')) pass(name);
  else fail(name, 'execute_limited_gate.mjs 未引用 isExecuteLimitedEnabled / kill_switch.mjs');
}

// ── 运行 ────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
console.log('   Proactive Kill Switch Tests (EVO-C D-7, Hard Gate 1)');
console.log('═══════════════════════════════════════════════════════════\n');

// 备份原状（ENV + config 文件）
const origEnv = process.env.EXECUTE_LIMITED_ENABLED;
const origConfigExisted = existsSync(CONFIG_FILE);
const origConfigContent = origConfigExisted ? readFileSync(CONFIG_FILE, 'utf-8') : null;

try {
  test_default_disabled();
  test_env_overrides_config_disable();
  test_env_overrides_config_enable();
  test_env_truthy_enumeration();
  test_config_file_semantics();
  test_consumer_binding();
} finally {
  // 还原原状：ENV + config 文件（含删除我们临时创建的文件）
  setEnv(origEnv);
  if (origConfigExisted) writeFileSync(CONFIG_FILE, origConfigContent);
  else removeConfig();
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('                    Summary');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  ${GREEN}Passed: ${passCount}${RESET}`);
console.log(`  ${RED}Failed: ${failCount}${RESET}`);
console.log('═══════════════════════════════════════════════════════════\n');

if (failCount > 0) {
  console.log(`${RED}FAILED: ${failCount} test(s) failed.${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}PASSED: All ${passCount} tests passed.${RESET}`);
  process.exit(0);
}
