import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BrandLockup, Logo } from '../components/Logo'
import { PrefsBar } from '../components/PrefsBar'
import { AppGlyph, APP_TILE } from '../desktop/glyphs'
import type { AppId } from '../desktop/DesktopContext'
import { useI18n } from '../i18n'
import { ErpFlyoutProvider } from './ErpFlyoutContext'
import { ErpNavProvider } from './ErpNavContext'
import { ErpSubNavProvider, useErpSubNavContext } from './ErpSubNavContext'

type ErpShellProps<T extends string> = {
  apps: T[]
  titles: Partial<Record<T, string>>
  renderApp: (id: T) => ReactNode
  eyebrow: string
  accountMenu: ReactNode
  banners?: ReactNode
  navbarExtras?: ReactNode
  sidebarTools?: ReactNode
}

function ErpSidebarNav<T extends string>({
  apps,
  titles,
  active,
  onSelectApp,
  onCloseSidebar,
}: {
  apps: T[]
  titles: Partial<Record<T, string>>
  active: T | null
  onSelectApp: (id: T) => void
  onCloseSidebar: () => void
}) {
  const { registration } = useErpSubNavContext() ?? { registration: null }
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({})
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const grouped = (registration?.groups.length ?? 0) > 0

  useEffect(() => {
    if (!active) return
    setExpandedApps((prev) => (prev[active as string] ? prev : { ...prev, [active as string]: true }))
  }, [active])

  useEffect(() => {
    if (!registration?.groups.length) return
    setOpenGroups((prev) => {
      const next = { ...prev }
      let changed = false
      registration.groups.forEach((group) => {
        if (next[group.id] === undefined) {
          next[group.id] = true
          changed = true
        }
      })
      if (registration.current) {
        const activeGroup = registration.groups.find((group) =>
          group.items.some((item) => item.id === registration.current),
        )
        if (activeGroup && !next[activeGroup.id]) {
          next[activeGroup.id] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [registration])

  function selectSubItem(id: string) {
    registration?.onSelect(id)
    onCloseSidebar()
  }

  return (
    <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
      {apps.map((id) => {
        const selected = active === id
        const showSubNav = selected && registration && (registration.groups.length > 0 || registration.items.length > 0)
        const expanded = expandedApps[id as string] ?? selected

        return (
          <div key={id} className="erp-nav-block">
            <button
              type="button"
              onClick={() => {
                if (selected && showSubNav) {
                  setExpandedApps((prev) => ({ ...prev, [id as string]: !expanded }))
                  return
                }
                onSelectApp(id)
                setExpandedApps((prev) => ({ ...prev, [id as string]: true }))
              }}
              className={`erp-nav-item ${selected ? 'is-active' : ''}`}
            >
              <span className={`erp-nav-glyph bg-gradient-to-br ${APP_TILE[id as AppId]}`}>
                <AppGlyph id={id as AppId} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-left font-medium">{titles[id] ?? id}</span>
              {showSubNav ? (
                <span className="erp-nav-caret" aria-hidden>
                  {expanded ? '▾' : '▸'}
                </span>
              ) : null}
            </button>

            {showSubNav && expanded ? (
              <div className="erp-subnav">
                {grouped
                  ? registration!.groups.map((group) => {
                      const open = openGroups[group.id] !== false
                      return (
                        <div key={group.id} className="erp-subnav-group">
                          <button
                            type="button"
                            className="erp-subnav-group-toggle"
                            aria-expanded={open}
                            onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !open }))}
                          >
                            <span>{group.label}</span>
                            <span aria-hidden>{open ? '▾' : '▸'}</span>
                          </button>
                          {open
                            ? group.items.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={`erp-subnav-item ${registration?.current === item.id ? 'is-active' : ''}`}
                                  onClick={() => selectSubItem(item.id)}
                                >
                                  {item.label}
                                </button>
                              ))
                            : null}
                        </div>
                      )
                    })
                  : registration!.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`erp-subnav-item ${registration?.current === item.id ? 'is-active' : ''}`}
                        onClick={() => selectSubItem(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}

export function ErpShell<T extends string>({
  apps,
  titles,
  renderApp,
  eyebrow,
  accountMenu,
  banners,
  navbarExtras,
  sidebarTools,
}: ErpShellProps<T>) {
  const { t } = useI18n()
  const [active, setActive] = useState<T | null>(() => apps[0] ?? null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [flyoutMount, setFlyoutMount] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (apps.length === 0) {
      setActive(null)
      return
    }
    setActive((current) => (current && apps.includes(current) ? current : apps[0]))
  }, [apps])

  const selectApp = useCallback((id: T) => {
    setActive(id)
    setSidebarOpen(false)
  }, [])

  const openErpApp = useCallback(
    (id: AppId) => {
      if (apps.includes(id as T)) selectApp(id as T)
    },
    [apps, selectApp],
  )

  const title = active ? (titles[active] ?? active) : t('appSettings')

  return (
    <ErpNavProvider openApp={openErpApp}>
      <ErpSubNavProvider>
        <ErpFlyoutProvider mount={flyoutMount}>
          <div className="erp-shell min-h-svh bg-page text-fg">
            <div ref={setFlyoutMount} className="erp-flyout-mount" />
            {sidebarOpen ? (
              <button
                type="button"
                className="erp-sidebar-backdrop"
                aria-label={t('close')}
                onClick={() => setSidebarOpen(false)}
              />
            ) : null}

            <aside className={`erp-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
              <div className="erp-sidebar-inner">
                <div className="mb-4 px-1">
                  <BrandLockup subtitle={eyebrow} />
                </div>

                <ErpSidebarNav
                  apps={apps}
                  titles={titles}
                  active={active}
                  onSelectApp={selectApp}
                  onCloseSidebar={() => setSidebarOpen(false)}
                />

                {sidebarTools ? <div className="erp-sidebar-tools">{sidebarTools}</div> : null}
              </div>
            </aside>

            <div className="erp-main">
              <header className="erp-navbar">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    className="erp-menu-btn md:hidden"
                    aria-label={t('openMenu')}
                    onClick={() => setSidebarOpen(true)}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 7h16M4 12h16M4 17h16" />
                    </svg>
                  </button>
                  <div className="min-w-0 md:hidden">
                    <Logo className="h-8 w-8 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-base font-bold sm:text-lg">{title}</div>
                  </div>
                </div>

                <div className="erp-navbar-actions">
                  <div className="hidden md:flex md:items-center md:gap-2">
                    <PrefsBar compact />
                    {navbarExtras}
                  </div>
                  {accountMenu}
                </div>
              </header>

              {banners}

              <main className="erp-content">
                {active ? (
                  renderApp(active)
                ) : (
                  <div className="rounded-3xl border border-line bg-fill p-8 text-center text-muted">
                    {t('erpNoModules')}
                  </div>
                )}
              </main>
            </div>
          </div>
        </ErpFlyoutProvider>
      </ErpSubNavProvider>
    </ErpNavProvider>
  )
}
