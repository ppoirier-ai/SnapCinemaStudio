import { Link } from 'react-router-dom'
import { WalletMenu } from './WalletMenu'

type Props = { variant: 'public' | 'authed' }

export function AppHeader({ variant }: Props) {
  const homeTo = variant === 'public' ? '/' : '/watch'

  return (
    <header className="app-topbar">
      <Link to={homeTo} className="app-brand">
        SnapCinema Studio
      </Link>
      <WalletMenu variant={variant} />
    </header>
  )
}
