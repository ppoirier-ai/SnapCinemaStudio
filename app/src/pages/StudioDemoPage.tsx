import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChainPanel } from '../demo/ChainPanel'
import { CreatorProjectForm } from '../demo/CreatorProjectForm'
import { FanSceneBoard } from '../demo/FanSceneBoard'
import { InitPanel } from '../demo/InitPanel'
import { LogPanel } from '../demo/LogPanel'
import { PositionsPanel } from '../demo/PositionsPanel'
import { RevenuePanel } from '../demo/RevenuePanel'
import { RoleTabs } from '../demo/RoleTabs'
import { StakePanel } from '../demo/StakePanel'
import type { DemoRole } from '../demo/types'
import { VersionsPanel } from '../demo/VersionsPanel'
import { useDemoSlot } from '../context/DemoSlotContext'
import { DEMO_SLOT_ID } from '../stakeToCurate/client'

export function StudioDemoPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<DemoRole>('fan')
  const {
    connected,
    busy,
    slotPk,
    v0,
    v1,
    pos0,
    pos1,
    playback,
    log,
    refreshOnChain,
    onSetup,
    onStakeUp,
    onStakeDown,
    onUnstake,
    onDeposit,
    onClaim,
    onRollPlayback,
  } = useDemoSlot()

  return (
    <main className="studio studio-demo-page">
      <div className="studio-demo-intro">
        <h1 className="studio-demo-title">Studio demo</h1>
        <p className="muted studio-demo-tagline">
          Phase 1 flow — pick a role. Reactions and playback live on{' '}
          <button
            type="button"
            className="btn btn-ghost studio-inline-link"
            onClick={() => navigate('/watch')}
          >
            Watch
          </button>
          . Use the wallet menu for Scene board, Account, and more.
        </p>
      </div>

      <RoleTabs role={role} onChange={setRole} />

      {role === 'admin' && (
        <p className="lede">
          <strong>Platform admin:</strong> deploy{' '}
          <code>programs/stake_to_curate</code> to <strong>devnet</strong>, set{' '}
          <code>VITE_STAKE_TO_CURATE_PROGRAM_ID</code> if your program id differs,
          fund this wallet with devnet SOL, then refresh and initialize below.
        </p>
      )}

      {role === 'creator' && (
        <p className="lede">
          <strong>Creator:</strong> save your project title and description here.
          Scene YouTube links and alternates are curated on the <strong>Scenes</strong>{' '}
          tab. Revenue tools below still follow on-chain versions (v0 / v1).
        </p>
      )}

      {role === 'fan' && (
        <p className="lede scenes-lede">
          <strong>Scenes:</strong> build the scene matrix (time × alternatives). Open{' '}
          <button
            type="button"
            className="btn btn-ghost studio-inline-link"
            onClick={() => navigate('/watch')}
          >
            Watch
          </button>{' '}
          to react with stakes. <strong>Account</strong> is in the wallet menu.
        </p>
      )}

      {role === 'admin' && (
        <>
          <ChainPanel
            demoSlotId={DEMO_SLOT_ID}
            slotPk={slotPk}
            connected={connected}
            busy={busy}
            onRefresh={refreshOnChain}
          />
          <InitPanel
            demoSlotId={DEMO_SLOT_ID}
            connected={connected}
            busy={busy}
            onSetup={onSetup}
          />
          <LogPanel lines={log} />
        </>
      )}

      {role === 'creator' && (
        <>
          <CreatorProjectForm />
          <VersionsPanel v0={v0} v1={v1} connected={connected} />
          <RevenuePanel
            connected={connected}
            busy={busy}
            onDeposit={onDeposit}
            onClaim={onClaim}
          />
        </>
      )}

      {role === 'fan' && <FanSceneBoard />}

      {role === 'admin' && (
        <>
          <section className="panel admin-tools-note">
            <h2>Advanced tools</h2>
            <p className="muted">
              Full stake matrix, positions, and mock playback for testing are
              available here without switching wallets.
            </p>
          </section>
          <VersionsPanel v0={v0} v1={v1} connected={connected} />
          <StakePanel
            connected={connected}
            busy={busy}
            onStakeUp={onStakeUp}
            onStakeDown={onStakeDown}
            onUnstake={onUnstake}
          />
          <PositionsPanel pos0={pos0} pos1={pos1} connected={connected} />
          <RevenuePanel
            connected={connected}
            busy={busy}
            onDeposit={onDeposit}
            onClaim={onClaim}
          />
          <section className="panel" aria-labelledby="playback-admin-heading">
            <h2 id="playback-admin-heading">Mock playback (test)</h2>
            <p className="muted">
              Same rank-weighted sampling as the <strong>Watch</strong> page embed
              path.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={onRollPlayback}
            >
              Roll which version &quot;plays&quot;
            </button>
            {playback !== null && (
              <p className="playback">
                Sampled version <strong>{playback}</strong>
              </p>
            )}
          </section>
        </>
      )}
    </main>
  )
}
