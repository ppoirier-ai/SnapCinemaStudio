import { useConnection } from '@solana/wallet-adapter-react'
import { useCallback, useEffect, useState } from 'react'
import { FAN_REACTION_STAKE_LAMPORTS } from '../../demo/constants'
import { lamportsToSol } from '../../demo/format'
import { isMainnetYieldBoostAvailable } from '../../yield/cluster'
import { yieldBoostApyPercent } from '../../yield/constants'
import { fetchYieldDashboardSnapshot } from '../../yield/yieldDashboard'

type Props = {
  connected: boolean
  publicKey: import('@solana/web3.js').PublicKey | null
  busy: boolean
  instantStakingSessionActive: boolean
  yieldBoostEnabled: boolean
  setYieldBoostEnabled: (v: boolean) => void
  onWithdrawYieldBoost: () => void
}

export function WatchYieldBoostPanel({
  connected,
  publicKey,
  busy,
  instantStakingSessionActive,
  yieldBoostEnabled,
  setYieldBoostEnabled,
  onWithdrawYieldBoost,
}: Props) {
  const { connection } = useConnection()
  const [clusterOk, setClusterOk] = useState(false)
  const [snap, setSnap] = useState<Awaited<
    ReturnType<typeof fetchYieldDashboardSnapshot>
  > | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ok = await isMainnetYieldBoostAvailable(connection)
      if (!cancelled) setClusterOk(ok)
    })()
    return () => {
      cancelled = true
    }
  }, [connection])

  const refreshSnap = useCallback(async () => {
    if (!connected || !publicKey || !clusterOk) {
      setSnap(null)
      return
    }
    setSnap(await fetchYieldDashboardSnapshot(connection, publicKey))
  }, [clusterOk, connected, connection, publicKey])

  useEffect(() => {
    let cancelled = false
    const t0 = window.setTimeout(() => {
      if (!cancelled) void refreshSnap()
    }, 0)
    let interval: number | undefined
    if (clusterOk && connected && publicKey) {
      interval = window.setInterval(() => {
        if (!cancelled) void refreshSnap()
      }, 12_000)
    }
    return () => {
      cancelled = true
      window.clearTimeout(t0)
      if (interval != null) window.clearInterval(interval)
    }
  }, [clusterOk, connected, publicKey, refreshSnap])

  const apy = yieldBoostApyPercent()
  const stakeSol = Number(FAN_REACTION_STAKE_LAMPORTS) / 1e9
  const expectedYearSol = stakeSol * (apy / 100)

  const toggleDisabled =
    !connected || busy || !clusterOk || instantStakingSessionActive

  return (
    <section className="watch-yield-boost" aria-labelledby="watch-yield-heading">
      <h3 id="watch-yield-heading" className="watch-yield-title">
        Yield Boost
      </h3>
      {!clusterOk && (
        <p className="muted watch-yield-note">
          Available on <strong>mainnet</strong> when{' '}
          <code>VITE_ENABLE_YIELD_BOOST=true</code>. StakeToCurate can stay on devnet; use a
          mainnet RPC in <code>.env</code> to try this flow.
        </p>
      )}
      {clusterOk && instantStakingSessionActive && (
        <p className="muted watch-yield-note">
          End <strong>Instant Staking</strong> to use Yield Boost (Phantom must sign JitoSOL +
          Kamino txs).
        </p>
      )}
      <label className="watch-yield-toggle-row">
        <input
          type="checkbox"
          className="watch-yield-toggle"
          checked={yieldBoostEnabled}
          disabled={toggleDisabled}
          onChange={(e) => setYieldBoostEnabled(e.target.checked)}
        />
        <span className="watch-yield-toggle-label">
          Boost yield to 7.5–8.5% with JitoSOL + Kamino
        </span>
      </label>
      {yieldBoostEnabled && clusterOk && (
        <p className="muted watch-yield-estimate">
          Est. APY ~{apy}% · Expected yearly on {lamportsToSol(FAN_REACTION_STAKE_LAMPORTS)} SOL
          stake: ~{expectedYearSol.toFixed(5)} SOL (not a guarantee; smart-contract and market
          risk).
        </p>
      )}
      {yieldBoostEnabled && clusterOk && (
        <p className="muted watch-yield-note">
          Uses <strong>2×</strong> the reaction stake in Phantom for one vote: one leg mints
          JitoSOL + Kamino, the other stakes SOL in SnapCinema (on-chain program unchanged).
        </p>
      )}
      {clusterOk && publicKey && (
        <div className="watch-yield-dashboard" aria-live="polite">
          <p className="watch-yield-dashboard-line">
            <strong>Kamino shares</strong>:{' '}
            {snap?.kaminoSharesUi != null ? snap.kaminoSharesUi : '—'}
          </p>
          <p className="watch-yield-dashboard-line">
            <strong>Wallet JitoSOL</strong>:{' '}
            {snap?.jitosolWalletUi != null ? snap.jitosolWalletUi : '—'}
          </p>
          <p className="watch-yield-dashboard-line">
            <strong>Strategy APY (Kamino)</strong>:{' '}
            {snap?.kaminoApyPercent != null
              ? `${snap.kaminoApyPercent.toFixed(2)}%`
              : '—'}
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm watch-yield-withdraw"
            disabled={!connected || busy || !clusterOk}
            onClick={() => onWithdrawYieldBoost()}
          >
            Withdraw anytime
          </button>
          <p className="muted watch-yield-withdraw-hint">
            Unstakes Kamino → JitoSOL → SOL in two steps; you may sign twice in Phantom.
          </p>
        </div>
      )}
    </section>
  )
}
