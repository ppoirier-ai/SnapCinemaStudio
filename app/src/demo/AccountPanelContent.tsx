import type { PublicKey } from '@solana/web3.js'
import { decodePosition } from '../stakeToCurate/client'
import { lamportsToSol } from './format'

type P = ReturnType<typeof decodePosition>

type Props = {
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

export function AccountPanelContent({
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

  if (!connected || !publicKey) {
    return <p className="muted">Connect a wallet to see positions and claims.</p>
  }

  return (
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
  )
}
