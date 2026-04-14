/**
 * Node globals expected by Kamino / Orca / some web3 stacks in the browser.
 * Keep this as the first import in main.tsx.
 */
import * as bufferModule from 'buffer'
import browserProcess from 'process'

const BufferCtor = bufferModule.Buffer
if (typeof BufferCtor !== 'function') {
  throw new Error(
    'Buffer polyfill failed: `buffer` did not export Buffer — check vite resolve.alias for `buffer`.',
  )
}

const processShim = browserProcess
if (!processShim.stderr) {
  // Browser build omits streams; some Orca/Kamino paths touch `process.stderr.write`.
  // @ts-expect-error minimal WritableStream stub for the browser bundle
  processShim.stderr = { write: () => true }
}
if (!processShim.stdout) {
  // @ts-expect-error minimal WritableStream stub for the browser bundle
  processShim.stdout = { write: () => true }
}

const root = globalThis as typeof globalThis & {
  Buffer?: typeof BufferCtor
  global?: typeof globalThis
}

root.Buffer = BufferCtor
;(globalThis as unknown as { process: typeof processShim }).process =
  processShim
if (typeof root.global === 'undefined') {
  root.global = globalThis
}
