import { useRef, type ReactNode, type PointerEvent } from 'react'
import { TASKBAR_H, useDesktop, type AppId } from './DesktopContext'

export function WindowFrame({
  id,
  title,
  children,
}: {
  id: AppId
  title: string
  children: ReactNode
}) {
  const desktop = useDesktop()
  const win = desktop.windows.find((item) => item.id === id)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  if (!win) return null
  const frame = win

  const hidden = frame.minimized
  const maximized = !hidden && (frame.maximized || window.innerWidth < 768)
  const style = maximized
    ? { left: 0, top: 0, width: '100%', height: `calc(100% - ${TASKBAR_H}px)`, zIndex: frame.z }
    : { left: frame.x, top: frame.y, width: frame.w, height: frame.h, zIndex: frame.z }

  function onDragStart(event: PointerEvent<HTMLDivElement>) {
    if (maximized) return
    if ((event.target as HTMLElement).closest('button')) return
    drag.current = { dx: event.clientX - frame.x, dy: event.clientY - frame.y }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onDragMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    desktop.moveApp(id, event.clientX - drag.current.dx, event.clientY - drag.current.dy)
  }

  function onDragEnd() {
    drag.current = null
  }

  function onResizeStart(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation()
    resize.current = { x: event.clientX, y: event.clientY, w: frame.w, h: frame.h }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onResizeMove(event: PointerEvent<HTMLDivElement>) {
    if (!resize.current) return
    desktop.resizeApp(
      id,
      resize.current.w + (event.clientX - resize.current.x),
      resize.current.h + (event.clientY - resize.current.y),
    )
  }

  return (
    <div
      className={`os-window ${hidden ? 'is-min' : ''}`}
      style={style}
      onPointerDown={() => desktop.focusApp(id)}
    >
      <div
        className="os-titlebar"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onDoubleClick={() => desktop.toggleMaximize(id)}
      >
        <div className="os-traffic">
          <button
            type="button"
            className="os-dot os-dot-close"
            title="Close"
            aria-label="Close"
            onClick={() => desktop.closeApp(id)}
          >
            <svg viewBox="0 0 12 12" aria-hidden>
              <path d="M3 3l6 6M9 3L3 9" />
            </svg>
          </button>
          <button
            type="button"
            className="os-dot os-dot-min"
            title="Minimize"
            aria-label="Minimize"
            onClick={() => desktop.minimizeApp(id)}
          >
            <svg viewBox="0 0 12 12" aria-hidden>
              <path d="M2.5 6h7" />
            </svg>
          </button>
          <button
            type="button"
            className="os-dot os-dot-max"
            title={maximized ? 'Restore' : 'Maximize'}
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onClick={() => desktop.toggleMaximize(id)}
          >
            {maximized ? (
              <svg viewBox="0 0 12 12" aria-hidden>
                <path d="M4 4.5h4.5V9H4zM3.5 3h4.5v1" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" aria-hidden>
                <rect x="2.75" y="2.75" width="6.5" height="6.5" rx="0.6" />
              </svg>
            )}
          </button>
        </div>
        <div className="os-title">{title}</div>
        <div className="os-caption">
          <button
            type="button"
            className="os-caption-btn"
            title="Minimize"
            aria-label="Minimize"
            onClick={() => desktop.minimizeApp(id)}
          >
            <svg viewBox="0 0 12 12" aria-hidden>
              <path d="M2 6h8" />
            </svg>
          </button>
          <button
            type="button"
            className="os-caption-btn"
            title={maximized ? 'Restore' : 'Maximize'}
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onClick={() => desktop.toggleMaximize(id)}
          >
            {maximized ? (
              <svg viewBox="0 0 12 12" aria-hidden>
                <path d="M3.5 4.5h5v5h-5zM4.5 3h5v1.2M4.5 3V4" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" aria-hidden>
                <rect x="2.5" y="2.5" width="7" height="7" rx="0.5" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="os-caption-btn os-caption-close"
            title="Close"
            aria-label="Close"
            onClick={() => desktop.closeApp(id)}
          >
            <svg viewBox="0 0 12 12" aria-hidden>
              <path d="M3 3l6 6M9 3L3 9" />
            </svg>
          </button>
        </div>
      </div>
      <div className="os-body">{children}</div>
      {!maximized ? (
        <div
          className="os-resize"
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={() => {
            resize.current = null
          }}
        />
      ) : null}
    </div>
  )
}
