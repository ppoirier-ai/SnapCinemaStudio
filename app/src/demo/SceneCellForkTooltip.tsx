import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  SceneForkHoverPanel,
  type SceneForkHoverPanelProps,
} from './SceneForkHoverPanel'

type Props = { children: ReactNode } & SceneForkHoverPanelProps

const CLOSE_DELAY_MS = 280

export function SceneCellForkTooltip(props: Props) {
  const { children, ...panelProps } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [rootStyle, setRootStyle] = useState<CSSProperties>({})
  const closeTimer = useRef(0)

  const cancelClose = useCallback(() => {
    window.clearTimeout(closeTimer.current)
  }, [])

  const scheduleClose = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }, [])

  const updatePosition = useCallback(() => {
    const el = hostRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const maxW = Math.min(320, window.innerWidth - 16)
    let left = r.left + r.width / 2 - maxW / 2
    left = Math.max(8, Math.min(left, window.innerWidth - maxW - 8))
    const gap = 10
    const spaceAbove = r.top
    const wantAbove = spaceAbove > 140
    if (wantAbove) {
      setRootStyle({
        position: 'fixed',
        left,
        width: maxW,
        top: r.top - gap,
        transform: 'translateY(-100%)',
        zIndex: 50000,
      })
    } else {
      setRootStyle({
        position: 'fixed',
        left,
        width: maxW,
        top: r.bottom + gap,
        transform: 'none',
        zIndex: 50000,
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const onScroll = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <div
        ref={hostRef}
        className="scene-cell-tooltip-host scene-cell-tooltip-host--anchor"
        onMouseEnter={() => {
          cancelClose()
          setOpen(true)
          queueMicrotask(updatePosition)
        }}
        onMouseLeave={scheduleClose}
      >
        {children}
      </div>
      {open &&
        createPortal(
          <div
            className="studio scene-tooltip-portal"
            style={rootStyle}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <SceneForkHoverPanel
              {...panelProps}
              rootClassName="scene-cell-chain-tooltip scene-cell-chain-tooltip--portal"
            />
          </div>,
          document.body,
        )}
    </>
  )
}
