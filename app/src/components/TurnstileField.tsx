import { useEffect, useRef } from 'react'

type TurnstileApi = {
  render: (
    container: HTMLElement | string,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-snapcinema-turnstile]',
    ) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('Turnstile script failed')),
      )
      return
    }
    const s = document.createElement('script')
    s.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.dataset.snapcinemaTurnstile = '1'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Turnstile script failed'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

type Props = {
  siteKey: string
  onToken: (token: string | null) => void
  className?: string
}

/**
 * Cloudflare Turnstile widget; mount only when `siteKey` is non-empty.
 */
export function TurnstileField({ siteKey, onToken, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    let cancelled = false
    const el = containerRef.current
    if (!siteKey || !el) return () => {}

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !el || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(el, {
          sitekey: siteKey,
          callback: (t) => onTokenRef.current(t),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        })
      })
      .catch(() => {
        onTokenRef.current(null)
      })

    return () => {
      cancelled = true
      const id = widgetIdRef.current
      widgetIdRef.current = null
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id)
        } catch {
          /* noop */
        }
      }
    }
  }, [siteKey])

  return <div ref={containerRef} className={className} />
}
