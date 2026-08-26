import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { TASKBAR_H, useDesktop } from '../DesktopContext'
import type { WidgetId } from '../desktopPrefs'
import { resolveWidgetPosition } from '../desktopPrefs'

const DRAG_THRESHOLD = 4

type WidgetFrameProps = {
  /** Position key — system widget id or `note:{id}` */
  id: string
  title: string
  width?: number
  children: ReactNode
  className?: string
  variant?: 'panel' | 'glass' | 'bare'
  /** Extra controls before the close button (e.g. add sticky note). */
  titleActions?: ReactNode
  /** If set, × hides this system widget. Otherwise onHide/onClose is used. */
  hideWidgetId?: WidgetId
  onClose?: () => void
}

export function WidgetFrame({
  id,
  title,
  width = 260,
  children,
  className = '',
  variant = 'panel',
  titleActions,
  hideWidgetId,
  onClose,
}: WidgetFrameProps) {
  const { desktop, setWidgetPosition, setWidgetVisible } = useDesktop()
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const livePosRef = useRef<{ x: number; y: number } | null>(null)

  const saved = resolveWidgetPosition(id, desktop)
  const pos = dragPos ?? saved

  const clamp = useCallback(
    (x: number, y: number) => {
      const maxX = Math.max(8, window.innerWidth - width - 8)
      const maxY = Math.max(8, window.innerHeight - TASKBAR_H - 80)
      return {
        x: Math.max(8, Math.min(x, maxX)),
        y: Math.max(8, Math.min(y, maxY)),
      }
    },
    [width],
  )

  useEffect(() => {
    if (dragPos) return
    const next = clamp(saved.x, saved.y)
    if (next.x === saved.x && next.y === saved.y) return
    setWidgetPosition(id, next)
  }, [clamp, dragPos, id, saved.x, saved.y, setWidgetPosition])

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      drag.moved = true
      const next = clamp(drag.originX + dx, drag.originY + dy)
      livePosRef.current = next
      setDragPos(next)
    }

    function onPointerUp() {
      const drag = dragRef.current
      if (!drag) return
      if (drag.moved) {
        setWidgetPosition(id, livePosRef.current ?? clamp(drag.originX, drag.originY))
      }
      dragRef.current = null
      livePosRef.current = null
      setDragPos(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [clamp, id, setWidgetPosition])

  function startDrag(event: ReactPointerEvent) {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('a, input, textarea, select, .os-widget-nodrag')) return
    // Allow drag from bare face; only block explicit control buttons
    if (target.closest('button.os-widget-hide, button.os-widget-bare-hide, button.os-notes-add, .os-clock-skins button, .os-notes-colors button')) {
      return
    }
    event.preventDefault()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    }
  }

  function handleClose() {
    if (onClose) onClose()
    else if (hideWidgetId) setWidgetVisible(hideWidgetId, false)
  }

  return (
    <div
      className={`os-widget is-${variant} ${className}`}
      style={{ left: pos.x, top: pos.y, width }}
      onPointerDown={startDrag}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {variant !== 'bare' ? (
        <div className="os-widget-title">
          <span>{title}</span>
          <div className="os-widget-title-actions">
            {titleActions}
            <button type="button" className="os-widget-hide" aria-label="Hide" onClick={handleClose}>
              ×
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="os-widget-bare-hide" aria-label="Hide" onClick={handleClose}>
          ×
        </button>
      )}
      <div className="os-widget-body">{children}</div>
    </div>
  )
}
