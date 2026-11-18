import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  test: {
    // Browser specs belong to Playwright, not the unit-test runner.
    include: ['tests/*.test.ts'],
    // Several checks load the full SEO registry; avoid competing transforms
    // exhausting the sandbox and timing out otherwise valid assertions.
    maxWorkers: 2,
    testTimeout: 15_000,
  },
});