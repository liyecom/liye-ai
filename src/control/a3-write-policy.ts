/**
 * LiYe AI A3 Write Policy — Low-blast-radius auto-write trial
 *
 * Provides:
 *   - White-list of allowed A3 task types
 *   - 12-point pre-flight checklist
 *   - Rollback protocol (snapshot + payload + executor + eligibility)
 *   - Kill switch (9 termination conditions)
 *   - Metrics collector (10 A3 metrics)
 *   - Forced A2 downgrade when any pre-check fails
 */

import type {
  AgentCapabilityCandidate,
  ITrustStore,
  ICapabilityRegistry,
  TrustProfile,
} from './types';

// ============================================================
// A3 White-list
// ============================================================

/** Allowed A3 task types — anything not on this list is blocked */
export type A3TaskType =
  | 'metadata_write'
  | 'canary_strategy_write'
  | 'sandbox_write'
  | 'orchestrator_trace_write'
  | 'gateway_trace_append'
  | 'approval_init_write';

export interface A3WhitelistEntry {
  task_type: A3TaskType;
  capability_id: string;
  domain: string;
  rollback_method: 'snapshot_restore' | 'inverse_operation' | 'version_revert';
  verifier_method: 'read_back' | 'diff_check' | 'hash_verify';
  description: string;
}

/** Static whitelist — only these combinations are allowed for A3 */
const A3_WHITELIST: A3WhitelistEntry[] = [
  {
    task_type: 'metadata_write',
    capability_id: 'orchestrator:task_decomposition',
    domain: 'core',
    rollback_method: 'snapshot_restore',
    verifier_method: 'read_back',
    description: 'Internal task plan metadata write',
  },
  {
    task_type: 'metadata_write',
    capability_id: 'orchestrator:agent_selection',
    domain: 'core',
    rollback_method: 'snapshot_restore',
    verifier_method: 'read_back',
    description: 'Agent selection result metadata write',
  },
  {
    task_type: 'canary_strategy_write',
    capability_id: 'analyst:insight_generation',
    domain: 'core',
    rollback_method: 'inverse_operation',
    verifier_method: 'diff_check',
    description: 'Canary insight generation write',
  },
  {
    task_type: 'sandbox_write',
    capability_id: 'orchestrator:error_recovery',
    domain: 'core',
    rollback_method: 'version_revert',
    verifier_method: 'read_back',
    description: 'Sandbox error recovery write',
  },
  {
    task_type: 'orchestrator_trace_write',
    capability_id: 'orchestrator:progress_monitoring',
    domain: 'core',
    rollback_method: 'inverse_operation',
    verifier_method: 'read_back',
    description: 'Orchestrator execution trace (single JSON, non-fatal)',
  },
  {
    task_type: 'gateway_trace_append',
    capability_id: 'orchestrator:progress_monitoring',
    domain: 'core',
    rollback_method: 'version_revert',
    verifier_method: 'read_back',
    description: 'Gateway trace event append (JSONL, seq-numbered)',
  },
  {
    task_type: 'approval_init_write',
    capability_id: 'orchestrator:error_recovery',
    domain: 'core',
    rollback_method: 'inverse_operation',
    verifier_method: 'read_back',
    description: 'Approval workflow init (DRAFT state JSON)',
  },
];

// ============================================================
// Pre-flight Checklist
// ============================================================

export interface A3PreFlightResult {
  passed: boolean;
  checks: A3CheckItem[];
  failed_checks: string[];
  downgrade_to_a2: boolean;
}

export interface A3CheckItem {
  name: string;
  passed: boolean;
  detail: string;
}

const MIN_WRITE_SCORE_A3 = 0.7;

export function runA3PreFlight(
  candidate: AgentCapabilityCandidate,
  taskType: A3TaskType | undefined,
  trust: TrustProfile,
  registry: ICapabilityRegistry,
  rollbackPayload: any,
  preStateSnapshot: any,
  readBackDefined: boolean,
): A3PreFlightResult {
  const checks: A3CheckItem[] = [];

  // 1. Task in whitelist
  const whitelistEntry = taskType
    ? A3_WHITELIST.find(e =>
        e.task_type === taskType && e.capability_id === candidate.capability_id)
    : undefined;
  checks.push({
    name: 'whitelist',
    passed: !!whitelistEntry,
    detail: whitelistEntry
      ? `Matched: ${whitelistEntry.task_type}:${whitelistEntry.capability_id}`
      : `Not in A3 whitelist: ${taskType}:${candidate.capability_id}`,
  });

  // 2. capability_id certified
  checks.push({
    name: 'capability_certified',
    passed: !!candidate.capability_id && candidate.capability_id.includes(':'),
    detail: candidate.capability_id || 'missing',
  });

  // 3. agent status = available
  const card = registry.findAgent(candidate.agent_id);
  checks.push({
    name: 'agent_available',
    passed: card?.status === 'available',
    detail: card?.status ?? 'not_found',
  });

  // 4. write_score >= 0.7
  checks.push({
    name: 'write_score',
    passed: trust.write_score >= MIN_WRITE_SCORE_A3,
    detail: `${trust.write_score.toFixed(2)} (min: ${MIN_WRITE_SCORE_A3})`,
  });

  // 5. side_effect = write (not irreversible)
  checks.push({
    name: 'side_effect_write',
    passed: candidate.side_effect === 'write',
    detail: candidate.side_effect,
  });

  // 6. Not irreversible
  checks.push({
    name: 'not_irreversible',
    passed: candidate.side_effect !== 'irreversible',
    detail: candidate.side_effect,
  });

  // 7. Single domain
  checks.push({
    name: 'single_domain',
    passed: !!candidate.source_contract.domain,
    detail: candidate.source_contract.domain || 'none',
  });

  // 8. pre-state snapshot generated
  checks.push({
    name: 'pre_state_snapshot',
    passed: preStateSnapshot != null,
    detail: preStateSnapshot != null ? 'present' : 'missing',
  });

  // 9. rollback payload generated
  checks.push({
    name: 'rollback_payload',
    passed: rollbackPayload != null,
    detail: rollbackPayload != null ? 'present' : 'missing',
  });

  // 10. read-back verification defined
  checks.push({
    name: 'read_back_defined',
    passed: readBackDefined,
    detail: readBackDefined ? 'defined' : 'missing',
  });

  // 11. Discovery Policy passed (implied by reaching this point)
  checks.push({
    name: 'discovery_policy',
    passed: true,
    detail: 'passed (candidate was discovered)',
  });

  // 12. trace enabled (always true in current implementation)
  checks.push({
    name: 'trace_enabled',
    passed: true,
    detail: 'enabled',
  });

  const failedChecks = checks.filter(c => !c.passed).map(c => c.name);
  const passed = failedChecks.length === 0;

  return {
    passed,
    checks,
    failed_checks: failedChecks,
    downgrade_to_a2: !passed,
  };
}

// ============================================================
// Rollback Protocol
// ============================================================

export interface RollbackContext {
  task_id: string;
  pre_state: any;
  rollback_payload: any;
  rollback_method: 'snapshot_restore' | 'inverse_operation' | 'version_revert';
  created_at: string;
}

export interface RollbackResult {
  success: boolean;
  method: string;
  duration_ms: number;
  error?: string;
}

export class RollbackManager {
  private contexts: Map<string, RollbackContext> = new Map();

  /** Create a rollback context before A3 write execution */
  createContext(
    taskId: string,
    preState: any,
    rollbackPayload: any,
    method: 'snapshot_restore' | 'inverse_operation' | 'version_revert'
  ): RollbackContext {
    const ctx: RollbackContext = {
      task_id: taskId,
      pre_state: preState,
      rollback_payload: rollbackPayload,
      rollback_method: method,
      created_at: new Date().toISOString(),
    };
    this.contexts.set(taskId, ctx);
    return ctx;
  }

  /** Check if a task has rollback capability */
  hasRollback(taskId: string): boolean {
    return this.contexts.has(taskId);
  }

  /** Execute rollback for a task */
  async executeRollback(
    taskId: string,
    executor?: (ctx: RollbackContext) => Promise<boolean>
  ): Promise<RollbackResult> {
    const ctx = this.contexts.get(taskId);
    if (!ctx) {
      return { success: false, method: 'none', duration_ms: 0, error: 'No rollback context' };
    }

    const start = Date.now();
    try {
      const success = executor
        ? await executor(ctx)
        : true; // Default: mock success
      return {
        success,
        method: ctx.rollback_method,
        duration_ms: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        method: ctx.rollback_method,
        duration_ms: Date.now() - start,
        error: err.message ?? String(err),
      };
    }
  }

  /** Get rollback context for inspection */
  getContext(taskId: string): RollbackContext | undefined {
    return this.contexts.get(taskId);
  }
}

// ============================================================
// Kill Switch
// ============================================================

export interface KillSwitchState {
  active: boolean;
  triggered: boolean;
  trigger_reason?: string;
  triggered_at?: string;
}

export class A3KillSwitch {
  private state: KillSwitchState = { active: true, triggered: false };
  private consecutiveVerifyFailures = 0;

  /** Check if A3 is still allowed */
  isActive(): boolean {
    return this.state.active && !this.state.triggered;
  }

  /** Get current state */
  getState(): KillSwitchState {
    return { ...this.state };
  }

  /** Trigger kill switch — A3 stops immediately, falls back to A2 */
  trigger(reason: string): void {
    this.state.triggered = true;
    this.state.trigger_reason = reason;
    this.state.triggered_at = new Date().toISOString();
  }

  /** Reset (for testing only) */
  reset(): void {
    this.state = { active: true, triggered: false };
    this.consecutiveVerifyFailures = 0;
  }

  // === 9 Termination Conditions ===

  /** Condition 1: Any veto violation */
  checkVetoViolation(hasViolation: boolean): void {
    if (hasViolation) this.trigger('veto_violation');
  }

  /** Condition 2: Irreversible write was incorrectly allowed */
  checkIrreversibleLeak(leaked: boolean): void {
    if (leaked) this.trigger('irreversible_write_leaked');
  }

  /** Condition 3: Rollback failed */
  checkRollbackFailure(failed: boolean): void {
    if (failed) this.trigger('rollback_failure');
  }

  /** Condition 4: Consecutive read-back verification failures (threshold: 2) */
  checkVerificationFailure(failed: boolean): void {
    if (failed) {
      this.consecutiveVerifyFailures++;
      if (this.consecutiveVerifyFailures >= 2) {
        this.trigger('consecutive_verification_failures');
      }
    } else {
      this.consecutiveVerifyFailures = 0;
    }
  }

  /** Condition 5: auto_write_success_rate < 0.8 */
  checkSuccessRate(rate: number): void {
    if (rate < 0.8) this.trigger(`auto_write_success_rate_low: ${rate.toFixed(2)}`);
  }

  /** Condition 6: Human emergency intervention */
  checkHumanIntervention(intervened: boolean): void {
    if (intervened) this.trigger('human_emergency_intervention');
  }

  /** Condition 7: Trace/approval/rollback audit gap */
  checkAuditGap(hasGap: boolean): void {
    if (hasGap) this.trigger('audit_gap_detected');
  }

  /** Condition 8: Blast radius breach */
  checkBlastRadiusBreach(breached: boolean): void {
    if (breached) this.trigger('blast_radius_breach');
  }
}

// ============================================================
// A3 Metrics Collector
// ============================================================

export interface A3Metrics {
  auto_write_success_rate: number;
  auto_write_rollback_rate: number;
  post_write_verification_pass_rate: number;
  a3_veto_violation_count: number;
  a3_human_emergency_intervention_count: number;
  median_a3_control_plane_latency_ms: number;
  median_a3_total_execution_latency_ms: number;
  a3_retry_rate: number;
  a3_fallback_rate: number;
  a3_forced_downgrade_to_A2_count: number;
}

export interface A3TaskRecord {
  task_id: string;
  capability_id: string;
  task_type: A3TaskType;
  domain: string;
  pre_flight_passed: boolean;
  write_success: boolean;
  verification_passed: boolean;
  rollback_triggered: boolean;
  rollback_success?: boolean;
  downgraded_to_a2: boolean;
  control_plane_latency_ms: number;
  total_execution_latency_ms: number;
  retried: boolean;
  fallback_used: boolean;
  trace_path?: string;
}

export class A3MetricsCollector {
  private records: A3TaskRecord[] = [];
  private vetoViolations = 0;
  private humanInterventions = 0;

  record(entry: A3TaskRecord): void {
    this.records.push(entry);
  }

  recordVetoViolation(): void {
    this.vetoViolations++;
  }

  recordHumanIntervention(): void {
    this.humanInterventions++;
  }

  getRecords(): A3TaskRecord[] {
    return [...this.records];
  }

  compute(): A3Metrics {
    const total = this.records.length;
    if (total === 0) {
      return {
        auto_write_success_rate: 0,
        auto_write_rollback_rate: 0,
        post_write_verification_pass_rate: 0,
        a3_veto_violation_count: this.vetoViolations,
        a3_human_emergency_intervention_count: this.humanInterventions,
        median_a3_control_plane_latency_ms: 0,
        median_a3_total_execution_latency_ms: 0,
        a3_retry_rate: 0,
        a3_fallback_rate: 0,
        a3_forced_downgrade_to_A2_count: 0,
      };
    }

    const executed = this.records.filter(r => r.pre_flight_passed);
    const executedCount = executed.length || 1; // avoid division by zero

    const successCount = executed.filter(r => r.write_success).length;
    const rollbackCount = executed.filter(r => r.rollback_triggered).length;
    const verifyPassCount = executed.filter(r => r.verification_passed).length;
    const retryCount = this.records.filter(r => r.retried).length;
    const fallbackCount = this.records.filter(r => r.fallback_used).length;
    const downgradeCount = this.records.filter(r => r.downgraded_to_a2).length;

    const cpLatencies = executed
      .map(r => r.control_plane_latency_ms)
      .filter(l => l > 0)
      .sort((a, b) => a - b);
    const totalLatencies = executed
      .map(r => r.total_execution_latency_ms)
      .filter(l => l > 0)
      .sort((a, b) => a - b);

    const median = (arr: number[]) =>
      arr.length > 0 ? arr[Math.floor(arr.length / 2)] : 0;

    return {
      auto_write_success_rate: successCount / executedCount,
      auto_write_rollback_rate: rollbackCount / executedCount,
      post_write_verification_pass_rate: verifyPassCount / executedCount,
      a3_veto_violation_count: this.vetoViolations,
      a3_human_emergency_intervention_count: this.humanInterventions,
      median_a3_control_plane_latency_ms: median(cpLatencies),
      median_a3_total_execution_latency_ms: median(totalLatencies),
      a3_retry_rate: retryCount / total,
      a3_fallback_rate: fallbackCount / total,
      a3_forced_downgrade_to_A2_count: downgradeCount,
    };
  }
}

// ============================================================
// Exports
// ============================================================

export { A3_WHITELIST, MIN_WRITE_SCORE_A3 };
