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
import { Keypair, PublicKey } from '@solana/web3.js'
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
  resolveStakeSlotAuthority,
  sampleVersionIndex,
  sendAndConfirm,
  sendAndConfirmWithKeypair,
  slotPda,
  versionPda,
} from '../stakeToCurate/client'
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

type V = ReturnType<typeof decodeVersion>
type P = ReturnType<typeof decodePosition>

type DemoSlotValue = {
  /** True after the latest `refreshOnChain` finished (success or failure). */
  chainSynced: boolean
  /** On-chain slot authority PDA seed (env or connected wallet). */
  slotAuthority: PublicKey | null
  authority: ReturnType<typeof useWallet>['publicKey']
  publicKey: ReturnType<typeof useWallet>['publicKey']
  connected: boolean
  signTransaction: ReturnType<typeof useWallet>['signTransaction']
  slotPk: ReturnType<typeof slotPda> | null
  v0Pk: ReturnType<typeof versionPda> | null
  v1Pk: ReturnType<typeof versionPda> | null
  v0: V | null
  v1: V | null
  pos0: P | null
  pos1: P | null
  playback: 0 | 1 | null
  log: string[]
  busy: boolean
  toast: string | null
  setToast: (t: string | null) => void
  append: (m: string) => void
  refreshOnChain: () => Promise<void>
  run: (label: string, fn: () => Promise<void>) => Promise<void>
  onSetup: () => void
  onStakeUp: (versionIndex: 0 | 1, lamports: bigint) => void
  onStakeDown: (versionIndex: 0 | 1, lamports: bigint) => void
  onUnstake: (versionIndex: 0 | 1) => void
  onDeposit: (versionIndex: 0 | 1, lamports: bigint) => void
  onClaim: (versionIndex: 0 | 1) => void
  onClaimAll: () => void
  onRollPlayback: () => void
  /** Ephemeral session: funded session wallet + expiry; null if none. */
  instantSessionMeta: InstantSessionMeta | null
  /** Live SOL balance on the session wallet (lamports), when a session exists. */
  instantSessionBalanceLamports: bigint | null
  /** Session wallet exists and wall-clock is before `expiresAtMs`. */
  instantStakingSessionActive: boolean
  enableInstantStaking: () => void
  topUpInstantSession: () => void
  endInstantSession: () => void
  /**
   * Creates/restores session + one Phantom transfer (up to 1 SOL) for Watch auto-flow.
   * Returns false if the user cancels or an error occurs (no `run()` wrapper).
   */
  ensureInstantSessionForWatch: () => Promise<boolean>
}

const DemoSlotContext = createContext<DemoSlotValue | null>(null)

export function DemoSlotProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { publicKey, signTransaction, connected } = wallet

  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [v0, setV0] = useState<V | null>(null)
  const [v1, setV1] = useState<V | null>(null)
  const [pos0, setPos0] = useState<P | null>(null)
  const [pos1, setPos1] = useState<P | null>(null)
  const [playback, setPlayback] = useState<0 | 1 | null>(null)
  const [chainSynced, setChainSynced] = useState(false)
  const sampledBothRef = useRef(false)
  const runInFlightRef = useRef(false)
  const instantKeypairRef = useRef<Keypair | null>(null)
  const instantSessionMetaRef = useRef<InstantSessionMeta | null>(null)
  const finalizeInFlightRef = useRef(false)

  const [instantSessionMeta, setInstantSessionMeta] =
    useState<InstantSessionMeta | null>(null)
  const [instantSessionBalanceLamports, setInstantSessionBalanceLamports] =
    useState<bigint | null>(null)
  /** Bumps once per second while a session exists so countdown / active flag stay fresh. */
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
    [slotAuthorityPk],
  )
  const v0Pk = useMemo(
    () => (slotPk ? versionPda(slotPk, 0) : null),
    [slotPk],
  )
  const v1Pk = useMemo(
    () => (slotPk ? versionPda(slotPk, 1) : null),
    [slotPk],
  )

  useEffect(() => {
    instantSessionMetaRef.current = instantSessionMeta
  }, [instantSessionMeta])

  const refreshOnChain = useCallback(async () => {
    if (!slotAuthorityPk || !v0Pk || !v1Pk || !publicKey) {
      setChainSynced(true)
      return
    }
    const meta = instantSessionMetaRef.current
    const positionOwner =
      meta?.ephemeralPk != null
        ? new PublicKey(meta.ephemeralPk)
        : publicKey
    try {
      const [a0, a1] = await Promise.all([
        connection.getAccountInfo(v0Pk),
        connection.getAccountInfo(v1Pk),
      ])
      if (a0?.data) setV0(decodeVersion(Buffer.from(a0.data)))
      else setV0(null)
      if (a1?.data) setV1(decodeVersion(Buffer.from(a1.data)))
      else setV1(null)
      const [p0, p1] = await Promise.all([
        connection.getAccountInfo(positionPda(v0Pk, positionOwner)),
        connection.getAccountInfo(positionPda(v1Pk, positionOwner)),
      ])
      if (p0?.data) setPos0(decodePosition(Buffer.from(p0.data)))
      else setPos0(null)
      if (p1?.data) setPos1(decodePosition(Buffer.from(p1.data)))
      else setPos1(null)
      if (meta?.ephemeralPk != null) {
        const b = await connection.getBalance(new PublicKey(meta.ephemeralPk))
        setInstantSessionBalanceLamports(BigInt(b))
      } else {
        setInstantSessionBalanceLamports(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setChainSynced(true)
    }
  }, [connection, publicKey, slotAuthorityPk, v0Pk, v1Pk])

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

  useEffect(() => {
    if (!connected || !publicKey) {
      setChainSynced(false)
      return
    }
    setChainSynced(false)
    void refreshOnChain()
  }, [connected, publicKey, instantSessionMeta, refreshOnChain])

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
        if (!kp || !custodian || !slotAuthorityPk || !v0Pk || !v1Pk) {
          clearInstantSessionStorage()
          instantKeypairRef.current = null
          instantSessionMetaRef.current = null
          setInstantSessionMeta(null)
          setInstantSessionBalanceLamports(null)
          return
        }
        append(`Closing instant session (${reason})…`)
        for (const vi of [0, 1] as const) {
          const ver = vi === 0 ? v0Pk : v1Pk
          const acc = await connection.getAccountInfo(
            positionPda(ver, kp.publicKey),
          )
          if (!acc?.data) continue
          const pos = decodePosition(Buffer.from(acc.data))
          if (pos.amount > 0n) {
            await sendAndConfirmWithKeypair(connection, kp, [
              ixUnstake(kp.publicKey, slotAuthorityPk, DEMO_SLOT_ID, vi),
            ])
          }
        }
        for (const vi of [0, 1] as const) {
          const ver = vi === 0 ? v0Pk : v1Pk
          const acc = await connection.getAccountInfo(
            positionPda(ver, kp.publicKey),
          )
          if (!acc?.data) continue
          const pos = decodePosition(Buffer.from(acc.data))
          if (pos.accruedRewards > 0n) {
            await sendAndConfirmWithKeypair(connection, kp, [
              ixClaimCurator(kp.publicKey, slotAuthorityPk, DEMO_SLOT_ID, vi),
            ])
          }
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
        await refreshOnChain()
      }
    },
    [
      append,
      connection,
      publicKey,
      refreshOnChain,
      slotAuthorityPk,
      v0Pk,
      v1Pk,
    ],
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
      await refreshOnChain()
    } catch (e) {
      console.error(e)
      append(`ERR: ${label} — ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      runInFlightRef.current = false
      setBusy(false)
    }
  }

  const onSetup = () =>
    run('setup slot + versions', async () => {
      if (!publicKey || !signTransaction)
        throw new Error('Connect wallet first')
      const slotAuth = resolveStakeSlotAuthority(publicKey)
      if (!slotAuth) throw new Error('Connect wallet first')
      if (!publicKey.equals(slotAuth)) {
        throw new Error(
          'Connect the slot authority wallet to initialize (must match VITE_STAKE_SLOT_AUTHORITY when set), or clear that env to use your wallet as authority.',
        )
      }
      await sendAndConfirm(
        connection,
        { publicKey, signTransaction },
        [
          ixInitializeSlot(slotAuth, slotAuth, slotAuth, DEMO_SLOT_ID),
          ixRegisterVersion(slotAuth, DEMO_SLOT_ID, 0, 1_000_000n),
          ixRegisterVersion(slotAuth, DEMO_SLOT_ID, 1, 200_000n),
        ],
      )
    })

  const onStakeUp = (versionIndex: 0 | 1, lamports: bigint) =>
    run(`stake_up v${versionIndex}`, async () => {
      if (!slotAuthorityPk) throw new Error('Missing slot authority')
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
            ixStakeUp(
              owner,
              slotAuthorityPk,
              DEMO_SLOT_ID,
              versionIndex,
              lamports,
            ),
          ])
        } catch (e) {
          const t = e instanceof Error ? e.message : String(e)
          if (
            t.includes('SideMismatch') ||
            t.includes('side mismatch') ||
            t.includes('0x177d')
          ) {
            setToast(
              'This session already staked the opposite direction on this version.',
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
          ixStakeUp(
            publicKey,
            slotAuthorityPk,
            DEMO_SLOT_ID,
            versionIndex,
            lamports,
          ),
        ],
      )
    })

  const onStakeDown = (versionIndex: 0 | 1, lamports: bigint) =>
    run(`stake_down v${versionIndex}`, async () => {
      if (!slotAuthorityPk) throw new Error('Missing slot authority')
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
            ixStakeDown(
              owner,
              slotAuthorityPk,
              DEMO_SLOT_ID,
              versionIndex,
              lamports,
            ),
          ])
        } catch (e) {
          const t = e instanceof Error ? e.message : String(e)
          if (
            t.includes('SideMismatch') ||
            t.includes('side mismatch') ||
            t.includes('0x177d')
          ) {
            setToast(
              'This session already staked the opposite direction on this version.',
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
          ixStakeDown(
            publicKey,
            slotAuthorityPk,
            DEMO_SLOT_ID,
            versionIndex,
            lamports,
          ),
        ],
      )
    })

  const onUnstake = (versionIndex: 0 | 1) =>
    run(`unstake v${versionIndex}`, async () => {
      if (!slotAuthorityPk) throw new Error('Missing slot authority')
      const kp = instantKeypairRef.current
      if (isInstantSessionUsable() && kp) {
        await sendAndConfirmWithKeypair(connection, kp, [
          ixUnstake(kp.publicKey, slotAuthorityPk, DEMO_SLOT_ID, versionIndex),
        ])
        return
      }
      if (!publicKey || !signTransaction)
        throw new Error('Connect wallet first')
      await sendAndConfirm(
        connection,
        { publicKey, signTransaction },
        [
          ixUnstake(
            publicKey,
            slotAuthorityPk,
            DEMO_SLOT_ID,
            versionIndex,
          ),
        ],
      )
    })

  const onDeposit = (versionIndex: 0 | 1, lamports: bigint) =>
    run(`deposit_revenue v${versionIndex}`, async () => {
      if (!publicKey || !signTransaction || !slotAuthorityPk)
        throw new Error('Connect wallet first')
      const slot = slotPda(slotAuthorityPk, DEMO_SLOT_ID)
      const ver = versionPda(slot, versionIndex)
      const positions = await fetchPositionsForVersion(connection, ver)
      if (positions.length === 0)
        throw new Error('No positions for this version — stake first')
      await sendAndConfirm(
        connection,
        { publicKey, signTransaction },
        [
          ixDepositRevenue(
            publicKey,
            slotAuthorityPk,
            DEMO_SLOT_ID,
            versionIndex,
            lamports,
            slotAuthorityPk,
            slotAuthorityPk,
            positions.map((p) => p.pubkey),
          ),
        ],
      )
    })

  const onClaim = (versionIndex: 0 | 1) =>
    run(`claim_curator v${versionIndex}`, async () => {
      if (!slotAuthorityPk) throw new Error('Missing slot authority')
      const kp = instantKeypairRef.current
      if (isInstantSessionUsable() && kp) {
        await sendAndConfirmWithKeypair(connection, kp, [
          ixClaimCurator(
            kp.publicKey,
            slotAuthorityPk,
            DEMO_SLOT_ID,
            versionIndex,
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
          ixClaimCurator(
            publicKey,
            slotAuthorityPk,
            DEMO_SLOT_ID,
            versionIndex,
          ),
        ],
      )
    })

  const onClaimAll = () =>
    run('claim all curator rewards', async () => {
      if (!slotAuthorityPk) throw new Error('Missing slot authority')
      const kp = instantKeypairRef.current
      if (isInstantSessionUsable() && kp) {
        const has0 = pos0 && pos0.accruedRewards > 0n
        const has1 = pos1 && pos1.accruedRewards > 0n
        if (!has0 && !has1)
          throw new Error('No accrued rewards to claim')
        if (has0) {
          await sendAndConfirmWithKeypair(connection, kp, [
            ixClaimCurator(
              kp.publicKey,
              slotAuthorityPk,
              DEMO_SLOT_ID,
              0,
            ),
          ])
        }
        if (has1) {
          await sendAndConfirmWithKeypair(connection, kp, [
            ixClaimCurator(
              kp.publicKey,
              slotAuthorityPk,
              DEMO_SLOT_ID,
              1,
            ),
          ])
        }
        return
      }
      if (!publicKey || !signTransaction)
        throw new Error('Connect wallet first')
      const has0 = pos0 && pos0.accruedRewards > 0n
      const has1 = pos1 && pos1.accruedRewards > 0n
      if (!has0 && !has1)
        throw new Error('No accrued rewards to claim')
      if (has0) {
        await sendAndConfirm(
          connection,
          { publicKey, signTransaction },
          [
            ixClaimCurator(
              publicKey,
              slotAuthorityPk,
              DEMO_SLOT_ID,
              0,
            ),
          ],
        )
      }
      if (has1) {
        await sendAndConfirm(
          connection,
          { publicKey, signTransaction },
          [
            ixClaimCurator(
              publicKey,
              slotAuthorityPk,
              DEMO_SLOT_ID,
              1,
            ),
          ],
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
      await refreshOnChain()
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
    v0Pk,
    v1Pk,
    v0,
    v1,
    pos0,
    pos1,
    playback,
    log,
    busy,
    toast,
    setToast,
    append,
    refreshOnChain,
    run,
    onSetup,
    onStakeUp,
    onStakeDown,
    onUnstake,
    onDeposit,
    onClaim,
    onClaimAll,
    onRollPlayback,
    instantSessionMeta,
    instantSessionBalanceLamports,
    instantStakingSessionActive,
    enableInstantStaking,
    topUpInstantSession,
    endInstantSession,
    ensureInstantSessionForWatch,
  }

  return (
    <DemoSlotContext.Provider value={value}>{children}</DemoSlotContext.Provider>
  )
}

/** Paired hook for {@link DemoSlotProvider}; must live in the same module as the provider. */
// eslint-disable-next-line react-refresh/only-export-components -- intentional context pattern
export function useDemoSlot() {
  const ctx = useContext(DemoSlotContext)
  if (!ctx)
    throw new Error('useDemoSlot must be used within DemoSlotProvider')
  return ctx
}
