import { useEffect, useRef } from 'react'
import type { PublicKey } from '@solana/web3.js'
import { decodePosition } from '../stakeToCurate/client'
import { lamportsToSol } from './format'

type P = ReturnType<typeof decodePosition>

type Props = {
  open: boolean
  onClose: () => void
  publicKey: PublicKey | null
  connected: boolean
  busy: boolean
  pos0: P | null
  pos1: P | null
  onRefresh: () => void
  onClaimV0: () => void
  onClaimV1: () => void
  onClaimAll: () => void
}

export function AccountModal({
  open,
  onClose,
  publicKey,
  connected,
  busy,
  pos0,
  pos1,
  onRefresh,
  onClaimV0,
  onClaimV1,
  onClaimAll,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const addr = publicKey?.toBase58() ?? ''
  const short =
    addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr || '—'
  const explorer =
    publicKey &&
    `https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`

  const acc0 = pos0?.accruedRewards ?? 0n
  const acc1 = pos1?.accruedRewards ?? 0n
  const canClaim0 = acc0 > 0n
  const canClaim1 = acc1 > 0n
  const canClaimAny = canClaim0 || canClaim1

  return (
    <div
      className="account-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
      >
        <div className="account-modal-head">
          <h2 id="account-modal-title">Account</h2>
          <button
            type="button"
            className="btn btn-ghost account-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {!connected || !publicKey ? (
          <p className="muted">Connect a wallet to see positions and claims.</p>
        ) : (
          <>
            <p className="account-wallet-line">
              <span className="field-label">Wallet</span>
              <code className="pid">{short}</code>
              {explorer && (
                <a
                  href={explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="account-explorer-link"
                >
                  View on Explorer
                </a>
              )}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void onRefresh()}
            >
              Refresh balances
            </button>
            <div className="account-sections">
              <div className="account-version-block">
                <h3>Version 0</h3>
                {pos0 ? (
                  <ul className="stats">
                    <li>staked: {lamportsToSol(pos0.amount)} SOL</li>
                    <li>side: {pos0.isUp ? 'up' : 'down'}</li>
                    <li>accrued: {lamportsToSol(pos0.accruedRewards)} SOL</li>
                  </ul>
                ) : (
                  <p className="muted empty-hint">No position</p>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canClaim0 || busy}
                  onClick={() => void onClaimV0()}
                >
                  Claim v0
                </button>
              </div>
              <div className="account-version-block">
                <h3>Version 1</h3>
                {pos1 ? (
                  <ul className="stats">
                    <li>staked: {lamportsToSol(pos1.amount)} SOL</li>
                    <li>side: {pos1.isUp ? 'up' : 'down'}</li>
                    <li>accrued: {lamportsToSol(pos1.accruedRewards)} SOL</li>
                  </ul>
                ) : (
                  <p className="muted empty-hint">No position</p>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canClaim1 || busy}
                  onClick={() => void onClaimV1()}
                >
                  Claim v1
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary account-claim-all"
              disabled={!canClaimAny || busy}
              onClick={() => void onClaimAll()}
            >
              Claim all available
            </button>
          </>
        )}
      </div>
    </div>
  )
}
