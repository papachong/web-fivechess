import { defineConfig } from 'vite'

export default defineConfig({
  base: '/fivechess/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  }
})
