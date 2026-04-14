/**
 * Must load before any module that uses Node's Buffer (e.g. @kamino-finance/kliquidity-sdk).
 * ES modules evaluate imports in source order; keep this as the first import in main.tsx.
 */
import { Buffer } from 'buffer'

Object.assign(globalThis, { Buffer })
