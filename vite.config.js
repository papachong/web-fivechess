import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.ELECTRON_BUILD ? './' : '/fivechess/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  }
})
