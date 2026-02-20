import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
      strictPort: true,
    },
    build: {
      // 优化构建输出
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false, // 🔧 DEBUG: Enable logs for Ralph Loop verification
          drop_debugger: false,
        },
      },
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          content: path.resolve(__dirname, 'src/chrome-extension/content.js'),
        },
        output: {
          // 优化chunk命名
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: (chunkInfo) => {
            // Extension entry points should have static names
            if (chunkInfo.name === 'content' || chunkInfo.name === 'background') {
              return 'extension/[name].js';
            }
            return 'assets/[name]-[hash].js';
          },
          assetFileNames: 'assets/[name]-[hash].[ext]',
          // 动态导入分割点
          manualChunks: (id) => {
            // 第三方库
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react';
            }
            if (id.includes('node_modules/@google/genai')) {
              return 'google';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'ui';
            }
            if (id.includes('node_modules/react-markdown')) {
              return 'markdown';
            }
            // 核心服务
            if (id.includes('services/yppService.ts') ||
              id.includes('services/veoService.ts') ||
              id.includes('services/stateManagerService.ts') ||
              id.includes('services/messageBusService.ts')) {
              return 'coreServices';
            }
            // 分析服务
            if (id.includes('services/analyticsService.ts') ||
              id.includes('services/trendService.ts')) {
              return 'analytics';
            }
            // 认证服务
            if (id.includes('services/oauthService.ts')) {
              return 'auth';
            }
            // 大型组件
            if (id.includes('components/YouTubeAnalytics')) {
              return 'youtubeAnalytics';
            }
            if (id.includes('components/Editor')) {
              return 'editor';
            }
          },
          // 优化模块连接
          compact: true
        },
        // 优化Tree Shaking
        treeshake: {
          moduleSideEffects: 'no-external',
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
        },
        // 解决动态导入警告
        onwarn: (warning, warn) => {
          // 忽略动态导入警告
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
            warning.code === 'UNUSED_EXTERNAL_IMPORT' ||
            (warning.code === 'PLUGIN_WARNING' &&
              warning.message.includes('dynamic import')) ||
            warning.code === 'CIRCULAR_DEPENDENCY'
          ) {
            return;
          }
          warn(warning);
        }
      },
      // 调整警告阈值
      chunkSizeWarningLimit: 1000,
      // 启用CSS代码分割
      cssCodeSplit: true,
      // 生产环境sourcemap
      sourcemap: false,
      // 优化依赖预构建
      optimizeDeps: {
        include: ['react', 'react-dom', '@google/genai', 'lucide-react', 'react-markdown'],
        exclude: ['@types/node'],
        esbuildOptions: {
          target: 'es2020',
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'globalThis.VITE_OAUTH_SERVER_URL': JSON.stringify(env.OAUTH_SERVER_URL || 'http://localhost:51122')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});