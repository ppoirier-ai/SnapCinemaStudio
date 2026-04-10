type Props = {
  demoSlotId: number
  connected: boolean
  busy: boolean
  onSetup: () => void
}

export function InitPanel({ demoSlotId, connected, busy, onSetup }: Props) {
  return (
    <section className="panel" aria-labelledby="init-heading">
      <h2 id="init-heading">1. Initialize</h2>
      <p className="muted">
        Platform admin: creates slot {demoSlotId}, creator/platform = your wallet, two
        versions (ranks 1_000_000 and 200_000). You must connect the{' '}
        <strong>slot authority</strong> wallet (the pubkey in{' '}
        <code>VITE_STAKE_SLOT_AUTHORITY</code> when set, otherwise your connected
        wallet).
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
  )
}
