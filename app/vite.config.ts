import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
/** Force the real feross `buffer` package — Vite can otherwise stub `buffer` / `node:buffer` for the client. */
const bufferFile = path.join(appRoot, 'node_modules', 'buffer', 'index.js')
const processBrowserFile = path.join(appRoot, 'node_modules', 'process', 'browser.js')

/**
 * Kamino / Orca / Anchor code often references bare `Buffer` (Node global). Inject a real
 * `Buffer` onto `globalThis` at the start of each transformed file in those packages.
 */
function bufferGlobalShim(): Plugin {
  const marker = '__snapBuf'
  return {
    name: 'snap-buffer-global-shim',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('node_modules')) return null
      if (id.includes('?')) return null
      if (/\.cjs(\?|$)/.test(id)) return null
      if (!/\.(mjs|js|ts|tsx|mts|cts)(?:$|\?)/.test(id)) return null
      if (
        !/[/\\]node_modules[/\\](@kamino-finance|@orca-so|@coral-xyz)[/\\]/.test(
          id,
        )
      ) {
        return null
      }
      if (code.includes('__snapBuf')) return null
      const injected = `import { Buffer as ${marker} } from 'buffer';
globalThis.Buffer = ${marker};
`
      return { code: injected + code, map: null }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  /**
   * Vercel’s Supabase integration sets `NEXT_PUBLIC_*`; the app also supports `VITE_*`.
   * Expose both so the client bundle can read URL + anon/publishable keys.
   */
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  /** Directory that contains `index.html`. Keeps resolution stable if `vite` is run from the repo root. */
  root: appRoot,
  /**
   * Default `node_modules/.vite` is relative to `root`; without an explicit `root`, a second cache can
   * appear under `<repo>/node_modules/.vite` when the dev server cwd differs. Pin it under `app/`.
   */
  cacheDir: path.join(appRoot, 'node_modules', '.vite'),
  plugins: [bufferGlobalShim(), react()],
  /** Orca (via Kamino kliquidity) ships `.wasm`; include so Rolldown/Vite can emit assets. */
  assetsInclude: ['**/*.wasm'],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: bufferFile,
      'node:buffer': bufferFile,
      process: processBrowserFile,
      'node:process': processBrowserFile,
    },
  },
  optimizeDeps: {
    /** Ensure the npm `buffer` package is prebundled (avoids "externalized" browser breakage). */
    include: [
      'buffer',
      'process',
      /** CJS package: must be prebundled or `import { Kamino }` fails (no ESM named exports). */
      '@kamino-finance/kliquidity-sdk',
    ],
  },
})
