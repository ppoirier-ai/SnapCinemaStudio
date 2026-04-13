import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /** Orca (via Kamino kliquidity) ships `.wasm`; include so Rolldown/Vite can emit assets. */
  assetsInclude: ['**/*.wasm'],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
})
