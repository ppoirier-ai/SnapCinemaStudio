/**
 * Live-ish read model for the Watch page “Yield Boost” card (mainnet only).
 */
import { Kamino } from '@kamino-finance/kliquidity-sdk'
import { address } from '@solana/kit'
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { PublicKey, type Connection } from '@solana/web3.js'
import { JITOSOL_MINT_MAINNET, kaminoJitosolSolStrategyFromEnv } from './constants'
import { getKaminoKitRpcLoose } from './kaminoRpc'

export type YieldDashboardSnapshot = {
  /** Kamino k-token (strategy shares) balance, UI amount if ATA exists */
  kaminoSharesUi: string | null
  /** Wallet JitoSOL SPL balance (includes amounts not yet in Kamino) */
  jitosolWalletUi: string | null
  /** Vault/strategy APY from Kamino API when available */
  kaminoApyPercent: number | null
  fetchedAtMs: number
}

export async function fetchYieldDashboardSnapshot(
  connection: Connection,
  owner: PublicKey,
): Promise<YieldDashboardSnapshot> {
  const rpc = getKaminoKitRpcLoose(connection.rpcEndpoint)
  const kamino = new Kamino('mainnet-beta', rpc)
  const strategyAddr = address(kaminoJitosolSolStrategyFromEnv().toBase58())

  let kaminoSharesUi: string | null = null
  let kaminoApyPercent: number | null = null

  try {
    const st = await kamino.getStrategyByAddress(strategyAddr)
    if (st) {
      const sharesMint = new PublicKey(String(st.sharesMint))
      const sharesAta = getAssociatedTokenAddressSync(
        sharesMint,
        owner,
        false,
        TOKEN_PROGRAM_ID,
      )
      const ai = await connection.getTokenAccountBalance(sharesAta).catch(() => null)
      if (ai && Number(ai.value.amount) > 0) {
        kaminoSharesUi = ai.value.uiAmountString ?? null
      }
    }
  } catch {
    kaminoSharesUi = null
  }

  try {
    const apy = await kamino.getStrategyAprApy(strategyAddr)
    const n = apy.totalApy.toNumber()
    kaminoApyPercent = Number.isFinite(n) ? n : null
  } catch {
    kaminoApyPercent = null
  }

  const jitoAta = getAssociatedTokenAddressSync(
    JITOSOL_MINT_MAINNET,
    owner,
    false,
    TOKEN_PROGRAM_ID,
  )
  let jitosolWalletUi: string | null = null
  try {
    const j = await connection.getTokenAccountBalance(jitoAta)
    if (Number(j.value.amount) > 0) {
      jitosolWalletUi = j.value.uiAmountString ?? null
    }
  } catch {
    jitosolWalletUi = null
  }

  return {
    kaminoSharesUi,
    jitosolWalletUi,
    kaminoApyPercent,
    fetchedAtMs: Date.now(),
  }
}
