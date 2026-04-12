import { useMemo } from 'react'
import { useDemoSlot } from '../context/DemoSlotContext'
import { AccountPanelContent } from '../demo/AccountPanelContent'

export function AccountPage() {
  const {
    publicKey,
    connected,
    busy,
    chainRefreshBusy,
    sceneRows,
    refreshOnChain,
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
          publicKey={publicKey}
          connected={connected}
          busy={busy}
          chainRefreshBusy={chainRefreshBusy}
          positions={positions}
          onRefresh={() => void refreshOnChain(null, { log: true })}
        />
      </section>
    </main>
  )
}
