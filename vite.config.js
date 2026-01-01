import { defineConfig } from 'vite'

export default defineConfig({
  base: (process.env.ELECTRON_BUILD || process.env.CAPACITOR_BUILD) ? './' : '/fivechess/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  }
})
