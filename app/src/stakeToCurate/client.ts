import { Buffer } from 'buffer'
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from '@solana/web3.js'

export const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_STAKE_TO_CURATE_PROGRAM_ID ??
    '4azLw8hCLoPiED81CNGXx5tthAsJUxm64P6kEnbg74ye',
)

/** Anchor `sha256("global:<name>")[0..8]` */
const IX = {
  initialize_slot: Buffer.from('970d156baf7b30c6', 'hex'),
  register_version: Buffer.from('5ec69a1d37feb234', 'hex'),
  stake_up: Buffer.from('cfbf30d24caaba99', 'hex'),
  stake_down: Buffer.from('fb9e6d08f1075d40', 'hex'),
  unstake: Buffer.from('5a5f6b2acd7c32e1', 'hex'),
  deposit_revenue: Buffer.from('e0d452643cf0dc1d', 'hex'),
  claim_curator: Buffer.from('633abf6d4d634970', 'hex'),
} as const

export const DEFAULT_RPC =
  import.meta.env.VITE_SOLANA_RPC ?? clusterApiUrl('devnet')

export const DEMO_SLOT_ID = 0

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

export function versionPda(slot: PublicKey, versionIndex: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('version'), slot.toBuffer(), Buffer.from([versionIndex & 0xff])],
    PROGRAM_ID,
  )
  return pda
}

export function positionPda(version: PublicKey, owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('position'), version.toBuffer(), owner.toBuffer()],
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
  let v = 0n
  for (let i = 0; i < 8; i++) {
    v |= BigInt(data[offset + i]!) << BigInt(8 * i)
  }
  return v
}

/** 8-byte discriminator + account body */
export function decodeVersion(data: Buffer) {
  let p = 8
  const slot = new PublicKey(data.subarray(p, p + 32))
  p += 32
  const index = data.readUInt8(p)
  p += 1
  const rank = readU64LE(data, p)
  p += 8
  const activeStake = readU64LE(data, p)
  p += 8
  const curatorCarry = readU64LE(data, p)
  p += 8
  const bump = data.readUInt8(p)
  return { slot, index, rank, activeStake, curatorCarry, bump }
}

export function decodePosition(data: Buffer) {
  let p = 8
  const version = new PublicKey(data.subarray(p, p + 32))
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
    version,
    owner,
    amount,
    isUp,
    isActive,
    entryRank,
    accruedRewards,
    bump,
  }
}

const POSITION_DATA_LEN = 99

export async function fetchPositionsForVersion(
  connection: Connection,
  version: PublicKey,
): Promise<{ pubkey: PublicKey; data: Buffer }[]> {
  const res = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: POSITION_DATA_LEN },
      { memcmp: { offset: 8, bytes: version.toBase58() } },
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

export function ixRegisterVersion(
  authority: PublicKey,
  slotId: number,
  versionIndex: number,
  initialRank: bigint,
): TransactionInstruction {
  const slot = slotPda(authority, slotId)
  const version = versionPda(slot, versionIndex)
  const data = Buffer.concat([
    IX.register_version,
    Buffer.from([versionIndex & 0xff]),
    u64le(initialRank),
  ])
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: slot, isSigner: false, isWritable: false },
      { pubkey: version, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

export function ixStakeUp(
  owner: PublicKey,
  authorityForSlot: PublicKey,
  slotId: number,
  versionIndex: number,
  amountLamports: bigint,
): TransactionInstruction {
  return stakeIx(
    owner,
    authorityForSlot,
    slotId,
    versionIndex,
    amountLamports,
    IX.stake_up,
  )
}

export function ixStakeDown(
  owner: PublicKey,
  authorityForSlot: PublicKey,
  slotId: number,
  versionIndex: number,
  amountLamports: bigint,
): TransactionInstruction {
  return stakeIx(
    owner,
    authorityForSlot,
    slotId,
    versionIndex,
    amountLamports,
    IX.stake_down,
  )
}

function stakeIx(
  owner: PublicKey,
  authorityForSlot: PublicKey,
  slotId: number,
  versionIndex: number,
  amountLamports: bigint,
  disc: Buffer,
): TransactionInstruction {
  const slot = slotPda(authorityForSlot, slotId)
  const version = versionPda(slot, versionIndex)
  const position = positionPda(version, owner)
  const vault = vaultPda(slot)
  const data = Buffer.concat([disc, u64le(amountLamports)])
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: slot, isSigner: false, isWritable: false },
      { pubkey: version, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

export function ixUnstake(
  owner: PublicKey,
  authorityForSlot: PublicKey,
  slotId: number,
  versionIndex: number,
): TransactionInstruction {
  const slot = slotPda(authorityForSlot, slotId)
  const version = versionPda(slot, versionIndex)
  const position = positionPda(version, owner)
  const vault = vaultPda(slot)
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: slot, isSigner: false, isWritable: false },
      { pubkey: version, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
    ],
    data: IX.unstake,
  })
}

export function ixDepositRevenue(
  payer: PublicKey,
  authorityForSlot: PublicKey,
  slotId: number,
  versionIndex: number,
  amountLamports: bigint,
  creator: PublicKey,
  platform: PublicKey,
  positionAccounts: PublicKey[],
): TransactionInstruction {
  const slot = slotPda(authorityForSlot, slotId)
  const version = versionPda(slot, versionIndex)
  const vault = vaultPda(slot)
  const data = Buffer.concat([IX.deposit_revenue, u64le(amountLamports)])
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: version, isSigner: false, isWritable: true },
    { pubkey: slot, isSigner: false, isWritable: false },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: creator, isSigner: false, isWritable: true },
    { pubkey: platform, isSigner: false, isWritable: true },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    ...positionAccounts.map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: true,
    })),
  ]
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
}

export function ixClaimCurator(
  owner: PublicKey,
  authorityForSlot: PublicKey,
  slotId: number,
  versionIndex: number,
): TransactionInstruction {
  const slot = slotPda(authorityForSlot, slotId)
  const version = versionPda(slot, versionIndex)
  const position = positionPda(version, owner)
  const vault = vaultPda(slot)
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: slot, isSigner: false, isWritable: false },
      { pubkey: version, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
    ],
    data: IX.claim_curator,
  })
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
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: commitment,
  })
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    commitment,
  )
  return sig
}

/** P(version) for demo playback */
export function sampleVersionIndex(ranks: [bigint, bigint]): 0 | 1 {
  const a = ranks[0] ?? 0n
  const b = ranks[1] ?? 0n
  const s = a + b
  if (s === 0n) return Math.random() < 0.5 ? 0 : 1
  const u = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) % s
  return u < a ? 0 : 1
}
