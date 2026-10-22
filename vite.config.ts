import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative URLs work for both the root Pages domain and project Pages paths.
  base: './',
})
