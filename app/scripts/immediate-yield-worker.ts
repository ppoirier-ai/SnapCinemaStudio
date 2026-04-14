/**
 * Permissionless vault sweep + treasury JitoSOL/Kamino compound (mainnet).
 * Signs with TREASURY_KEYPAIR only — no Phantom. See docs/vault-yield-pool-plan.md
 *
 * From `app/`:
 *   TREASURY_KEYPAIR=$HOME/.config/solana/id.json \
 *   STAKE_SLOT_AUTHORITY=<base58 authority of the slot> \
 *   SOLANA_RPC=https://api.mainnet-beta.solana.com \
 *   npx tsx scripts/immediate-yield-worker.ts
 */
import { readFileSync } from 'node:fs'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  DEMO_SLOT_ID,
  ixCrankSweepYieldPool,
  PROGRAM_ID,
  sendAndConfirmWithKeypair,
  slotPda,
  tryDecodeSlot,
  vaultPda,
} from '../src/stakeToCurate/client'
import { MAINNET_GENESIS_HASH, YIELD_BOOST_RESERVE_LAMPORTS } from '../src/yield/constants'
import { runTreasuryPoolCompound } from '../src/yield/yieldStake'
import { keypairYieldWallet } from '../src/yield/walletAdapter'

function loadKeypair(path: string): Keypair {
  const raw = readFileSync(path, 'utf-8')
  const secret = JSON.parse(raw) as number[]
  return Keypair.fromSecretKey(Uint8Array.from(secret))
}

function demoSlotIdFromEnv(): number {
  const raw =
    process.env.STAKE_DEMO_SLOT_ID ??
    process.env.VITE_DEMO_SLOT_ID ??
    process.env.DEMO_SLOT_ID
  if (raw == null || String(raw).trim() === '') return DEMO_SLOT_ID
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 0 || n > 255) return DEMO_SLOT_ID
  return n & 0xff
}

async function tick(
  connection: Connection,
  treasuryKp: Keypair,
  slotAuthority: PublicKey,
  slotId: number,
  mainnet: boolean,
): Promise<void> {
  const slotPk = slotPda(slotAuthority, slotId)
  const vaultPk = vaultPda(slotPk)

  const [slotAi, vaultAi] = await Promise.all([
    connection.getAccountInfo(slotPk),
    connection.getAccountInfo(vaultPk),
  ])
  if (!slotAi?.data || !tryDecodeSlot(Buffer.from(slotAi.data))) {
    console.warn('[yield-worker] slot account missing or wrong program / layout')
    return
  }
  const slotDecoded = tryDecodeSlot(Buffer.from(slotAi.data))!
  if (slotDecoded.yieldTreasury.equals(PublicKey.default)) {
    console.warn('[yield-worker] yield treasury not configured (configure_yield_treasury)')
    return
  }
  if (!treasuryKp.publicKey.equals(slotDecoded.yieldTreasury)) {
    console.warn(
      '[yield-worker] TREASURY_KEYPAIR pubkey must match on-chain yield_treasury',
    )
    return
  }

  if (!vaultAi?.data) {
    console.warn('[yield-worker] vault missing')
    return
  }

  const minRent = await connection.getMinimumBalanceForRentExemption(
    vaultAi.data.length,
  )
  const vaultLamports = BigInt(vaultAi.lamports)
  const maxSweep =
    vaultLamports -
    slotDecoded.totalPrincipalLocked -
    BigInt(minRent)

  if (maxSweep > 0n) {
    if (maxSweep > BigInt(Number.MAX_SAFE_INTEGER)) {
      console.warn('[yield-worker] sweep too large for this client; skipping')
    } else {
      console.log(`[yield-worker] sweep ${maxSweep} lamports to treasury`)
      await sendAndConfirmWithKeypair(connection, treasuryKp, [
        ixCrankSweepYieldPool(
          slotAuthority,
          slotId,
          slotDecoded.yieldTreasury,
          maxSweep,
        ),
      ])
    }
  }

  if (!mainnet) return

  const bal = BigInt(await connection.getBalance(treasuryKp.publicKey))
  const reserve = YIELD_BOOST_RESERVE_LAMPORTS
  if (bal <= reserve) return

  const compoundLamports = bal - reserve
  console.log(`[yield-worker] compound ${compoundLamports} lamports (JitoSOL → Kamino)`)
  await runTreasuryPoolCompound({
    connection,
    wallet: keypairYieldWallet(treasuryKp),
    lamports: compoundLamports,
  })
}

async function main(): Promise<void> {
  const kpPath = process.env.TREASURY_KEYPAIR
  if (!kpPath?.trim()) {
    throw new Error('Set TREASURY_KEYPAIR to a json keypair file (same pubkey as yield treasury)')
  }
  const authStr = process.env.STAKE_SLOT_AUTHORITY?.trim()
  if (!authStr) {
    throw new Error('Set STAKE_SLOT_AUTHORITY to the slot authority base58 pubkey')
  }

  const treasuryKp = loadKeypair(kpPath.trim())
  const slotAuthority = new PublicKey(authStr)
  const slotId = demoSlotIdFromEnv()
  const rpc =
    process.env.SOLANA_RPC?.trim() ||
    process.env.VITE_SOLANA_RPC?.trim() ||
    'https://api.mainnet-beta.solana.com'

  const connection = new Connection(rpc, 'confirmed')
  const gh = await connection.getGenesisHash()
  const mainnet = gh === MAINNET_GENESIS_HASH
  console.log(
    `[yield-worker] rpc=${rpc} program=${PROGRAM_ID.toBase58()} slotAuthority=${slotAuthority.toBase58()} slotId=${slotId} treasury=${treasuryKp.publicKey.toBase58()} mainnet=${mainnet}`,
  )

  const pollMs = Number.parseInt(process.env.YIELD_WORKER_POLL_MS ?? '2000', 10)
  const interval = Number.isFinite(pollMs) && pollMs >= 500 ? pollMs : 2000

  const run = () =>
    void tick(connection, treasuryKp, slotAuthority, slotId, mainnet).catch((e) => {
      console.error('[yield-worker]', e)
    })

  run()
  setInterval(run, interval)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
