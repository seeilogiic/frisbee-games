import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.frontend file if it exists
dotenv.config({ path: resolve(process.cwd(), '.env.frontend') })

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Ensure React plugin handles TypeScript files correctly
      include: '**/*.{jsx,tsx,ts}',
    }),
  ],
  base: process.env.GITHUB_PAGES_BASE || '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    // Explicitly list extensions in order of resolution
    // TypeScript files must come before JavaScript files
    // Order matters: try .ts before .tsx for .ts files
    extensions: ['.mjs', '.mts', '.ts', '.tsx', '.js', '.jsx', '.json'],
    // Ensure Vite resolves TypeScript files correctly
    mainFields: ['module', 'main'],
    // Preserve symlinks for better resolution
    preserveSymlinks: false,
    // Explicitly set conditions for module resolution
    conditions: ['import', 'module', 'browser', 'default'],
  },
  // Ensure proper handling of TypeScript files
  esbuild: {
    target: 'es2022',
  },
  // Build configuration
  build: {
    // Ensure proper module resolution during build
    rollupOptions: {
      output: {
        // Ensure consistent module format
        format: 'es',
      },
    },
    // Ensure source maps are handled correctly
    sourcemap: false,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})
