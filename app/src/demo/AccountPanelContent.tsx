import { useConnection } from '@solana/wallet-adapter-react'
import { useEffect, useMemo, useState } from 'react'
import type { PublicKey } from '@solana/web3.js'
import { resolveSceneFromHex } from '../lib/resolveSceneLabel'
import type { Movie } from '../storage/sceneBoardModel'
import { decodeScenePosition } from '../stakeToCurate/client'
import { lamportsToSol } from './format'

type P = ReturnType<typeof decodeScenePosition>

type SortMode = 'roiAsc' | 'roiDesc' | 'stakeDesc'

type Row = {
  sceneKeyHex: string
  position: P
  label: ReturnType<typeof resolveSceneFromHex>
  returnPct: number | null
}

function explorerClusterParam(rpcEndpoint: string): string {
  if (rpcEndpoint.includes('mainnet-beta') || rpcEndpoint.includes('mainnet'))
    return 'mainnet-beta'
  if (rpcEndpoint.includes('testnet')) return 'testnet'
  return 'devnet'
}

function computeReturnPct(position: P): number | null {
  if (position.amount <= 0n) return null
  const acc = Number(position.accruedRewards)
  const amt = Number(position.amount)
  if (!Number.isFinite(acc) || !Number.isFinite(amt) || amt === 0) return null
  return (acc / amt) * 100
}

function yieldPreviewLamports(totalPrincipal: bigint): bigint {
  /** Demo-only: 2% annualized expressed as instant preview lamports (not on-chain). */
  return (totalPrincipal * 2n) / 100n
}

type Props = {
  movies: Movie[]
  publicKey: PublicKey | null
  connected: boolean
  busy: boolean
  chainRefreshBusy: boolean
  positions: Array<{ sceneKeyHex: string; position: P }>
  onRefresh: () => void
  onUnstake: (sceneKeyHex: string) => Promise<void>
  onUnstakeLowestRoiScenes: (sceneKeyHexes: string[]) => Promise<void>
}

export function AccountPanelContent({
  movies,
  publicKey,
  connected,
  busy,
  chainRefreshBusy,
  positions,
  onRefresh,
  onUnstake,
  onUnstakeLowestRoiScenes,
}: Props) {
  const { connection } = useConnection()
  const cluster = explorerClusterParam(connection.rpcEndpoint)
  const yieldPreview =
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_ACCOUNT_YIELD_PREVIEW === 'true'

  const [sortMode, setSortMode] = useState<SortMode>('roiAsc')
  const [batchCount, setBatchCount] = useState(1)

  const addr = publicKey?.toBase58() ?? ''
  const short =
    addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr || '—'
  const explorer =
    publicKey &&
    `https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=${cluster}`

  const rows: Row[] = useMemo(() => {
    return positions.map(({ sceneKeyHex, position }) => ({
      sceneKeyHex,
      position,
      label: resolveSceneFromHex(movies, sceneKeyHex),
      returnPct: computeReturnPct(position),
    }))
  }, [positions, movies])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      if (sortMode === 'stakeDesc') {
        if (b.position.amount === a.position.amount) return 0
        return b.position.amount > a.position.amount ? 1 : -1
      }
      const ar =
        a.returnPct != null ? a.returnPct : sortMode === 'roiAsc' ? Infinity : -Infinity
      const br =
        b.returnPct != null ? b.returnPct : sortMode === 'roiAsc' ? Infinity : -Infinity
      if (sortMode === 'roiAsc') return ar - br
      return br - ar
    })
    return copy
  }, [rows, sortMode])

  const totalStaked = useMemo(
    () => positions.reduce((s, p) => s + p.position.amount, 0n),
    [positions],
  )
  const totalAccrued = useMemo(
    () => positions.reduce((s, p) => s + p.position.accruedRewards, 0n),
    [positions],
  )

  const batchOptionsMax = Math.min(5, Math.max(1, positions.length))

  useEffect(() => {
    if (batchCount > batchOptionsMax) setBatchCount(batchOptionsMax)
  }, [batchCount, batchOptionsMax])

  const lowestRoiHexesForBatch = useMemo(() => {
    const withPct = rows
      .map((r) => ({
        hex: r.sceneKeyHex,
        pct: r.returnPct,
      }))
      .sort((a, b) => {
        const ax = a.pct ?? Infinity
        const bx = b.pct ?? Infinity
        return ax - bx
      })
    const n = Math.min(Math.max(1, batchCount), withPct.length)
    return withPct.slice(0, n).map((x) => x.hex)
  }, [rows, batchCount, positions.length])

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
        className="btn btn-secondary account-refresh-btn"
        disabled={busy || chainRefreshBusy}
        aria-busy={chainRefreshBusy}
        onClick={() => void onRefresh()}
      >
        {chainRefreshBusy ? 'Refreshing…' : 'Refresh balances'}
      </button>

      <section className="account-summary-strip" aria-labelledby="account-summary-heading">
        <h2 id="account-summary-heading" className="account-summary-heading">
          Curator overview
        </h2>
        <div className="account-summary-grid">
          <div className="account-summary-card">
            <span className="account-summary-label">Total staked (principal)</span>
            <span className="account-summary-value">{lamportsToSol(totalStaked)} SOL</span>
          </div>
          <div className="account-summary-card">
            <span className="account-summary-label">Accrued rewards (on-chain)</span>
            <span className="account-summary-value">{lamportsToSol(totalAccrued)} SOL</span>
            <p className="account-summary-hint muted">
              Non-zero when revenue flows populate <code>accrued_rewards</code> on your
              positions. Many devnet demos show 0 until revenue is wired.
            </p>
          </div>
          {yieldPreview && positions.length > 0 && (
            <div className="account-summary-card account-summary-card-preview">
              <span className="account-summary-label">
                Yield preview{' '}
                <span className="account-preview-badge" title="Not on-chain">
                  Preview
                </span>
              </span>
              <span className="account-summary-value">
                ~{lamportsToSol(yieldPreviewLamports(totalStaked))} SOL
              </span>
              <p className="account-summary-hint muted">
                Mock 2% illustrative only — enable with{' '}
                <code>VITE_ACCOUNT_YIELD_PREVIEW=true</code>.
              </p>
            </div>
          )}
        </div>
        <div className="account-claim-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled
            title="Curator claim is not live in this MVP (no deposit_revenue / claim_curator in demo UI)."
          >
            Claim all rewards
          </button>
          <p className="muted account-claim-note">
            Claim is disabled until curator distribution is implemented on-chain and in the
            app. Stakes and unstakes are live per scene.
          </p>
        </div>
      </section>

      <details className="account-details-breakdown" open>
        <summary className="account-details-summary">
          By scene ({positions.length})
        </summary>
        <div className="account-breakdown-inner">
          {positions.length === 0 ? (
            <p className="muted empty-hint">No scene positions for this wallet.</p>
          ) : (
            <>
              <div className="account-toolbar">
                <label className="account-sort-label">
                  Sort
                  <select
                    className="account-sort-select"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                  >
                    <option value="roiAsc">Return % — lowest first</option>
                    <option value="roiDesc">Return % — highest first</option>
                    <option value="stakeDesc">Stake amount — largest first</option>
                  </select>
                </label>
                <div className="account-batch-unstake">
                  <label>
                    Unstake lowest-return
                    <select
                      className="account-batch-n"
                      value={Math.min(batchCount, batchOptionsMax)}
                      onChange={(e) => setBatchCount(Number(e.target.value))}
                    >
                      {Array.from({ length: batchOptionsMax }, (_, i) => i + 1).map(
                        (n) => (
                          <option key={n} value={n}>
                            {n} scene{n > 1 ? 's' : ''}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy || sortedRows.length === 0}
                    title="Unstakes scenes with the lowest return % in one flow (Phantom may ask once per tx)."
                    onClick={() =>
                      void onUnstakeLowestRoiScenes(lowestRoiHexesForBatch)
                    }
                  >
                    Unstake
                  </button>
                </div>
              </div>

              <div className="account-table-wrap">
                <table className="account-scene-table">
                  <thead>
                    <tr>
                      <th scope="col">Scene</th>
                      <th scope="col">Side</th>
                      <th scope="col">Staked</th>
                      <th scope="col">Accrued</th>
                      <th scope="col">Return %</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map(
                      ({ sceneKeyHex, position, label, returnPct }) => (
                        <tr key={sceneKeyHex}>
                          <td>
                            <div className="account-scene-title">
                              {label ? (
                                <>
                                  <strong>{label.movieTitle}</strong>
                                  <span className="muted account-scene-sub">
                                    Time {label.timeNumber} · Alt {label.altNumber}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="muted">Unknown scene</span>
                                  <code className="account-scene-hex">
                                    {sceneKeyHex.slice(0, 10)}…
                                  </code>
                                </>
                              )}
                            </div>
                          </td>
                          <td>{position.isUp ? 'Up' : 'Down'}</td>
                          <td>{lamportsToSol(position.amount)}</td>
                          <td>{lamportsToSol(position.accruedRewards)}</td>
                          <td>
                            {returnPct != null ? `${returnPct.toFixed(2)}%` : '—'}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={busy}
                              onClick={() => void onUnstake(sceneKeyHex)}
                            >
                              Unstake
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </details>
    </>
  )
}
