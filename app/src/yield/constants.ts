import { PublicKey } from '@solana/web3.js'

/** Solana mainnet genesis hash (used with RPC to detect cluster). */
export const MAINNET_GENESIS_HASH =
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'

/**
 * Official Jito stake pool on mainnet (SPL stake pool program).
 * @see https://github.com/jito-foundation/jito-omnidocs/blob/master/jitosol/jitosol-liquid-staking/security/deployed-programs/index.md
 */
export const JITO_STAKE_POOL_MAINNET = new PublicKey(
  'Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb',
)

export const JITOSOL_MINT_MAINNET = new PublicKey(
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
)

/**
 * Kamino **liquidity strategy** (JitoSOL / SOL) with highest TVL on the public metrics feed.
 * Earn vaults use a different program than kvault; this pubkey is the on-chain strategy account.
 * Override with `VITE_KAMINO_JITOSOL_SOL_STRATEGY` if Kamino migrates the canonical pool.
 */
export const DEFAULT_KAMINO_JITOSOL_SOL_STRATEGY_MAINNET = new PublicKey(
  '4Zuhh9SD6iQyaPx9vTt2cqHpAcwM7JDvUMkqNmyv6oSD',
)

export function kaminoJitosolSolStrategyFromEnv(): PublicKey {
  const raw = import.meta.env.VITE_KAMINO_JITOSOL_SOL_STRATEGY
  if (raw == null || String(raw).trim() === '') {
    return DEFAULT_KAMINO_JITOSOL_SOL_STRATEGY_MAINNET
  }
  return new PublicKey(String(raw).trim())
}

/** Midpoint of the 7.5%–8.5% product band for UI estimates (overridable). */
export function yieldBoostApyPercent(): number {
  const raw = import.meta.env.VITE_YIELD_BOOST_APY_PERCENT
  if (raw == null || String(raw).trim() === '') return 8
  const n = Number.parseFloat(String(raw).trim())
  return Number.isFinite(n) && n > 0 ? n : 8
}

/**
 * Extra lamports beyond `2 * stake` required on the wallet (ATAs, Jupiter route, compute).
 * Keep in sync with realistic mainnet costs; conservative default.
 */
export const YIELD_BOOST_RESERVE_LAMPORTS = 8_000_000n // 0.008 SOL
