import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { clarityEvent, claritySetTag } from './clarity'

function routeNameFromPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'landing'
  if (pathname.startsWith('/watch')) return 'watch'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/studio')) return 'studio'
  if (pathname.startsWith('/contribute')) return 'contribute'
  if (pathname.startsWith('/account')) return 'account'
  return 'other'
}

function firstVisitEventKey(routeName: string): string | null {
  if (
    routeName === 'watch' ||
    routeName === 'dashboard' ||
    routeName === 'contribute' ||
    routeName === 'account'
  ) {
    return `snapcinema_clarity_first_${routeName}`
  }
  return null
}

/** Sets Clarity tags for SPA route; emits one `first_route_*` event per tab session for key routes. */
export function ClarityRouteTracker() {
  const { pathname } = useLocation()

  useEffect(() => {
    const routeName = routeNameFromPath(pathname)
    claritySetTag('route', pathname)
    claritySetTag('route_name', routeName)

    const storageKey = firstVisitEventKey(routeName)
    if (storageKey && !sessionStorage.getItem(storageKey)) {
      sessionStorage.setItem(storageKey, '1')
      clarityEvent(`first_route_${routeName}`)
    }
  }, [pathname])

  return null
}
