import { PRESETS_LAMPORTS } from './constants'
import { lamportsToSol } from './format'

type Props = {
  connected: boolean
  busy: boolean
  onStakeUp: (versionIndex: 0 | 1, lamports: bigint) => void
  onStakeDown: (versionIndex: 0 | 1, lamports: bigint) => void
  onUnstake: (versionIndex: 0 | 1) => void
}

export function StakePanel({
  connected,
  busy,
  onStakeUp,
  onStakeDown,
  onUnstake,
}: Props) {
  return (
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
  )
}
