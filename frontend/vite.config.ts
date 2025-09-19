import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { Plugin } from 'vite'

// Custom plugin to ensure content files are copied
const copyContentPlugin = (): Plugin => ({
  name: 'copy-content',
  closeBundle() {
    // Ensure content directory is copied to dist
    const srcDir = path.resolve(__dirname, 'public/content')
    const destDir = path.resolve(__dirname, 'dist/content')
    
    // Function to copy directory recursively
    const copyDir = (src: string, dest: string) => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
      }
      
      const entries = fs.readdirSync(src, { withFileTypes: true })
      
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)
        
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath)
        } else {
          fs.copyFileSync(srcPath, destPath)
        }
      }
    }
    
    if (fs.existsSync(srcDir)) {
      copyDir(srcDir, destDir)
      console.log('✅ Content files copied to dist/content')
    }
  }
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyContentPlugin()],
  publicDir: 'public',
  resolve: {
    alias: {
      // This directly replaces your craco alias configuration
      '@': path.resolve(__dirname, 'src'),
    }
  },
  server: {
    // Match the port that was previously used with CRACO
    port: 3000,
    strictPort: false, // Allow using 3001 if 3000 is taken
    open: true, // Automatically open browser on start
    // Proxy API calls to backend
    proxy: {
      // Proxy all API calls to backend - strip /api prefix when forwarding
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')  // Strip /api prefix when forwarding to backend
      }
    }
  },
  build: {
    // Use 'dist' directory to match Docker expectations
    outDir: 'dist',
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
    exclude: ['**/node_modules/**', '**/dist/**']
  }
})