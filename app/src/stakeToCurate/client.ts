import { Buffer } from 'buffer'
import bs58 from 'bs58'
import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from '@solana/web3.js'

export const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_STAKE_TO_CURATE_PROGRAM_ID ??
    'UfaPFjHzepp91cEzmfoAd2b7bMVWoB37wuPRa8vy9Su',
)

/** Anchor `sha256("global:<name>")[0..8]` (from IDL after `anchor build`). */
const IX = {
  initialize_slot: Buffer.from('970d156baf7b30c6', 'hex'),
  register_scene: Buffer.from('abe29d5dd65a2c4a', 'hex'),
  stake_scene_up: Buffer.from('37827a136859a9e8', 'hex'),
  stake_scene_down: Buffer.from('9502916cbe1159c8', 'hex'),
  unstake_scene: Buffer.from('956f624ea339c5eb', 'hex'),
  reset_scene_rank: Buffer.from('588f697e50fc4522', 'hex'),
} as const

export const DEFAULT_RPC =
  import.meta.env.VITE_SOLANA_RPC ?? clusterApiUrl('devnet')

/** On-chain `slot_id` (0–255). Increase `VITE_DEMO_SLOT_ID` in `.env` for a fresh slot (empty stakes) with the same authority wallet. */
function demoSlotIdFromEnv(): number {
  const raw = import.meta.env.VITE_DEMO_SLOT_ID
  if (raw == null || String(raw).trim() === '') return 0
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 0 || n > 255) {
    console.warn('VITE_DEMO_SLOT_ID must be an integer 0–255; using 0')
    return 0
  }
  return n & 0xff
}

export const DEMO_SLOT_ID = demoSlotIdFromEnv()

/**
 * Optional shared demo slot owner (base58). When set, all users read the same
 * slot/scene PDAs and stake with `authorityForSlot` = this key; initialize
 * once with the wallet that matches this pubkey. When unset, the connected
 * wallet is both authority and staker (solo dev).
 */
export function stakeSlotAuthorityFromEnv(): PublicKey | null {
  const raw = import.meta.env.VITE_STAKE_SLOT_AUTHORITY
  if (raw == null || String(raw).trim() === '') return null
  try {
    return new PublicKey(String(raw).trim())
  } catch {
    console.warn(
      'VITE_STAKE_SLOT_AUTHORITY is not valid base58; falling back to connected wallet',
    )
    return null
  }
}

export function resolveStakeSlotAuthority(
  connectedPublicKey: PublicKey | null,
): PublicKey | null {
  return stakeSlotAuthorityFromEnv() ?? connectedPublicKey
}

export function slotPda(authority: PublicKey, slotId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('slot'), authority.toBuffer(), Buffer.from([slotId & 0xff])],
    PROGRAM_ID,
  )
  return pda
}

export function vaultPda(slot: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), slot.toBuffer()],
    PROGRAM_ID,
  )
  return pda
}

export function scenePda(slot: PublicKey, sceneKey: Uint8Array): PublicKey {
  if (sceneKey.length !== 32) throw new Error('scene_key must be 32 bytes')
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('scene'), slot.toBuffer(), Buffer.from(sceneKey)],
    PROGRAM_ID,
  )
  return pda
}

export function scenePositionPda(scene: PublicKey, owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('position'), scene.toBuffer(), owner.toBuffer()],
    PROGRAM_ID,
  )
  return pda
}

function u64le(n: bigint): Buffer {
  const b = Buffer.alloc(8)
  let x = n
  for (let i = 0; i < 8; i++) {
    b[i] = Number(x & 0xffn)
    x >>= 8n
  }
  return b
}

function readU64LE(data: Buffer, offset: number): bigint {
  if (offset + 8 > data.length) {
    throw new RangeError(
      `readU64LE out of range: offset ${offset}, need 8 bytes, have ${data.length}`,
    )
  }
  let v = 0n
  for (let i = 0; i < 8; i++) {
    v |= BigInt(data[offset + i]!) << BigInt(8 * i)
  }
  return v
}

export const SCENE_POSITION_DATA_LEN = 99

/** 8-byte Anchor discriminator + `Scene` body (`programs/stake_to_curate`). */
export const SCENE_ACCOUNT_DATA_LEN = 89

/** 8-byte discriminator + `Scene` account body */
export function decodeScene(data: Buffer) {
  if (data.length < SCENE_ACCOUNT_DATA_LEN) {
    throw new RangeError(
      `Scene account buffer too short: ${data.length} (need ${SCENE_ACCOUNT_DATA_LEN})`,
    )
  }
  let p = 8
  const slot = new PublicKey(data.subarray(p, p + 32))
  p += 32
  const sceneKey = new Uint8Array(data.subarray(p, p + 32))
  p += 32
  const rank = readU64LE(data, p)
  p += 8
  const activeStake = readU64LE(data, p)
  p += 8
  const bump = data.readUInt8(p)
  return { slot, sceneKey, rank, activeStake, bump }
}

/** Safe decode for RPC data (wrong layout, pre-migration account, or garbage address). */
export function tryDecodeScene(data: Buffer | undefined): ReturnType<
  typeof decodeScene
> | null {
  if (!data || data.length < SCENE_ACCOUNT_DATA_LEN) return null
  try {
    return decodeScene(data)
  } catch {
    return null
  }
}

/** 8-byte discriminator + `ScenePosition` account body */
export function decodeScenePosition(data: Buffer) {
  if (data.length < SCENE_POSITION_DATA_LEN) {
    throw new RangeError(
      `ScenePosition buffer too short: ${data.length} (need ${SCENE_POSITION_DATA_LEN})`,
    )
  }
  let p = 8
  const scene = new PublicKey(data.subarray(p, p + 32))
  p += 32
  const owner = new PublicKey(data.subarray(p, p + 32))
  p += 32
  const amount = readU64LE(data, p)
  p += 8
  const isUp = data.readUInt8(p) !== 0
  p += 1
  const isActive = data.readUInt8(p) !== 0
  p += 1
  const entryRank = readU64LE(data, p)
  p += 8
  const accruedRewards = readU64LE(data, p)
  p += 8
  const bump = data.readUInt8(p)
  return {
    scene,
    owner,
    amount,
    isUp,
    isActive,
    entryRank,
    accruedRewards,
    bump,
  }
}

export function tryDecodeScenePosition(
  data: Buffer | undefined,
): ReturnType<typeof decodeScenePosition> | null {
  if (!data || data.length < SCENE_POSITION_DATA_LEN) return null
  try {
    return decodeScenePosition(data)
  } catch {
    return null
  }
}

export async function fetchScenePositionsForOwner(
  connection: Connection,
  owner: PublicKey,
): Promise<{ pubkey: PublicKey; data: Buffer }[]> {
  const res = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: SCENE_POSITION_DATA_LEN },
      { memcmp: { offset: 40, bytes: owner.toBase58() } },
    ],
  })
  return res.map(({ pubkey, account }) => ({
    pubkey,
    data: Buffer.from(account.data),
  }))
}

export function ixInitializeSlot(
  authority: PublicKey,
  creator: PublicKey,
  platform: PublicKey,
  slotId: number,
): TransactionInstruction {
  const slot = slotPda(authority, slotId)
  const vault = vaultPda(slot)
  const data = Buffer.concat([IX.initialize_slot, Buffer.from([slotId & 0xff])])
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: creator, isSigner: false, isWritable: false },
      { pubkey: platform, isSigner: false, isWritable: false },
      { pubkey: slot, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

export function ixRegisterScene(
  authority: PublicKey,
  slotId: number,
  sceneKey32: Uint8Array,
  initialRank: bigint,
): TransactionInstruction {
  if (sceneKey32.length !== 32) throw new Error('scene_key must be 32 bytes')
  const slot = slotPda(authority, slotId)
  const scene = scenePda(slot, sceneKey32)
  const data = Buffer.concat([
    IX.register_scene,
    Buffer.from(sceneKey32),
    u64le(initialRank),
  ])
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: slot, isSigner: false, isWritable: false },
      { pubkey: scene, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

export function ixResetSceneRank(
  authority: PublicKey,
  slotId: number,
  sceneKey32: Uint8Array,
  newRank: bigint,
): TransactionInstruction {
  if (sceneKey32.length !== 32) throw new Error('scene_key must be 32 bytes')
  const slot = slotPda(authority, slotId)
  const scene = scenePda(slot, sceneKey32)
  const data = Buffer.concat([IX.reset_scene_rank, u64le(newRank)])
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: slot, isSigner: false, isWritable: false },
      { pubkey: scene, isSigner: false, isWritable: true },
    ],
    data,
  })
}

export function ixStakeSceneUp(
  owner: PublicKey,
  authorityForSlot: PublicKey,
  slotId: number,
  sceneKey32: Uint8Array,
  amountLamports: bigint,
): TransactionInstruction {
  return stakeSceneIx(
    owner,
    authorityForSlot,
    slotId,
    sceneKey32,
    amountLamports,
    IX.stake_scene_up,
  )
}

export function ixStakeSceneDown(
  owner: PublicKey,
  authorityForSlot: PublicKey,
  slotId: number,
  sceneKey32: Uint8Array,
  amountLamports: bigint,
): TransactionInstruction {
  return stakeSceneIx(
    owner,
    authorityForSlot,
    slotId,
    sceneKey32,
    amountLamports,
    IX.stake_scene_down,
  )
}

function stakeSceneIx(
  owner: PublicKey,
  authorityForSlot: PublicKey,
  slotId: number,
  sceneKey32: Uint8Array,
  amountLamports: bigint,
  disc: Buffer,
): TransactionInstruction {
  if (sceneKey32.length !== 32) throw new Error('scene_key must be 32 bytes')
  const slot = slotPda(authorityForSlot, slotId)
  const scene = scenePda(slot, sceneKey32)
  const position = scenePositionPda(scene, owner)
  const vault = vaultPda(slot)
  const data = Buffer.concat([disc, u64le(amountLamports)])
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: slot, isSigner: false, isWritable: false },
      { pubkey: scene, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

export function ixUnstakeScene(
  owner: PublicKey,
  authorityForSlot: PublicKey,
  slotId: number,
  sceneKey32: Uint8Array,
): TransactionInstruction {
  if (sceneKey32.length !== 32) throw new Error('scene_key must be 32 bytes')
  const slot = slotPda(authorityForSlot, slotId)
  const scene = scenePda(slot, sceneKey32)
  const position = scenePositionPda(scene, owner)
  const vault = vaultPda(slot)
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: slot, isSigner: false, isWritable: false },
      { pubkey: scene, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: IX.unstake_scene,
  })
}

function transactionSignatureBase58(signed: Transaction): string | null {
  const raw = signed.signatures[0]?.signature
  if (!raw || raw.length === 0) return null
  return bs58.encode(raw)
}

/** Prefer full simulation logs when the RPC wraps failure as {@link SendTransactionError}. */
async function wrapSendTransactionError(
  connection: Connection,
  e: unknown,
): Promise<Error> {
  if (e instanceof SendTransactionError) {
    let logBlock = ''
    try {
      const fetched = await e.getLogs(connection)
      if (fetched.length > 0) {
        logBlock = `\nLogs:\n${fetched.join('\n')}`
      }
    } catch {
      /* ignore log fetch failures */
    }
    if (!logBlock && e.logs?.length) {
      logBlock = `\nLogs:\n${e.logs.join('\n')}`
    }
    return new Error(`${e.message}${logBlock}`, { cause: e })
  }
  return e instanceof Error ? e : new Error(String(e))
}

async function signatureAlreadyConfirmed(
  connection: Connection,
  signature: string,
): Promise<boolean> {
  const { value } = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  })
  const st = value[0]
  if (!st) return false
  if (st.err) return false
  return Boolean(
    st.confirmationStatus ??
      (typeof st.confirmations === 'number' && st.confirmations > 0),
  )
}

export async function sendAndConfirm(
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction(tx: Transaction): Promise<Transaction> },
  instructions: TransactionInstruction[],
  commitment: 'confirmed' | 'finalized' = 'confirmed',
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash()
  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: wallet.publicKey,
  }).add(...instructions)
  const signed = await wallet.signTransaction(tx)
  const optimisticSig = transactionSignatureBase58(signed)
  try {
    const sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: commitment,
    })
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      commitment,
    )
    return sig
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e)
    if (
      optimisticSig &&
      text.includes('already been processed') &&
      (await signatureAlreadyConfirmed(connection, optimisticSig))
    ) {
      return optimisticSig
    }
    throw await wrapSendTransactionError(connection, e)
  }
}

/**
 * Build, sign with an ephemeral {@link Keypair}, send, and confirm — no wallet adapter.
 * Used for instant-staking session thumbs after the custodian wallet funds the session key.
 */
export async function sendAndConfirmWithKeypair(
  connection: Connection,
  signer: Keypair,
  instructions: TransactionInstruction[],
  commitment: 'confirmed' | 'finalized' = 'confirmed',
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash()
  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: signer.publicKey,
  }).add(...instructions)
  tx.sign(signer)
  const optimisticSig = transactionSignatureBase58(tx)
  try {
    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: commitment,
    })
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      commitment,
    )
    return sig
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e)
    if (
      optimisticSig &&
      text.includes('already been processed') &&
      (await signatureAlreadyConfirmed(connection, optimisticSig))
    ) {
      return optimisticSig
    }
    throw await wrapSendTransactionError(connection, e)
  }
}

/** Result of one weighted index draw (for debugging / console traces). */
export type WeightedPickTrace = {
  index: number
  /** Per-option weights after clamping negatives to 0. */
  weights: bigint[]
  weightSum: bigint
  /**
   * Uniform integer in [0, weightSum) used for the weighted pick; `null` if we used
   * the zero-sum fallback (uniform random among indices).
   */
  drawU: bigint | null
  usedUniformFallback: boolean
}

/**
 * Weighted index: P(i) ∝ max(rank_i, 0). Same bucket model as on-chain StakeToCurate.
 * Falls back to uniform if all weights are zero.
 */
export function sampleWeightedIndexWithTrace(ranks: bigint[]): WeightedPickTrace {
  const n = ranks.length
  const weights = ranks.map((r) => (r > 0n ? r : 0n))
  if (n === 0) {
    return {
      index: 0,
      weights,
      weightSum: 0n,
      drawU: null,
      usedUniformFallback: false,
    }
  }
  if (n === 1) {
    return {
      index: 0,
      weights,
      weightSum: weights[0]!,
      drawU: null,
      usedUniformFallback: false,
    }
  }
  let weightSum = 0n
  for (const w of weights) weightSum += w
  if (weightSum === 0n) {
    const idx = Math.floor(Math.random() * n)
    return {
      index: idx,
      weights,
      weightSum: 0n,
      drawU: null,
      usedUniformFallback: true,
    }
  }
  const drawU =
    BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) % weightSum
  let acc = 0n
  for (let i = 0; i < n; i++) {
    acc += weights[i]!
    if (drawU < acc) {
      return {
        index: i,
        weights,
        weightSum,
        drawU,
        usedUniformFallback: false,
      }
    }
  }
  return {
    index: n - 1,
    weights,
    weightSum,
    drawU,
    usedUniformFallback: false,
  }
}

export function sampleWeightedIndex(ranks: bigint[]): number {
  return sampleWeightedIndexWithTrace(ranks).index
}
