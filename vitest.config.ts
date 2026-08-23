import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'labs/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', '**/*.test.ts'],
    },
  },
  resolve: {
    alias: {
      '@faultforge/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
      '@faultforge/contracts': path.resolve(__dirname, 'packages/contracts/src/index.ts'),
      '@faultforge/database': path.resolve(__dirname, 'packages/database/src/index.ts'),
      '@faultforge/security': path.resolve(__dirname, 'packages/security/src/index.ts'),
      '@faultforge/commerce-lab': path.resolve(__dirname, 'labs/commerce-lab/src/index.ts'),
      '@faultforge/payment-lab': path.resolve(__dirname, 'labs/payment-lab/src/index.ts'),
      '@faultforge/perf-lab': path.resolve(__dirname, 'labs/perf-lab/src/index.ts'),
      '@faultforge/worker': path.resolve(__dirname, 'apps/worker/src/index.ts'),
      '@faultforge/observability': path.resolve(__dirname, 'packages/observability/src/index.ts'),
      '@faultforge/ui': path.resolve(__dirname, 'packages/ui/src/index.ts'),
      '@faultforge/agent-runtime': path.resolve(__dirname, 'packages/agent-runtime/src/index.ts'),
      '@faultforge/arena-eval': path.resolve(__dirname, 'packages/arena-eval/src/index.ts'),
      '@faultforge/canary-engine': path.resolve(__dirname, 'packages/canary-engine/src/index.ts'),
      '@faultforge/reference-library': path.resolve(
        __dirname,
        'packages/reference-library/src/index.ts',
      ),
    },
  },
});
