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
        Platform admin: creates slot {demoSlotId} with creator/platform = your wallet.
        <strong> Scene accounts</strong> are created separately when the authority saves
        playable YouTube URLs on the <strong>Scene</strong> tab (one <code>Scene</code>{' '}
        PDA per cell). You must connect the <strong>slot authority</strong> wallet (the
        pubkey in <code>VITE_STAKE_SLOT_AUTHORITY</code> when set, otherwise your connected
        wallet).
      </p>
      <p className="muted init-panel-cluster-note">
        <strong>Wallet cluster must match the app RPC.</strong> This build defaults to{' '}
        <strong>devnet</strong> (<code>VITE_SOLANA_RPC</code> or public devnet). In
        Phantom, use <strong>Devnet</strong> — not &quot;Testnet&quot; (Solana testnet is
        a different network). Mismatch causes &quot;reverted during simulation&quot;.
      </p>
      <p className="muted init-panel-cluster-note">
        <strong>Devnet SOL required.</strong> Setup creates new accounts (rent) plus
        fees. A zero balance will fail simulation — use a devnet faucet (e.g.{' '}
        <a
          href="https://faucet.solana.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          faucet.solana.com
        </a>
        ) for the <strong>slot authority</strong> wallet.
      </p>
      <p className="muted init-panel-cluster-note">
        If you see <strong>&quot;already been processed&quot;</strong>, the same setup tx
        may have already landed — click <strong>Refresh on-chain state</strong> above;
        do not repeat-sign the identical transaction in Phantom.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!connected || busy}
        onClick={() => void onSetup()}
      >
        Setup demo (init slot only)
      </button>
    </section>
  )
}
