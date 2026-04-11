/**
 * Instant staking “session” = a funded ephemeral Solana keypair.
 *
 * The on-chain StakeToCurate program only accepts `owner: Signer` with direct
 * lamport transfers from that owner — there is no session escrow PDA. We
 * approximate the product spec by moving up to 1 SOL per top-up onto this
 * keypair and using it as `owner` for `stake_up` / `stake_down`, signed locally.
 *
 * **Persistence**: The ephemeral secret is stored in `sessionStorage` (scoped
 * to tab + origin) so a refresh within the session window does not strand funds.
 * This is a pragmatic tradeoff, not hardware-wallet-grade isolation.
 */
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'

/** 2.5 hours — matches product spec. */
export const INSTANT_SESSION_DURATION_MS = 150 * 60 * 1000

/** Max SOL moved from Phantom to the session key per enable or top-up tx. */
export const MAX_SESSION_TOPUP_LAMPORTS = 1_000_000_000n

/** Browser instant-staking session (ephemeral keypair), persisted for tab refresh. */
export type InstantSessionMeta = {
  expiresAtMs: number
  ephemeralPk: string
}

const STORAGE_KEY = 'snapcinema_instant_staking_session_v1'

/** Extra lamports reserved per stake for fees + first-time position rent. */
export const STAKE_RESERVE_LAMPORTS = 500_000n

export type PersistedInstantSessionV1 = {
  v: 1
  /** Base58 Phantom (custodian) pubkey this session belongs to. */
  custodian: string
  /** 64-byte secret key of the ephemeral session wallet. */
  secretKey: number[]
  /** Wall-clock expiry (ms since epoch). */
  expiresAtMs: number
}

export function createEphemeralKeypair(): Keypair {
  return Keypair.generate()
}

export function persistInstantSession(
  custodian: PublicKey,
  keypair: Keypair,
  expiresAtMs: number,
): void {
  const payload: PersistedInstantSessionV1 = {
    v: 1,
    custodian: custodian.toBase58(),
    secretKey: [...keypair.secretKey],
    expiresAtMs,
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Quota / private mode — session still works until tab close.
  }
}

export function clearInstantSessionStorage(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function tryRestoreInstantSession(
  custodian: PublicKey,
): { keypair: Keypair; expiresAtMs: number } | null {
  let raw: string | null
  try {
    raw = sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedInstantSessionV1
    if (parsed.v !== 1 || !parsed.custodian || !Array.isArray(parsed.secretKey))
      return null
    if (parsed.custodian !== custodian.toBase58()) return null
    if (typeof parsed.expiresAtMs !== 'number' || parsed.expiresAtMs <= Date.now())
      return null
    if (parsed.secretKey.length !== 64) return null
    const keypair = Keypair.fromSecretKey(Uint8Array.from(parsed.secretKey))
    return { keypair, expiresAtMs: parsed.expiresAtMs }
  } catch {
    return null
  }
}

/** SPL/system transfer from custodian Phantom wallet to the session key. */
export function ixFundSessionWallet(
  from: PublicKey,
  to: PublicKey,
  lamports: bigint,
): TransactionInstruction {
  const lam = lamports > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(lamports)
  if (lam <= 0) throw new Error('Fund amount must be positive')
  return SystemProgram.transfer({
    fromPubkey: from,
    toPubkey: to,
    lamports: lam,
  })
}

/** Session key sends everything it can (minus fee) back to the custodian. */
export function ixSweepSessionWalletToCustodian(
  ephemeral: PublicKey,
  custodian: PublicKey,
  lamports: bigint,
): TransactionInstruction {
  const lam = lamports > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(lamports)
  if (lam <= 0) throw new Error('Sweep amount must be positive')
  return SystemProgram.transfer({
    fromPubkey: ephemeral,
    toPubkey: custodian,
    lamports: lam,
  })
}
