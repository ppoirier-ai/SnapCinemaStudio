import { useCallback, useMemo, useState } from 'react'
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
} from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletModalButton } from '@solana/wallet-adapter-react-ui'
import { getPlatformOwnerPubkeyString } from '../config/platformOwner'
import { sendAndConfirm } from '../stakeToCurate/client'

const MAINNET_RPC =
  (typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_MAINNET_RPC &&
    String(import.meta.env.VITE_MAINNET_RPC).trim()) ||
  clusterApiUrl('mainnet-beta')

/** Landing page skips /watch redirect while this is set (see LandingPage). */
function markLandingDonationConnect() {
  try {
    sessionStorage.setItem('snapcinema_landing_stay', '1')
  } catch {
    /* private mode */
  }
}

export function SupportStudioDonation() {
  const { connected, publicKey, signTransaction } = useWallet()
  const [amountSol, setAmountSol] = useState('0.05')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSig, setLastSig] = useState<string | null>(null)

  const recipientStr = getPlatformOwnerPubkeyString()
  const recipientPk = useMemo(() => new PublicKey(recipientStr), [recipientStr])
  const mainnet = useMemo(
    () => new Connection(MAINNET_RPC, 'confirmed'),
    [],
  )

  const shortAddr = `${recipientStr.slice(0, 4)}…${recipientStr.slice(-4)}`

  const copyAddress = useCallback(async () => {
    setError(null)
    try {
      await navigator.clipboard.writeText(recipientStr)
    } catch {
      setError('Could not copy—copy the address manually.')
    }
  }, [recipientStr])

  const sendDonation = useCallback(async () => {
    setError(null)
    setLastSig(null)
    if (!publicKey || !signTransaction) {
      setError('Connect your wallet first.')
      return
    }
    const n = Number.parseFloat(amountSol.replace(/,/g, ''))
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a positive SOL amount.')
      return
    }
    if (n > 1_000) {
      setError('Amount looks too large—please double-check.')
      return
    }
    const lamports = Math.round(n * LAMPORTS_PER_SOL)
    if (lamports <= 0) {
      setError('Amount is too small after conversion.')
      return
    }
    setBusy(true)
    try {
      const sig = await sendAndConfirm(
        mainnet,
        { publicKey, signTransaction },
        [
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPk,
            lamports,
          }),
        ],
      )
      setLastSig(sig)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [amountSol, mainnet, publicKey, recipientPk, signTransaction])

  return (
    <div className="support-studio-donation">
      <h2 id="support-heading" className="support-studio-donation-title">
        Support SnapCinema Studio
      </h2>
      <p className="support-studio-donation-eyebrow">Fund the build</p>
      <p className="support-studio-donation-lead">
        Donations are <strong>real SOL</strong> on <strong>Solana mainnet</strong>. In Phantom,
        switch to <strong>Mainnet Beta</strong> before you send so the network matches this
        transaction.
      </p>
      <div className="support-studio-donation-address-row">
        <code className="support-studio-donation-address" title={recipientStr}>
          {shortAddr}
        </code>
        <button
          type="button"
          className="btn btn-ghost support-studio-donation-copy"
          onClick={() => void copyAddress()}
        >
          Copy address
        </button>
      </div>
      <label className="support-studio-donation-label">
        <span>Amount (SOL)</span>
        <input
          type="text"
          inputMode="decimal"
          className="mailing-list-signup-input support-studio-donation-input"
          value={amountSol}
          onChange={(e) => setAmountSol(e.target.value)}
          disabled={busy}
          autoComplete="off"
        />
      </label>
      {error ? (
        <p className="mailing-list-signup-error" role="alert">
          {error}
        </p>
      ) : null}
      {lastSig ? (
        <p className="mailing-list-signup-success" role="status">
          Sent.{' '}
          <a
            href={`https://solscan.io/tx/${lastSig}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Solscan
          </a>
        </p>
      ) : null}
      {!connected ? (
        <WalletModalButton
          className="btn btn-primary"
          onClick={markLandingDonationConnect}
        >
          Connect wallet to send SOL
        </WalletModalButton>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void sendDonation()}
        >
          {busy ? 'Sending…' : 'Send SOL'}
        </button>
      )}
    </div>
  )
}
