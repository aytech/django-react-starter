import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const djangoProxyTarget = process.env.DJANGO_PROXY_TARGET || 'http://127.0.0.1:8000';

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'build' || isPreview ? '/static/client/' : '/',
  build: {
    outDir: 'dist',
  },
  server: {
    strictPort: true,
    watch: {
      usePolling: process.env.VITE_USE_POLLING === '1',
      interval: 1000,
    },
    proxy: {
      '/api': djangoProxyTarget,
      '/admin': djangoProxyTarget,
      '/static/admin': djangoProxyTarget,
    },
  },
}));
