import { Buffer } from 'buffer'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  Keypair,
  PublicKey,
  type TransactionInstruction,
} from '@solana/web3.js'
import { extractYoutubeVideoId } from '../lib/youtubeUrl'
import type { Movie } from './SceneBoardContext'
import {
  DEMO_SLOT_ID,
  decodeScene,
  decodeScenePosition,
  fetchScenePositionsForOwner,
  tryDecodeScene,
  tryDecodeScenePosition,
  ixConfigureYieldTreasury,
  ixInitializeSlot,
  ixRegisterScene,
  ixResetSceneRank,
  ixStakeSceneDown,
  ixStakeSceneUp,
  ixUnstakeScene,
  PROGRAM_ID,
  scenePda,
  scenePositionPda,
  resolveStakeSlotAuthority,
  sendAndConfirm,
  sendAndConfirmWithKeypair,
  slotPda,
} from '../stakeToCurate/client'
import {
  bytesToHex,
  hexToSceneKeyBytes,
  sceneKeyHex,
} from '../stakeToCurate/sceneKey'
import { REGISTER_SCENE_INITIAL_RANK_LAMPORTS } from '../demo/constants'
import {
  clearInstantSessionStorage,
  createEphemeralKeypair,
  INSTANT_SESSION_DURATION_MS,
  type InstantSessionMeta,
  ixFundSessionWallet,
  ixSweepSessionWalletToCustodian,
  MAX_SESSION_TOPUP_LAMPORTS,
  persistInstantSession,
  STAKE_RESERVE_LAMPORTS,
  tryRestoreInstantSession,
} from '../session/instantStakingSession'
import { isMainnetYieldBoostAvailable } from '../yield/cluster'
import { runYieldBoostWithdrawAll } from '../yield/yieldWithdraw'

export type SceneChainRow = {
  scene: ReturnType<typeof decodeScene> | null
  position: ReturnType<typeof decodeScenePosition> | null
}

type SceneRows = Record<string, SceneChainRow>

type DemoSlotValue = {
  chainSynced: boolean
  slotAuthority: PublicKey | null
  authority: ReturnType<typeof useWallet>['publicKey']
  publicKey: ReturnType<typeof useWallet>['publicKey']
  connected: boolean
  signTransaction: ReturnType<typeof useWallet>['signTransaction']
  slotPk: PublicKey | null
  /** True when the slot PDA account exists (admin ran setup). */
  slotInitialized: boolean
  /** Per-scene chain rows keyed by `sceneKeyHex` (64 hex chars). */
  sceneRows: SceneRows
  getSceneRow: (sceneKeyHex: string) => SceneChainRow | undefined
  /** Ranks for `buildWatchPlaylist` (on-chain rank when registered). */
  rankBySceneKeyHex: Record<string, bigint>
  log: string[]
  busy: boolean
  /** True while a user-triggered chain refresh (RPC read) is in flight. */
  chainRefreshBusy: boolean
  toast: string | null
  setToast: (t: string | null) => void
  append: (m: string) => void
  /**
   * Reload slot / scene rows from RPC. Pass the current movie to fetch each playable cell’s
   * Scene account. Use `{ log: true }` from UI buttons so the log panel and toast update.
   */
  refreshOnChain: (
    movie?: Movie | null,
    opts?: { log?: boolean },
  ) => Promise<void>
  /** Slot authority only: legacy batch register for cells that already have URLs (admin). */
  ensureScenesRegisteredForMovie: (movie: Movie) => Promise<void>
  /** Contributor pays rent: register Scene PDA for an empty cell (call after adding column/cell). */
  registerSceneForCell: (
    movie: Movie,
    columnId: string,
    cellId: string,
  ) => Promise<void>
  run: (label: string, fn: () => Promise<void>) => Promise<void>
  onSetup: () => void
  onStakeUp: (sceneKeyHex: string, lamports: bigint) => void
  onStakeDown: (sceneKeyHex: string, lamports: bigint) => void
  onUnstake: (sceneKeyHex: string) => void
  /** MVP: curator revenue distribution is deferred for per-scene accounts. */
  onDeposit: (_sceneKeyHex: string, _lamports: bigint) => void
  onClaim: (_sceneKeyHex: string) => void
  onClaimAll: () => void
  instantSessionMeta: InstantSessionMeta | null
  instantSessionBalanceLamports: bigint | null
  instantStakingSessionActive: boolean
  enableInstantStaking: () => void
  topUpInstantSession: () => void
  endInstantSession: () => void
  ensureInstantSessionForWatch: () => Promise<boolean>
  /** Full exit: Kamino shares → JitoSOL → SOL (mainnet + env gate); Studio → Admin only. */
  onWithdrawYieldBoost: () => void
  /** Slot authority: set on-chain yield treasury pubkey (use automation wallet for workers). */
  onConfigureYieldTreasury: () => void
}

const DemoSlotContext = createContext<DemoSlotValue | null>(null)

function collectPlayableSceneHexes(movie: Movie): string[] {
  const out: string[] = []
  for (const col of movie.columns) {
    for (const cell of col.cells) {
      if (!extractYoutubeVideoId(cell.youtubeUrl ?? '')) continue
      out.push(sceneKeyHex(movie.id, col.id, cell.id))
    }
  }
  return out
}

async function loadSceneRows(
  connection: ReturnType<typeof useConnection>['connection'],
  slotPk: PublicKey,
  positionOwner: PublicKey,
  movie: Movie | null | undefined,
): Promise<SceneRows> {
  const out: SceneRows = {}

  const posAccounts = await fetchScenePositionsForOwner(connection, positionOwner)
  for (const { data } of posAccounts) {
    const pos = tryDecodeScenePosition(Buffer.from(data))
    if (!pos) continue
    const sAi = await connection.getAccountInfo(pos.scene)
    const scene = sAi?.data ? tryDecodeScene(Buffer.from(sAi.data)) : null
    if (!scene) continue
    /** Positions are global per owner; only rows for *this* slot’s Scene PDAs belong here. */
    if (!scene.slot.equals(slotPk)) continue
    const hex = bytesToHex(scene.sceneKey)
    out[hex] = { scene, position: pos }
  }

  if (movie) {
    for (const hex of collectPlayableSceneHexes(movie)) {
      if (out[hex]?.scene) continue
      const sk = hexToSceneKeyBytes(hex)
      const scenePk = scenePda(slotPk, sk)
      const posPk = scenePositionPda(scenePk, positionOwner)
      const [sAi, pAi] = await Promise.all([
        connection.getAccountInfo(scenePk),
        connection.getAccountInfo(posPk),
      ])
      out[hex] = {
        scene: sAi?.data ? tryDecodeScene(Buffer.from(sAi.data)) : null,
        position: pAi?.data ? tryDecodeScenePosition(Buffer.from(pAi.data)) : null,
      }
    }
  }

  return out
}

export function DemoSlotProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { publicKey, signTransaction, connected } = wallet

  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [chainRefreshBusy, setChainRefreshBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [sceneRows, setSceneRows] = useState<SceneRows>({})
  const [slotInitialized, setSlotInitialized] = useState(false)
  const [chainSynced, setChainSynced] = useState(false)
  const runInFlightRef = useRef(false)
  const instantKeypairRef = useRef<Keypair | null>(null)
  const instantSessionMetaRef = useRef<InstantSessionMeta | null>(null)
  const finalizeInFlightRef = useRef(false)
  /** When slot PDA or position owner changes, replace scene rows instead of merging. */
  const sceneRowsChainKeyRef = useRef<string>('')

  const [instantSessionMeta, setInstantSessionMeta] =
    useState<InstantSessionMeta | null>(null)
  const [instantSessionBalanceLamports, setInstantSessionBalanceLamports] =
    useState<bigint | null>(null)
  const [, setSessionUiTick] = useState(0)

  const append = useCallback((m: string) => {
    setLog((prev) => [
      ...prev.slice(-40),
      `${new Date().toISOString().slice(11, 19)} ${m}`,
    ])
  }, [])

  const slotAuthorityPk = useMemo(
    () => resolveStakeSlotAuthority(publicKey),
    [publicKey],
  )
  const slotPk = useMemo(
    () =>
      slotAuthorityPk ? slotPda(slotAuthorityPk, DEMO_SLOT_ID) : null,
    [slotAuthorityPk, DEMO_SLOT_ID],
  )

  useEffect(() => {
    instantSessionMetaRef.current = instantSessionMeta
  }, [instantSessionMeta])

  const refreshOnChain = useCallback(
    async (movie?: Movie | null, opts?: { log?: boolean }) => {
      const verbose = opts?.log === true
      if (!slotAuthorityPk || !slotPk || !publicKey) {
        if (verbose) {
          append('Refresh skipped — connect your wallet first.')
          setToast('Connect your wallet to refresh.')
        }
        setChainSynced(true)
        return
      }
      if (verbose) {
        setChainRefreshBusy(true)
        append(
          movie
            ? 'Refreshing on-chain (including current movie scenes)…'
            : 'Refreshing on-chain…',
        )
      }
      const meta = instantSessionMetaRef.current
      const positionOwner =
        meta?.ephemeralPk != null
          ? new PublicKey(meta.ephemeralPk)
          : publicKey
      try {
        const slotAi = await connection.getAccountInfo(slotPk)
        setSlotInitialized(Boolean(slotAi?.data))

        const rows = await loadSceneRows(
          connection,
          slotPk,
          positionOwner,
          movie ?? undefined,
        )
        const chainKey = `${slotPk.toBase58()}|${positionOwner.toBase58()}`
        const identityChanged = chainKey !== sceneRowsChainKeyRef.current
        if (identityChanged) {
          sceneRowsChainKeyRef.current = chainKey
        }
        setSceneRows((prev) => {
          if (identityChanged) return rows
          return { ...prev, ...rows }
        })

        if (meta?.ephemeralPk != null) {
          const b = await connection.getBalance(new PublicKey(meta.ephemeralPk))
          setInstantSessionBalanceLamports(BigInt(b))
        } else {
          setInstantSessionBalanceLamports(null)
        }
        if (verbose) {
          append(
            slotAi?.data?.length
              ? 'OK: refreshed — slot account found'
              : 'OK: refreshed — slot account missing (run Setup once)',
          )
          setToast('On-chain state updated')
        }
      } catch (e) {
        console.error(e)
        if (verbose) {
          append(
            `ERR: refresh — ${e instanceof Error ? e.message : String(e)}`,
          )
          setToast('Refresh failed — see log')
        }
      } finally {
        if (verbose) setChainRefreshBusy(false)
        setChainSynced(true)
      }
    },
    [append, connection, publicKey, slotAuthorityPk, slotPk],
  )

  const rankBySceneKeyHex = useMemo(() => {
    const m: Record<string, bigint> = {}
    for (const [hex, row] of Object.entries(sceneRows)) {
      if (row.scene) m[hex] = row.scene.rank
    }
    return m
  }, [sceneRows])

  const getSceneRow = useCallback(
    (sceneKeyHex: string) => sceneRows[sceneKeyHex],
    [sceneRows],
  )

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!publicKey) {
      instantKeypairRef.current = null
      setInstantSessionMeta(null)
      setInstantSessionBalanceLamports(null)
      return
    }
    const restored = tryRestoreInstantSession(publicKey)
    if (restored) {
      instantKeypairRef.current = restored.keypair
      setInstantSessionMeta({
        expiresAtMs: restored.expiresAtMs,
        ephemeralPk: restored.keypair.publicKey.toBase58(),
      })
    } else {
      instantKeypairRef.current = null
      setInstantSessionMeta(null)
      setInstantSessionBalanceLamports(null)
    }
  }, [publicKey])

  /** Wallet / cluster: full chain read. Do not depend on `instantSessionMeta` here — that
   *  caused `chainSynced` to flip false whenever the instant session was created/restored,
   *  which disabled Watch thumbs until refresh finished (felt like “need a page reload”). */
  useEffect(() => {
    if (!connected || !publicKey) {
      setChainSynced(false)
      return
    }
    setChainSynced(false)
    void refreshOnChain(null)
  }, [connected, publicKey, refreshOnChain])

  /** Session wallet appeared or changed: refresh balances / scene merge without clearing `chainSynced`. */
  useEffect(() => {
    if (!connected || !publicKey || !instantSessionMeta) return
    void refreshOnChain(null)
  }, [connected, publicKey, instantSessionMeta?.ephemeralPk, refreshOnChain])

  const instantStakingSessionActive = Boolean(
    instantSessionMeta &&
      Date.now() < instantSessionMeta.expiresAtMs &&
      instantKeypairRef.current &&
      instantSessionMeta.ephemeralPk ===
        instantKeypairRef.current.publicKey.toBase58(),
  )

  const isInstantSessionUsable = useCallback((): boolean => {
    const m = instantSessionMetaRef.current
    const kp = instantKeypairRef.current
    return Boolean(
      m &&
        kp &&
        m.ephemeralPk === kp.publicKey.toBase58() &&
        Date.now() < m.expiresAtMs,
    )
  }, [])

  const finalizeInstantSessionCore = useCallback(
    async (reason: string) => {
      if (finalizeInFlightRef.current) return
      finalizeInFlightRef.current = true
      const kp = instantKeypairRef.current
      const custodian = publicKey
      try {
        if (!kp || !custodian || !slotAuthorityPk || !slotPk) {
          clearInstantSessionStorage()
          instantKeypairRef.current = null
          instantSessionMetaRef.current = null
          setInstantSessionMeta(null)
          setInstantSessionBalanceLamports(null)
          return
        }
        append(`Closing instant session (${reason})…`)
        const owned = await fetchScenePositionsForOwner(connection, kp.publicKey)
        for (const { data } of owned) {
          const pos = tryDecodeScenePosition(Buffer.from(data))
          if (!pos || pos.amount <= 0n) continue
          const sAi = await connection.getAccountInfo(pos.scene)
          const scene = sAi?.data ? tryDecodeScene(Buffer.from(sAi.data)) : null
          const sk = scene?.sceneKey
          if (!sk || sk.length !== 32) continue
          await sendAndConfirmWithKeypair(connection, kp, [
            ixUnstakeScene(kp.publicKey, slotAuthorityPk, DEMO_SLOT_ID, sk),
          ])
        }
        const bal = await connection.getBalance(kp.publicKey)
        const feeBuf = 10_000
        const sweep = bal > feeBuf ? bal - feeBuf : 0
        if (sweep > 0) {
          await sendAndConfirmWithKeypair(connection, kp, [
            ixSweepSessionWalletToCustodian(
              kp.publicKey,
              custodian,
              BigInt(sweep),
            ),
          ])
        }
        append(`Instant session closed (${reason}).`)
      } catch (e) {
        console.error(e)
        append(
          `ERR: close instant session — ${e instanceof Error ? e.message : String(e)}`,
        )
      } finally {
        clearInstantSessionStorage()
        instantKeypairRef.current = null
        instantSessionMetaRef.current = null
        setInstantSessionMeta(null)
        setInstantSessionBalanceLamports(null)
        finalizeInFlightRef.current = false
        await refreshOnChain(null)
      }
    },
    [append, connection, publicKey, refreshOnChain, slotAuthorityPk, slotPk],
  )

  useEffect(() => {
    if (!instantSessionMeta) return
    const tick = window.setInterval(() => setSessionUiTick((n) => n + 1), 1000)
    return () => window.clearInterval(tick)
  }, [instantSessionMeta])

  useEffect(() => {
    if (!instantSessionMeta || !publicKey) return
    const tick = window.setInterval(() => {
      if (Date.now() >= instantSessionMeta.expiresAtMs)
        void finalizeInstantSessionCore('session_expired')
    }, 15_000)
    return () => window.clearInterval(tick)
  }, [instantSessionMeta, publicKey, finalizeInstantSessionCore])

  const run = async (label: string, fn: () => Promise<void>) => {
    if (runInFlightRef.current) return
    runInFlightRef.current = true
    setBusy(true)
    try {
      await fn()
      append(`OK: ${label}`)
      await refreshOnChain(null)
    } catch (e) {
      console.error(e)
      append(`ERR: ${label} — ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      runInFlightRef.current = false
      setBusy(false)
    }
  }

  const ensureScenesRegisteredForMovie = useCallback(
    async (movie: Movie) => {
      if (!publicKey || !signTransaction || !slotAuthorityPk || !slotPk) return
      if (!publicKey.equals(slotAuthorityPk)) return
      const ixs: TransactionInstruction[] = []
      let registerCount = 0
      let rankBumpCount = 0
      for (const col of movie.columns) {
        for (const cell of col.cells) {
          if (!extractYoutubeVideoId(cell.youtubeUrl ?? '')) continue
          const sk = sceneKeyHex(movie.id, col.id, cell.id)
          const bytes = hexToSceneKeyBytes(sk)
          const pk = scenePda(slotPk, bytes)
          const ai = await connection.getAccountInfo(pk)
          if (!ai) {
            ixs.push(
              ixRegisterScene(
                publicKey,
                slotAuthorityPk,
                DEMO_SLOT_ID,
                bytes,
                REGISTER_SCENE_INITIAL_RANK_LAMPORTS,
              ),
            )
            registerCount += 1
            continue
          }
          const decoded = tryDecodeScene(Buffer.from(ai.data))
          if (
            decoded &&
            decoded.rank < REGISTER_SCENE_INITIAL_RANK_LAMPORTS
          ) {
            ixs.push(
              ixResetSceneRank(
                publicKey,
                DEMO_SLOT_ID,
                bytes,
                REGISTER_SCENE_INITIAL_RANK_LAMPORTS,
              ),
            )
            rankBumpCount += 1
          }
        }
      }
      if (ixs.length === 0) return
      const CHUNK = 6
      for (let i = 0; i < ixs.length; i += CHUNK) {
        const slice = ixs.slice(i, i + CHUNK)
        await sendAndConfirm(connection, { publicKey, signTransaction }, slice)
      }
      const parts: string[] = []
      if (registerCount > 0)
        parts.push(`registered ${registerCount} new scene(s)`)
      if (rankBumpCount > 0)
        parts.push(
          `raised rank on ${rankBumpCount} scene(s) so downstake (thumbs) clears the on-chain floor`,
        )
      append(parts.length > 0 ? `OK: ${parts.join(' · ')}` : `OK: chain update (${ixs.length} ix)`)
      await refreshOnChain(movie)
    },
    [
      append,
      connection,
      publicKey,
      refreshOnChain,
      signTransaction,
      slotAuthorityPk,
      slotPk,
    ],
  )

  const registerSceneForCell = useCallback(
    async (movie: Movie, columnId: string, cellId: string) => {
      if (!publicKey || !signTransaction || !slotAuthorityPk || !slotPk) {
        throw new Error('Connect wallet and wait for slot to load')
      }
      const slotAi = await connection.getAccountInfo(slotPk)
      if (!slotAi?.data) {
        throw new Error(
          'The shared StakeToCurate slot is not initialized on this cluster yet. The slot authority wallet must open Dashboard and run Initialize once (see VITE_STAKE_SLOT_AUTHORITY in .env.example).',
        )
      }
      const sk = sceneKeyHex(movie.id, columnId, cellId)
      const bytes = hexToSceneKeyBytes(sk)
      const pk = scenePda(slotPk, bytes)
      const ai = await connection.getAccountInfo(pk)
      if (ai) {
        const decoded = tryDecodeScene(Buffer.from(ai.data))
        if (
          decoded?.reservedBy &&
          !decoded.reservedBy.equals(PublicKey.default) &&
          !decoded.reservedBy.equals(publicKey)
        ) {
          throw new Error(
            'This scene slot is already registered by another wallet.',
          )
        }
        append('Scene already registered for this cell.')
        await refreshOnChain(movie)
        return
      }
      const ix = ixRegisterScene(
        publicKey,
        slotAuthorityPk,
        DEMO_SLOT_ID,
        bytes,
        REGISTER_SCENE_INITIAL_RANK_LAMPORTS,
      )
      await sendAndConfirm(connection, { publicKey, signTransaction }, [ix])
      append('OK: scene slot registered on-chain')
      await refreshOnChain(movie)
    },
    [
      append,
      connection,
      publicKey,
      refreshOnChain,
      signTransaction,
      slotAuthorityPk,
      slotPk,
    ],
  )

  const onSetup = () =>
    run('setup slot', async () => {
      if (!publicKey || !signTransaction)
        throw new Error('Connect wallet first')
      const slotAuth = resolveStakeSlotAuthority(publicKey)
      if (!slotAuth) throw new Error('Connect wallet first')
      if (!publicKey.equals(slotAuth)) {
        throw new Error(
          'Connect the slot authority wallet to initialize (must match VITE_STAKE_SLOT_AUTHORITY when set), or clear that env to use your wallet as authority.',
        )
      }
      const slotAccountPk = slotPda(slotAuth, DEMO_SLOT_ID)
      const existing = await connection.getAccountInfo(slotAccountPk)
      if (existing?.data?.length) {
        if (!existing.owner.equals(PROGRAM_ID)) {
          throw new Error(
            `Slot address ${slotAccountPk.toBase58()} is already in use by another program (${existing.owner.toBase58()}). Check VITE_STAKE_TO_CURATE_PROGRAM_ID matches your on-chain deployment.`,
          )
        }
        throw new Error(
          'Demo slot is already initialized on this cluster. Use “Refresh on-chain state” above; Setup should only run once per slot authority wallet.',
        )
      }
      await sendAndConfirm(
        connection,
        { publicKey, signTransaction },
        [
          ixInitializeSlot(slotAuth, slotAuth, slotAuth, DEMO_SLOT_ID),
        ],
      )
    })

  const stakeScene = (
    label: string,
    discIx: (
      o: PublicKey,
      auth: PublicKey,
      sid: number,
      sk: Uint8Array,
      lam: bigint,
    ) => TransactionInstruction,
    sceneKeyHexArg: string,
    lamports: bigint,
  ) =>
    run(label, async () => {
      if (!slotAuthorityPk) throw new Error('Missing slot authority')
      const sk = hexToSceneKeyBytes(sceneKeyHexArg)
      const meta = instantSessionMetaRef.current
      if (meta && Date.now() >= meta.expiresAtMs && instantKeypairRef.current) {
        await finalizeInstantSessionCore('stake_after_expired_session')
      }
      const kp = instantKeypairRef.current
      if (isInstantSessionUsable() && kp) {
        const owner = kp.publicKey
        const bal = BigInt(await connection.getBalance(owner))
        const needed = lamports + STAKE_RESERVE_LAMPORTS
        if (bal < needed) {
          setToast(
            'Not enough SOL left in this session. Use Top Up Session (up to 1 SOL per top-up).',
          )
          throw new Error('Insufficient session balance')
        }
        try {
          await sendAndConfirmWithKeypair(connection, kp, [
            discIx(owner, slotAuthorityPk, DEMO_SLOT_ID, sk, lamports),
          ])
        } catch (e) {
          const t = e instanceof Error ? e.message : String(e)
          if (
            t.includes('SideMismatch') ||
            t.includes('side mismatch') ||
            t.includes('0x177d')
          ) {
            setToast(
              'This session already staked the opposite direction on this scene.',
            )
          }
          throw e
        }
        return
      }
      if (!publicKey || !signTransaction)
        throw new Error('Connect wallet first')
      await sendAndConfirm(
        connection,
        { publicKey, signTransaction },
        [
          discIx(publicKey, slotAuthorityPk, DEMO_SLOT_ID, sk, lamports),
        ],
      )
    })

  const onStakeUp = (sceneKeyHexArg: string, lamports: bigint) =>
    stakeScene(
      `stake_scene_up ${sceneKeyHexArg.slice(0, 10)}…`,
      ixStakeSceneUp,
      sceneKeyHexArg,
      lamports,
    )

  const onStakeDown = (sceneKeyHexArg: string, lamports: bigint) =>
    stakeScene(
      `stake_scene_down ${sceneKeyHexArg.slice(0, 10)}…`,
      ixStakeSceneDown,
      sceneKeyHexArg,
      lamports,
    )

  const onWithdrawYieldBoost = () =>
    void run('withdraw_yield_boost', async () => {
      if (!(await isMainnetYieldBoostAvailable(connection))) {
        throw new Error('Yield withdraw only on mainnet with VITE_ENABLE_YIELD_BOOST=true')
      }
      if (!publicKey || !signTransaction)
        throw new Error('Connect wallet first')
      await runYieldBoostWithdrawAll({
        connection,
        wallet: { publicKey, signTransaction },
      })
    })

  const onConfigureYieldTreasury = () =>
    void run('configure_yield_treasury', async () => {
      if (!slotAuthorityPk) throw new Error('Missing slot authority')
      if (!publicKey || !signTransaction)
        throw new Error('Connect wallet first')
      if (!publicKey.equals(slotAuthorityPk)) {
        throw new Error(
          'Only the slot authority wallet can set the yield treasury (match VITE_STAKE_SLOT_AUTHORITY or use solo dev wallet).',
        )
      }
      await sendAndConfirm(connection, { publicKey, signTransaction }, [
        ixConfigureYieldTreasury(publicKey, DEMO_SLOT_ID, publicKey),
      ])
      append('OK: yield treasury set to this wallet (use same keypair for the immediate-yield worker).')
    })

  const onUnstake = (sceneKeyHexArg: string) =>
    run(`unstake_scene ${sceneKeyHexArg.slice(0, 10)}…`, async () => {
      if (!slotAuthorityPk) throw new Error('Missing slot authority')
      const sk = hexToSceneKeyBytes(sceneKeyHexArg)
      const slot = slotPda(slotAuthorityPk, DEMO_SLOT_ID)
      const sceneAddr = scenePda(slot, sk)

      /** Prefer custodian, then instant session — matches where the user actually staked. */
      type StakeOwner = { owner: PublicKey; sessionKp: Keypair | null }
      const candidates: StakeOwner[] = []
      if (publicKey) candidates.push({ owner: publicKey, sessionKp: null })
      const sessionKp = instantKeypairRef.current
      if (isInstantSessionUsable() && sessionKp) {
        if (!publicKey || !sessionKp.publicKey.equals(publicKey)) {
          candidates.push({ owner: sessionKp.publicKey, sessionKp })
        }
      }
      if (candidates.length === 0)
        throw new Error('Connect wallet first (or enable instant staking).')

      let chosen: StakeOwner | null = null
      for (const c of candidates) {
        const posPk = scenePositionPda(sceneAddr, c.owner)
        const ai = await connection.getAccountInfo(posPk)
        if (!ai?.data) continue
        const pos = tryDecodeScenePosition(Buffer.from(ai.data))
        if (pos && pos.amount > 0n) {
          chosen = c
          break
        }
      }

      if (!chosen) {
        throw new Error(
          'No active stake for this scene on your wallet (or instant session). Stake and unstake must use the same signer.',
        )
      }

      if (chosen.sessionKp) {
        await sendAndConfirmWithKeypair(connection, chosen.sessionKp, [
          ixUnstakeScene(
            chosen.owner,
            slotAuthorityPk,
            DEMO_SLOT_ID,
            sk,
          ),
        ])
        return
      }
      if (!publicKey || !signTransaction)
        throw new Error('Connect wallet first')
      await sendAndConfirm(
        connection,
        { publicKey, signTransaction },
        [
          ixUnstakeScene(
            chosen.owner,
            slotAuthorityPk,
            DEMO_SLOT_ID,
            sk,
          ),
        ],
      )
    })

  const onDeposit = (sceneKeyHex: string, lamports: bigint) => {
    void sceneKeyHex
    void lamports
    append(
      'Note: deposit_revenue is deferred for per-scene StakeToCurate (MVP — no curator pool yet).',
    )
  }

  const onClaim = (sceneKeyHex: string) => {
    void sceneKeyHex
    append(
      'Note: claim_curator is deferred for per-scene StakeToCurate (MVP — no curator pool yet).',
    )
  }

  const onClaimAll = () => {
    append(
      'Note: claim_curator is deferred for per-scene StakeToCurate (MVP — no curator pool yet).',
    )
  }

  const enableInstantStaking = () => {
    void run('enable instant staking', async () => {
      if (!publicKey || !signTransaction || !slotAuthorityPk)
        throw new Error('Connect wallet first')
      if (isInstantSessionUsable()) return
      if (
        instantSessionMetaRef.current &&
        Date.now() >= instantSessionMetaRef.current.expiresAtMs &&
        instantKeypairRef.current
      ) {
        await finalizeInstantSessionCore('replaced_expired_session')
      }
      const kp = createEphemeralKeypair()
      const expiresAtMs = Date.now() + INSTANT_SESSION_DURATION_MS
      persistInstantSession(publicKey, kp, expiresAtMs)
      instantKeypairRef.current = kp
      const met: InstantSessionMeta = {
        expiresAtMs,
        ephemeralPk: kp.publicKey.toBase58(),
      }
      instantSessionMetaRef.current = met
      setInstantSessionMeta(met)
      try {
        await sendAndConfirm(
          connection,
          { publicKey, signTransaction },
          [
            ixFundSessionWallet(
              publicKey,
              kp.publicKey,
              MAX_SESSION_TOPUP_LAMPORTS,
            ),
          ],
        )
      } catch (e) {
        clearInstantSessionStorage()
        instantKeypairRef.current = null
        instantSessionMetaRef.current = null
        setInstantSessionMeta(null)
        setInstantSessionBalanceLamports(null)
        throw e
      }
    })
  }

  const topUpInstantSession = () => {
    void run('top up instant session', async () => {
      if (!publicKey || !signTransaction)
        throw new Error('Connect wallet first')
      if (!isInstantSessionUsable() || !instantKeypairRef.current)
        throw new Error('No active instant session')
      const to = instantKeypairRef.current.publicKey
      await sendAndConfirm(
        connection,
        { publicKey, signTransaction },
        [
          ixFundSessionWallet(publicKey, to, MAX_SESSION_TOPUP_LAMPORTS),
        ],
      )
    })
  }

  const endInstantSession = () => {
    void run('end instant session', async () => {
      await finalizeInstantSessionCore('user_ended')
    })
  }

  const ensureInstantSessionForWatch = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !signTransaction || !slotAuthorityPk) return false
    if (isInstantSessionUsable()) return true
    if (runInFlightRef.current) return false
    runInFlightRef.current = true
    setBusy(true)
    try {
      if (
        instantSessionMetaRef.current &&
        Date.now() >= instantSessionMetaRef.current.expiresAtMs &&
        instantKeypairRef.current
      ) {
        await finalizeInstantSessionCore('watch_new_session_after_expiry')
      }
      const kp = createEphemeralKeypair()
      const expiresAtMs = Date.now() + INSTANT_SESSION_DURATION_MS
      persistInstantSession(publicKey, kp, expiresAtMs)
      instantKeypairRef.current = kp
      const met: InstantSessionMeta = {
        expiresAtMs,
        ephemeralPk: kp.publicKey.toBase58(),
      }
      instantSessionMetaRef.current = met
      setInstantSessionMeta(met)
      await sendAndConfirm(
        connection,
        { publicKey, signTransaction },
        [
          ixFundSessionWallet(
            publicKey,
            kp.publicKey,
            MAX_SESSION_TOPUP_LAMPORTS,
          ),
        ],
      )
      await refreshOnChain(null)
      append('OK: instant staking session ready (watch)')
      return true
    } catch (e) {
      console.error(e)
      clearInstantSessionStorage()
      instantKeypairRef.current = null
      instantSessionMetaRef.current = null
      setInstantSessionMeta(null)
      setToast(
        'Could not start instant staking (Phantom cancelled or network error).',
      )
      return false
    } finally {
      runInFlightRef.current = false
      setBusy(false)
    }
  }, [
    append,
    connection,
    finalizeInstantSessionCore,
    isInstantSessionUsable,
    publicKey,
    refreshOnChain,
    setToast,
    signTransaction,
    slotAuthorityPk,
  ])

  const value: DemoSlotValue = {
    chainSynced,
    slotAuthority: slotAuthorityPk,
    authority: publicKey,
    publicKey,
    connected,
    signTransaction,
    slotPk,
    slotInitialized,
    sceneRows,
    getSceneRow,
    rankBySceneKeyHex,
    log,
    busy,
    chainRefreshBusy,
    toast,
    setToast,
    append,
    refreshOnChain,
    ensureScenesRegisteredForMovie,
    registerSceneForCell,
    run,
    onSetup,
    onStakeUp,
    onStakeDown,
    onUnstake,
    onDeposit,
    onClaim,
    onClaimAll,
    instantSessionMeta,
    instantSessionBalanceLamports,
    instantStakingSessionActive,
    enableInstantStaking,
    topUpInstantSession,
    endInstantSession,
    ensureInstantSessionForWatch,
    onWithdrawYieldBoost,
    onConfigureYieldTreasury,
  }

  return (
    <DemoSlotContext.Provider value={value}>{children}</DemoSlotContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useDemoSlot() {
  const ctx = useContext(DemoSlotContext)
  if (!ctx)
    throw new Error('useDemoSlot must be used within DemoSlotProvider')
  return ctx
}
