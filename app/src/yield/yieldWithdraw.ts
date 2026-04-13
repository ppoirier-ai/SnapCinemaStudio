/**
 * Withdraw from Kamino strategy shares, then redeem JitoSOL → SOL via the SPL stake pool.
 */
import { Kamino } from '@kamino-finance/kliquidity-sdk'
import { address } from '@solana/kit'
import { withdrawSol } from '@solana/spl-stake-pool'
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { type Connection } from '@solana/web3.js'
import { sendAndConfirm } from '../stakeToCurate/client'
import {
  JITO_STAKE_POOL_MAINNET,
  JITOSOL_MINT_MAINNET,
  kaminoJitosolSolStrategyFromEnv,
} from './constants'
import { kitInstructionToLegacy, kitInstructionsToLegacy } from './convertKitIx'
import { getKaminoKitRpcLoose } from './kaminoRpc'
import { noopSignerFromPublicKey } from './kitSigner'
import { legacySigningWallet, type YieldWallet } from './walletAdapter'

export async function runYieldBoostWithdrawAll(params: {
  connection: Connection
  wallet: YieldWallet
}): Promise<void> {
  const { connection, wallet } = params
  const rpc = getKaminoKitRpcLoose(connection.rpcEndpoint)
  const kamino = new Kamino('mainnet-beta', rpc)
  const strategyAddr = address(kaminoJitosolSolStrategyFromEnv().toBase58())
  const ownerKit = noopSignerFromPublicKey(wallet.publicKey)

  const withdrawPack = await kamino.withdrawAllShares(strategyAddr, ownerKit)
  if (!withdrawPack) {
    throw new Error('No Kamino shares in this wallet for the configured strategy')
  }
  const pre = kitInstructionsToLegacy(withdrawPack.prerequisiteIxs)
  const wix = kitInstructionToLegacy(withdrawPack.withdrawIx)
  const post = withdrawPack.closeSharesAtaIx
    ? [kitInstructionToLegacy(withdrawPack.closeSharesAtaIx)]
    : []
  await sendAndConfirm(connection, legacySigningWallet(wallet), [...pre, wix, ...post])

  const jitoAta = getAssociatedTokenAddressSync(
    JITOSOL_MINT_MAINNET,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  )
  const bal = await connection.getTokenAccountBalance(jitoAta)
  const lamports = Number(bal.value.amount)
  if (lamports <= 0) return

  const { instructions, signers } = await withdrawSol(
    connection,
    JITO_STAKE_POOL_MAINNET,
    wallet.publicKey,
    wallet.publicKey,
    lamports,
    undefined,
  )
  if (signers.length > 0) {
    throw new Error('Unexpected signers from withdrawSol')
  }
  await sendAndConfirm(connection, legacySigningWallet(wallet), instructions)
}
