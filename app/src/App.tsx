import { Buffer } from 'buffer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { AccountModal } from './demo/AccountModal'
import { ChainPanel } from './demo/ChainPanel'
import { CreatorConceptPanel } from './demo/CreatorConceptPanel'
import { FAN_REACTION_LAMPORTS } from './demo/constants'
import { FanContributePanel } from './demo/FanContributePanel'
import { FanReactions } from './demo/FanReactions'
import { FanStage } from './demo/FanStage'
import { InitPanel } from './demo/InitPanel'
import { LogPanel } from './demo/LogPanel'
import { PositionsPanel } from './demo/PositionsPanel'
import { RevenuePanel } from './demo/RevenuePanel'
import { RoleTabs } from './demo/RoleTabs'
import { StakePanel } from './demo/StakePanel'
import type { DemoRole, FanSubView } from './demo/types'
import { VersionsPanel } from './demo/VersionsPanel'
import {
  DEMO_SLOT_ID,
  decodePosition,
  decodeVersion,
  fetchPositionsForVersion,
  ixClaimCurator,
  ixDepositRevenue,
  ixInitializeSlot,
  ixRegisterVersion,
  ixStakeDown,
  ixStakeUp,
  ixUnstake,
  positionPda,
  sampleVersionIndex,
  sendAndConfirm,
  slotPda,
  versionPda,
} from './stakeToCurate/client'
import './App.css'

export default function App() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { publicKey, signTransaction, connected } = wallet

  const [role, setRole] = useState<DemoRole>('fan')
  const [fanSubView, setFanSubView] = useState<FanSubView>('watch')
  const [accountOpen, setAccountOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [v0, setV0] = useState<ReturnType<typeof decodeVersion> | null>(null)
  const [v1, setV1] = useState<ReturnType<typeof decodeVersion> | null>(null)
  const [pos0, setPos0] = useState<ReturnType<typeof decodePosition> | null>(null)
  const [pos1, setPos1] = useState<ReturnType<typeof decodePosition> | null>(null)
  const [playback, setPlayback] = useState<0 | 1 | null>(null)
  const sampledBothRef = useRef(false)

  const append = useCallback((m: string) => {
    setLog((prev) => [...prev.slice(-40), `${new Date().toISOString().slice(11, 19)} ${m}`])
  }, [])

  const authority = publicKey
  const slotPk = useMemo(
    () => (authority ? slotPda(authority, DEMO_SLOT_ID) : null),
    [authority],
  )
  const v0Pk = useMemo(
    () => (slotPk ? versionPda(slotPk, 0) : null),
    [slotPk],
  )
  const v1Pk = useMemo(
    () => (slotPk ? versionPda(slotPk, 1) : null),
    [slotPk],
  )

  const refreshOnChain = useCallback(async () => {
    if (!authority || !v0Pk || !v1Pk) return
    const [a0, a1] = await Promise.all([
      connection.getAccountInfo(v0Pk),
      connection.getAccountInfo(v1Pk),
    ])
    if (a0?.data) setV0(decodeVersion(Buffer.from(a0.data)))
    else setV0(null)
    if (a1?.data) setV1(decodeVersion(Buffer.from(a1.data)))
    else setV1(null)
    const [p0, p1] = await Promise.all([
      connection.getAccountInfo(positionPda(v0Pk, authority)),
      connection.getAccountInfo(positionPda(v1Pk, authority)),
    ])
    if (p0?.data) setPos0(decodePosition(Buffer.from(p0.data)))
    else setPos0(null)
    if (p1?.data) setPos1(decodePosition(Buffer.from(p1.data)))
    else setPos1(null)
  }, [authority, connection, v0Pk, v1Pk])

  useEffect(() => {
    if (!v0 && !v1) {
      setPlayback(null)
      sampledBothRef.current = false
      return
    }
    if (v0 && !v1) {
      setPlayback(0)
      sampledBothRef.current = false
      return
    }
    if (!v0 && v1) {
      setPlayback(1)
      sampledBothRef.current = false
      return
    }
    if (v0 && v1) {
      if (!sampledBothRef.current) {
        setPlayback(sampleVersionIndex([v0.rank, v1.rank]))
        sampledBothRef.current = true
      }
    }
  }, [v0, v1])

  useEffect(() => {
    if (role !== 'fan') setFanSubView('watch')
  }, [role])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!connected || !authority) return
    void refreshOnChain()
  }, [connected, authority, refreshOnChain])

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      append(`OK: ${label}`)
      await refreshOnChain()
    } catch (e) {
      console.error(e)
      append(`ERR: ${label} — ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const onSetup = () =>
    run('setup slot + versions', async () => {
      if (!authority || !signTransaction)
        throw new Error('Connect wallet first')
      const creator = authority
      const platform = authority
      await sendAndConfirm(
        connection,
        { publicKey: authority, signTransaction },
        [
          ixInitializeSlot(authority, creator, platform, DEMO_SLOT_ID),
          ixRegisterVersion(authority, DEMO_SLOT_ID, 0, 1_000_000n),
          ixRegisterVersion(authority, DEMO_SLOT_ID, 1, 200_000n),
        ],
      )
    })

  const onStakeUp = (versionIndex: 0 | 1, lamports: bigint) =>
    run(`stake_up v${versionIndex}`, async () => {
      if (!authority || !signTransaction)
        throw new Error('Connect wallet first')
      await sendAndConfirm(
        connection,
        { publicKey: authority, signTransaction },
        [
          ixStakeUp(authority, authority, DEMO_SLOT_ID, versionIndex, lamports),
        ],
      )
    })

  const onStakeDown = (versionIndex: 0 | 1, lamports: bigint) =>
    run(`stake_down v${versionIndex}`, async () => {
      if (!authority || !signTransaction)
        throw new Error('Connect wallet first')
      await sendAndConfirm(
        connection,
        { publicKey: authority, signTransaction },
        [
          ixStakeDown(authority, authority, DEMO_SLOT_ID, versionIndex, lamports),
        ],
      )
    })

  const onUnstake = (versionIndex: 0 | 1) =>
    run(`unstake v${versionIndex}`, async () => {
      if (!authority || !signTransaction)
        throw new Error('Connect wallet first')
      await sendAndConfirm(
        connection,
        { publicKey: authority, signTransaction },
        [ixUnstake(authority, authority, DEMO_SLOT_ID, versionIndex)],
      )
    })

  const onDeposit = (versionIndex: 0 | 1, lamports: bigint) =>
    run(`deposit_revenue v${versionIndex}`, async () => {
      if (!authority || !signTransaction)
        throw new Error('Connect wallet first')
      const slot = slotPda(authority, DEMO_SLOT_ID)
      const ver = versionPda(slot, versionIndex)
      const positions = await fetchPositionsForVersion(connection, ver)
      if (positions.length === 0)
        throw new Error('No positions for this version — stake first')
      await sendAndConfirm(
        connection,
        { publicKey: authority, signTransaction },
        [
          ixDepositRevenue(
            authority,
            authority,
            DEMO_SLOT_ID,
            versionIndex,
            lamports,
            authority,
            authority,
            positions.map((p) => p.pubkey),
          ),
        ],
      )
    })

  const onClaim = (versionIndex: 0 | 1) =>
    run(`claim_curator v${versionIndex}`, async () => {
      if (!authority || !signTransaction)
        throw new Error('Connect wallet first')
      await sendAndConfirm(
        connection,
        { publicKey: authority, signTransaction },
        [ixClaimCurator(authority, authority, DEMO_SLOT_ID, versionIndex)],
      )
    })

  const onClaimAll = () =>
    run('claim all curator rewards', async () => {
      if (!authority || !signTransaction)
        throw new Error('Connect wallet first')
      const has0 = pos0 && pos0.accruedRewards > 0n
      const has1 = pos1 && pos1.accruedRewards > 0n
      if (!has0 && !has1)
        throw new Error('No accrued rewards to claim')
      if (has0) {
        await sendAndConfirm(
          connection,
          { publicKey: authority, signTransaction },
          [ixClaimCurator(authority, authority, DEMO_SLOT_ID, 0)],
        )
      }
      if (has1) {
        await sendAndConfirm(
          connection,
          { publicKey: authority, signTransaction },
          [ixClaimCurator(authority, authority, DEMO_SLOT_ID, 1)],
        )
      }
    })

  const onRollPlayback = () => {
    if (!v0 || !v1) {
      append('Roll playback: need both versions on-chain')
      return
    }
    const i = sampleVersionIndex([v0.rank, v1.rank])
    setPlayback(i)
    append(`Playback sampled version ${i} (ranks ${v0.rank} / ${v1.rank})`)
  }

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

  const reactionsDisabled =
    !connected || busy || playback === null

  const setRoleTab = (r: DemoRole) => {
    setRole(r)
    if (r !== 'fan') setAccountOpen(false)
  }

  return (
    <main className="studio">
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <header className="top">
        <div className="top-brand">
          <h1>SnapCinema Studio</h1>
          <p className="top-tagline">Phase 1 demo — pick a role to explore the flow</p>
        </div>
        <div className="header-actions">
          {role === 'fan' && fanSubView === 'watch' && (
            <button
              type="button"
              className="btn btn-secondary header-link-btn"
              onClick={() => setFanSubView('contribute')}
            >
              Contribute a scene
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary header-link-btn"
            onClick={() => setAccountOpen(true)}
          >
            Account
          </button>
          <div className="wallet-slot">
            <WalletMultiButton />
          </div>
        </div>
      </header>

      <RoleTabs role={role} onChange={setRoleTab} />

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
          <strong>Creator:</strong> register your concept and trailer placeholders,
          then track version performance and simulated revenue splits (20% / 10% /
          70%).
        </p>
      )}

      {role === 'fan' && fanSubView === 'watch' && (
        <p className="lede fan-lede">
          <strong>Fan:</strong> watch the sampled cut, react with thumbs or flag, and
          open <strong>Account</strong> to claim curator rewards. Advanced staking
          lives under the <strong>Admin</strong> tab.
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

      {role === 'fan' && fanSubView === 'watch' && (
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

      {role === 'fan' && fanSubView === 'contribute' && (
        <FanContributePanel
          onBack={() => setFanSubView('watch')}
          onSubmitted={(summary) => {
            append(summary)
          }}
        />
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
            <p className="muted">
              Same rank-weighted sampling as the Fan tab.
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

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        publicKey={publicKey}
        connected={connected}
        busy={busy}
        pos0={pos0}
        pos1={pos1}
        onRefresh={refreshOnChain}
        onClaimV0={() => void onClaim(0)}
        onClaimV1={() => void onClaim(1)}
        onClaimAll={() => void onClaimAll()}
      />
    </main>
  )
}
