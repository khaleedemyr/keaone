import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { useDesktop } from './DesktopContext'
import { WIDGET_IDS, isWidgetVisible, type WidgetId } from './desktopPrefs'
import { widgetLabelKey } from './widgets/DesktopWidgetsLayer'

type DesktopSurfaceProps = {
  children: ReactNode
  onPersonalize?: () => void
}

export function DesktopSurface({ children, onPersonalize }: DesktopSurfaceProps) {
  const { t } = useI18n()
  const { desktop, setShowDesktopIcons, setWidgetVisible } = useDesktop()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [widgetsOpen, setWidgetsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    function close() {
      setMenu(null)
      setWidgetsOpen(false)
    }
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return
      close()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menu])

  return (
    <div
      className="os-desktop-surface"
      onContextMenu={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('.os-icon-free')) return
        if (target.closest('.os-widget')) return
        if (target.closest('.os-window')) return
        if (target.closest('.os-start')) return
        if (target.closest('.os-taskbar')) return
        if (target.closest('.os-context-menu')) return
        event.preventDefault()
        setWidgetsOpen(false)
        setMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      {children}
      {menu ? (
        <div ref={menuRef} className="os-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setShowDesktopIcons(!desktop.showIcons)
              setMenu(null)
            }}
          >
            {desktop.showIcons ? t('desktopHideIcons') : t('desktopShowIcons')}
          </button>
          <button type="button" role="menuitem" onClick={() => setWidgetsOpen((open) => !open)}>
            {t('desktopWidgets')} ▸
          </button>
          {widgetsOpen
            ? WIDGET_IDS.map((id: WidgetId) => {
                const visible = isWidgetVisible(id, desktop)
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className="os-context-sub"
                    onClick={() => {
                      setWidgetVisible(id, !visible)
                      setMenu(null)
                    }}
                  >
                    {visible ? '✓ ' : ''}
                    {t(widgetLabelKey(id))}
                  </button>
                )
              })
            : null}
          {onPersonalize ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null)
                onPersonalize()
              }}
            >
              {t('desktopPersonalize')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
