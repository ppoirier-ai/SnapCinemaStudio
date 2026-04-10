type Props = {
  connected: boolean
  busy: boolean
  onDeposit: (versionIndex: 0 | 1, lamports: bigint) => void
  onClaim: (versionIndex: 0 | 1) => void
}

export function RevenuePanel({ connected, busy, onDeposit, onClaim }: Props) {
  return (
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
  )
}
