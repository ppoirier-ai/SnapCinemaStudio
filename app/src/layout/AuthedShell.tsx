import { Outlet, Navigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { AppHeader } from '../components/AppHeader'
import { DemoSlotProvider, useDemoSlot } from '../context/DemoSlotContext'
import { SceneBoardProvider } from '../context/SceneBoardContext'

export function AuthedShell() {
  const { connected } = useWallet()
  if (!connected) return <Navigate to="/" replace />
  return (
    <DemoSlotProvider>
      <SceneBoardProvider>
        <AuthedChrome />
      </SceneBoardProvider>
    </DemoSlotProvider>
  )
}

function AuthedChrome() {
  const { toast } = useDemoSlot()
  return (
    <div className="authed-app">
      <AppHeader variant="authed" />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <Outlet />
    </div>
  )
}
