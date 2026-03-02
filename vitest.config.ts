import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/renderer/**/*.{ts,tsx}'],
      exclude: [
        'src/renderer/**/*.test.{ts,tsx}',
        'src/renderer/**/*.d.ts',
        'src/renderer/components/ui/**', // Radix UI wrappers - low priority
        'src/renderer/main.tsx', // Entry point
        'src/renderer/vite-env.d.ts',
      ],
      // Thresholds will be increased as more tests are added
      // Target: 95% coverage by end of testing tasks
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
});
