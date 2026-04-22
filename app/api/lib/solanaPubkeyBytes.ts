import bs58 from 'bs58'
import { timingSafeEqual } from 'node:crypto'

/**
 * Ed25519 public key bytes (32) from a base58 wallet address. Avoids
 * `@solana/web3.js` in Vercel serverless bundles (large + occasional init issues).
 */
export function decodeBase58Ed25519Pubkey(s: string): Uint8Array | null {
  const t = s.trim()
  if (!t) return null
  try {
    const d = bs58.decode(t)
    if (d.length !== 32) return null
    return d
  } catch {
    return null
  }
}

export function ed25519PubkeyBytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== 32 || b.length !== 32) return false
  return timingSafeEqual(a, b)
}
