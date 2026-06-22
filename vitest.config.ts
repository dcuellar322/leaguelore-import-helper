import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/desktop/src/**/*.test.ts', 'packages/import-contract/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: [
        'apps/desktop/src/main/validation.ts',
        'apps/desktop/src/main/espn/transform.ts',
        'packages/import-contract/src/schema.ts',
        'packages/import-contract/src/validate.ts',
        'packages/import-contract/src/fixtures.ts'
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    }
  }
});
