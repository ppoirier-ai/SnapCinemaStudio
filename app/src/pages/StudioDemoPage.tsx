import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { ChainPanel } from '../demo/ChainPanel'
import { InitPanel } from '../demo/InitPanel'
import { LogPanel } from '../demo/LogPanel'
import { PositionsPanel } from '../demo/PositionsPanel'
import { AdminYieldPanel } from '../components/yield/AdminYieldPanel'
import { isPlatformOwner } from '../config/platformOwner'
import { useDemoSlot } from '../context/DemoSlotContext'
import { DEMO_SLOT_ID } from '../stakeToCurate/client'

export function StudioDemoPage() {
  const navigate = useNavigate()
  const { publicKey } = useWallet()
  const {
    connected,
    busy,
    chainRefreshBusy,
    slotPk,
    sceneRows,
    log,
    refreshOnChain,
    onSetup,
    instantStakingSessionActive,
    onWithdrawYieldBoost,
    onConfigureYieldTreasury,
  } = useDemoSlot()

  const positions = useMemo(
    () =>
      Object.entries(sceneRows)
        .filter(([, row]) => row.position && row.position.amount > 0n)
        .map(([sceneKeyHex, row]) => ({
          sceneKeyHex,
          position: row.position!,
        })),
    [sceneRows],
  )

  if (publicKey && !isPlatformOwner(publicKey)) {
    return <Navigate to="/watch" replace />
  }

  return (
    <main className="studio studio-demo-page">
      <div className="studio-demo-intro">
        <h1 className="studio-demo-title">Dashboard</h1>
        <p className="muted studio-demo-tagline">
          Platform admin: deploy and initialize the shared slot and yield tools. Contributors
          register scenes when they save YouTube URLs. Viewers use{' '}
          <button
            type="button"
            className="btn btn-ghost studio-inline-link"
            onClick={() => navigate('/watch')}
          >
            Watch
          </button>
          .
        </p>
      </div>

      <ChainPanel
        demoSlotId={DEMO_SLOT_ID}
        slotPk={slotPk}
        connected={connected}
        busy={busy}
        chainRefreshBusy={chainRefreshBusy}
        onRefresh={() => void refreshOnChain(null, { log: true })}
      />
      <InitPanel
        demoSlotId={DEMO_SLOT_ID}
        connected={connected}
        busy={busy}
        onSetup={onSetup}
      />
      <AdminYieldPanel
        connected={connected}
        publicKey={publicKey}
        busy={busy}
        instantStakingSessionActive={instantStakingSessionActive}
        onWithdrawYieldBoost={onWithdrawYieldBoost}
        onConfigureYieldTreasury={onConfigureYieldTreasury}
      />
      <LogPanel lines={log} />
      <section className="panel admin-tools-note">
        <h2>Advanced tools</h2>
        <p className="muted">
          Ranks and stake / downstake live on the wallet menu <strong>Scene</strong>{' '}
          page (per-scene tooltips) and on <strong>Watch</strong> for the playing clip.
        </p>
      </section>
      <PositionsPanel positions={positions} connected={connected} />
    </main>
  )
}
