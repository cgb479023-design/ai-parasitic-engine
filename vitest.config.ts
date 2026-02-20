import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'scripts', '.archive', 'src/services/dependencyAnalysisService.test.ts', 'performance-tests/backend/scenarios/**', 'performance-tests/frontend/dashboard.perf.test.ts'],
    setupFiles: ['tests/setup.ts'],
    reporters: ['junit', 'default'], // Add junit reporter
    outputFile: 'junit.xml', // Output to junit.xml
    coverage: {
      provider: 'v8',
      include: ['src/**/*', 'components/**/*', 'services/**/*'],
      exclude: ['node_modules', 'dist', 'scripts', '**/*.d.ts', 'components/YouTubeAnalytics.tsx', 'services/codeReviewService.ts', 'services/securityScanService.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        branches: 80, // Updated to 80
        functions: 80, // Updated to 80
        lines: 80, // Updated to 80
        statements: 80, // Updated to 80
      }
    },
    globals: true,
    // 启用 Jest 兼容模式
    environmentOptions: {
      customExportConditions: ['node', 'node-addons'],
      VITE_NODE_OPTIONS: "--max-old-space-size=4096"
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
