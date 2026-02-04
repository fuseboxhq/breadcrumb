import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9999,
    proxy: {
      '/api/watch': {
        target: 'http://localhost:9998',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['X-Accel-Buffering'] = 'no';
          });
        },
      },
      '/api': {
        target: 'http://localhost:9998',
        changeOrigin: true,
      },
    },
  },
})
