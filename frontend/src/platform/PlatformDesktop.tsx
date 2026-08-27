import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ClockTray } from '../desktop/ClockTray'
import { DesktopIconsLayer } from '../desktop/DesktopIconsLayer'
import { DesktopSurface } from '../desktop/DesktopSurface'
import { DesktopWidgetsLayer } from '../desktop/widgets/DesktopWidgetsLayer'
import { NotifyTray } from '../desktop/NotifyTray'
import { SupportTray } from './SupportTray'
import { useDesktop, type AppId } from '../desktop/DesktopContext'
import { APP_TILE, AppGlyph } from '../desktop/glyphs'
import SettingsApp from '../desktop/SettingsApp'
import { StartMenuPanel } from '../desktop/StartMenuPanel'
import { usePlatformApps } from '../desktop/usePlatformApps'
import { WallpaperLayer } from '../desktop/WallpaperLayer'
import { WindowFrame } from '../desktop/WindowFrame'
import { Logo } from '../components/Logo'
import { Avatar } from '../components/Avatar'
import { PrefsBar } from '../components/PrefsBar'
import { useI18n } from '../i18n'
import PlatformOverviewPage from '../pages/platform/Overview'
import PlatformCompanies from '../pages/platform/Companies'
import PlatformAdminApp from './PlatformAdminApp'
import PlatformBillingApp from './PlatformBillingApp'
import PlatformBlogPage from '../pages/platform/Blog'
import { usePlatformAccess } from './access'

export default function PlatformDesktop() {
  const { t } = useI18n()
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const desktop = useDesktop()
  const { apps, titles } = usePlatformApps()
  const { roleName } = usePlatformAccess()
  const [startOpen, setStartOpen] = useState(false)

  const roleLabel = roleName || t('roleSupport')

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function openApp(id: AppId) {
    desktop.openApp(id)
  }

  function openSettings() {
    setStartOpen(false)
    desktop.openApp('settings')
  }

  return (
    <DesktopSurface onPersonalize={openSettings}>
      <div className="os-desktop">
        <WallpaperLayer wallpaper={desktop.wallpaper} />
        <div className="os-desktop-dim" />

        <DesktopIconsLayer apps={apps} titles={titles} onOpenApp={openApp} />
        <DesktopWidgetsLayer />

        {desktop.windows.map((win) => (
          <WindowFrame key={win.id} id={win.id} title={titles[win.id] ?? win.id}>
            {win.id === 'overview' ? <PlatformOverviewPage /> : null}
            {win.id === 'tenants' ? (
              <div className="p-4">
                <PlatformCompanies />
              </div>
            ) : null}
            {win.id === 'billing' ? <PlatformBillingApp /> : null}
            {win.id === 'blog' ? (
              <div className="h-full overflow-auto">
                <PlatformBlogPage />
              </div>
            ) : null}
            {win.id === 'admin' ? <PlatformAdminApp /> : null}
            {win.id === 'settings' ? <SettingsApp /> : null}
          </WindowFrame>
        ))}

        <StartMenuPanel
          open={startOpen}
          onClose={() => setStartOpen(false)}
          apps={apps}
          titles={titles}
          onOpenApp={openApp}
          eyebrow={t('platformEyebrow')}
          accountPanel={
            <div className="rounded-2xl border border-line bg-fill p-3">
              <div className="flex items-center gap-3">
                <Avatar name={me?.user.name ?? ''} src={me?.user.avatar} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg">{me?.user.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">{me?.user.email}</div>
                  <div className="mt-1 text-[11px] text-mint">{roleLabel}</div>
                </div>
              </div>
              <button type="button" className="btn-ghost mt-3 w-full" onClick={openSettings}>
                {t('navProfile')}
              </button>
              <button type="button" className="btn-ghost mt-2 w-full" onClick={() => void handleLogout()}>
                {t('logout')}
              </button>
            </div>
          }
        />

        <footer className="os-taskbar">
          <button
            type="button"
            className={`os-start-btn ${startOpen ? 'is-active' : ''}`}
            onClick={() => setStartOpen((open) => !open)}
          >
            <Logo className="h-8 w-8" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
            {desktop.windows.map((win) => (
              <button
                key={win.id}
                type="button"
                className={`os-task ${win.minimized ? '' : 'is-active'}`}
                onClick={() =>
                  win.minimized || win.z < Math.max(...desktop.windows.map((item) => item.z), 0)
                    ? desktop.focusApp(win.id)
                    : desktop.minimizeApp(win.id)
                }
              >
                <span className={`os-task-glyph bg-gradient-to-br ${APP_TILE[win.id]}`}>
                  <AppGlyph id={win.id} className="h-3.5 w-3.5" />
                </span>
                <span className="hidden truncate sm:inline">{titles[win.id] ?? win.id}</span>
              </button>
            ))}
          </div>
          <div className="hidden md:block">
            <PrefsBar compact />
          </div>
          <NotifyTray />
          <SupportTray />
          <ClockTray />
        </footer>
      </div>
    </DesktopSurface>
  )
}
