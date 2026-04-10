import { useDemoSlot } from '../context/DemoSlotContext'
import { AccountPanelContent } from '../demo/AccountPanelContent'

export function AccountPage() {
  const {
    publicKey,
    connected,
    busy,
    pos0,
    pos1,
    refreshOnChain,
    onClaim,
    onClaimAll,
  } = useDemoSlot()

  return (
    <main className="studio account-route">
      <h1 className="account-route-title">Account</h1>
      <section className="panel account-route-panel">
        <AccountPanelContent
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
      </section>
    </main>
  )
}
