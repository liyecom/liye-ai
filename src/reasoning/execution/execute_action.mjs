/**
 * execute_action.mjs - Action Executor
 *
 * P3: Main entry point for action execution.
 * Validates eligibility, checks safety limits, and delegates to action implementations.
 *
 * @module reasoning/execution
 * @version v0.1
 */

import {
  loadActionPlaybook,
  loadExecutionFlags,
  checkEligibility,
  checkSafetyLimits
} from './build_action_proposal.mjs';
import { createActionOutcomeEvent, recordActionOutcome } from '../feedback/action_outcome.mjs';

// Action implementations registry
const ACTION_IMPLEMENTATIONS = {};

/**
 * Register an action implementation
 *
 * @param {string} actionId - Action ID
 * @param {Function} implementation - Action implementation function
 */
export function registerAction(actionId, implementation) {
  ACTION_IMPLEMENTATIONS[actionId] = implementation;
}

/**
 * Execution result types
 */
export const ExecutionStatus = {
  SUGGEST_ONLY: 'SUGGEST_ONLY',                     // Not eligible for auto execution
  DRY_RUN: 'DRY_RUN',                               // Would execute but dry_run mode
  AUTO_EXECUTED: 'AUTO_EXECUTED',                   // Actually executed
  FAILED: 'FAILED',                                 // Execution attempted but failed
  BLOCKED: 'BLOCKED',                               // Blocked by safety limits
  DENY_UNSUPPORTED_ACTION: 'DENY_UNSUPPORTED_ACTION' // Action not in whitelist
};

/**
 * Execute an action proposal
 *
 * @param {Object} proposal - Action proposal from buildProposal
 * @param {Object} params - Action-specific parameters (e.g., negative_keywords)
 * @param {Object} signals - Current signal values for eligibility checking
 * @param {Object} state - Current state (e.g., negatives_added_today)
 * @param {Object} options - Execution options
 * @param {boolean} options.force_dry_run - Force dry run mode
 * @param {Object} options.before_metrics - Metrics before action (for outcome event)
 * @returns {Object} Execution result
 */
export async function executeAction(proposal, params, signals, state = {}, options = {}) {
  const startTime = Date.now();
  const flags = loadExecutionFlags();
  const playbook = loadActionPlaybook(proposal.action_id);

  // Result structure
  const result = {
    proposal_id: proposal.proposal_id,
    action_id: proposal.action_id,
    trace_id: proposal.trace_id,
    status: ExecutionStatus.SUGGEST_ONLY,
    executed_at: new Date().toISOString(),
    duration_ms: 0,
    dry_run: true,
    eligibility: null,
    safety: null,
    execution_result: null,
    rollback_payload: null,
    outcome_event: null,
    notes: []
  };

  try {
    // Step 1: Check execution mode
    if (proposal.execution_mode !== 'auto_if_safe') {
      result.notes.push(`Execution mode is ${proposal.execution_mode}, returning SUGGEST_ONLY`);
      return finishResult(result, startTime);
    }

    // Step 2: Check if action is in whitelist (BEFORE kill switch - for audit trail)
    // This ensures we can track "denied" vs "disabled" in reports
    const allowList = flags.auto_execution?.allow_actions || [];
    if (!allowList.includes(proposal.action_id)) {
      result.status = ExecutionStatus.DENY_UNSUPPORTED_ACTION;
      result.notes.push(`Action ${proposal.action_id} not in allow list (DENY_UNSUPPORTED_ACTION)`);

      // Record outcome event for denied actions (for audit)
      try {
        result.outcome_event = await createAndRecordOutcome(
          proposal,
          params,
          options.before_metrics,
          null,
          null,  // success=null for denied (not attempted)
          false,
          `Action denied: ${proposal.action_id} not in whitelist [${allowList.join(', ')}]`
        );
      } catch (outcomeError) {
        result.notes.push(`Failed to record deny outcome: ${outcomeError.message}`);
      }

      return finishResult(result, startTime);
    }

    // Step 3: Check if auto execution is enabled globally (kill switch)
    if (!flags.auto_execution?.enabled) {
      result.notes.push('Auto execution is disabled globally');
      return finishResult(result, startTime);
    }

    // Step 4: Check eligibility
    const eligibility = checkEligibility(proposal, signals);
    result.eligibility = eligibility;

    if (!eligibility.eligible) {
      result.notes.push(`Eligibility check failed: ${eligibility.reasons.join('; ')}`);
      return finishResult(result, startTime);
    }

    // Step 5: Check safety limits
    const safety = checkSafetyLimits(proposal, params, state);
    result.safety = safety;

    if (!safety.safe) {
      result.status = ExecutionStatus.BLOCKED;
      result.notes.push(`Safety check failed: ${safety.violations.join('; ')}`);
      return finishResult(result, startTime);
    }

    // Step 6: Check cooldown (if applicable)
    if (playbook?.eligibility?.cooldown && state.last_execution_time) {
      const cooldownHours = playbook.eligibility.cooldown.per_campaign_hours || 24;
      const cooldownMs = cooldownHours * 60 * 60 * 1000;
      const timeSinceLastExec = Date.now() - new Date(state.last_execution_time).getTime();

      if (timeSinceLastExec < cooldownMs) {
        result.status = ExecutionStatus.BLOCKED;
        result.notes.push(`Cooldown not elapsed: ${Math.round((cooldownMs - timeSinceLastExec) / 1000 / 60)} minutes remaining`);
        return finishResult(result, startTime);
      }
    }

    // Step 7: Check dry run mode
    const isDryRun = options.force_dry_run || flags.dry_run?.enabled || proposal.dry_run;
    result.dry_run = isDryRun;

    if (isDryRun) {
      result.status = ExecutionStatus.DRY_RUN;
      result.notes.push('Dry run mode - would have executed');
      result.execution_result = {
        would_execute: true,
        action_id: proposal.action_id,
        params: params
      };

      // Generate simulated rollback payload
      result.rollback_payload = generateRollbackPayload(proposal, params, playbook);

      // Generate outcome event (simulated)
      if (playbook?.audit?.must_emit_action_outcome_event) {
        result.outcome_event = await createAndRecordOutcome(
          proposal,
          params,
          options.before_metrics,
          null,  // No after metrics in dry run
          true,  // Simulated success
          isDryRun,
          'Dry run - simulated success'
        );
      }

      return finishResult(result, startTime);
    }

    // Step 8: Get action implementation
    const implementation = ACTION_IMPLEMENTATIONS[proposal.action_id];
    if (!implementation) {
      result.status = ExecutionStatus.FAILED;
      result.notes.push(`No implementation found for ${proposal.action_id}`);
      return finishResult(result, startTime);
    }

    // Step 9: Execute the action
    const executionResult = await implementation(proposal, params, state);
    result.execution_result = executionResult;

    if (executionResult.success) {
      result.status = ExecutionStatus.AUTO_EXECUTED;
      result.rollback_payload = executionResult.rollback_payload;
      result.notes.push('Action executed successfully');
    } else {
      result.status = ExecutionStatus.FAILED;
      result.notes.push(`Execution failed: ${executionResult.error}`);
    }

    // Step 10: Record outcome event
    if (playbook?.audit?.must_emit_action_outcome_event) {
      result.outcome_event = await createAndRecordOutcome(
        proposal,
        params,
        options.before_metrics,
        executionResult.after_metrics,
        executionResult.success,
        false,
        executionResult.error || null
      );
    }

  } catch (error) {
    result.status = ExecutionStatus.FAILED;
    result.notes.push(`Exception: ${error.message}`);

    // Still try to record outcome event on failure
    try {
      result.outcome_event = await createAndRecordOutcome(
        proposal,
        params,
        options.before_metrics,
        null,
        false,
        false,
        `Exception: ${error.message}`
      );
    } catch (outcomeError) {
      result.notes.push(`Failed to record outcome: ${outcomeError.message}`);
    }
  }

  return finishResult(result, startTime);
}

/**
 * Finalize result with duration
 */
function finishResult(result, startTime) {
  result.duration_ms = Date.now() - startTime;
  return result;
}

/**
 * Generate rollback payload from proposal and params
 */
function generateRollbackPayload(proposal, params, playbook) {
  if (!playbook?.rollback?.supported) {
    return null;
  }

  const payload = {
    action_id: proposal.action_id,
    method: playbook.rollback.method,
    ttl_hours: playbook.rollback.ttl_hours,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + (playbook.rollback.ttl_hours || 168) * 60 * 60 * 1000).toISOString(),
    trace_id: proposal.trace_id,
    rule_version: proposal.rule_version
  };

  // Add required fields from playbook
  for (const field of playbook.rollback.payload_required_fields || []) {
    if (params[field] !== undefined) {
      payload[field] = params[field];
    } else if (proposal[field] !== undefined) {
      payload[field] = proposal[field];
    }
  }

  // For ADD_NEGATIVE_KEYWORDS specifically
  if (proposal.action_id === 'ADD_NEGATIVE_KEYWORDS') {
    payload.negative_keywords_added = params.negative_keywords || [];
    payload.match_types = params.match_type ? [params.match_type] : [];
    payload.campaign_id = params.campaign_id;
    payload.ad_group_id = params.ad_group_id;
  }

  return payload;
}

/**
 * Create and record an ActionOutcomeEvent
 */
async function createAndRecordOutcome(proposal, params, beforeMetrics, afterMetrics, success, isDryRun, notes) {
  const event = createActionOutcomeEvent({
    trace_id: proposal.trace_id,
    observation_id: proposal.observation_id,
    action_id: proposal.action_id,
    cause_id: proposal.cause_id,
    before_metrics: beforeMetrics,
    after_metrics: afterMetrics,
    success: success,
    expected_outcome: proposal.expected_outcome,
    actual_outcome: success ? 'Action completed' : notes,
    notes: isDryRun ? `[DRY RUN] ${notes || ''}` : notes,
    evaluator: 'auto'
  });

  // Add P3-specific fields
  event.execution_mode = isDryRun ? 'dry_run' : 'auto_executed';
  event.rule_version = proposal.rule_version;
  event.params_summary = {
    action_id: proposal.action_id,
    items_count: params.negative_keywords?.length || 0
  };

  // Record the event (non-blocking)
  const recordResult = recordActionOutcome(event);

  if (!recordResult.success) {
    console.warn(`[EXECUTE_ACTION] Failed to record outcome: ${recordResult.error}`);
  }

  return event;
}

/**
 * Execute action in suggestion mode only (returns proposal for manual review)
 *
 * @param {Object} proposal - Action proposal
 * @param {Object} params - Action-specific parameters
 * @param {Object} signals - Current signal values
 * @returns {Object} Suggestion result (not executed)
 */
export function suggestAction(proposal, params, signals) {
  const eligibility = checkEligibility(proposal, signals);
  const playbook = loadActionPlaybook(proposal.action_id);

  return {
    proposal_id: proposal.proposal_id,
    action_id: proposal.action_id,
    status: 'SUGGESTED',
    can_auto_execute: eligibility.eligible && proposal.execution_mode === 'auto_if_safe',
    eligibility: eligibility,
    params: params,
    playbook_version: playbook?.version,
    notes: ['Action suggested for manual review']
  };
}

// Default export
export default {
  executeAction,
  suggestAction,
  registerAction,
  ExecutionStatus
};
