import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// publicDir 直接指向仓库 assets/：/registry.json 与 /tripo/*.glb 原样可访问，
// assetId → GLB 的换皮只依赖登记台账（approved 才加载），白膜是默认回退。
export default defineConfig({
  base: './',
  publicDir: resolve(HERE, '../../assets'),
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8077', changeOrigin: true },
    },
  },
});
