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
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE || '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    // Ensure Vite resolves TypeScript files correctly
    mainFields: ['module', 'main'],
  },
  // Ensure proper handling of TypeScript files
  esbuild: {
    target: 'es2022',
  },
})
