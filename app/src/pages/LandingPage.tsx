import { Navigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletModalButton } from '@solana/wallet-adapter-react-ui'
import { AppHeader } from '../components/AppHeader'

export function LandingPage() {
  const { connected } = useWallet()

  if (connected) return <Navigate to="/watch" replace />

  return (
    <div className="landing">
      <AppHeader variant="public" />
      <main className="landing-main">
        <h1 className="landing-title">Stake-weighted cinema curation</h1>
        <p className="landing-lead">
          SnapCinema Studio is a Solana-powered demo where fans signal which cut of a
          scene deserves attention, creators ship competing versions, and curator
          stakes route rewards on devnet. Connect a wallet to watch the short and
          react on-chain.
        </p>
        <div className="landing-cta">
          <WalletModalButton className="btn btn-primary landing-connect">
            Connect wallet to begin
          </WalletModalButton>
          <p className="muted landing-cta-note">
            Uses Phantom (or your chosen adapter) on devnet. No email login.
          </p>
        </div>
      </main>
    </div>
  )
}
