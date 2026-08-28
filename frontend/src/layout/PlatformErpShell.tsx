import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { PrefsBar } from '../components/PrefsBar'
import { ClockTray } from '../desktop/ClockTray'
import { NotesTray } from '../desktop/NotesTray'
import { NotifyTray } from '../desktop/NotifyTray'
import { usePlatformApps } from '../desktop/usePlatformApps'
import { useI18n } from '../i18n'
import { usePlatformAccess } from '../platform/access'
import { SupportTray } from '../platform/SupportTray'
import { ErpAccountMenu } from './ErpAccountMenu'
import { ErpShell } from './ErpShell'
import { PlatformAppView } from './PlatformAppView'

export default function PlatformErpShell() {
  const { t } = useI18n()
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const { apps, titles } = usePlatformApps()
  const { roleName } = usePlatformAccess()
  const roleLabel = roleName || t('roleSupport')

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <ErpShell
      apps={apps}
      titles={titles}
      eyebrow={t('platformEyebrow')}
      renderApp={(id) => <PlatformAppView appId={id} />}
      sidebarTools={
        <>
          <NotesTray />
          <ClockTray navCompact />
          <NotifyTray />
          <SupportTray />
        </>
      }
      navbarExtras={
        <>
          <NotesTray />
          <ClockTray navCompact />
          <NotifyTray />
          <SupportTray />
        </>
      }
      accountMenu={
        <ErpAccountMenu name={me?.user.name ?? ''} avatar={me?.user.avatar} subtitle={me?.user.email}>
          <div className="sm:hidden border-b border-line pb-3">
            <PrefsBar compact />
          </div>

          <div className="erp-account-head">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-fg">{me?.user.name}</div>
              <div className="mt-0.5 truncate text-xs text-muted">{me?.user.email}</div>
              <div className="mt-1 text-[11px] text-mint">{roleLabel}</div>
            </div>
          </div>

          <button type="button" className="btn-ghost mt-3 w-full" onClick={() => void handleLogout()}>
            {t('logout')}
          </button>
        </ErpAccountMenu>
      }
    />
  )
}
