import { useMemo, useState } from 'react'
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
    chainRefreshBusy,
    slotPk,
    sceneRows,
    log,
    refreshOnChain,
    onSetup,
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

  return (
    <main className="studio studio-demo-page">
      <div className="studio-demo-intro">
        <h1 className="studio-demo-title">Studio</h1>
        <p className="muted studio-demo-tagline">
          Phase 1 flow — pick a role. Reactions on{' '}
          <button
            type="button"
            className="btn btn-ghost studio-inline-link"
            onClick={() => navigate('/watch')}
          >
            Watch
          </button>{' '}
          target the <strong>currently playing scene</strong> (per-cell on-chain rank).
          Scene editing is under the wallet menu (<strong>Scene</strong>).
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
          <strong>Scene</strong>. Each playable cell gets its own on-chain scene account
          when the slot authority saves a URL there.
        </p>
      )}

      {role === 'admin' && (
        <>
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
          <LogPanel lines={log} />
        </>
      )}

      {role === 'creator' && (
        <>
          <CreatorProjectForm />
          <RevenuePanel />
        </>
      )}

      {role === 'admin' && (
        <>
          <section className="panel admin-tools-note">
            <h2>Advanced tools</h2>
            <p className="muted">
              Ranks and stake / downstake live on the wallet menu <strong>Scene</strong>{' '}
              page (per-scene tooltips) and on <strong>Watch</strong> for the playing clip.
            </p>
          </section>
          <PositionsPanel positions={positions} connected={connected} />
          <RevenuePanel />
        </>
      )}
    </main>
  )
}
