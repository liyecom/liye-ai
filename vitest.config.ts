import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      'Extensions/**',
      'websites/**',
      'node_modules/**',
    ],
  },
});
