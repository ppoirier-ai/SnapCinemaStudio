import { Buffer } from 'buffer'
import { useCallback, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
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
  PROGRAM_ID,
  sampleVersionIndex,
  sendAndConfirm,
  slotPda,
  versionPda,
} from './stakeToCurate/client'
import './App.css'

const PRESETS_LAMPORTS = [
  BigInt(10_000_000),
  BigInt(50_000_000),
  BigInt(100_000_000),
]

function lamportsToSol(l: bigint): string {
  const whole = l / BigInt(LAMPORTS_PER_SOL)
  const frac = l % BigInt(LAMPORTS_PER_SOL)
  return `${whole}.${frac.toString().padStart(9, '0').replace(/0+$/, '') || '0'}`
}

export default function App() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { publicKey, signTransaction, connected } = wallet

  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [v0, setV0] = useState<ReturnType<typeof decodeVersion> | null>(null)
  const [v1, setV1] = useState<ReturnType<typeof decodeVersion> | null>(null)
  const [pos0, setPos0] = useState<ReturnType<typeof decodePosition> | null>(null)
  const [pos1, setPos1] = useState<ReturnType<typeof decodePosition> | null>(null)
  const [playback, setPlayback] = useState<0 | 1 | null>(null)

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

  const onRollPlayback = () => {
    if (!v0 || !v1) {
      append('Roll playback: create versions first')
      return
    }
    const i = sampleVersionIndex([v0.rank, v1.rank])
    setPlayback(i)
    append(`Playback sampled version ${i} (ranks ${v0.rank} / ${v1.rank})`)
  }

  const versionHint = !connected
    ? 'Connect wallet to load on-chain data.'
    : 'No version account yet — run Setup below.'
  const positionHint = !connected
    ? 'Connect wallet to see your positions.'
    : 'No open position for this version — stake first.'

  return (
    <main className="studio">
      <header className="top">
        <h1>SnapCinema Studio — Phase 1 demo</h1>
        <div className="wallet-slot">
          <WalletMultiButton />
        </div>
      </header>

      <p className="lede">
        Deploy <code>programs/stake_to_curate</code> to <strong>devnet</strong>, set{' '}
        <code>VITE_STAKE_TO_CURATE_PROGRAM_ID</code> if your ID differs, fund the
        wallet with devnet SOL, then run the flow below.
      </p>

      <section className="panel" aria-labelledby="chain-heading">
        <h2 id="chain-heading">Chain</h2>
        <div>
          <span className="field-label">Program</span>
          <code className="pid">{PROGRAM_ID.toBase58()}</code>
        </div>
        {slotPk && (
          <div>
            <span className="field-label">Slot PDA (id {DEMO_SLOT_ID})</span>
            <code className="pid">{slotPk.toBase58()}</code>
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!connected || busy}
          onClick={() => void refreshOnChain()}
        >
          Refresh on-chain state
        </button>
      </section>

      <section className="panel" aria-labelledby="init-heading">
        <h2 id="init-heading">1. Initialize</h2>
        <p className="muted">
          Creates slot {DEMO_SLOT_ID}, creator/platform = your wallet, two
          versions (ranks 1_000_000 and 200_000).
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!connected || busy}
          onClick={() => void onSetup()}
        >
          Setup demo (init slot + 2 versions)
        </button>
      </section>

      <section className="panel" aria-labelledby="versions-heading">
        <h2 id="versions-heading">2. Versions &amp; ranks</h2>
        <div className="grid2">
          <div className="version-card">
            <h3>Version 0</h3>
            {v0 ? (
              <ul className="stats">
                <li>rank: {v0.rank.toString()}</li>
                <li>active stake: {lamportsToSol(v0.activeStake)} SOL</li>
              </ul>
            ) : (
              <p className="muted empty-hint">{versionHint}</p>
            )}
          </div>
          <div className="version-card">
            <h3>Version 1</h3>
            {v1 ? (
              <ul className="stats">
                <li>rank: {v1.rank.toString()}</li>
                <li>active stake: {lamportsToSol(v1.activeStake)} SOL</li>
              </ul>
            ) : (
              <p className="muted empty-hint">{versionHint}</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="stake-heading">
        <h2 id="stake-heading">3. Stake (preset lamports)</h2>
        <div className="stake-matrix" role="group" aria-label="Stake presets by amount">
          <div className="stake-matrix-head">
            <span className="stake-col-label">Preset</span>
            <span className="stake-col-label stake-up">Up v0</span>
            <span className="stake-col-label stake-up">Up v1</span>
            <span className="stake-col-label stake-down">Down v0</span>
            <span className="stake-col-label stake-down">Down v1</span>
          </div>
          {PRESETS_LAMPORTS.map((lam) => (
            <div key={lam.toString()} className="stake-matrix-row">
              <span className="preset-label">{lamportsToSol(lam)} SOL</span>
              <button
                type="button"
                className="btn btn-ghost btn-up"
                disabled={!connected || busy}
                onClick={() => void onStakeUp(0, lam)}
              >
                Up v0
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-up"
                disabled={!connected || busy}
                onClick={() => void onStakeUp(1, lam)}
              >
                Up v1
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-down"
                disabled={!connected || busy}
                onClick={() => void onStakeDown(0, lam)}
              >
                Down v0
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-down"
                disabled={!connected || busy}
                onClick={() => void onStakeDown(1, lam)}
              >
                Down v1
              </button>
            </div>
          ))}
        </div>
        <p className="muted">
          First stake on a version sets your side (up vs down). Add more stake on
          the same side; use Unstake to exit (1% residual rank stays on-chain).
        </p>
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!connected || busy}
            onClick={() => void onUnstake(0)}
          >
            Unstake v0
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!connected || busy}
            onClick={() => void onUnstake(1)}
          >
            Unstake v1
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="positions-heading">
        <h2 id="positions-heading">4. Your positions</h2>
        <div className="grid2">
          <div className="version-card">
            <h3>On version 0</h3>
            {pos0 ? (
              <ul className="stats">
                <li>staked: {lamportsToSol(pos0.amount)} SOL</li>
                <li>side: {pos0.isUp ? 'up' : 'down'}</li>
                <li>active: {pos0.isActive ? 'yes' : 'residual'}</li>
                <li>entry_rank: {pos0.entryRank.toString()}</li>
                <li>accrued: {lamportsToSol(pos0.accruedRewards)} SOL</li>
              </ul>
            ) : (
              <p className="muted empty-hint">{positionHint}</p>
            )}
          </div>
          <div className="version-card">
            <h3>On version 1</h3>
            {pos1 ? (
              <ul className="stats">
                <li>staked: {lamportsToSol(pos1.amount)} SOL</li>
                <li>side: {pos1.isUp ? 'up' : 'down'}</li>
                <li>active: {pos1.isActive ? 'yes' : 'residual'}</li>
                <li>entry_rank: {pos1.entryRank.toString()}</li>
                <li>accrued: {lamportsToSol(pos1.accruedRewards)} SOL</li>
              </ul>
            ) : (
              <p className="muted empty-hint">{positionHint}</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="revenue-heading">
        <h2 id="revenue-heading">5. Revenue &amp; claim</h2>
        <p className="muted">
          Deposits split 20% / 10% / 70% (creator / platform / curators). Passes all
          position accounts for that version (auto-fetched).
        </p>
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!connected || busy}
            onClick={() => void onDeposit(0, BigInt(200_000_000))}
          >
            Deposit 0.2 SOL on v0
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!connected || busy}
            onClick={() => void onClaim(0)}
          >
            Claim curator (v0)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!connected || busy}
            onClick={() => void onDeposit(1, BigInt(200_000_000))}
          >
            Deposit 0.2 SOL on v1
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!connected || busy}
            onClick={() => void onClaim(1)}
          >
            Claim curator (v1)
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="playback-heading">
        <h2 id="playback-heading">6. Mock playback</h2>
        <p className="muted">
          Weighted by on-chain ranks: P(v) ∝ rank_v / (rank0 + rank1).
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

      <section className="panel log-panel" aria-labelledby="log-heading">
        <h2 id="log-heading">Log</h2>
        <pre
          className={`log${log.length === 0 ? ' log-empty-state' : ''}`}
        >
          {log.length > 0 ? log.join('\n') : 'No events yet — actions append here.'}
        </pre>
      </section>
    </main>
  )
}
