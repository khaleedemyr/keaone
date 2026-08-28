import { useEffect, useState, type ReactNode } from 'react'
import { BrandLockup, Logo } from '../components/Logo'
import { PrefsBar } from '../components/PrefsBar'
import { AppGlyph, APP_TILE } from '../desktop/glyphs'
import type { AppId } from '../desktop/DesktopContext'
import { useI18n } from '../i18n'

type ErpShellProps<T extends string> = {
  apps: T[]
  titles: Partial<Record<T, string>>
  renderApp: (id: T) => ReactNode
  eyebrow: string
  accountPanel: ReactNode
  banners?: ReactNode
  navbarExtras?: ReactNode
}

export function ErpShell<T extends string>({
  apps,
  titles,
  renderApp,
  eyebrow,
  accountPanel,
  banners,
  navbarExtras,
}: ErpShellProps<T>) {
  const { t } = useI18n()
  const [active, setActive] = useState<T | null>(() => apps[0] ?? null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (apps.length === 0) {
      setActive(null)
      return
    }
    setActive((current) => (current && apps.includes(current) ? current : apps[0]))
  }, [apps])

  function selectApp(id: T) {
    setActive(id)
    setSidebarOpen(false)
  }

  const title = active ? (titles[active] ?? active) : t('appSettings')

  return (
    <div className="erp-shell min-h-svh bg-page text-fg">
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
          <div className="mb-6 px-1">
            <BrandLockup subtitle={eyebrow} />
          </div>

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
            {apps.map((id) => {
              const selected = active === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectApp(id)}
                  className={`erp-nav-item ${selected ? 'is-active' : ''}`}
                >
                  <span className={`erp-nav-glyph bg-gradient-to-br ${APP_TILE[id as AppId]}`}>
                    <AppGlyph id={id as AppId} className="h-4 w-4" />
                  </span>
                  <span className="truncate font-medium">{titles[id] ?? id}</span>
                </button>
              )
            })}
          </nav>

          <div className="mt-4 shrink-0 space-y-3 border-t border-line pt-4">{accountPanel}</div>
        </div>
      </aside>

      <div className="erp-main">
        <header className="erp-navbar">
          <div className="flex min-w-0 items-center gap-3">
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
              <Logo className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-lg font-bold">{title}</div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden sm:block">
              <PrefsBar compact />
            </div>
            {navbarExtras}
          </div>
        </header>

        {banners}

        <main className="erp-content">
          {active ? renderApp(active) : (
            <div className="rounded-3xl border border-line bg-fill p-8 text-center text-muted">
              {t('erpNoModules')}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
