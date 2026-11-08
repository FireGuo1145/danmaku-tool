import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { bilibiliApiPlugin } from './server/bilibiliApi.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = (env.VITE_BILI_API_BASE || '/bili-api').trim();

  return {
    plugins: [react(), bilibiliApiPlugin({ prefix: apiBase, cookie: env.BILI_COOKIE, uid: env.BILI_UID })],
    resolve: {
      alias: [
        // bilibili-ws-client 的 ESM 构建依赖 Node 的 zlib，这里换成浏览器可用的 pako 实现
        { find: /^zlib$/, replacement: fileURLToPath(new URL('./src/lib/zlibShim.ts', import.meta.url)) },
        // 库内部继承自 Node 的 EventEmitter，用 npm 上的浏览器实现替代
        { find: /^events$/, replacement: fileURLToPath(new URL('./node_modules/events/events.js', import.meta.url)) },
      ],
    },
    define: {
      global: 'globalThis',
    },
    optimizeDeps: {
      include: ['bilibili-ws-client', 'buffer', 'pako'],
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      watch: {
        // 忽略临时目录（截图 / 测试脚本等）
        ignored: ['**/.tmp/**'],
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1200,
    },
  };
});
