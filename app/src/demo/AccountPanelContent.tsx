import type { PublicKey } from '@solana/web3.js'
import { decodeScenePosition } from '../stakeToCurate/client'
import { lamportsToSol } from './format'

type P = ReturnType<typeof decodeScenePosition>

type Props = {
  publicKey: PublicKey | null
  connected: boolean
  busy: boolean
  chainRefreshBusy: boolean
  positions: Array<{ sceneKeyHex: string; position: P }>
  onRefresh: () => void
}

export function AccountPanelContent({
  publicKey,
  connected,
  busy,
  chainRefreshBusy,
  positions,
  onRefresh,
}: Props) {
  const addr = publicKey?.toBase58() ?? ''
  const short =
    addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr || '—'
  const explorer =
    publicKey &&
    `https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`

  if (!connected || !publicKey) {
    return <p className="muted">Connect a wallet to see positions.</p>
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
        disabled={busy || chainRefreshBusy}
        aria-busy={chainRefreshBusy}
        onClick={() => void onRefresh()}
      >
        {chainRefreshBusy ? 'Refreshing…' : 'Refresh balances'}
      </button>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Curator <strong>claim</strong> is deferred in the per-scene MVP (no{' '}
        <code>deposit_revenue</code> yet). Stakes and ranks are live per scene.
      </p>
      {positions.length === 0 ? (
        <p className="muted empty-hint" style={{ marginTop: '0.75rem' }}>
          No scene positions for this wallet.
        </p>
      ) : (
        <ul className="stats" style={{ marginTop: '1rem' }}>
          {positions.map(({ sceneKeyHex, position }) => (
            <li key={sceneKeyHex} style={{ marginBottom: '1rem' }}>
              <div className="muted scene-key-mono">
                {sceneKeyHex.slice(0, 16)}…
              </div>
              <ul className="stats nested">
                <li>staked: {lamportsToSol(position.amount)} SOL</li>
                <li>side: {position.isUp ? 'up' : 'down'}</li>
                <li>accrued (reserved): {lamportsToSol(position.accruedRewards)} SOL</li>
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
