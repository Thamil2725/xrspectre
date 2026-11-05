import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the Vite server proxies API calls to the backend, so the
// app always talks to a same-origin "/api" (as it does in production).
const apiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:4000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react-dom') || id.includes('/node_modules/react/') || id.includes('/node_modules/react-router')) return 'react-vendor';
          if (id.includes('/node_modules/@codemirror') || id.includes('/node_modules/@uiw/react-codemirror')) return 'codemirror';
          if (id.includes('/node_modules/lucide-react')) return 'ui';
        },
      },
    },
    chunkSizeWarningLimit: 500,
    sourcemap: false,
  },
})
