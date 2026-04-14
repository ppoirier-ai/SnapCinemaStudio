import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = { error: Error | null }

/**
 * Catches render / React.lazy failures (e.g. Kamino chunk load) so the user can recover
 * when the wallet auto-connected and the app would otherwise stay blank.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  private clearWalletAndReload = () => {
    try {
      localStorage.removeItem('walletName')
    } catch {
      /* ignore */
    }
    window.location.reload()
  }

  override render() {
    if (this.state.error) {
      const msg = this.state.error.message
      return (
        <div
          style={{
            minHeight: '100vh',
            boxSizing: 'border-box',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            background: '#0b0c10',
            color: '#c8cad4',
          }}
        >
          <h1 style={{ color: '#f2f3f7', fontSize: '1.25rem', marginTop: 0 }}>
            SnapCinema hit a startup error
          </h1>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#060708',
              padding: '1rem',
              borderRadius: 8,
              fontSize: '0.85rem',
            }}
          >
            {msg}
          </pre>
          <p style={{ maxWidth: '40rem', lineHeight: 1.5 }}>
            If your wallet was auto-connecting, use the button below to clear the saved wallet
            choice and reload. You can also disconnect from Phantom for this site in the extension.
          </p>
          <button
            type="button"
            onClick={this.clearWalletAndReload}
            style={{
              marginTop: '0.75rem',
              padding: '0.6rem 1rem',
              borderRadius: 8,
              border: '1px solid #3d4356',
              background: '#181b26',
              color: '#f2f3f7',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Clear saved wallet, then reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
