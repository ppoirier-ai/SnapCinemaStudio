import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChainPanel } from '../demo/ChainPanel'
import { CreatorProjectForm } from '../demo/CreatorProjectForm'
import { InitPanel } from '../demo/InitPanel'
import { LogPanel } from '../demo/LogPanel'
import { PositionsPanel } from '../demo/PositionsPanel'
import { RevenuePanel } from '../demo/RevenuePanel'
import { RoleTabs } from '../demo/RoleTabs'
import type { DemoRole } from '../demo/types'
import { useDemoSlot } from '../context/DemoSlotContext'
import { DEMO_SLOT_ID } from '../stakeToCurate/client'

export function StudioDemoPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<DemoRole>('creator')
  const {
    connected,
    busy,
    slotPk,
    pos0,
    pos1,
    playback,
    log,
    refreshOnChain,
    onSetup,
    onDeposit,
    onClaim,
    onRollPlayback,
  } = useDemoSlot()

  return (
    <main className="studio studio-demo-page">
      <div className="studio-demo-intro">
        <h1 className="studio-demo-title">Studio</h1>
        <p className="muted studio-demo-tagline">
          Phase 1 flow — pick a role. Reactions and playback live on{' '}
          <button
            type="button"
            className="btn btn-ghost studio-inline-link"
            onClick={() => navigate('/watch')}
          >
            Watch
          </button>
          . Scene editing is under the wallet menu (<strong>Scene</strong>).
        </p>
      </div>

      <RoleTabs role={role} onChange={setRole} roles={['admin', 'creator']} />

      {role === 'admin' && (
        <p className="lede">
          <strong>Platform admin:</strong> deploy{' '}
          <code>programs/stake_to_curate</code> to <strong>devnet</strong>, set{' '}
          <code>VITE_STAKE_TO_CURATE_PROGRAM_ID</code> if your program id differs, set{' '}
          <code>VITE_STAKE_SLOT_AUTHORITY</code> to the admin wallet pubkey so all
          viewers share one slot (see <code>app/.env.example</code>), fund that wallet
          with devnet SOL, connect it here, then initialize below once.
        </p>
      )}

      {role === 'creator' && (
        <p className="lede">
          <strong>Creator:</strong> save your project title and description here.
          Scene YouTube links and alternates are edited from the wallet menu under{' '}
          <strong>Scene</strong> for ranks, stakes, and the scene matrix. Revenue tools
          below use the same on-chain v0 / v1.
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
          <RevenuePanel
            connected={connected}
            busy={busy}
            onDeposit={onDeposit}
            onClaim={onClaim}
          />
        </>
      )}

      {role === 'admin' && (
        <>
          <section className="panel admin-tools-note">
            <h2>Advanced tools</h2>
            <p className="muted">
              Ranks and stake / downstake live on the wallet menu <strong>Scene</strong>{' '}
              page. Positions detail and mock playback stay here for testing.
            </p>
          </section>
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
