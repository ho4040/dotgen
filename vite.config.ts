import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` must match the GitHub Pages project path: https://<user>.github.io/dotgen/
export default defineConfig({
  base: '/dotgen/',
  plugins: [react()],
})
