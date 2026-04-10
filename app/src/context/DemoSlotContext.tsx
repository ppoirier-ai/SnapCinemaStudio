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
} from '../stakeToCurate/client'

type V = ReturnType<typeof decodeVersion>
type P = ReturnType<typeof decodePosition>

type DemoSlotValue = {
  /** True after the latest `refreshOnChain` finished (success or failure). */
  chainSynced: boolean
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

  const append = useCallback((m: string) => {
    setLog((prev) => [
      ...prev.slice(-40),
      `${new Date().toISOString().slice(11, 19)} ${m}`,
    ])
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
    if (!authority || !v0Pk || !v1Pk) {
      setChainSynced(true)
      return
    }
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
        connection.getAccountInfo(positionPda(v0Pk, authority)),
        connection.getAccountInfo(positionPda(v1Pk, authority)),
      ])
      if (p0?.data) setPos0(decodePosition(Buffer.from(p0.data)))
      else setPos0(null)
      if (p1?.data) setPos1(decodePosition(Buffer.from(p1.data)))
      else setPos1(null)
    } catch (e) {
      console.error(e)
    } finally {
      setChainSynced(true)
    }
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
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!connected || !authority) {
      setChainSynced(false)
      return
    }
    setChainSynced(false)
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

  const value: DemoSlotValue = {
    chainSynced,
    authority,
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
  }

  return (
    <DemoSlotContext.Provider value={value}>{children}</DemoSlotContext.Provider>
  )
}

export function useDemoSlot() {
  const ctx = useContext(DemoSlotContext)
  if (!ctx)
    throw new Error('useDemoSlot must be used within DemoSlotProvider')
  return ctx
}
