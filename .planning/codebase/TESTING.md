# Testing Patterns

**Analysis Date:** 2026-04-13

## Test Framework

**Runner:**
- Vitest ^1.0.0
- Config: `vitest.config.ts` (root project)
- Extensions have their own Vitest setup (e.g., `Extensions/slack-proxy/` uses `vitest` via `package.json` scripts)

**Assertion Library:**
- Vitest built-in `expect` (Chai-compatible API)

**Run Commands:**
```bash
npx vitest                    # Run all tests (watch mode by default)
npx vitest run                # Run all tests once
npx vitest tests/gateway      # Run gateway tests only
npx vitest run tests/control  # Run control plane tests
npx vitest run tests/orchestrator  # Run orchestrator tests
npx vitest run tests/trial-run     # Run trial/acceptance tests
```

**Vitest Configuration (`vitest.config.ts`):**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      'Extensions/**',        // Each extension has its own test runner
      'websites/**',          // Website projects excluded
      'node_modules/**',
      'tests/runtime/memory-gateway.test.mjs',  // Specific exclusion
    ],
  },
});
```

## Test File Organization

**Location:**
- Separate `tests/` directory, NOT co-located with source
- Test directory mirrors source structure loosely by domain

**Naming:**
- `.test.ts` for main project tests (control, orchestrator, trial-run)
- `.spec.ts` for gateway and Extensions tests

**Structure:**
```
tests/
├── control/
│   └── control-plane.test.ts          # Control plane unit + integration
├── orchestrator/
│   ├── orchestrator.test.ts           # Orchestrator pipeline tests
│   ├── crew-matching.test.ts          # Decomposer crew matching regression
│   └── approval-workflow.test.ts      # DAG approval state machine tests
├── gateway/
│   └── openclaw/
│       ├── job_runner.spec.ts         # Job runner with mocked AGE client
│       └── trace_store.spec.ts        # Trace store unit tests
└── trial-run/
    ├── v1-trial-run.test.ts           # v1 acceptance suite (A/B/C classes)
    ├── v1-d7-trial-run.test.ts        # D+7 expanded trial (30-50 tasks)
    ├── v1-postfix-revalidation.test.ts # Post-fix revalidation
    ├── v1-a3-trial.test.ts            # A3 write trial
    └── v1-a3-batch1-trial.test.ts     # A3 batch 1 trial
```

## Test Structure

**Suite Organization:**
```typescript
/**
 * [Component] Tests — [Phase/Scope]
 *
 * Tests: [list of modules covered]
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Section separators for multi-module test files:
// ============================================================
// Phase 0: Extractor
// ============================================================

describe('inferSideEffect', () => {
  it('classifies *_research as read', () => {
    expect(inferSideEffect('market_research')).toBe('read');
  });

  it('defaults unknown to write (conservative, fail-closed)', () => {
    expect(inferSideEffect('unknown_skill_name')).toBe('write');
  });
});
```

**Test description style:**
- `it('should ...')` in gateway/extension tests
- `it('classifies/returns/filters/blocks ...')` (verb-first, no "should") in control/orchestrator tests
- Descriptive names that explain the rule being tested: `'downstream stays pending when dependency is pending_approval'`
- Test IDs used in regression suites: `'C01: "a" alone -> no-match (rule fallback)'`

**Patterns:**

**Setup (beforeEach/beforeAll):**
```typescript
let registry: CapabilityRegistry;
let engine: OrchestrationEngine;

beforeEach(() => {
  registry = new CapabilityRegistry();
  registry.scanAgents([AGENTS_DIR]);
  // ... build full dependency chain
});
```
- `beforeEach` for unit tests -- fresh state per test
- `beforeAll` for acceptance/trial-run tests -- shared infrastructure, per-test metrics
- Temp directories for file-based tests: `mkdtemp(join(tmpdir(), 'prefix-'))`

**Teardown:**
```typescript
afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});
```
- `afterEach` used for temp directory cleanup
- `afterAll` used for writing metric reports to trace files

**Assertion style:**
- Vitest matchers: `toBe()`, `toEqual()`, `toBeDefined()`, `toContain()`, `toBeGreaterThan()`
- `toBeCloseTo()` for floating-point comparisons
- `toHaveProperty()` for structural checks on objects
- Array membership: `expect(array).toContain(value)` or `expect(array.some(predicate)).toBe(true)`
- Negation: `expect(x).not.toBe(y)`

## Mocking

**Framework:** Vitest `vi` module

**Patterns:**

**Module mocking (vi.mock):**
```typescript
// Mock at module level before imports
vi.mock('../../../src/gateway/openclaw/age_job_client', () => ({
  ageCreateJob: vi.fn(),
  ageGetJob: vi.fn(),
  ageGetJobResult: vi.fn(),
}));

// Import after mock declaration
import { ageCreateJob, ageGetJob } from '../../../src/gateway/openclaw/age_job_client';

// Type-safe mock access
const mockAgeCreateJob = vi.mocked(ageCreateJob);
```

**Mock setup per test:**
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

it('should process valid request', async () => {
  mockAgeCreateJob.mockResolvedValue({ job_id: 'job-123' });
  mockAgeGetJob.mockResolvedValue({ job_id: 'job-123', status: 'done', ... });
  // ... test logic
});
```

**Custom executor injection (no mocking needed):**
```typescript
// Engine accepts optional executor function -- no mock framework required
const failFirstExecutor = async (task: Task): Promise<TaskResult> => {
  callCount++;
  if (callCount === 1) {
    return { task_id: task.id, status: 'failure', outputs: {}, duration: 10, error: 'simulated' };
  }
  return { task_id: task.id, status: 'success', outputs: { result: 'from_fallback' }, duration: 5 };
};

const result = await engine.orchestrate(intent, failFirstExecutor);
```

**What to Mock:**
- External API clients (AGE job client)
- File system operations when testing non-IO logic
- Never mock the module under test

**What NOT to Mock:**
- Internal modules within the same layer (registry, trust, policy)
- YAML file loading in integration tests (use real `Agents/` and `Crews/` directories)
- DAG scheduler state machine (test real state transitions)

## Fixtures and Factories

**Test Data:**

**Inline fixture objects:**
```typescript
const validRequest: GovToolCallRequestV1 = {
  version: 'GOV_TOOL_CALL_REQUEST_V1',
  trace_id: 'test-trace-123',
  idempotency_key: 'idem-123',
  tenant_id: 'slack:T123',
  task: 'Analyze wasted spend',
  // ... full object literal
};
```

**Helper functions for test data:**
```typescript
function makeIntent(goal: string, domain?: string): Intent {
  return { id: `test_${Date.now()}`, goal, domain };
}

function buildTwoTaskDAG(): DAGScheduler {
  const tasks: Task[] = [
    { id: 't1', agent: 'a1', skill: 's1', inputs: {} },
    { id: 't2', agent: 'a2', skill: 's2', inputs: {}, depends_on: ['t1'] },
  ];
  const dag = new DAGScheduler();
  dag.build(tasks);
  return dag;
}
```

**Path constants for real data:**
```typescript
const AGENTS_DIR = path.resolve(__dirname, '../../Agents');
const CREWS_DIR = path.resolve(__dirname, '../../Crews');
const TRACE_DIR = path.resolve(__dirname, '../../data/traces/orchestrator');
```

**Location:**
- No separate fixtures directory -- all fixtures inline in test files
- Real YAML files from `Agents/` and `Crews/` used as integration test data

## Coverage

**Requirements:** Not enforced (no coverage thresholds configured)

**View Coverage:**
```bash
npx vitest run --coverage      # Requires @vitest/coverage-v8 or similar
```

## Test Types

**Unit Tests:**
- Scope: Single function or class method
- Files: `tests/control/control-plane.test.ts` (inferSideEffect, extractFromAgentYAML sections), `tests/gateway/openclaw/trace_store.spec.ts`
- Pattern: Direct function calls, assertion on return values
- No external dependencies (temp dirs for file I/O)

**Integration Tests:**
- Scope: Multi-module pipelines using real YAML data
- Files: `tests/orchestrator/orchestrator.test.ts`, `tests/orchestrator/crew-matching.test.ts`
- Pattern: Build full dependency chain (registry + trust + policy + decomposer + router + engine), exercise end-to-end
- Use real `Agents/` and `Crews/` YAML files, not mocks

**Acceptance / Trial-Run Tests:**
- Scope: System-level validation with metrics collection
- Files: `tests/trial-run/v1-trial-run.test.ts`, `tests/trial-run/v1-d7-trial-run.test.ts`
- Pattern: Define task corpus with expected outcomes, run through full orchestration pipeline, collect precision/recall/latency metrics, write trace reports
- Metrics: `top1_correct`, `auto_bind_success`, `fallback_triggered`, `fallback_rescued`, `human_override`, `latency_ms`
- Reports written to `data/traces/` directories

**Regression Tests:**
- Scope: Specific bug fixes verified with targeted assertions
- Files: `tests/orchestrator/crew-matching.test.ts` (P0 fix regression)
- Pattern: Named test IDs (C01-C18), explicit edge cases, false-positive rate assertions

**State Machine Tests:**
- Scope: DAG approval lifecycle transitions
- Files: `tests/orchestrator/approval-workflow.test.ts`
- Pattern: State transition table documented in comments, all paths tested (approve/reject/timeout), conservation invariants verified

**E2E Tests:**
- Not used at the root project level
- Extensions (slack-proxy) have smoke tests that approximate integration testing

## Common Patterns

**Async Testing:**
```typescript
it('should process valid request through all phases', async () => {
  mockAgeCreateJob.mockResolvedValue({ job_id: 'job-123' });
  // ...

  const chunks: StreamChunkV1[] = [];
  const generator = runGovernedToolCall(validRequest, { trace: traceStore, ageConfig });

  for await (const chunk of generator) {
    chunks.push(chunk);
  }

  expect(chunks.some(c => c.phase === 'gate')).toBe(true);
});
```

**Async Generator Testing:**
```typescript
// Consume async generator fully, collect all yielded values
const chunks: StreamChunkV1[] = [];
for await (const chunk of generator) {
  chunks.push(chunk);
  if (chunk.type === 'complete') {
    result = chunk.data;
  }
}
```

**Error/Block Testing:**
```typescript
it('should block requests with invalid action_type', async () => {
  const invalidRequest = { ...validRequest, proposed_actions: [{ action_type: 'write' as const, ... }] };

  const chunks: StreamChunkV1[] = [];
  for await (const chunk of runGovernedToolCall(invalidRequest as any, deps)) {
    chunks.push(chunk);
  }

  const completeChunk = chunks.find(c => c.type === 'complete');
  expect((completeChunk?.data as any).decision).toBe('BLOCK');
});
```

**Timeout Testing:**
```typescript
it('isTimedOut detects expired approvals', async () => {
  dag.markRunning('t1');
  dag.markPendingApproval('t1', 1); // 1ms timeout
  // Spin-wait for expiry (small timeout)
  const start = Date.now();
  while (Date.now() - start < 5) { /* spin */ }
  expect(dag.isTimedOut('t1')).toBe(true);
});
```

**Metrics Collection Pattern (trial-run tests):**
```typescript
interface TrialMetrics {
  tasks: Array<{
    id: string;
    category: 'A' | 'B' | 'C';
    top1_correct: boolean;
    auto_bind_success: boolean;
    fallback_triggered: boolean;
    // ...
  }>;
  veto_violations: string[];
}

const metrics: TrialMetrics = { tasks: [], veto_violations: [] };

afterAll(() => {
  // Write metrics to JSON trace file
  fs.writeFileSync(tracePath, JSON.stringify(metrics, null, 2));
});
```

**Corpus-Based Testing (regression):**
```typescript
const corpus: Array<{ goal: string; expected: 'research-team' | 'analysis-team' | 'no-match' }> = [
  { goal: 'Research competitive landscape for outdoor rugs', expected: 'research-team' },
  { goal: 'Deploy to production', expected: 'no-match' },
  // ...
];

it('computes crew match metrics', async () => {
  let correct = 0;
  for (const { goal, expected } of corpus) {
    const plan = await decomposer.decompose(makeIntent(goal));
    // ... classify and count
  }
  expect(accuracy).toBeGreaterThanOrEqual(0.85);
  expect(fpRate).toBe(0);
});
```

## Adding New Tests

**New unit test for a control plane module:**
- File: `tests/control/<module-name>.test.ts`
- Import from `vitest`: `describe, it, expect, beforeEach`
- Use section separators for logical groupings
- Build dependencies inline (not shared fixtures)

**New integration test for orchestrator:**
- File: `tests/orchestrator/<feature>.test.ts`
- Use real `AGENTS_DIR` and `CREWS_DIR` paths
- Build full dependency chain in `beforeEach`
- Test the orchestration pipeline end-to-end

**New gateway test:**
- File: `tests/gateway/openclaw/<module>.spec.ts`
- Use `mkdtemp` for temp directories, `afterEach` cleanup
- Mock external API clients with `vi.mock()`

**New trial-run / acceptance test:**
- File: `tests/trial-run/<name>.test.ts`
- Define metrics interface, collect per-test results
- Write trace to `data/traces/<subdir>/`
- Include quantitative assertions (accuracy >= threshold)

---

*Testing analysis: 2026-04-13*
