/**
 * Mission Runner
 * Executes a mission using the configured broker
 * Supports semi-auto approval, degradation, and enhanced logging
 */

const fs = require('fs');
const path = require('path');
const { MissionStatus, ErrorCode } = require('./types');
const {
  readYaml,
  writeJson,
  readJson,
  generateRunId,
} = require('./utils');
const { getBroker } = require('../brokers/registry');
const { appendEvent } = require('../context/eventlog');
const { getRouteConfig } = require('../config/load');
const { initApprovalMode, getApprovalState, formatApprovalStatus } = require('../config/approval');

/**
 * Run a mission
 * @param {string} missionDir - Mission directory path
 * @param {Object} options - Runtime options
 * @param {string} options.model - Override model
 * @param {string} options.repoRoot - Repository root
 * @param {string} options.route - Route type (ask, build, etc.)
 * @returns {Object} Run result
 */
async function runMission(missionDir, options = {}) {
  const { repoRoot, route = 'ask' } = options;

  // Read mission config
  const missionPath = path.join(missionDir, 'mission.yaml');
  if (!fs.existsSync(missionPath)) {
    throw new Error(`Mission not found: ${missionPath}`);
  }

  const mission = readYaml(missionPath);
  const runId = generateRunId();
  const startedAt = new Date();

  // Get route config
  const routeConfig = getRouteConfig(repoRoot, route, {
    broker: mission.broker,
    model: options.model || mission.model,
  });

  // Initialize approval mode in meta
  initApprovalMode(missionDir, routeConfig.approval);

  // Create/update meta.json with enhanced fields
  const meta = {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: null,
    status: MissionStatus.RUNNING,
    broker: mission.broker,
    model: options.model || mission.model,
    route: route,
    approval_mode: routeConfig.approval,
    sandbox_mode: routeConfig.sandbox,
    attempt_count: 1,
    environment: {
      node_version: process.version,
      platform: process.platform,
      cwd: process.cwd(),
    },
    approval: {
      mode: routeConfig.approval,
    },
  };

  // Check for previous attempts
  const metaPath = path.join(missionDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    const prevMeta = readJson(metaPath);
    meta.attempt_count = (prevMeta.attempt_count || 0) + 1;
    // Preserve approval state
    if (prevMeta.approval) {
      meta.approval = { ...prevMeta.approval, mode: routeConfig.approval };
    }
  }

  writeJson(metaPath, meta);

  // Log start event with enhanced fields
  await appendEvent(repoRoot, {
    type: 'start',
    broker: mission.broker,
    model: meta.model,
    mission_dir: missionDir,
    mission_id: mission.id,
    objective: mission.objective,
    run_id: runId,
    route: route,
    approval_mode: routeConfig.approval,
    sandbox_mode: routeConfig.sandbox,
    attempt_count: meta.attempt_count,
    tags: mission.tags || [],
  });

  // Get and run broker
  const broker = getBroker(mission.broker);
  let result;
  let errorCode = null;

  try {
    // Check broker availability
    const check = await broker.check();
    if (!check.ok) {
      console.log(`\n⚠️  Broker check: ${check.detail}`);
      errorCode = check.errorCode || ErrorCode.BROKER_NOT_INSTALLED;
    }

    // Display approval status
    const approvalState = getApprovalState(missionDir);
    console.log(`📋 Approval: ${formatApprovalStatus(approvalState)}`);

    // Run the mission
    result = await broker.run(missionDir, {
      model: meta.model,
      mission,
      repoRoot,
      route,
    });

    // Determine final status
    let finalStatus;
    if (result.status === 'ok') {
      finalStatus = MissionStatus.COMPLETED;
    } else if (result.status === 'needs_manual') {
      finalStatus = MissionStatus.NEEDS_MANUAL;
    } else {
      finalStatus = MissionStatus.FAILED;
    }

    // Update meta with result
    const finishedAt = new Date();
    meta.finished_at = finishedAt.toISOString();
    meta.status = finalStatus;
    meta.outputs = result.outputs || [];
    meta.evidence = result.evidence || [];
    meta.notes = result.notes || '';
    meta.runtime_sec = result.runtime_sec || Math.round((finishedAt - startedAt) / 1000);
    meta.error_code = result.error_code || errorCode;

    // Model mapping info
    if (result.model_requested) {
      meta.model_requested = result.model_requested;
      meta.model_actual = result.model_actual;
      meta.model_mapped = result.model_mapped;
    }

    writeJson(metaPath, meta);

    // Log end event with enhanced fields
    await appendEvent(repoRoot, {
      type: 'end',
      broker: mission.broker,
      model: meta.model,
      model_actual: meta.model_actual,
      mission_dir: missionDir,
      mission_id: mission.id,
      run_id: runId,
      route: route,
      approval_mode: routeConfig.approval,
      sandbox_mode: routeConfig.sandbox,
      status: finalStatus,
      outputs: meta.outputs,
      evidence: meta.evidence,
      runtime_sec: meta.runtime_sec,
      attempt_count: meta.attempt_count,
      error_code: meta.error_code,
      tags: mission.tags || [],
    });

    // Show needs_manual hint if applicable
    if (finalStatus === MissionStatus.NEEDS_MANUAL) {
      console.log('\n⚠️  Mission requires manual completion.');
      console.log('   1. Complete the task in outputs/MANUAL_PROMPT.md');
      console.log('   2. Save your answer to outputs/answer.md');
      console.log(`   3. Run: liye mission ingest ${path.basename(missionDir)}\n`);
    }

  } catch (err) {
    meta.finished_at = new Date().toISOString();
    meta.status = MissionStatus.FAILED;
    meta.error = err.message;
    meta.error_code = ErrorCode.UNKNOWN;
    meta.runtime_sec = Math.round((new Date() - startedAt) / 1000);
    writeJson(metaPath, meta);

    // Log error event
    await appendEvent(repoRoot, {
      type: 'error',
      broker: mission.broker,
      model: meta.model,
      mission_dir: missionDir,
      mission_id: mission.id,
      run_id: runId,
      route: route,
      approval_mode: routeConfig.approval,
      sandbox_mode: routeConfig.sandbox,
      status: MissionStatus.FAILED,
      error: err.message,
      error_code: ErrorCode.UNKNOWN,
      runtime_sec: meta.runtime_sec,
      attempt_count: meta.attempt_count,
      tags: mission.tags || [],
    });

    throw err;
  }

  return {
    runId,
    missionId: mission.id,
    status: meta.status,
    outputs: result.outputs || [],
    evidence: result.evidence || [],
    notes: result.notes,
    runtime_sec: meta.runtime_sec,
    error_code: meta.error_code,
  };
}

/**
 * Get mission status
 */
function getMissionStatus(missionDir) {
  const metaPath = path.join(missionDir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    return { status: MissionStatus.PENDING };
  }
  return readJson(metaPath);
}

module.exports = { runMission, getMissionStatus };
