import type { Connection } from '@solana/web3.js'
import { MAINNET_GENESIS_HASH } from './constants'

/**
 * Yield boost uses JitoSOL + Kamino on **mainnet** only.
 * Requires env `VITE_ENABLE_YIELD_BOOST=true` so devnet demos do not surface a broken toggle.
 */
export async function isMainnetYieldBoostAvailable(
  connection: Connection,
): Promise<boolean> {
  const boost =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_ENABLE_YIELD_BOOST
      : typeof process !== 'undefined'
        ? process.env.VITE_ENABLE_YIELD_BOOST
        : undefined
  if (boost !== 'true') return false
  try {
    const gh = await connection.getGenesisHash()
    return gh === MAINNET_GENESIS_HASH
  } catch {
    return false
  }
}
