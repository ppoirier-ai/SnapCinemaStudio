import { useMemo } from 'react'
import { useMovies } from '../context/SceneBoardContext'
import { useDemoSlot } from '../context/DemoSlotContext'
import { AccountPanelContent } from '../demo/AccountPanelContent'
import { RevenuePanel } from '../demo/RevenuePanel'

export function AccountPage() {
  const { movies } = useMovies()
  const {
    publicKey,
    connected,
    busy,
    chainRefreshBusy,
    sceneRows,
    refreshOnChain,
    onUnstake,
    onUnstakeLowestRoiScenes,
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
    <main className="studio account-route">
      <h1 className="account-route-title">Account</h1>
      <section className="panel account-route-panel">
        <AccountPanelContent
          movies={movies}
          publicKey={publicKey}
          connected={connected}
          busy={busy}
          chainRefreshBusy={chainRefreshBusy}
          positions={positions}
          onRefresh={() => void refreshOnChain(null, { log: true })}
          onUnstake={onUnstake}
          onUnstakeLowestRoiScenes={onUnstakeLowestRoiScenes}
        />
      </section>
      <RevenuePanel />
    </main>
  )
}
