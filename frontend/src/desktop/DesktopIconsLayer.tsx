import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { AppId } from './DesktopContext'
import { TASKBAR_H, useDesktop } from './DesktopContext'
import { DESKTOP_ICON_SLOT_H, DESKTOP_ICON_SLOT_W, isDesktopIconVisible, layoutDesktopIcons } from './desktopPrefs'
import { APP_TILE, AppGlyph } from './glyphs'

const ICON_W = DESKTOP_ICON_SLOT_W
const ICON_H = DESKTOP_ICON_SLOT_H
const DRAG_THRESHOLD = 5

type IconMenu = { x: number; y: number; appId: AppId } | null

type DesktopIconsLayerProps = {
  apps: AppId[]
  titles: Partial<Record<AppId, string>>
  onOpenApp: (id: AppId) => void
}

export function DesktopIconsLayer({ apps, titles, onOpenApp }: DesktopIconsLayerProps) {
  const { t } = useI18n()
  const { desktop, setIconPosition, setAppDesktopVisible } = useDesktop()
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [iconMenu, setIconMenu] = useState<IconMenu>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    id: AppId
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const livePosRef = useRef<{ x: number; y: number } | null>(null)

  const visibleApps = apps.filter((id) => isDesktopIconVisible(id, desktop))
  const [viewportH, setViewportH] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight,
  )

  useEffect(() => {
    function onResize() {
      setViewportH(window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const iconPositions = layoutDesktopIcons(visibleApps, desktop, viewportH)

  const clampPosition = useCallback((x: number, y: number) => {
    const maxX = Math.max(8, window.innerWidth - ICON_W - 8)
    const maxY = Math.max(8, window.innerHeight - TASKBAR_H - ICON_H - 8)
    return {
      x: Math.max(8, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY)),
    }
  }, [])

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      drag.moved = true
      const next = clampPosition(drag.originX + dx, drag.originY + dy)
      livePosRef.current = next
      setDragPositions((current) => ({ ...current, [drag.id]: next }))
    }

    function onPointerUp() {
      const drag = dragRef.current
      if (!drag) return
      if (drag.moved) {
        const pos = livePosRef.current ?? clampPosition(drag.originX, drag.originY)
        setIconPosition(drag.id, pos)
      } else {
        onOpenApp(drag.id)
      }
      dragRef.current = null
      livePosRef.current = null
      setDragPositions((current) => {
        const next = { ...current }
        delete next[drag.id]
        return next
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [clampPosition, onOpenApp, setIconPosition])

  useEffect(() => {
    if (!iconMenu) return
    function close() {
      setIconMenu(null)
    }
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return
      close()
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [iconMenu])

  if (!desktop.showIcons || visibleApps.length === 0) return null

  return (
    <>
      <div className="os-icons-layer">
        {visibleApps.map((id) => {
          const pos = dragPositions[id] ?? iconPositions[id]
          return (
            <button
              key={id}
              type="button"
              className="os-icon os-icon-free"
              style={{ left: pos.x, top: pos.y }}
              onPointerDown={(event) => {
                if (event.button !== 0) return
                event.preventDefault()
                setIconMenu(null)
                dragRef.current = {
                  id,
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: pos.x,
                  originY: pos.y,
                  moved: false,
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setIconMenu({ x: event.clientX, y: event.clientY, appId: id })
              }}
            >
              <span className={`os-icon-tile bg-gradient-to-br ${APP_TILE[id]} text-ink`}>
                <AppGlyph id={id} />
              </span>
              <span className="os-icon-label">{titles[id] ?? id}</span>
            </button>
          )
        })}
      </div>
      {iconMenu ? (
        <div ref={menuRef} className="os-context-menu" style={{ left: iconMenu.x, top: iconMenu.y }} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIconMenu(null)
              onOpenApp(iconMenu.appId)
            }}
          >
            {t('desktopIconOpen')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAppDesktopVisible(iconMenu.appId, false)
              setIconMenu(null)
            }}
          >
            {t('desktopIconHide')}
          </button>
        </div>
      ) : null}
    </>
  )
}
