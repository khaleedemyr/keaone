import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { BrandLockup, Logo } from '../components/Logo'
import { PrefsBar } from '../components/PrefsBar'
import { AppGlyph, APP_TILE } from '../desktop/glyphs'
import type { AppId } from '../desktop/DesktopContext'
import { useI18n } from '../i18n'
import { ErpFlyoutProvider } from './ErpFlyoutContext'
import { ErpNavProvider } from './ErpNavContext'
import { ErpSidebarSearch } from './ErpSidebarSearch'
import { ErpSubNavProvider, useErpSubNavContext } from './ErpSubNavContext'
import type { ErpSearchEntry } from './erpNavSearch'

const SIDEBAR_COLLAPSED_KEY = 'kea_erp_sidebar_collapsed'

type ErpShellProps<T extends string> = {
  apps: T[]
  titles: Partial<Record<T, string>>
  renderApp: (id: T) => ReactNode
  eyebrow: string
  accountMenu: ReactNode
  banners?: ReactNode
  navbarExtras?: ReactNode
  sidebarTools?: ReactNode
  searchEntries?: ErpSearchEntry[]
}

function ErpSidebarNav<T extends string>({
  apps,
  titles,
  active,
  collapsed,
  onSelectApp,
  onCloseSidebar,
}: {
  apps: T[]
  titles: Partial<Record<T, string>>
  active: T | null
  collapsed: boolean
  onSelectApp: (id: T, opts?: { keepSidebarOpen?: boolean }) => void
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
        const showSubNav = !collapsed && selected && registration && (registration.groups.length > 0 || registration.items.length > 0)
        const expanded = expandedApps[id as string] ?? selected
        const label = titles[id] ?? id

        return (
          <div key={id} className="erp-nav-block">
            <button
              type="button"
              title={collapsed ? label : undefined}
              onClick={() => {
                if (selected) {
                  if (showSubNav) {
                    setExpandedApps((prev) => ({ ...prev, [id as string]: !expanded }))
                  }
                  return
                }
                onSelectApp(id, { keepSidebarOpen: true })
                setExpandedApps({ [id as string]: true })
              }}
              className={`erp-nav-item ${selected ? 'is-active' : ''}`}
            >
              <span className={`erp-nav-glyph bg-gradient-to-br ${APP_TILE[id as AppId]}`}>
                <AppGlyph id={id as AppId} className="h-4 w-4" />
              </span>
              <span className="erp-nav-label min-w-0 flex-1 truncate text-left font-medium">{label}</span>
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

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
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
  searchEntries = [],
}: ErpShellProps<T>) {
  const { t } = useI18n()
  const [active, setActive] = useState<T | null>(() => apps[0] ?? null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [flyoutMount, setFlyoutMount] = useState<HTMLDivElement | null>(null)
  const [pendingSection, setPendingSection] = useState<{ appId: AppId; sectionId: string } | null>(null)

  useEffect(() => {
    if (apps.length === 0) {
      setActive(null)
      return
    }
    setActive((current) => (current && apps.includes(current) ? current : apps[0]))
  }, [apps])

  const selectApp = useCallback((id: T, opts?: { keepSidebarOpen?: boolean }) => {
    setActive(id)
    if (!opts?.keepSidebarOpen) {
      setSidebarOpen(false)
    }
  }, [])

  const openErpApp = useCallback(
    (id: AppId) => {
      if (apps.includes(id as T)) selectApp(id as T)
    },
    [apps, selectApp],
  )

  const openAppSection = useCallback(
    (id: AppId, sectionId: string) => {
      setPendingSection({ appId: id, sectionId })
      if (apps.includes(id as T)) selectApp(id as T, { keepSidebarOpen: true })
    },
    [apps, selectApp],
  )

  const clearPendingSection = useCallback(() => setPendingSection(null), [])

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((value) => {
      const next = !value
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function handleSearchSelect(entry: ErpSearchEntry) {
    if (entry.sectionId) {
      openAppSection(entry.appId, entry.sectionId)
    } else {
      setPendingSection(null)
      openErpApp(entry.appId)
    }
    setSidebarOpen(false)
  }

  const title = active ? (titles[active] ?? active) : t('appSettings')

  return (
    <ErpNavProvider
      openApp={openErpApp}
      openAppSection={openAppSection}
      pendingSection={pendingSection}
      clearPendingSection={clearPendingSection}
    >
      <ErpSubNavProvider>
        <ErpFlyoutProvider mount={flyoutMount}>
          <div className={`erp-shell min-h-svh bg-page text-fg ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
            <div ref={setFlyoutMount} className="erp-flyout-mount" />
            {sidebarOpen ? (
              <button
                type="button"
                className="erp-sidebar-backdrop"
                aria-label={t('close')}
                onClick={() => setSidebarOpen(false)}
              />
            ) : null}

            <aside className={`erp-sidebar ${sidebarOpen ? 'is-open' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
              <div className="erp-sidebar-inner">
                <div className="erp-sidebar-brand">
                  {sidebarCollapsed ? (
                    <Logo className="mx-auto h-9 w-9 shrink-0" />
                  ) : (
                    <div className="mb-1 px-1">
                      <BrandLockup subtitle={eyebrow} />
                    </div>
                  )}
                </div>

                {searchEntries.length > 0 ? (
                  <ErpSidebarSearch
                    entries={searchEntries}
                    collapsed={sidebarCollapsed}
                    onSelect={handleSearchSelect}
                  />
                ) : null}

                <ErpSidebarNav
                  apps={apps}
                  titles={titles}
                  active={active}
                  collapsed={sidebarCollapsed}
                  onSelectApp={selectApp}
                  onCloseSidebar={() => setSidebarOpen(false)}
                />

                <div className="erp-sidebar-foot">
                  {sidebarTools ? <div className="erp-sidebar-tools">{sidebarTools}</div> : null}
                  <button
                    type="button"
                    className="erp-sidebar-collapse-btn hidden md:inline-flex"
                    aria-label={sidebarCollapsed ? t('erpSidebarExpand') : t('erpSidebarCollapse')}
                    title={sidebarCollapsed ? t('erpSidebarExpand') : t('erpSidebarCollapse')}
                    onClick={toggleSidebarCollapsed}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      {sidebarCollapsed ? (
                        <path d="M9 6v12M15 8l4 4-4 4" />
                      ) : (
                        <path d="M15 6v12M9 8 5 12l4 4" />
                      )}
                    </svg>
                    <span className="erp-sidebar-collapse-label">
                      {sidebarCollapsed ? t('erpSidebarExpand') : t('erpSidebarCollapse')}
                    </span>
                  </button>
                </div>
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
