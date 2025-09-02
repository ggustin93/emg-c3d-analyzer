import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // This directly replaces your craco alias configuration
      '@': path.resolve(__dirname, 'src'),
    }
  },
  server: {
    // Match the port that was previously used with CRACO
    port: 3000,
    open: true, // Automatically open browser on start
    // Proxy API calls to backend
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    // This sets the output directory to 'build' to match CRA's default
    outDir: 'build',
    sourcemap: true, // Enable source maps for production debugging
    rollupOptions: {
      output: {
        manualChunks: {
          // Chunk splitting for better caching
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-tabs', '@radix-ui/react-dialog', '@radix-ui/react-select'],
          charts: ['recharts']
        }
      }
    }
  },
  // Enable CSS code splitting for better performance
  css: {
    modules: {
      localsConvention: 'camelCase'
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/src/tests/authBestPractices.test.tsx']
  }
})