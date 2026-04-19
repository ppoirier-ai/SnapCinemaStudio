import { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { clarityEvent, claritySetTag } from './clarity'

const SESSION_KEY = 'snapcinema_clarity_wallet_connected_event'

/** Tags the session when a wallet connects; fires `wallet_connected` once per browser session. */
export function ClarityWalletTracker() {
  const { connected } = useWallet()

  useEffect(() => {
    if (connected) {
      claritySetTag('wallet_connected', 'true')
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, '1')
        clarityEvent('wallet_connected')
      }
    } else {
      claritySetTag('wallet_connected', 'false')
    }
  }, [connected])

  return null
}
