import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  useWalletModal,
  WalletModalButton,
} from '@solana/wallet-adapter-react-ui'

type Props = { variant: 'public' | 'authed' }

const navClass = ({ isActive }: { isActive: boolean }) =>
  `wallet-menu-link${isActive ? ' wallet-menu-link-active' : ''}`

export function WalletMenu({ variant }: Props) {
  const { publicKey, disconnect, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  if (variant === 'public' || !connected) {
    return (
      <WalletModalButton className="btn btn-primary wallet-menu-connect">
        Connect wallet
      </WalletModalButton>
    )
  }

  const addr = publicKey?.toBase58() ?? ''
  const short =
    addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr || 'Wallet'

  return (
    <div className="wallet-menu" ref={wrapRef}>
      <button
        type="button"
        className="wallet-menu-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="wallet-menu-trigger-label">{short}</span>
        <span className="wallet-menu-chevron" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M12 15.4 6 9.4l1.4-1.4 4.6 4.6 4.6-4.6L18 9.4l-6 6z"
            />
          </svg>
        </span>
      </button>
      {open && (
        <div className="wallet-menu-dropdown" role="menu">
          <NavLink
            to="/watch"
            className={navClass}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Watch
          </NavLink>
          <NavLink
            to="/studio"
            className={navClass}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Studio demo
          </NavLink>
          <NavLink
            to="/contribute"
            className={navClass}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Scene board
          </NavLink>
          <NavLink
            to="/account"
            className={navClass}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Account
          </NavLink>
          <button
            type="button"
            className="wallet-menu-item wallet-menu-item-button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setVisible(true)
            }}
          >
            Change wallet
          </button>
          <button
            type="button"
            className="wallet-menu-item wallet-menu-item-danger"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void disconnect()
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
