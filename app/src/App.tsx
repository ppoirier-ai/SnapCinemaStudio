import { PublicKey } from '@solana/web3.js'
import './App.css'

const PROGRAM_ID_STR =
  import.meta.env.VITE_STAKE_TO_CURATE_PROGRAM_ID ??
  '4azLw8hCLoPiED81CNGXx5tthAsJUxm64P6kEnbg74ye'

function App() {
  let programIdDisplay = PROGRAM_ID_STR
  try {
    programIdDisplay = new PublicKey(PROGRAM_ID_STR).toBase58()
  } catch {
    programIdDisplay = `${PROGRAM_ID_STR} (invalid)`
  }

  return (
    <main className="studio">
      <h1>SnapCinema Studio</h1>
      <p className="lede">
        Demo app scaffold — wire wallet adapter and IDL client after{' '}
        <code>anchor build</code>.
      </p>
      <section className="panel">
        <h2>StakeToCurate program</h2>
        <p>
          <code className="pid">{programIdDisplay}</code>
        </p>
        <p className="hint">
          Override with <code>VITE_STAKE_TO_CURATE_PROGRAM_ID</code> (see{' '}
          <code>.env.example</code>).
        </p>
      </section>
    </main>
  )
}

export default App
