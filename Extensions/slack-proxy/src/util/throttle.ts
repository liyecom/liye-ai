/**
 * Chunk Throttler
 *
 * Prevents Slack message flooding by throttling updates based on:
 * 1. Phase changes (always update)
 * 2. Progress step threshold (e.g., every 10%)
 * 3. Minimum time interval (e.g., 900ms between updates)
 * 4. Maximum updates per job (hard limit)
 */

export type ThrottleReason =
  | 'phase_change'
  | 'progress_step'
  | 'min_interval'
  | 'forced_final'
  | 'dropped';

export interface ThrottleDecision {
  shouldUpdate: boolean;
  reason: ThrottleReason;
}

export interface ThrottleConfig {
  minIntervalMs: number;     // Minimum ms between updates (default: 900)
  progressStep: number;      // Progress step threshold (default: 10)
  maxUpdatesPerJob: number;  // Max updates per job (default: 30)
}

export interface ChunkInput {
  traceId: string;
  phase: string;
  progress: number;
  isFinal?: boolean;
}

interface JobState {
  lastPhase: string | null;
  lastProgress: number;
  lastUpdateTime: number;
  updateCount: number;
}

const DEFAULT_CONFIG: ThrottleConfig = {
  minIntervalMs: 900,
  progressStep: 10,
  maxUpdatesPerJob: 30,
};

/**
 * Load throttle config from environment variables.
 */
export function loadThrottleConfig(): ThrottleConfig {
  return {
    minIntervalMs: parseInt(process.env.SLACK_UPDATE_MIN_INTERVAL_MS || '900', 10),
    progressStep: parseInt(process.env.SLACK_PROGRESS_STEP || '10', 10),
    maxUpdatesPerJob: parseInt(process.env.SLACK_MAX_UPDATES_PER_JOB || '30', 10),
  };
}

/**
 * Create a chunk throttler instance.
 */
export function createChunkThrottler(cfg?: Partial<ThrottleConfig>): {
  decide(input: ChunkInput): ThrottleDecision;
  reset(traceId: string): void;
  getState(traceId: string): JobState | undefined;
} {
  const config: ThrottleConfig = { ...DEFAULT_CONFIG, ...cfg };
  const jobs = new Map<string, JobState>();

  function getOrCreateState(traceId: string): JobState {
    let state = jobs.get(traceId);
    if (!state) {
      state = {
        lastPhase: null,
        lastProgress: 0,
        lastUpdateTime: 0,
        updateCount: 0,
      };
      jobs.set(traceId, state);
    }
    return state;
  }

  function decide(input: ChunkInput): ThrottleDecision {
    const { traceId, phase, progress, isFinal } = input;
    const state = getOrCreateState(traceId);
    const now = Date.now();

    // Rule 1: Always allow forced final (complete/error)
    if (isFinal) {
      state.updateCount++;
      state.lastUpdateTime = now;
      state.lastPhase = phase;
      state.lastProgress = progress;
      return { shouldUpdate: true, reason: 'forced_final' };
    }

    // Rule 2: Hard limit on max updates
    if (state.updateCount >= config.maxUpdatesPerJob) {
      return { shouldUpdate: false, reason: 'dropped' };
    }

    // Rule 3: Phase change always triggers update
    if (phase !== state.lastPhase) {
      state.lastPhase = phase;
      state.lastProgress = progress;
      state.lastUpdateTime = now;
      state.updateCount++;
      return { shouldUpdate: true, reason: 'phase_change' };
    }

    // Rule 4: Check minimum interval
    const timeSinceLastUpdate = now - state.lastUpdateTime;
    if (timeSinceLastUpdate < config.minIntervalMs) {
      return { shouldUpdate: false, reason: 'dropped' };
    }

    // Rule 5: Check progress step
    const progressDelta = progress - state.lastProgress;
    if (progressDelta >= config.progressStep) {
      state.lastProgress = progress;
      state.lastUpdateTime = now;
      state.updateCount++;
      return { shouldUpdate: true, reason: 'progress_step' };
    }

    // Rule 6: Minimum interval passed but not enough progress
    // Still update to show activity (but rate limited)
    if (timeSinceLastUpdate >= config.minIntervalMs * 2) {
      state.lastProgress = progress;
      state.lastUpdateTime = now;
      state.updateCount++;
      return { shouldUpdate: true, reason: 'min_interval' };
    }

    return { shouldUpdate: false, reason: 'dropped' };
  }

  function reset(traceId: string): void {
    jobs.delete(traceId);
  }

  function getState(traceId: string): JobState | undefined {
    return jobs.get(traceId);
  }

  return { decide, reset, getState };
}

/**
 * Create a simple rate limiter for a single operation.
 */
export function createRateLimiter(minIntervalMs: number): {
  canProceed(): boolean;
  markExecuted(): void;
} {
  let lastExecutionTime = 0;

  return {
    canProceed(): boolean {
      const now = Date.now();
      return now - lastExecutionTime >= minIntervalMs;
    },
    markExecuted(): void {
      lastExecutionTime = Date.now();
    },
  };
}
