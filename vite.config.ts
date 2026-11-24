import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Относительные пути: сайт открывается с GitHub Pages из подпапки репозитория.
export default defineConfig({
  base: './',
  plugins: [react()],
})
