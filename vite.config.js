import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'copy-overwolf-files',
      apply: 'build',
      writeBundle() {
        mkdirSync('dist', { recursive: true })
        copyFileSync('manifest.json', 'dist/manifest.json')
        copyFileSync('background.js', 'dist/background.js')
        copyFileSync('background.html', 'dist/background.html')
      }
    }
  ],
})