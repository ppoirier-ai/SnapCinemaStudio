import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChainPanel } from '../demo/ChainPanel'
import { CreatorConceptPanel } from '../demo/CreatorConceptPanel'
import { FAN_REACTION_LAMPORTS } from '../demo/constants'
import { FanReactions } from '../demo/FanReactions'
import { FanStage } from '../demo/FanStage'
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
    setToast,
    append,
    refreshOnChain,
    onSetup,
    onStakeUp,
    onStakeDown,
    onUnstake,
    onDeposit,
    onClaim,
    onRollPlayback,
  } = useDemoSlot()

  const onFanThumbUp = () => {
    if (playback === null) return
    void onStakeUp(playback, FAN_REACTION_LAMPORTS)
  }

  const onFanThumbDown = () => {
    if (playback === null) return
    void onStakeDown(playback, FAN_REACTION_LAMPORTS)
  }

  const onFlag = () => {
    setToast(
      'Flag recorded for this demo. On-chain reporting can be added in a later version.',
    )
    append('Flag: UI-only signal (no chain tx)')
  }

  const reactionsDisabled = !connected || busy || playback === null

  return (
    <main className="studio studio-demo-page">
      <div className="studio-demo-intro">
        <h1 className="studio-demo-title">Studio demo</h1>
        <p className="muted studio-demo-tagline">
          Phase 1 flow — pick a role. Use the wallet menu for Watch, Contribute, and
          Account.
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
          <strong>Creator:</strong> paste a <strong>YouTube</strong> link for your
          trailer or cut, add an optional local concept file (not uploaded here), then
          track version performance and simulated revenue splits (20% / 10% / 70%).
        </p>
      )}

      {role === 'fan' && (
        <p className="lede fan-lede">
          <strong>Fan:</strong> watch the sampled cut, react with thumbs or flag, and
          use <strong>Account</strong> in the wallet menu to claim rewards.{' '}
          <button
            type="button"
            className="btn btn-ghost studio-inline-link"
            onClick={() => navigate('/contribute')}
          >
            Contribute a scene
          </button>
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
          <CreatorConceptPanel />
          <VersionsPanel v0={v0} v1={v1} connected={connected} />
          <RevenuePanel
            connected={connected}
            busy={busy}
            onDeposit={onDeposit}
            onClaim={onClaim}
          />
        </>
      )}

      {role === 'fan' && (
        <>
          <FanStage
            activeVersion={playback}
            v0={v0}
            v1={v1}
            connected={connected}
            busy={busy}
            onRoll={onRollPlayback}
          />
          <FanReactions
            disabled={reactionsDisabled}
            activeVersion={playback}
            onThumbUp={onFanThumbUp}
            onThumbDown={onFanThumbDown}
            onFlag={onFlag}
          />
        </>
      )}

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
            <p className="muted">Same rank-weighted sampling as the Fan tab.</p>
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
