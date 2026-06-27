/**
 * Drift Enforcement (read-only) v1.0.0
 * SSOT: src/governance/learning/drift_enforcement.mjs
 *
 * D-A3 preserved read-only enforcement library — isDriftBlocked() 自退役的 drift_monitor.mjs
 * **逐字节抽取**（EVO-D / ADR-Learning-Stack-Generations §D-11；行为冻结 / 字节级回归 under Hard Gate 1）。
 *
 * isDriftBlocked() 是 v0 "week 3" drift 面的**唯一 live face**：被 STAYING enforcement 原语
 * execution_gate.mjs 消费（preflight，仅当 policyId 非空 ∧ actionType=WRITE_LIMITED 触发）。
 *
 * ⚠ 诚实披露（休眠语义，非活跃 enforcement）：这是**数据驱动的休眠 enforcement 读**——每次
 *   WRITE_LIMITED preflight 真被执行（live edge），但其两条 blocked 分支的写入者（drift_monitor
 *   主动降级面 / fact_drift_events 产生）已随 §D-A2 退役，故当前数据下恒返回 {blocked:false}
 *   （dormant effect）。**绝不可描述为「活跃 24h freeze enforcement」。** 写侧重生归 GHL 2c
 *   （append-only lifecycle event，§D-A4 / EVO-C GHL-BACKLOG C-1/C-2）。
 *
 * 纯只读库：只 export isDriftBlocked；无 CLI、无 isMain、无主动降级/写入面（那些随 drift_monitor 退役）。
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const DRIFT_FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_drift_events.jsonl');
const POLICIES_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies');

/**
 * 导出：检查特定 policy 是否被 drift 阻断
 */
// ENFORCEMENT-READ (D-A3): consumed by execution_gate preflight; behavior frozen, byte-level regression under Hard Gate 1
export function isDriftBlocked(policyId) {
  // 检查 policy 是否在 quarantine
  const quarantinePath = join(POLICIES_DIR, 'quarantine', `${policyId}.yaml`);
  if (existsSync(quarantinePath)) {
    return { blocked: true, reason: 'policy_in_quarantine' };
  }

  // 检查最近的 drift_triggered 事件
  if (existsSync(DRIFT_FACTS_FILE)) {
    const lines = readFileSync(DRIFT_FACTS_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    const recentDrift = lines
      .map(line => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(Boolean)
      .filter(f => f.policy_id === policyId && f.event_type === 'drift_triggered')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

    if (recentDrift) {
      // 检查是否在最近 24 小时内
      const triggeredAt = new Date(recentDrift.timestamp);
      const now = new Date();
      const hoursSince = (now - triggeredAt) / (1000 * 60 * 60);

      if (hoursSince < 24) {
        return { blocked: true, reason: 'recent_drift_triggered', drift_event: recentDrift };
      }
    }
  }

  return { blocked: false };
}
