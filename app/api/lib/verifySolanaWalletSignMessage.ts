import { verifyAsync } from '@noble/ed25519'
import { decodeBase58Ed25519Pubkey } from './solanaPubkeyBytes.js'

export type WalletSigResult =
  | { ok: true; walletPubkeyBytes: Uint8Array }
  | { ok: false; error: string }

const DEFAULT_MAX_SKEW_MS = 15 * 60_000

/**
 * Validates format, timestamp freshness, pubkey, and Ed25519 signature for wallet `signMessage` flows.
 */
export async function verifySolanaWalletSignMessage(params: {
  wallet: string
  message: string
  signatureBase64: string
  /** Must capture wallet at index 1 and unix ms timestamp at index 2. */
  messageRegex: RegExp
  maxSkewMs?: number
}): Promise<WalletSigResult> {
  const { wallet, message, signatureBase64, messageRegex, maxSkewMs } = params
  const skew = maxSkewMs ?? DEFAULT_MAX_SKEW_MS

  const m = messageRegex.exec(message)
  if (!m) return { ok: false, error: 'Invalid message format' }

  const msgWallet = m[1]
  const ts = Number(m[2])
  if (msgWallet !== wallet) return { ok: false, error: 'Wallet mismatch' }
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > skew) {
    return { ok: false, error: 'Stale or invalid timestamp' }
  }

  const walletBytes = decodeBase58Ed25519Pubkey(wallet)
  if (!walletBytes) return { ok: false, error: 'Invalid wallet' }

  let sig: Uint8Array
  try {
    sig = new Uint8Array(Buffer.from(signatureBase64, 'base64'))
  } catch {
    return { ok: false, error: 'Invalid signature encoding' }
  }
  if (sig.length !== 64) return { ok: false, error: 'Invalid signature length' }

  const msgBytes = Buffer.from(message, 'utf8')
  try {
    const sigOk = await verifyAsync(sig, msgBytes, walletBytes)
    if (!sigOk) return { ok: false, error: 'Signature verification failed' }
  } catch {
    return { ok: false, error: 'Signature verification error' }
  }

  return { ok: true, walletPubkeyBytes: walletBytes }
}
