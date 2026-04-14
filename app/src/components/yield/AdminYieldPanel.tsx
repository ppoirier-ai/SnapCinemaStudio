import { useConnection } from '@solana/wallet-adapter-react'
import { useCallback, useEffect, useState } from 'react'
import { lamportsToSol } from '../../demo/format'
import { isMainnetYieldBoostAvailable } from '../../yield/cluster'
import { yieldBoostApyPercent } from '../../yield/constants'
import { fetchYieldDashboardSnapshot } from '../../yield/yieldDashboard'
import { FAN_REACTION_STAKE_LAMPORTS } from '../../demo/constants'

type Props = {
  connected: boolean
  publicKey: import('@solana/web3.js').PublicKey | null
  busy: boolean
  instantStakingSessionActive: boolean
  onWithdrawYieldBoost: () => void
  onConfigureYieldTreasury: () => void
}

/**
 * Mainnet JitoSOL / Kamino dashboard and withdraw — **Studio → Admin** only.
 * Watch reactions use StakeToCurate vault stakes only; this panel does not move vault SOL.
 */
export function AdminYieldPanel({
  connected,
  publicKey,
  busy,
  instantStakingSessionActive,
  onWithdrawYieldBoost,
  onConfigureYieldTreasury,
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

  return (
    <section className="watch-yield-boost" aria-labelledby="admin-yield-heading">
      <h3 id="admin-yield-heading" className="watch-yield-title">
        JitoSOL / Kamino (mainnet, admin)
      </h3>
      <p className="muted watch-yield-note">
        Surplus vault SOL (above tracked principal) can be swept to a configured yield
        treasury; run the <code>immediate-yield-worker</code> script with the same
        keypair. See <code>docs/vault-yield-pool-plan.md</code>.
      </p>
      {connected && publicKey && (
        <p className="muted watch-yield-note">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => onConfigureYieldTreasury()}
          >
            Set yield treasury to this wallet
          </button>{' '}
          (slot authority only — one-time; use this keypair for the immediate-yield worker on
          mainnet.)
        </p>
      )}
      {!clusterOk && (
        <p className="muted watch-yield-note">
          Connect with <strong>mainnet</strong> and set{' '}
          <code>VITE_ENABLE_YIELD_BOOST=true</code> to load Kamino metrics and withdraw.
        </p>
      )}
      {clusterOk && instantStakingSessionActive && (
        <p className="muted watch-yield-note">
          End <strong>Instant Staking</strong> on Watch before signing Kamino withdraw txs
          here (same Phantom session).
        </p>
      )}
      {clusterOk && (
        <p className="muted watch-yield-estimate">
          Reference ~{apy}% APY · Illustrative yearly on {lamportsToSol(FAN_REACTION_STAKE_LAMPORTS)}{' '}
          SOL notional: ~{expectedYearSol.toFixed(5)} SOL (not a guarantee; market risk).
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
            Withdraw from Kamino path
          </button>
          <p className="muted watch-yield-withdraw-hint">
            Unstakes Kamino → JitoSOL → SOL; you may sign twice in Phantom.
          </p>
        </div>
      )}
    </section>
  )
}
