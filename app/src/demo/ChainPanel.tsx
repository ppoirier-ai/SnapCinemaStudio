import type { PublicKey } from '@solana/web3.js'
import { PROGRAM_ID } from '../stakeToCurate/client'

type Props = {
  demoSlotId: number
  slotPk: PublicKey | null
  connected: boolean
  busy: boolean
  onRefresh: () => void
}

export function ChainPanel({
  demoSlotId,
  slotPk,
  connected,
  busy,
  onRefresh,
}: Props) {
  return (
    <section className="panel" aria-labelledby="chain-heading">
      <h2 id="chain-heading">Chain</h2>
      <div>
        <span className="field-label">Program</span>
        <code className="pid">{PROGRAM_ID.toBase58()}</code>
      </div>
      {slotPk && (
        <div>
          <span className="field-label">Slot PDA (id {demoSlotId})</span>
          <code className="pid">{slotPk.toBase58()}</code>
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={!connected || busy}
        onClick={() => void onRefresh()}
      >
        Refresh on-chain state
      </button>
    </section>
  )
}
