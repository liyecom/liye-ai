#!/usr/bin/env node
/**
 * Drift Enforcement Tests (EVO-D / ADR-Learning-Stack-Generations §D-11)
 * SSOT: tests/governance/test_drift_enforcement.mjs
 *
 * 锁 isDriftBlocked() 的三分支行为 + 路径同一性，在 drift_monitor.mjs 物理退役前后字节级回归：
 *   ① policy_in_quarantine（quarantine YAML 存在）→ blocked
 *   ② recent_drift_triggered（<24h drift_triggered fact）→ blocked；>24h 边界 → not blocked
 *   ③ clean（无 quarantine / 无近期 drift）→ {blocked:false}
 *   + 行为式路径同一性：fixture 落"期望"绝对路径 → blocked；落"错误"路径 → not blocked
 *     （防 PROJECT_ROOT/常量漂移导致 isDriftBlocked 静默读错路径、恒转 allow 的假绿）。
 *
 * fixture 策略：运行时在硬编码生产路径 materialize + finally cleanup + 预存则 backup/restore +
 *   每分支唯一 policyId 隔离；禁提交式 fixture（state/ 整目录 .gitignore）。
 *
 * 运行：node tests/governance/test_drift_enforcement.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, mkdirSync, unlinkSync, renameSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { isDriftBlocked } from '../../src/governance/learning/drift_enforcement.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// tests/governance → tests → repo root（2 级），与 drift_enforcement.mjs 的 PROJECT_ROOT（src/governance/learning → root，3 级）落同一 repo root
const PROJECT_ROOT = join(__dirname, '..', '..');

const QUARANTINE_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies', 'quarantine');
const DRIFT_FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_drift_events.jsonl');

const BAK = '.evo-d-test.bak';

// 在期望 quarantine 路径 materialize policy YAML，跑 fn，finally 清理 + 预存 restore
function withQuarantinePolicy(policyId, fn) {
  mkdirSync(QUARANTINE_DIR, { recursive: true });
  const p = join(QUARANTINE_DIR, `${policyId}.yaml`);
  const had = existsSync(p);
  if (had) renameSync(p, p + BAK);
  try {
    writeFileSync(p, `policy_id: ${policyId}\nvalidation_status: quarantine\n`);
    return fn();
  } finally {
    if (existsSync(p)) unlinkSync(p);
    if (had) renameSync(p + BAK, p);
  }
}

// 在期望 drift facts 路径 materialize events，跑 fn，finally 清理 + 预存 restore
function withDriftFacts(events, fn) {
  mkdirSync(dirname(DRIFT_FACTS_FILE), { recursive: true });
  const had = existsSync(DRIFT_FACTS_FILE);
  if (had) renameSync(DRIFT_FACTS_FILE, DRIFT_FACTS_FILE + BAK);
  try {
    writeFileSync(DRIFT_FACTS_FILE, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
    return fn();
  } finally {
    if (existsSync(DRIFT_FACTS_FILE)) unlinkSync(DRIFT_FACTS_FILE);
    if (had) renameSync(DRIFT_FACTS_FILE + BAK, DRIFT_FACTS_FILE);
  }
}

// now-相对时间戳（避免持久化 golden 随时间腐烂/分支翻转）
function isoHoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

// ── 分支 ①：quarantine ────────────────────────────────────────────────
test('branch ①: policy in quarantine → blocked / policy_in_quarantine', () => {
  const id = 'EVO_D_TEST_QUAR';
  const r = withQuarantinePolicy(id, () => isDriftBlocked(id));
  assert.equal(r.blocked, true);
  assert.equal(r.reason, 'policy_in_quarantine');
});

// ── 分支 ②：recent_drift_triggered（<24h）+ >24h 边界 ──────────────────
test('branch ②: recent (<24h) drift_triggered → blocked / recent_drift_triggered', () => {
  const id = 'EVO_D_TEST_RECENT';
  const evt = { policy_id: id, event_type: 'drift_triggered', timestamp: isoHoursAgo(1) };
  const r = withDriftFacts([evt], () => isDriftBlocked(id));
  assert.equal(r.blocked, true);
  assert.equal(r.reason, 'recent_drift_triggered');
  assert.equal(r.drift_event.policy_id, id);
});

test('branch ② boundary: >24h drift_triggered → not blocked', () => {
  const id = 'EVO_D_TEST_OLD';
  const evt = { policy_id: id, event_type: 'drift_triggered', timestamp: isoHoursAgo(25) };
  const r = withDriftFacts([evt], () => isDriftBlocked(id));
  assert.equal(r.blocked, false);
});

// ── 分支 ③：clean ─────────────────────────────────────────────────────
test('branch ③: clean (no quarantine, no recent drift) → exactly {blocked:false}', () => {
  const r = isDriftBlocked('EVO_D_TEST_CLEAN_NEVER_SEEN');
  assert.deepEqual(r, { blocked: false });
});

// ── 行为式路径同一性（D-4 point2）────────────────────────────────────────
// 证 isDriftBlocked 读的正是期望 PROJECT_ROOT 派生路径：fixture 落错误路径不应 block，落期望路径才 block。
// 防常量改名/PROJECT_ROOT 深度漂移导致静默读错路径、恒转 allow 的假绿。
test('path-identity: fixture at EXPECTED quarantine path → blocked; at WRONG path → not blocked', () => {
  const id = 'EVO_D_TEST_PATH';
  const wrongDir = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies', 'quarantine_WRONG_EVO_D');
  mkdirSync(wrongDir, { recursive: true });
  const wrongP = join(wrongDir, `${id}.yaml`);
  writeFileSync(wrongP, `policy_id: ${id}\nvalidation_status: quarantine\n`);
  try {
    // 只有"错误路径" fixture → 模块读"期望路径"（空）→ 不应 blocked
    assert.equal(isDriftBlocked(id).blocked, false, 'module must NOT read the wrong path');
    // 再在"期望路径"建 fixture → blocked（证读的确是期望路径）
    const r = withQuarantinePolicy(id, () => isDriftBlocked(id));
    assert.equal(r.blocked, true, 'module must read the EXPECTED path');
    assert.equal(r.reason, 'policy_in_quarantine');
  } finally {
    rmSync(wrongDir, { recursive: true, force: true });
  }
});
