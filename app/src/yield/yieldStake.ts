/**
 * Yield Boost: mint JitoSOL from SOL (stake pool), deposit into Kamino JitoSOL/SOL strategy,
 * then run the existing StakeToCurate stake instruction — **two** Phantom signatures on mainnet
 * (mint JitoSOL, then Kamino+stake) to stay under tx size limits and avoid brittle single-tx bundles.
 */
import { Kamino } from '@kamino-finance/kliquidity-sdk'
import { address, type Address, type Instruction, type TransactionSigner } from '@solana/kit'
import { depositSol } from '@solana/spl-stake-pool'
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import Decimal from 'decimal.js'
import {
  AddressLookupTableAccount,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
} from '@solana/web3.js'
import { sendAndConfirm } from '../stakeToCurate/client'
import {
  JITO_STAKE_POOL_MAINNET,
  JITOSOL_MINT_MAINNET,
  kaminoJitosolSolStrategyFromEnv,
} from './constants'
import { kitInstructionToLegacy } from './convertKitIx'
import { getKaminoKitRpcLoose } from './kaminoRpc'
import { noopSignerFromPublicKey } from './kitSigner'
import { legacySigningWallet, type YieldWallet } from './walletAdapter'

export type { YieldWallet }

function flattenDepositPack(pack: {
  instructions: readonly Instruction[]
  lookupTablesAddresses: readonly import('@solana/kit').Address[]
}): { instructions: Instruction[]; lookupTables: PublicKey[] } {
  return {
    instructions: [...pack.instructions],
    lookupTables: pack.lookupTablesAddresses.map((a) => new PublicKey(a)),
  }
}

async function sendVersionedInstructions(
  connection: Connection,
  wallet: YieldWallet,
  instructions: TransactionInstruction[],
  lookupTableAddresses: PublicKey[],
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash()
  const resolved: AddressLookupTableAccount[] = []
  for (const pk of lookupTableAddresses) {
    const res = await connection.getAddressLookupTable(pk)
    if (res.value) resolved.push(res.value)
  }
  const msg = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(resolved)
  let vtx = new VersionedTransaction(msg)
  const signed = await wallet.signTransaction(vtx)
  if (!(signed instanceof VersionedTransaction)) {
    throw new Error('Wallet must return a VersionedTransaction')
  }
  vtx = signed
  const sig = await connection.sendRawTransaction(vtx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed',
  )
  return sig
}

/**
 * Runs mint JitoSOL (L SOL) then Kamino single-sided deposit + StakeToCurate stake (L SOL).
 * Requires wallet balance ≥ 2L + {@link import("./constants").YIELD_BOOST_RESERVE_LAMPORTS}.
 */
export async function runYieldBoostStakeFlow(params: {
  connection: Connection
  wallet: YieldWallet
  stakeLamports: bigint
  stakeInstruction: TransactionInstruction
}): Promise<void> {
  const { connection, wallet, stakeLamports, stakeInstruction } = params
  if (stakeLamports > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Stake amount too large for this client path')
  }
  const lam = Number(stakeLamports)

  const jitoAta = getAssociatedTokenAddressSync(
    JITOSOL_MINT_MAINNET,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  )

  const { instructions: mintIxs, signers } = await depositSol(
    connection,
    JITO_STAKE_POOL_MAINNET,
    wallet.publicKey,
    lam,
    jitoAta,
    undefined,
    undefined,
  )
  if (signers.length > 0) {
    throw new Error('Unexpected local signers from depositSol; use wallet-only flow')
  }

  await sendAndConfirm(connection, legacySigningWallet(wallet), mintIxs)

  const bal = await connection.getTokenAccountBalance(jitoAta)
  const ui = new Decimal(bal.value.uiAmountString ?? '0')
  if (ui.lessThanOrEqualTo(0)) {
    throw new Error('No JitoSOL received after stake-pool deposit')
  }

  const rpc = getKaminoKitRpcLoose(connection.rpcEndpoint)
  const kamino = new Kamino('mainnet-beta', rpc)
  const strategyAddr = address(kaminoJitosolSolStrategyFromEnv().toBase58())
  const ownerKit = noopSignerFromPublicKey(wallet.publicKey)
  const slippageBps = new Decimal(100) // 1%

  const swapper = (
    input: unknown,
    tokenAMint: Address,
    tokenBMint: Address,
    user: TransactionSigner,
    slippage: import('decimal.js').default,
    allAccounts: Address[],
  ) =>
    kamino.getJupSwapIxsV6(
      input as Parameters<Kamino['getJupSwapIxsV6']>[0],
      tokenAMint,
      tokenBMint,
      user.address,
      slippage,
      true,
      allAccounts,
      undefined,
      undefined,
    )

  const pack = await kamino.singleSidedDepositTokenA(
    strategyAddr,
    ui,
    ownerKit,
    slippageBps,
    undefined,
    swapper,
    undefined,
    undefined,
    true,
  )

  const { instructions: kitIxs, lookupTables } = flattenDepositPack(pack)
  const legacyStake = stakeInstruction
  const legacyKamino: TransactionInstruction[] = []
  for (const kix of kitIxs) {
    try {
      legacyKamino.push(kitInstructionToLegacy(kix))
    } catch {
      throw new Error(
        'Kamino deposit uses address lookup tables inside an instruction; try again or update the client.',
      )
    }
  }

  const allLegacy = [...legacyKamino, legacyStake]
  if (lookupTables.length > 0) {
    await sendVersionedInstructions(
      connection,
      wallet,
      allLegacy,
      lookupTables,
    )
  } else {
    await sendAndConfirm(connection, legacySigningWallet(wallet), allLegacy)
  }
}
