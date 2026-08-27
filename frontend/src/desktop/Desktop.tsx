import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Avatar } from '../components/Avatar'
import { BusinessTypeField } from '../components/BusinessTypeField'
import { Logo } from '../components/Logo'
import { PrefsBar } from '../components/PrefsBar'
import Dashboard from '../pages/Dashboard'
import Pos from '../pages/Pos'
import { useI18n } from '../i18n'
import AdminApp from './AdminApp'
import { ChatTray } from './ChatTray'
import { ClockTray } from './ClockTray'
import { LiveSupportTray } from './LiveSupportTray'
import { DesktopIconsLayer } from './DesktopIconsLayer'
import { DesktopSurface } from './DesktopSurface'
import { DesktopWidgetsLayer } from './widgets/DesktopWidgetsLayer'
import { NotifyTray } from './NotifyTray'
import { useDesktop, type AppId } from './DesktopContext'
import { APP_TILE, AppGlyph } from './glyphs'
import MasterApp from './MasterApp'
import PurchaseApp from './PurchaseApp'
import SalesApp from './SalesApp'
import SettingsApp from './SettingsApp'
import { StartMenuPanel } from './StartMenuPanel'
import { useTenantApps } from './useTenantApps'
import { WallpaperLayer } from './WallpaperLayer'
import { WindowFrame } from './WindowFrame'
import { ErrorBoundary } from '../components/ErrorBoundary'

export default function Desktop() {
  const { t } = useI18n()
  const { me, logout, switchCompany, createCompany } = useAuth()
  const navigate = useNavigate()
  const desktop = useDesktop()
  const { apps, titles } = useTenantApps()
  const [startOpen, setStartOpen] = useState(false)
  const [newCompany, setNewCompany] = useState('')
  const [newType, setNewType] = useState('retail')
  const [creating, setCreating] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  async function handleSwitch(companyId: number) {
    if (companyId === me?.company?.id) {
      setStartOpen(false)
      return
    }
    setStartOpen(false)
    await switchCompany(companyId)
  }

  async function handleCreateCompany() {
    if (!newCompany.trim()) return
    setCreating(true)
    try {
      await createCompany(newCompany.trim(), newType)
      setNewCompany('')
      setStartOpen(false)
    } finally {
      setCreating(false)
    }
  }

  async function leaveStore() {
    setStartOpen(false)
    await switchCompany(null)
    navigate('/app', { replace: true })
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

        {me?.access === 'support' ? (
          <div className="os-support">
            <span>
              {t('supportMode')} · {me.company?.name}
            </span>
            <button type="button" onClick={() => void leaveStore()}>
              {t('backToPlatform')}
            </button>
          </div>
        ) : me?.billing && !me.billing.usable ? (
          <div className="os-support">
            <span>{t('billingBlocked')}</span>
            <button type="button" onClick={() => openApp('admin')}>
              {t('navBilling')}
            </button>
          </div>
        ) : me?.billing?.status === 'trialing' && me.billing.trial_ends_at ? (
          <div className="os-support">
            <span>
              {t('trialUntil', { date: new Date(me.billing.trial_ends_at).toLocaleDateString() })}
            </span>
          </div>
        ) : null}

        <DesktopIconsLayer apps={apps} titles={titles} onOpenApp={openApp} />
        <DesktopWidgetsLayer />

        {desktop.windows.map((win) => (
          <WindowFrame key={win.id} id={win.id} title={titles[win.id] ?? win.id}>
            <ErrorBoundary>
              {win.id === 'insight' ? <Dashboard /> : null}
              {win.id === 'pos' ? <Pos /> : null}
              {win.id === 'master' ? <MasterApp /> : null}
              {win.id === 'sales' ? <SalesApp /> : null}
              {win.id === 'purchase' ? <PurchaseApp /> : null}
              {win.id === 'admin' ? <AdminApp /> : null}
              {win.id === 'settings' ? <SettingsApp /> : null}
            </ErrorBoundary>
          </WindowFrame>
        ))}

        <StartMenuPanel
          open={startOpen}
          onClose={() => setStartOpen(false)}
          apps={apps}
          titles={titles}
          onOpenApp={openApp}
          eyebrow={t('osLine')}
          accountPanel={
            <div className="rounded-2xl border border-line bg-fill p-3">
              <div className="flex items-center gap-3">
                <Avatar name={me?.user.name ?? ''} src={me?.user.avatar} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg">{me?.user.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {me?.company?.name} · {me?.outlet?.name}
                  </div>
                  <div className="mt-1 text-[11px] text-mint">
                    {me?.access === 'support' ? t('supportMode') : me?.user.role_name ?? me?.user.role}
                  </div>
                </div>
              </div>

              {me?.user.is_platform ? (
                <button
                  type="button"
                  className="btn-ghost mt-3 w-full"
                  onClick={() => {
                    setStartOpen(false)
                    if (me.access === 'support') void leaveStore()
                    else navigate('/app')
                  }}
                >
                  {t('openPlatform')}
                </button>
              ) : null}

              {(me?.memberships?.length ?? 0) > 1 ? (
                <div className="mt-3">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted">
                    {t('yourCompanies')}
                  </div>
                  <div className="max-h-40 space-y-1 overflow-auto">
                    {me?.memberships?.map((item) => (
                      <button
                        key={item.company_id}
                        type="button"
                        className={`os-company ${item.company_id === me.company?.id ? 'is-active' : ''}`}
                        onClick={() => void handleSwitch(item.company_id)}
                      >
                        <span>{item.name}</span>
                        <span className="text-[10px] uppercase text-muted">{item.role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {!me?.user.is_platform ? (
                <form
                  className="mt-3 space-y-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleCreateCompany()
                  }}
                >
                  <div className="flex gap-1">
                    <input
                      className="field !mt-0 min-w-0 flex-1 !py-1.5 !text-xs"
                      placeholder={t('newCompany')}
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                    />
                    <button type="submit" disabled={creating} className="btn-ghost !px-2 !text-xs">
                      {t('addCompany')}
                    </button>
                  </div>
                  <BusinessTypeField value={newType} onChange={setNewType} />
                </form>
              ) : null}

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
          <ChatTray />
          <LiveSupportTray />
          <NotifyTray />
          <ClockTray />
        </footer>
      </div>
    </DesktopSurface>
  )
}
