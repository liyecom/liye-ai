import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      'Extensions/**',
      'websites/**',
      'node_modules/**',
      'tests/runtime/memory-gateway.test.mjs',
      // Phase 1b GHL importer tests use the Node built-in runner (node:test),
      // not vitest. vitest would collect them and fail with "No test suite found".
      // Run them with: node --test .claude/scripts/learning/tests/*.test.mjs
      '.claude/scripts/learning/tests/**',
      // Phase 1c GHL policy_trial_evaluator tests also use node:test (same reason).
      // Run them with: node --test src/reasoning/tests/*.test.mjs
      'src/reasoning/tests/**',
    ],
  },
});
