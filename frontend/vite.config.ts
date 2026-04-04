import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8080';
const mediamtxUrl = process.env.MEDIAMTX_URL ?? 'http://localhost:8888';

export default defineConfig({
  plugins: [react(), cesium()],
  define: {
    global: 'globalThis',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      // Polling is required when the source is mounted into a Docker container
      // on Linux or Windows hosts where inotify events don't cross the bind mount.
      usePolling: !!process.env.CHOKIDAR_USEPOLLING,
    },
    proxy: {
      '/ws-skytrack': {
        target: backendUrl,
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/hls': {
        target: mediamtxUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hls/, ''),
      },
    },
  },
});
